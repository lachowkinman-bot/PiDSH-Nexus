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
    let candidates = [
        node_root.join("node_modules/@deepseek-ai/dsh/lib/bin.js"),
        root.join(".dsh-home/profiles/web/node_modules/@deepseek-ai/dsh/lib/bin.js"),
    ];
    for dsh in candidates {
        if dsh.is_file() {
            return Ok((node, dsh));
        }
    }
    Err("缺少 DSH 引擎；runtime-web.zip 未解压且便携 Node 未安装引擎".to_string())
}

fn ensure_runtime(root: &Path) -> Result<(), String> {
    let profile = root.join(".dsh-home/profiles/web/package.json");
    let build_file = root.join("offline-3.0/runtime-web.build-id");
    let marker_file = root.join(".dsh-home/profiles/web/runtime-build.json");
    let expected = fs::read_to_string(&build_file).ok().map(|value| value.trim().to_string());
    let installed = fs::read_to_string(&marker_file).ok()
        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
        .and_then(|value| value.get("build_id").and_then(|item| item.as_str()).map(str::to_string));
    if profile.is_file() {
        if expected.is_none() || expected == installed {
            return Ok(());
        }
    }
    let archive = root.join("offline-3.0/runtime-web.zip");
    if !archive.is_file() {
        if profile.is_file() {
            return Ok(());
        }
        return Err(format!("缺少离线 runtime：{}", archive.display()));
    }
    let dsh_home = root.join(".dsh-home");
    fs::create_dir_all(&dsh_home).map_err(|e| format!("无法创建 DSH_HOME：{e}"))?;
    let mut command = Command::new("tar.exe");
    command
        .args(["-xf"])
        .arg(&archive)
        .arg("-C")
        .arg(&dsh_home);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let status = command
        .status()
        .map_err(|e| format!("无法解压离线 runtime：{e}"))?;
    if !status.success() {
        return Err(format!("离线 runtime 解压失败：exit={status}"));
    }
    if !profile.is_file() {
        return Err("离线 runtime 解压后缺少 profiles/web/package.json".to_string());
    }
    Ok(())
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
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("PiDSH Nexus · 全能工作台")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1100.0, 700.0)
        .resizable(true)
        .center()
        .visible(true)
        .focused(true)
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
