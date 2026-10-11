#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::fs::File;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct ServerState {
    child: Mutex<Option<Child>>,
}

fn app_root() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "无法定位项目根目录".to_string());
    }
    let exe = std::env::current_exe().map_err(|e| format!("无法定位可执行文件：{e}"))?;
    for candidate in exe.ancestors().filter_map(Path::parent) {
        if candidate.join("workbench-ui-plugin").is_dir() && candidate.join("offline/node").is_dir() {
            return Ok(candidate.to_path_buf());
        }
    }
    exe.parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法定位应用安装目录".to_string())
}

fn node_and_dsh(root: &Path) -> Result<(PathBuf, PathBuf), String> {
    let node_root = root.join("offline/node/node-v24.21.0-win-x64");
    let node = node_root.join("node.exe");
    if !node.is_file() {
        return Err(format!("缺少便携 Node：{}", node.display()));
    }
    // 2026-10-11（0.2 升级）：profile 内引擎优先——机器上可能残留旧版全局引擎（如 0.1.7），
    // 若先命中全局路径，会用旧引擎引导新 profile（实测 61 个插件 pending、启动失败）。
    let candidates = [
        root.join(".dsh-home/profiles/web/node_modules/@deepseek-ai/dsh/lib/bin.js"),
        node_root.join("node_modules/@deepseek-ai/dsh/lib/bin.js"),
    ];
    for dsh in candidates {
        if dsh.is_file() {
            return Ok((node, dsh));
        }
    }
    Err("缺少 DSH 引擎；runtime-web.zip 未解压且便携 Node 未安装引擎".to_string())
}

fn read_build_id(marker: &Path) -> Option<String> {
    fs::read_to_string(marker)
        .ok()
        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
        .and_then(|value| {
            value
                .get("build_id")
                .and_then(|item| item.as_str())
                .map(str::to_string)
        })
}

/// UTC 时间戳（yyyyMMdd-HHmmss），仅用于把旧 profile 备份成唯一目录名。
fn utc_stamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);
    let days = (secs / 86_400) as i64;
    let rest = secs % 86_400;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    format!(
        "{year:04}{m:02}{d:02}-{:02}{:02}{:02}",
        rest / 3600,
        (rest % 3600) / 60,
        rest % 60
    )
}

/// 把出厂 patch（预览版说明预置确认）合并进用户已有 patch：
/// - 用户没有该条目：追加出厂条目；
/// - 用户已有旧版本值：按出厂值做行级 upsert（上游通知版本升级后旧值会让弹窗重复出现）。
fn merge_preset_patch(live: &Path, preset_text: &str) -> Result<(), String> {
    let existing = fs::read_to_string(live).unwrap_or_default();
    let preset_line = preset_text
        .lines()
        .find(|line| line.trim_start().starts_with("welcomeNoticeVersion:"))
        .map(|line| line.trim().to_string());
    if existing.contains("welcomeNoticeVersion") {
        if let Some(line) = preset_line {
            let mut changed = false;
            let updated: Vec<String> = existing
                .lines()
                .map(|current| {
                    if current.contains("welcomeNoticeVersion") {
                        changed = true;
                        line.clone()
                    } else {
                        current.to_string()
                    }
                })
                .collect();
            if changed {
                let mut text = updated.join("\n");
                if existing.ends_with('\n') {
                    text.push('\n');
                }
                fs::write(live, text).map_err(|e| format!("无法写入 profile patch：{e}"))?;
            }
        }
        return Ok(());
    }
    let merged = if existing.trim().is_empty() {
        preset_text.to_string()
    } else {
        format!("{}\n{}", existing.trim_end(), preset_text)
    };
    fs::write(live, merged).map_err(|e| format!("无法写入 profile patch：{e}"))
}

/// 合并出厂版本豁免表（compatibility.json）：并集，保留用户已有条目。
fn merge_compatibility(live: &Path, preset_text: &str) -> Result<(), String> {
    let mut merged: serde_json::Map<String, serde_json::Value> = fs::read_to_string(live)
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let preset: serde_json::Value = serde_json::from_str(preset_text)
        .map_err(|e| format!("出厂豁免表非法：{e}"))?;
    if let Some(entries) = preset.as_object() {
        for (key, value) in entries {
            match merged.get_mut(key) {
                None => {
                    merged.insert(key.clone(), value.clone());
                }
                Some(existing) => {
                    // 豁免表做数组并集：用户已有条目保留，出厂新增的 dsh 版本并入（0.2 升级需要）
                    if let (Some(existing_values), Some(preset_values)) =
                        (existing.as_array().cloned(), value.as_array())
                    {
                        let mut out = existing_values;
                        for item in preset_values {
                            if !out.contains(item) {
                                out.push(item.clone());
                            }
                        }
                        *existing = serde_json::Value::Array(out);
                    }
                }
            }
        }
    }
    let text = serde_json::to_string_pretty(&serde_json::Value::Object(merged))
        .map_err(|e| format!("序列化豁免表失败：{e}"))?;
    fs::write(live, text).map_err(|e| format!("无法写入豁免表：{e}"))
}

