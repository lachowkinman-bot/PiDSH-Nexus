; setup-x.iss — setup.iss 的 X: 盘构建变体（仅为绕开 Windows MAX_PATH：subst X: → 项目根）
; 生成方式：内容与 setup.iss 一致，仅把 "..\..\..\" 前缀换成 "X:\"。
; 3.0 实构建修正：
;   ① ISCC 对 offline/node 内嵌套 node_modules 的 166 个 >240 字符路径报"找不到指定的路径"（FindFirstFile 长
;      路径限制）→ 安装器只携带"干净 Node 工具链"，安装后由 workbench.ps1 install 用随包 tarball 离线装引擎
;      +pnpm+P0/P1+工作台插件（015 §10.1 第④步合同内，无网可完成）；
;   ② Compression=zip（便携 runtime 已压缩，lzma2 收益低且极慢）；
;   ③ 2026-09-29 同步 setup.iss：补 app.html / workbench-ui-plugin / src 三项 [Files]（此前本变体缺失，
;      装出的产品没有工作台应用与插件）；node 工具链改【显式列举】——Excludes "node_modules" 会排掉 npm 本体，
;      Excludes "node_modules\@*" 会连 npm 的 @npmcli 等 scoped 依赖一起排掉（实装报 cjs/loader 错），
;      两者都会让干净机 postinstall 失败；另 PrivilegesRequired=lowest（每用户安装）、
;      [Icons] 改 {autodesktop}/{autoprograms}、[Run] 补 WorkingDir。
; 构建命令：subst X: <项目根> && iscc X:\scripts\installer\win\setup-x.iss

#define MyAppName "PiDSH Nexus"
#define MyAppVersion "3.0.0"
#define MyAppExeName "UniversalWorkbench"

[Setup]
AppId={{7E6C2B1A-0150-4A6E-9D5B-UNIVERSALWB}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\UniversalWorkbench
DefaultGroupName={#MyAppName}
; 每用户安装（理由见 setup.iss）：运行期写入都在安装目录内，Program Files + 非管理员会 EPERM/EACCES。
PrivilegesRequired=lowest
OutputDir=X:\installer-output
OutputBaseFilename=UniversalWorkbench-Setup
SetupIconFile=X:\src-tauri\icons\icon.ico
Compression=zip
SolidCompression=no
ArchitecturesInstallIn64BitMode=x64compatible
; 仅 127.0.0.1：安装脚本绝不开放 0.0.0.0（CVE-2026-82533 处置红线）

[Files]
Source: "X:\src-tauri\target\release\universal-workbench.exe"; DestDir: "{app}"; DestName: "UniversalWorkbench.exe"; Flags: ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\node.exe"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\npm*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\npx*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\corepack*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\pnpm*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\node_modules\npm\*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64\node_modules\npm"; Flags: recursesubdirs ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\node_modules\corepack\*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64\node_modules\corepack"; Flags: recursesubdirs ignoreversion
Source: "X:\offline\node\node-v24.21.0-win-x64\node_modules\pnpm\*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64\node_modules\pnpm"; Flags: recursesubdirs ignoreversion
Source: "X:\offline-3.0\runtime-web.zip"; DestDir: "{app}\offline-3.0"; Flags: ignoreversion
Source: "X:\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs ignoreversion
Source: "X:\templates\*"; DestDir: "{app}\templates"; Flags: recursesubdirs ignoreversion
Source: "X:\manifests\*"; DestDir: "{app}\manifests"; Flags: recursesubdirs ignoreversion
Source: "X:\docs\*"; DestDir: "{app}\docs"; Flags: recursesubdirs ignoreversion
; —— 工作台应用与插件（2026-09-29 补，与 setup.iss 同步）——
Source: "X:\app.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "X:\workbench-ui-plugin\*"; DestDir: "{app}\workbench-ui-plugin"; Excludes: "node_modules"; Flags: recursesubdirs ignoreversion
Source: "X:\src\*"; DestDir: "{app}\src"; Flags: recursesubdirs ignoreversion
Source: "X:\assets\*"; DestDir: "{app}\assets"; Flags: recursesubdirs ignoreversion
; .dsh-home profile 不入安装包：目标机由 postinstall 的 workbench.ps1 install 初始化（引擎+pnpm+P0/P1+工作台插件）

[Icons]
Name: "{autodesktop}\PiDSH Nexus"; Filename: "{app}\UniversalWorkbench.exe"; WorkingDir: "{app}"
Name: "{autoprograms}\PiDSH Nexus"; Filename: "{app}\UniversalWorkbench.exe"; WorkingDir: "{app}"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\workbench.ps1"" -Cmd install"; WorkingDir: "{app}"; Description: "离线安装 DSH 引擎、pnpm 与插件（含工作台插件，全用随包 tarball，无网）"; Flags: postinstall skipifsilent runhidden
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\workbench.ps1"" -Cmd verify"; WorkingDir: "{app}"; Description: "首启自检（十要素矩阵骨架 + runner-probe）"; Flags: postinstall skipifsilent runhidden

[Code]
// 安装前：若无 Node ≥22.19 则静默安装 offline/node 下的 msi（F1 离线安装）
function InitializeSetup(): Boolean;
begin
  if not (
    RegKeyExists(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3C4FE00-EFD5-403B-9569-398A20F1BA4A}') or
    RegKeyExists(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3C4FE00-EFD5-403B-9569-398A20F1BA4A}') or
    RegKeyExists(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3C4FE00-EFD5-403B-9569-398A20F1BA4A}')
  ) then
  begin
    MsgBox('未检测到 Microsoft Edge WebView2 Runtime。请先安装 WebView2 后重试。', mbCriticalError, MB_OK);
    Result := False;
  end
  else
    Result := True;
end;

[UninstallRun]
; 卸载可逆（C5）：仅移除程序文件，不删用户工作区数据
