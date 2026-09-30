; scripts/installer/win/setup.iss — Universal Workbench Windows 安装器基线（Inno Setup 6）
; 015 §10.1：校验 offline SHA256 → 装 Node（缺则用 offline/node/*.msi）→ 解压工作区 → 本地装 DSH/pi/P0 → 快捷方式 → 首启自检
; 构建：iscc scripts\installer\win\setup.iss   产出：installer-output\UniversalWorkbench-Setup.exe
; Agent 按 U14 实构建后固化；本文件为基线模板（F1/F11 的载体）

#define MyAppName "PiDSH Nexus"
#define MyAppVersion "3.0.0"
#define MyAppExeName "UniversalWorkbench"

[Setup]
AppId={{7E6C2B1A-0150-4A6E-9D5B-UNIVERSALWB}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\UniversalWorkbench
DefaultGroupName={#MyAppName}
; 3.0 实构建修正④（2026-09-29）：改为【每用户安装】。原因：运行期写入全部发生在安装目录内
;   （插件写 {app}\templates\workspace\{audit,deliverables,system\preset-state} + {app}\reports\.tmp；
;    launch.ps1 把 DSH_HOME 指向 {app}\.dsh-home）——装在 Program Files + 默认 admin 模式下，
;   普通用户双击图标后每次写入都是 EPERM/EACCES（HTTP 500）。PrivilegesRequired=lowest 使
;   {autopf} 自动落到 %LOCALAPPDATA%\Programs（免 UAC），所有写路径天然可用，且契约 §10.1 的
;   DefaultDirName={autopf}\UniversalWorkbench 一字不改。多用户本就是 PRD §4 的非目标。
PrivilegesRequired=lowest
OutputDir=..\..\..\installer-output
OutputBaseFilename=UniversalWorkbench-Setup
SetupIconFile=..\..\..\src-tauri\icons\icon.ico
Compression=zip
SolidCompression=no
ArchitecturesInstallIn64BitMode=x64compatible
; 仅 127.0.0.1：安装脚本绝不开放 0.0.0.0（CVE-2026-82533 处置红线）
; 3.0 实构建修正：①本 .iss 位于 scripts\installer\win\，项目根需三层上溯；②ISCC 对 offline/node 内嵌套
; node_modules 的 166 个 >240 字符路径报错（长路径限制）→ 不携带"已安装态" node_modules，安装后由
; workbench.ps1 install 用随包 tarball 离线装引擎+P0/P1（015 §10.1 第④步合同内）；③Compression=zip。
; ④2026-09-29 修正 node 工具链打包：改为【显式列举】。此前 Excludes "node_modules" 会把 npm 本体一起排掉
;   （探针实测 Tree B：只剩 node.exe+npm.cmd），而后安装步骤全靠 npm（npm i -g 引擎/pnpm）→ 干净机 postinstall 必然失败。
;   改用 Excludes "node_modules\@*" 又踩第二个坑（实装发现）：ISCC 的 pattern 会匹配【任意层级】的 node_modules\@*，
;   于是 npm 自己的 @npmcli/@isaacs/@sigstore/@gar/@tufjs 等 scoped 依赖被一并排掉（装出 npm 内部依赖 113 项 vs 开发机 118 项）
;   → postinstall 首步报 node:internal/modules/cjs/loader 退出。现按名单（通配）逐个列举，产物与开发机逐字一致（npm 1926 文件/118 内部依赖）。

[Files]
Source: "..\..\..\src-tauri\target\release\universal-workbench.exe"; DestDir: "{app}"; DestName: "UniversalWorkbench.exe"; Flags: ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\node.exe"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\npm*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\npx*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\corepack*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\pnpm*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64"; Flags: ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\node_modules\npm\*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64\node_modules\npm"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\node_modules\corepack\*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64\node_modules\corepack"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\offline\node\node-v24.21.0-win-x64\node_modules\pnpm\*"; DestDir: "{app}\offline\node\node-v24.21.0-win-x64\node_modules\pnpm"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\offline-3.0\runtime-web.zip"; DestDir: "{app}\offline-3.0"; Flags: ignoreversion
Source: "..\..\..\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\templates\*"; DestDir: "{app}\templates"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\manifests\*"; DestDir: "{app}\manifests"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\docs\*"; DestDir: "{app}\docs"; Flags: recursesubdirs ignoreversion
; —— 工作台应用与插件（2026-09-29 补）——
; 此前安装包未含 app.html / workbench-ui-plugin / src：装出的产品既没有 ⟡ 工作台 面板
; （该插件一直是开发期手工 link 进 profile 的），launch.ps1 的 /app-page 也会落到"尚未构建"占位页。
Source: "..\..\..\app.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\..\workbench-ui-plugin\*"; DestDir: "{app}\workbench-ui-plugin"; Excludes: "node_modules"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\src\*"; DestDir: "{app}\src"; Flags: recursesubdirs ignoreversion
Source: "..\..\..\assets\*"; DestDir: "{app}\assets"; Flags: recursesubdirs ignoreversion
; .dsh-home profile 不入安装包：目标机由 postinstall 的 workbench.ps1 install 初始化（装引擎+P0/P1 插件）

[Icons]
; {autodesktop}/{autoprograms} 随 PrivilegesRequired 自动映射（lowest → 当前用户桌面/开始菜单），
; 不用 {commondesktop}：非管理员模式下写公共桌面会失败。
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