/// 用随包 runtime 刷新 profile：备份旧 profile → 解压到暂存 → 原子换入 → 合并 patch。
/// 任一步失败都会把旧 profile 还原回去，绝不留下半损状态。
fn refresh_runtime(root: &Path, archive: &Path, expected: &str) -> Result<(), String> {
    let dsh_home = root.join(".dsh-home");
    fs::create_dir_all(&dsh_home).map_err(|e| format!("无法创建 DSH_HOME：{e}"))?;
    let profile = dsh_home.join("profiles/web");
    let stage = dsh_home.join(".runtime-stage");
    let _ = fs::remove_dir_all(&stage);
    fs::create_dir_all(&stage).map_err(|e| format!("无法创建暂存目录：{e}"))?;

    let mut command = Command::new("tar.exe");
    command.args(["-xf"]).arg(archive).arg("-C").arg(&stage);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let status = command
        .status()
        .map_err(|e| format!("无法解压离线 runtime：{e}"))?;
    if !status.success() {
        let _ = fs::remove_dir_all(&stage);
        return Err(format!("离线 runtime 解压失败：exit={status}"));
    }
    let staged_profile = stage.join("profiles/web");
    if !staged_profile.join("package.json").is_file()
        || !staged_profile
            .join("node_modules/@deepseek-ai/dsh/lib/bin.js")
            .is_file()
    {
        let _ = fs::remove_dir_all(&stage);
        return Err("离线 runtime 内容不完整（缺 profiles/web/package.json 或 DSH 引擎）".to_string());
    }

    let backup = root.join(format!(".dsh-home.pre-r9-{}", utc_stamp()));
    let preset_text = fs::read_to_string(staged_profile.join("cordis.patch.yml")).unwrap_or_default();
    let compat_text =
        fs::read_to_string(staged_profile.join("compatibility.json")).unwrap_or_default();
    let had_profile = profile.is_dir();
    if had_profile {
        fs::rename(&profile, &backup).map_err(|e| format!("无法备份旧 profile：{e}"))?;
    }
    let install = (|| -> Result<(), String> {
        if let Some(parent) = profile.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建 profiles 目录：{e}"))?;
        }
        fs::rename(&staged_profile, &profile).map_err(|e| format!("无法换入新 profile：{e}"))?;
        let live_patch = profile.join("cordis.patch.yml");
        if had_profile {
            let old_patch = backup.join("cordis.patch.yml");
            if old_patch.is_file() {
                fs::copy(&old_patch, &live_patch)
                    .map_err(|e| format!("无法沿用用户 patch：{e}"))?;
            }
        }
        merge_preset_patch(&live_patch, &preset_text)?;
        if !compat_text.trim().is_empty() {
            merge_compatibility(&profile.join("compatibility.json"), &compat_text)?;
        }
        let marker = serde_json::json!({ "build_id": expected, "refreshed_at": utc_stamp() });
        fs::write(profile.join("runtime-build.json"), marker.to_string())
            .map_err(|e| format!("无法写入 runtime 标记：{e}"))?;
        Ok(())
    })();
    if let Err(error) = install {
        let _ = fs::remove_dir_all(&profile);
        if had_profile {
            let _ = fs::rename(&backup, &profile);
        }
        let _ = fs::remove_dir_all(&stage);
        return Err(format!("runtime 刷新失败（已回滚到旧 profile）：{error}"));
    }
    let _ = fs::remove_dir_all(&stage);
    Ok(())
}

/// 三态判定：①无 build-id → 阻断（安装包不完整）；②已就绪 → 跳过；③缺失/不一致 → 强制刷新。
fn ensure_runtime(root: &Path) -> Result<(), String> {
    let build_file = root.join("offline-3.0/runtime-web.build-id");
    let expected = fs::read_to_string(&build_file)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                "缺少 runtime 构建标识（安装包不完整，请用最新安装包覆盖安装）：{}",
                build_file.display()
            )
        })?;
    let profile = root.join(".dsh-home/profiles/web");
    let engine = profile.join("node_modules/@deepseek-ai/dsh/lib/bin.js");
    let installed = read_build_id(&profile.join("runtime-build.json"));
    if engine.is_file() && installed.as_deref() == Some(expected.as_str()) {
        return Ok(());
    }
    let archive = root.join("offline-3.0/runtime-web.zip");
    if !archive.is_file() {
        return Err(format!("缺少离线 runtime：{}", archive.display()));
    }
    refresh_runtime(root, &archive, &expected)
}

fn http_ready(port: u16, path: &str) -> bool {
    let Ok(mut stream) = TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse().expect("loopback address"),
        Duration::from_millis(700),
    ) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1000)));
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    response
        .lines()
        .next()
        .map(|line| line.contains(" 200 "))
        .unwrap_or(false)
}

fn available_port() -> Result<u16, String> {
    for port in 3080..=3090 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    Err("3080-3090 均不可用".to_string())
}

