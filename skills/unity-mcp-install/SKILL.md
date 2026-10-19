---
name: unity-mcp-install
description: 在当前工作区的 Unity 项目里安装 Unity-MCP 插件与其 MCP Server（GameDev-MCP-Server）：先查 unity-mcp-cli（缺则 npm install -g unity-mcp-cli，版本要与插件对齐），再对工作区内探测到的 Unity 项目执行 unity-mcp-cli install-plugin --with-server；下载失败时用本机代理（如 Clash）或离线 zip 兜底。含项目定位、已装判定与验证。
whenToUse: 用户要求「在工作区的 Unity 项目里安装 / 补装 Unity-MCP 插件（AI Game Developer）」时；或 unity-mcp-check 报「Unity 项目里没有 MCP 包」时。
---

# 安装 Unity-MCP 插件（工作区内的 Unity 项目）

把 Unity 侧的 MCP 插件（包名 `com.ivanmurzak.unity.mcp`，即 AI Game Developer）装进**当前工作区**里的 Unity 项目。DSH 侧的桥接插件 `dsh-unity-mcp-bridge` 是另一半，装完用 `/unity-mcp-check` 验通。

官方文档：<https://ai-game.dev/engines/unity>

## 0. 范围与前置

- 本技能只碰**当前工作区内**的项目文件，不修改工作区外的任何东西。
- 安装这一步不需要 Unity 编辑器在运行；但包要等 Unity 打开时才真正解析进 `Library/PackageCache`。
- 全部命令在 PowerShell 下给出（DSH 的 shell 就是 pwsh）。

## 1. 检查 unity-mcp-cli

```powershell
$cli = Get-Command unity-mcp-cli -ErrorAction SilentlyContinue
if ($cli) { unity-mcp-cli --version } else { 'NOT INSTALLED' }
```

- 打印出版本（如 `v1.2.0`）→ 先做下面的**版本对齐**检查，再跳到第 3 步。
- 打印 `NOT INSTALLED` → 走第 2 步。
- 命令在但执行报错，或怀疑「装了但不在 PATH」：`npm ls -g unity-mcp-cli`（全局 bin 目录一般是 `%APPDATA%\npm`）。

**版本对齐（必查，别只看「能不能跑」）**：CLI、Unity 插件、MCP Server 三者版本是 lockstep 的 —— 实测 `unity-mcp-cli 1.2.0` ↔ 插件 `com.ivanmurzak.unity.mcp@1.2.0` ↔ Server `9.2.11`（CLI 的 `dist/utils/server-version.js` 里 `DEFAULT_SERVER_VERSION` 就是插件 `McpServerManager.ServerVersion` 的镜像）。老 CLI 的 **AI agent 列表会缺项**：实测 0.91.0 与 1.2.0 的 `setup-mcp --list` 都只有 14 个 agent，**不含 `kilo-code`**；而 Server 自己的 `configure --help` 有 16 个（含 `kilo-code`、`zoo-code`、`other-custom`）。所以 `/unity-mcp-check` 要配 Kilo Code 时，CLI 太旧会直接 `Unknown agent`。

```powershell
npm view unity-mcp-cli version          # registry 上的最新版
Select-String -Path (Join-Path $proj 'Packages\manifest.json') -Pattern 'com\.ivanmurzak\.unity\.mcp'
```

CLI 明显落后于项目里的插件版本 → 先 `npm install -g unity-mcp-cli` 再继续。

## 2. 安装 unity-mcp-cli（仅当第 1 步缺失）

```powershell
npm install -g unity-mcp-cli
unity-mcp-cli --version    # 复验
```

- 需要 Node.js 与 npm（`node -v`、`npm -v`）。缺 npm 就先解决 npm，别换别的包管理器猜。
- 已装但偏旧：`unity-mcp-cli update`。
- 装完仍找不到命令：把 `%APPDATA%\npm` 加进 PATH，或直接用绝对路径 `& "$env:APPDATA\npm\unity-mcp-cli.cmd" --version`。

## 3. 在工作区里定位 Unity 项目

判据用 **`ProjectSettings\ProjectVersion.txt`**（最可靠，比只看 `Assets/` 稳）：

```powershell
$ws = (Get-Location).Path
$projects = Get-ChildItem $ws -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'ProjectSettings\ProjectVersion.txt') } |
  Where-Object { $_.FullName -notmatch '\\(Library|Temp|obj|node_modules|\.git)\\' } |
  Select-Object -ExpandProperty FullName -Unique
$projects
```