fn spawn_server(root: &Path, port: u16) -> Result<Child, String> {
    ensure_runtime(root)?;
    let (node, dsh) = node_and_dsh(root)?;
    let dsh_home = root.join(".dsh-home");
    fs::create_dir_all(&dsh_home).map_err(|e| format!("无法创建 DSH_HOME：{e}"))?;
    let logs = dsh_home.join("logs");
    fs::create_dir_all(&logs).map_err(|e| format!("无法创建日志目录：{e}"))?;
    let stdout = File::create(logs.join("tauri-web.log")).map_err(|e| format!("无法创建启动日志：{e}"))?;
    let stderr = File::create(logs.join("tauri-web.err.log")).map_err(|e| format!("无法创建错误日志：{e}"))?;
    let mut command = Command::new(node);
    command
        .arg(dsh)
        .args(["--profile", "web", "--no-open", "--port"])
        .arg(port.to_string())
        .current_dir(root)
        .env("DSH_HOME", &dsh_home)
        .env("UNIVERSAL_WORKBENCH_ROOT", root)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
        .spawn()
        .map_err(|e| format!("无法启动 DSH：{e}"))
}

fn shell_url_from_log(root: &Path, port: u16) -> Option<String> {
    let log = root.join(".dsh-home/logs/tauri-web.log");
    let text = fs::read_to_string(log).ok()?;
    for line in text.lines().rev() {
        let Some(index) = line.find("dsh web: ") else { continue };
        let candidate = line[index + "dsh web: ".len()..].split_whitespace().next()?;
        if candidate.starts_with(&format!("http://127.0.0.1:{port}/")) && candidate.contains("token=") {
            return Some(candidate.to_string());
        }
    }
    None
}

fn wait_shell_url(root: &Path, port: u16, timeout: Duration) -> Option<String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if let Some(url) = shell_url_from_log(root, port) {
            return Some(url);
        }
        std::thread::sleep(Duration::from_millis(350));
    }
    None
}

fn wait_ready(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if http_ready(port, "/workbench/api/app-page") {
            return true;
        }
        std::thread::sleep(Duration::from_millis(400));
    }
    false
}

fn start_workbench(app: &tauri::App) -> Result<(), String> {
    let root = app_root()?;
    let port = available_port()?;
    let mut owned_child = Some(spawn_server(&root, port)?);
    let shell_url = match wait_shell_url(&root, port, Duration::from_secs(120)) {
        Some(url) => url,
        None => {
            if let Some(mut child) = owned_child.take() {
                let _ = child.kill();
            }
            return Err(format!("DSH 主壳在 120 秒内未就绪，端口 {port}"));
        }
    };
    if !wait_ready(port, Duration::from_secs(30)) {
        if let Some(mut child) = owned_child.take() {
            let _ = child.kill();
        }
        return Err(format!("DSH 工作台接口未就绪，端口 {port}"));
    }
    if let Some(state) = app.try_state::<ServerState>() {
        *state.child.lock().expect("server mutex poisoned") = owned_child.take();
    }
    let url = shell_url
        .parse()
        .map_err(|e| format!("工作台 URL 非法：{e}"))?;
    // dev9：WebView2 默认丢弃 window.open（wry 无处理器时 SetHandled(true)）→ 独立驾驶舱点不动。
    // 接管新窗口请求：在应用内新开一个窗口承载请求的 URL（独立驾驶舱 / 草稿预览等）。
    let standalone_counter = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(1));
    let app_handle = app.handle().clone();
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("PiDSH Nexus · 全能工作台")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1100.0, 700.0)
        .resizable(true)
        .center()
        .visible(true)
        .focused(true)
        .on_new_window(move |url, features| {
            let label = format!(
                "standalone-{}",
                standalone_counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
            );
            let builder = WebviewWindowBuilder::new(&app_handle, &label, WebviewUrl::External(url.clone()))
                .title("PiDSH Nexus · 独立驾驶舱")
                .inner_size(1280.0, 840.0)
                .min_inner_size(1000.0, 640.0)
                .resizable(true)
                .window_features(features);
            match builder.build() {
                Ok(window) => {
                    eprintln!("[universal-workbench] 独立驾驶舱窗口已创建：{url}");
                    tauri::webview::NewWindowResponse::Create { window }
                }
                Err(error) => {
                    eprintln!("[universal-workbench] 独立驾驶舱窗口创建失败：{error}");
                    tauri::webview::NewWindowResponse::Deny
                }
            }
        })
        .build()
        .map_err(|e| format!("无法创建原生窗口：{e}"))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(ServerState {
            child: Mutex::new(None),
        })
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            if let Err(error) = start_workbench(app) {
                eprintln!("[universal-workbench] {error}");
                return Err(error.into());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                if let Some(state) = window.app_handle().try_state::<ServerState>() {
                    if let Some(mut child) = state.child.lock().expect("server mutex poisoned").take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Universal Workbench 启动失败");
}