- **恰好 1 个** → `$proj = $projects[0]`，继续。
- **0 个** → 停下来问用户：是指定一个已有项目路径，还是要新建（`unity-mcp-cli create-project <path>`）。不要擅自创建。
- **多个** → 列出路径让用户选，不要替他挑。

## 4. 判断插件是否已安装

```powershell
$manifest = Join-Path $proj 'Packages\manifest.json'
Select-String -Path $manifest -Pattern 'com\.ivanmurzak\.unity\.mcp' -Quiet
Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp*' -ErrorAction SilentlyContinue
```

- manifest 里已有该依赖 → 已装。`install-plugin` 是幂等的，重跑可用于升级或补齐。
- 既无依赖、也无 `PackageCache` 目录 → 未装。

## 5. 安装（插件 + MCP Server 一起装）

```powershell
unity-mcp-cli install-plugin $proj --with-server
```

**默认就带 `--with-server`**：它把与本机 RID 匹配的 `GameDev-MCP-Server` 二进制装进 CLI 的**托管目录** `~\.ai-game-dev\server\<rid>\`（含 `version` 标记文件）。`/unity-mcp-check` 里的 `configure --agent <id>` 是靠这个二进制跑起来的（`proxyConfigure` 直接执行 `<托管 exe> configure --agent <id> [--url …]`，cwd = 项目根），缺它就只能退回项目自带的 `Library\mcp-server\<rid>\gamedev-mcp-server.exe`。

| 开关 | 用途 |
|---|---|
| `--with-server` | 同时下载 GameDev-MCP-Server 二进制（CLI 1.2.0 默认 **9.2.11**，与插件 lockstep） |
| `--server-version <version>` | 指定要下载的 Server 版本（默认 9.2.11） |
| `--server-source <path-or-url>` | 离线兜底：从本地 zip 或 URL 装 Server（**跳过 SHA256SUMS 校验**，自己核对哈希） |
| `--plugin-version <version>` | 指定插件版本（默认 latest；离线/代理场景下显式指定可省掉一次 OpenUPM 解析） |
| `--enroll <code>` / `--enroll-stdin` | 兑换云端 enrollment code（用自建本地端点时不需要） |
| `--path <path>` | 等价于位置参数 |

命令的原始输出（含报错）要照实报告，不要吞掉或改写。

### 5.1 网络失败：用本机代理（Clash 这类）重试

实测症状：OpenUPM 能通、GitHub 不通 ——

```
Resolving latest plugin version...
SUCCESS: Resolved plugin version: 1.2.0
Downloading GameDev-MCP-Server binary...
ERROR: Server download failed
ERROR: fetch failed
```

按这个顺序处理，**不要**直接判定「装不上」：

1. **取代理端口**（别猜 7890）：读系统代理，再连通性验证。

   ```powershell
   (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings') |
     Select-Object ProxyEnable,ProxyServer          # 实测：1 / 127.0.0.1:7897
   Test-NetConnection -ComputerName 127.0.0.1 -Port 7897 -InformationLevel Quiet
   ```

2. **关键坑：Node 24 的全局 `fetch` 默认不读 `HTTP_PROXY`/`HTTPS_PROXY`** —— 只设代理变量等于没设（实测：设了照样 `fetch failed`）。必须同时设 `NODE_USE_ENV_PROXY=1`。

3. **只代理 GitHub**：`NO_PROXY` 要放行 OpenUPM 与 npm，否则连插件版本解析都会一起挂（实测报 `Failed to resolve the latest version of com.ivanmurzak.unity.mcp from OpenUPM`）。

   ```powershell
   $px = 'http://127.0.0.1:7897'
   $env:HTTP_PROXY = $px; $env:HTTPS_PROXY = $px; $env:ALL_PROXY = $px
   $env:NO_PROXY = 'localhost,127.0.0.1,::1,.openupm.com,registry.npmjs.org'
   $env:NODE_USE_ENV_PROXY = '1'
   unity-mcp-cli install-plugin $proj --with-server --plugin-version 1.2.0
   ```

4. **代理也慢/被掐断**（实测 `curl: (56) schannel: server closed abruptly`，均速 ~19 KB/s）：用可续传的手动下载 + 离线安装。URL 模板与校验：

   ```powershell
   # rid 例如 win-x64 / win-x86 / win-arm64 / osx-arm64 / linux-x64
   $ver = '9.2.11'; $rid = 'win-x64'
   $base = "https://github.com/IvanMurzak/GameDev-MCP-Server/releases/download/v$ver"
   curl.exe -sL -C - --retry 5 --retry-delay 3 -x http://127.0.0.1:7897 -o "gamedev-mcp-server-$rid.zip" "$base/gamedev-mcp-server-$rid.zip"
   curl.exe -sL -x http://127.0.0.1:7897 -o SHA256SUMS "$base/SHA256SUMS"
   (Get-FileHash -Algorithm SHA256 "gamedev-mcp-server-$rid.zip").Hash.ToLower()   # 必须等于 SHA256SUMS 里那一行
   unity-mcp-cli install-plugin $proj --with-server --plugin-version 1.2.0 --server-source "gamedev-mcp-server-$rid.zip"
   ```

   `--server-source` 会**跳过** CLI 的 fail-closed 校验门，所以上面那步哈希比对不能省（实测 9.2.11 的 `gamedev-mcp-server-win-x64.zip` = 45 503 855 B，SHA256 `04854973d7210b5e73860854bda279e02a126730fea6be4cfeafde10810ee019`）。

5. **项目里已有可用的 Server 二进制**（Unity 自己下过）时，可按 CLI 的托管目录布局直接补齐，省掉整轮下载 —— 前提是版本与 CLI 默认值一致，且核对过 `FileVersion`：

   ```powershell
   Get-ChildItem (Join-Path $proj 'Library\mcp-server\win-x64') |
     Select-Object Name,Length,@{n='Ver';e={$_.VersionInfo.FileVersion}}   # 期望 9.2.11.x
   $dst = "$env:USERPROFILE\.ai-game-dev\server\win-x64"
   New-Item -ItemType Directory -Path $dst -Force | Out-Null
   Copy-Item "$proj\Library\mcp-server\win-x64\*" -Destination $dst -Recurse -Force -Exclude 'logs'
   Set-Content -Path "$dst\version" -Value '9.2.11' -NoNewline
   ```

   这是**兜底而非首选**：绕过了官方 zip 的哈希校验，必须向用户说明来源与版本。

## 6. 验证与下一步

```powershell
Select-String -Path (Join-Path $proj 'Packages\manifest.json') -Pattern 'com\.ivanmurzak\.unity\.mcp'
# 托管 Server 是否就位（configure --agent 依赖它）
Get-ChildItem "$env:USERPROFILE\.ai-game-dev\server\win-x64" -ErrorAction SilentlyContinue |
  Select-Object Name,Length
Get-Content "$env:USERPROFILE\.ai-game-dev\server\win-x64\version" -Raw   # 期望 9.2.11
# 该 Server 支持哪些 AI agent（kilo-code 在这里，不在 CLI 的 setup-mcp --list 里）
Push-Location $proj; & "$env:USERPROFILE\.ai-game-dev\server\win-x64\gamedev-mcp-server.exe" configure --help; Pop-Location
```

> ⚠️ 别对 Server 二进制跑裸 `--help`：`gamedev-mcp-server.exe --help` **不是打印帮助，而是直接启动 server**（默认 8080，会一直占着）。只有 `configure --help` 这类子命令帮助是安全的；误启动就按端口找到 PID 杀掉。

然后告诉用户三条：

1. 用 Unity 打开该项目（`unity-mcp-cli open $proj`）—— 包在编辑器里解析，`Library/PackageCache/` 才会出现。
2. 在 Unity 里打开 **Window → AI Game Developer**，确认连接方式（自建本地端点选 Custom，或走 Cloud），并把顶部的 **AI agent** 选成要用的那个（如 **Kilo Code**）—— Skills 的自动生成只认这个下拉框，CLI 的 `setup-skills` 不支持 `kilo-code`。
3. 回到 DSH 跑 `/unity-mcp-check`：它会把两端端口统一到 **20000**、把 AI agent 配成 **Kilo Code**（写 `.kilocode\mcp.json`）、把 Unity 工具集初始化成只留 `tool-set-enabled-state`，再实测连通性。

## 注意

- 不要手改 `Library/`；不要在工作区外装插件。
- 本技能只负责 **Unity 侧**。DSH 侧的依赖与 `cordis.patch.yml` 配置属于 `dsh-unity-mcp-bridge` 自身；端口/端点不匹配由 `/unity-mcp-check` 修正。
- 与 `install-plugin` 无关的 `install-unity`（装编辑器）、`create-project`（建项目）只在与用户确认后才用。
