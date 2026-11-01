---
name: unity-mcp-update
description: 检查并更新 Unity-MCP 的三样东西：官方 CLI（npm 上的 unity-mcp-cli）、本地离线包（插件自带 vendor/：插件 tarball + GameDev-MCP-Server zip + SHA256SUMS + manifest.json）、以及当前 Unity 工程里的插件 com.ivanmurzak.unity.mcp（Server 跟随插件钉住的版本）。只读检查完先报告，有更新就**问用户**，用户明确同意后才执行更新（CLI 用 npm install -g，离线包与工程用 tools/offline-package.mjs fetch/install 或 unity-mcp-cli install-plugin --with-server），更新后重生成桥接的命令目录并提示重启 dsh web。
whenToUse: 用户要求「检查 Unity-MCP / AI Game Developer / unity-mcp-cli 有没有新版本」「升级 Unity-MCP 插件或 CLI」「刷新 / 更新 vendor 本地离线包」时；或 /unity-mcp-check 已通过、用户想确认版本新旧与是否该升级时。安装、端口、工具集、命令目录、连通性的排查请用 /unity-mcp-check，不要用本技能。
---

# 检查并更新 Unity-MCP（官方 CLI + 本地离线包 + Unity 内插件）

三个可更新目标，各自独立，可以只更新其中一个：

| 目标 | 是什么 | 位置 |
|---|---|---|
| 官方 CLI | `unity-mcp-cli`（npm 全局包） | 全局 npm 目录（一般是 `%APPDATA%\npm`） |
| 本地离线包 | 插件自带的 `vendor/` 缓存：插件 tarball、GameDev-MCP-Server zip、`SHA256SUMS-*`、`manifest.json` | `<bridge>\vendor\` |
| Unity 内插件 | 工程 `Packages\manifest.json` 里的 `com.ivanmurzak.unity.mcp`（`file:` 本地包或版本号） | 当前工作区的 Unity 工程 `$proj` |

`<bridge>` = 插件目录（已安装副本在 `%DSH_PROFILE_DIR%\node_modules\dsh-unity-mcp-bridge`）。

版本是 **lockstep**：CLI `unity-mcp-cli` ↔ Unity 插件 `com.ivanmurzak.unity.mcp` ↔ MCP Server `GameDev-MCP-Server`。插件钉住哪个 Server 以插件源码 `Editor/Scripts/McpServerManager.cs` 的 `ServerVersion` 常量为准（`tools/offline-package.mjs` 直接从 tarball 里读它），**不要拿「Server 上游最新」当目标单独追新**。`vendor/` 不是第四种版本，它是这套版本的**本地缓存**，要跟着同一目标一起刷新 —— 离线安装、`install-plugin --server-source`、断网机器都靠它；缺了 43 MB 级的 Server zip 就没法离线装。

本技能分三段，**顺序不能颠倒**：

1. **检查**（第 1–2 步，只读）：不下载、不写文件、不装东西。
2. **询问**（第 3 步）：有更新就停下来问用户；没有更新直接结束。
3. **更新**（第 4–6 步）：只在用户明确同意后执行，否则一步都不做。

## 1. 定位 Unity 项目（只读）

判据用 `ProjectSettings\ProjectVersion.txt`（排除 `Library` / `Temp` / `obj` / `node_modules` / `.git`）：

```powershell
$ws = (Get-Location).Path
$projects = Get-ChildItem $ws -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'ProjectSettings\ProjectVersion.txt') } |
  Where-Object { $_.FullName -notmatch '\\(Library|Temp|obj|node_modules|\.git)\\' } |
  Select-Object -ExpandProperty FullName -Unique
$projects
```

- **恰好 1 个** → `$proj = $projects[0]`，继续。
- **0 个或多个** → 停下来问用户，不要替他挑。
- 用户只想刷新本地离线包（不碰任何工程）→ 跳过这一步，第 2 步的 `check` **不要带 `--project`**（只比上游 / `vendor/` / CLI），更新只做 4.2。

## 2. 检查版本（只读；不 fetch、不 install）

```powershell
# 当前装的 CLI 版本（未装则为空字符串）
$cliVer = (unity-mcp-cli --version 2>$null)

# 代理优先：GitHub release 资产直连常被掐断（实测 ECONNRESET）
$px = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' |
        Where-Object ProxyEnable -eq 1).ProxyServer          # 实测 127.0.0.1:7897，别猜端口
if ($px) { $env:HTTPS_PROXY = "http://$px"; $env:NODE_USE_ENV_PROXY = '1' }

node "<bridge>\tools\offline-package.mjs" check --project $proj --cli-version $cliVer

# 本地离线包细节：manifest 指向的版本/平台，以及记了却不在磁盘上的文件
Get-Content "<bridge>\vendor\manifest.json" -Raw
Get-ChildItem "<bridge>\vendor" | Select-Object Name,Length
```

一次比四层：**上游最新 / 插件自带 `vendor/` 离线包 / 项目已装 / 本机 CLI**（只想刷离线包时去掉 `--project`，就只比上游 / `vendor/` / CLI）。

- 脚本无第三方依赖（Node 24）。`--json` 给机器可读结果；`--no-proxy` 强制直连；`--proxy http://127.0.0.1:<port>` 显式指定代理。
- **`NODE_USE_ENV_PROXY=1` 不能省**：Node 24 的全局 `fetch` 否则无视 `HTTPS_PROXY`（实测设了等于没设）。脚本自己会补，外层也设上更稳。
- 网络策略是「代理 ↔ 直连互为兜底」：查询类（OpenUPM / npm / GitHub API）先直连，下载类（Server zip、`SHA256SUMS`）先代理、失败再直连。
- 项目侧读两处：`Packages\manifest.json` 的依赖（可能是 `file:…` 本地包依赖）与 `Library\PackageCache\com.ivanmurzak.unity.mcp@*`。
- 离线包侧以 `vendor\manifest.json` 为准：`plugin.version` / `plugin.pinnedServerVersion` / `server.version` / `server.rid`；manifest 记了包但磁盘上没有（`plugin.file` / `server.file` 不存在）＝**离线包不完整**，同样算需要更新。
- CLI 的最新版由脚本查 npm registry（`unity-mcp-cli`）；脚本没取到时用 `npm view unity-mcp-cli version` 兜底。未安装 CLI 时脚本给不出「CLI 落后」的结论，自己把它记为**未安装**（= 需要装，见 4.1）。

**怎么读结论**（`--json` 里是 `upstream` / `vendor` / `project` / `verdict`）：

| 目标 | 「有更新」的判据 | 目标版本 |
|---|---|---|
| 官方 CLI | 已装版本 ≠ 上游最新（或未安装） | 上游最新；它应与插件同号（lockstep） |
| 本地离线包 `vendor/` | manifest 里的插件版本 ≠ 上游最新；或 Server zip/tarball 缺失、哈希不符 | 插件上游最新 + 它钉住的 Server |
| Unity 内插件 | 项目已装版本 ≠ 上游最新；`file:` 本地依赖**不会自动升级**，同样算落后 | 上游最新 |
| Server | **不单独追新**：只在插件升级后、按新插件钉住的 `ServerVersion` 才需要换 | 插件钉住的版本 |

## 3. 结论：先问用户（门禁，必做）

先把结论念给用户听（表格：目标 / 当前版本 / 最新版本 / 是否需要更新），然后：

- **全部已是最新** → 报告「已是最新，无需更新」，**结束**。不要为了「顺手」去 `fetch` 或重装。
- **存在更新** → **停下来问用户**：列出待更新项与目标版本，例如
  - CLI `1.6.0 → x.y.z`
  - 本地离线包 `1.6.0 + 9.3.0 → b + s`（`s` 在 `fetch` 后从 `vendor/manifest.json` 读出）
  - Unity 工程内插件 `1.6.0 → b`（Server 随之到 `s`）

  说明影响（会动哪些文件/目录、是否需要重启 Unity 与 `dsh web`），并明确问「是否现在更新？」。
  - 只用普通提问即可；要选项时用提问工具给「全部更新 / 只更新本地离线包 / 只更新某一层 / 暂不更新」。
  - **用户没明确同意（沉默、反悔、"先看看"）→ 一律按不同意处理**：只给报告与可复制的命令，**不执行第 4、5、6 步**。
  - 用户只同意某一层 → 只做那一层。**只更新本地离线包是合法选择**：不动任何 Unity 工程、不需要 Unity 在运行、也不用重启 DSH，做完 4.2 即结束（第 5 步只复验 vendor）。
  - 但注意 lockstep：**工程内插件升级必须连带 Server 换到它钉住的版本**（走 4.3），CLI 落后则先升 CLI。

## 4. 执行更新（仅用户同意后）

顺序固定：**CLI → 本地离线包 → 工程内插件 + Server → 命令目录**（`install-plugin` 依赖 CLI；工程安装用刚刷新的离线包；命令目录依赖装好的插件版本）。

### 4.1 更新官方 CLI

```powershell
npm install -g unity-mcp-cli
unity-mcp-cli --version    # 复验，应等于目标版本
```

- 版本对齐：CLI 与插件同号。CLI 落后而插件要升级时，先升 CLI 再升级插件，否则新插件的安装参数可能不被老 CLI 支持。
- `npm` 报网络错误时再挂代理（npm 走 registry，`NO_PROXY` 里放行 `registry.npmjs.org` 即可）。
- 升级后 `install-plugin` 的 `--server-version` 默认值也会跟着变；仍要显式传插件钉住的版本，别依赖默认值。

### 4.2 更新本地离线包（`vendor/`）

这一步把**插件 tarball + 按插件钉住版本的 Server zip + `SHA256SUMS` + `manifest.json`** 一起刷到目标版本：

```powershell
node "<bridge>\tools\offline-package.mjs" fetch --plugin-version <latest>
```

- **只动 `<bridge>\vendor\`**：不写 Unity 工程、不需要 Unity 在运行、不用重启 DSH；可以单独执行（用户只要求「更新离线包」时到此结束）。
- Server 不用自己指定版本：脚本按**新插件 tarball 里读出的 `ServerVersion`** 去下，lockstep 自动成立；想强制换 Server 版本才用 `--server-version`。
- 换平台：`fetch --rid osx-arm64` 补对应 zip。`manifest.json` 只记**最后一次 fetch 的 rid**，多平台时以最后一条为准，别以为一次 fetch 能同时缓存多个平台。
- 已存在同名文件会跳过下载（`--force` 强制重下）；下载有 4 次退避重试，失败保留 `.part`，重跑从断点续传（实测 GitHub 资产首次 `ECONNRESET`、第二次即通）。
- zip 的 SHA256 对着**同一 release** 的 `SHA256SUMS` 校验，不匹配直接失败退出，不会留下「装上了但内容不对」的包。
- 旧版本文件不会删（manifest 只指向新版本）：留着可回滚、也不占多少（43 MB 级 zip 除外）；要清理再手删。
- 校验更新结果：

  ```powershell
  $m = Get-Content "<bridge>\vendor\manifest.json" -Raw | ConvertFrom-Json
  $m.plugin.version; $m.plugin.pinnedServerVersion; $m.server.version; $m.server.rid
  Get-FileHash "<bridge>\vendor\$($m.plugin.file)" -Algorithm SHA256   # 应等于 $m.plugin.sha256
  Get-FileHash "<bridge>\vendor\$($m.server.file)" -Algorithm SHA256   # 应等于 $m.server.sha256
  ```

- ⚠️ 若 `<bridge>` 指向 profile 里的安装副本（`node_modules\...`），`dsh plugin add` 重装插件会**整份替换**它，离线包随之丢失 —— 重装后要重跑一次 4.2。想长期保住离线包就在源码目录 `vendor/` 里维护。

### 4.3 把插件装进 Unity 工程（用刚更新的离线包）

```powershell
# 先看会改什么，不落盘
node "<bridge>\tools\offline-package.mjs" install --project $proj --dry-run

# 落盘（自动备份 Packages\manifest.json；默认把 tarball 复制到工程 UnityMcpOffline/ 并写相对依赖）
node "<bridge>\tools\offline-package.mjs" install --project $proj

# Server 从 vendor 的 zip 装进 CLI 托管目录（不联网）
unity-mcp-cli install-plugin $proj --with-server --server-version <pinned> `
  --server-source "<bridge>\vendor\gamedev-mcp-server-<rid>-<pinned>.zip"
```

- `<pinned>` / `<rid>` 取 `vendor/manifest.json` 的 `plugin.pinnedServerVersion` 与 `server.rid`，不要拿上游 Server 版本顶。
- `install-plugin` **没有** `--plugin-source`；离线升级靠的就是 Unity 官方支持的 `file:` 本地 tarball 依赖。它不会把 `file:` 改回版本号（`nonSemverPrefixes`），所以之后重跑安全。
- **本地缺 Server zip**（profile 里的安装副本常见）→ 先按 4.2 `fetch` 补齐，**不要拿旧版本的 zip 顶**；`install` 会明确提示缺不缺。
- 想走在线安装（不进 vendor）：`unity-mcp-cli install-plugin $proj --with-server --plugin-version <latest>`；GitHub 失败按 `/unity-mcp-install` 5.1 的代理流程处理（`NODE_USE_ENV_PROXY=1` 必需，`NO_PROXY` 放行 OpenUPM/npm）。
- 装完让 **Unity 重新加载项目**（或重启编辑器），新包才会真正进 `Library\PackageCache`。

### 4.4 重生成命令目录与扩展索引（插件版本变了就必须做）

命令名随插件版本变（实测 0.9x = 73 个；1.2.0 = 18 个；1.6.0 = 19 个，且 1.6.0 起管理开关默认隐藏、需要设为 visible），旧目录会让 `/unity-mcp-tools` 去开不存在的命令。这一步可以直接交给 `/unity-mcp-update-tools`（它按 `vendor/` 里的最新离线包重生成，不依赖 Unity 工程），也可以手动：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<bridge>\tools\generate-unity-mcp-catalog.ps1" -ProjectRoot $proj
```

- 生成后**重启 `dsh web` / 应用**：技能在插件启动时注册，不重启不生效。
- 生成器会重写 `<bridge>\skills\unity-mcp-tools\SKILL.md`、`skills\unity-mcp-tools\reference\*.md` 与 `reference\extensions.md`（可选扩展清单，来自插件包内的 `extensions.catalog.json`）；如果 `<bridge>` 是 profile 里的安装副本，改动落在该副本上，升级插件版本后要重跑一次。

## 5. 复验

```powershell
unity-mcp-cli --version
# 只更新了离线包时可省掉 --project（只比上游 / vendor / CLI）
node "<bridge>\tools\offline-package.mjs" check --project $proj --cli-version (unity-mcp-cli --version)

# 本地离线包：版本 + 文件哈希
$m = Get-Content "<bridge>\vendor\manifest.json" -Raw | ConvertFrom-Json
$m.plugin.version; $m.plugin.pinnedServerVersion; $m.server.version

# 工程与托管 Server
(Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp@*').Name
Get-Content "$env:USERPROFILE\.ai-game-dev\server\win-x64\version" -Raw   # 期望 = 插件钉住的版本
```

四个目标都对上（CLI / 离线包 / 工程已装 / Server）才算更新完成；`check` 仍报落后就回去看是不是 `fetch` 没换版本、只跑了 4.2 没跑 4.3，或 Unity 没重新解析包。连通性另用 `/unity-mcp-check` 验（本技能不验端口与连接）。

## 6. 报告格式

| 项 | 结果 |
|---|---|
| 官方 CLI `unity-mcp-cli` | 已装 1.6.0 → 上游 1.6.0（一致）/ 已更新 1.6.0 → x.y.z / 未装 |
| 本地离线包 `vendor/` | 已是 b + s（哈希通过）/ 已 `fetch` 到 b + s（哈希通过）/ 缺 zip（已补齐 / 未补齐）/ 版本未变，无需更新 |
| Unity 插件 `com.ivanmurzak.unity.mcp` | 项目已装 a → 上游 b（落后 / 一致）/ 已更新 a → b |
| MCP Server（lockstep） | 插件钉住 s ｜ 托管目录 `~\.ai-game-dev\server\<rid>\` 已是 s / 已换成 s |
| 命令目录 | 已按 b 重生成（需重启 `dsh web`）/ 版本未变，无需重生成 |
| 用户决定 | 已同意更新 / 只更新本地离线包 / 暂不更新（仅报告） |
| 改动的文件 | 工程 `Packages\manifest.json` 及其 `.bak-*` 备份；`<bridge>\vendor\` 下的 tarball / zip / `SHA256SUMS-*` / `manifest.json`；无则写"无" |

## 常见故障

| 现象 | 原因 | 处理 |
|---|---|---|
| `check` 某层显示 `?` 或报「…失败」 | 代理与直连都失败（GitHub API 被掐 / npm 超时） | 设 `HTTPS_PROXY` + `NODE_USE_ENV_PROXY=1`（或 `--proxy`）重跑；插件版本可 `--plugin-version` 手工指定 |
| `fetch` 后 `vendor/manifest.json` 还是旧版本 | 没传对 `--plugin-version`，或同名文件已存在被跳过 | 显式 `fetch --plugin-version <目标> --force` 重跑，再核对 manifest 与 `Get-FileHash` |
| 离线包更新了，Unity 工程里还是旧版本 | 只做了 4.2 的 `fetch`，没做 4.3 的 `install` | 继续 4.3：`install --project` + `install-plugin --server-source` |
| 重装 `dsh plugin` 后离线包没了 | `<bridge>` 在 profile 的 `node_modules` 里，整份副本被替换 | 重装后重跑 4.2；要长期保留就在源码目录维护 `vendor/` |
| `fetch` 报 `SHA256 不匹配` | 下载被中间盒改写，或复用了半截文件 | 删掉该 zip 与 `*.part`，重跑 `fetch --force`；仍不匹配就换代理节点 |
| `fetch` 报 `下载不完整 …（保留 .part，可重跑续传）` | 连接被掐断（实测 GitHub release 资产会） | 直接重跑 `fetch`，从 `.part` 续传，别手删 |
| `install` 报「离线包不存在 / sha256 与 manifest 不符」 | manifest 记了新版本但 tarball 没下全 | 重新 `fetch --plugin-version <目标> --force`，再 `install` |
| `install-plugin` 报 `Server download failed` / `fetch failed` | GitHub 直连被掐，且没设 `NODE_USE_ENV_PROXY=1` | 改走 4.3 的 `--server-source` 离线 zip；或按 `/unity-mcp-install` 5.1 配代理 |
| 换平台后离线装 Server 失败 | `manifest.json` 的 server 条目是另一个 rid 的 zip | `fetch --rid <目标 rid>` 重新生成 zip 与 manifest，再用 `--server-source` |
| 升级后 `/unity-mcp-tools` 调用报 `tool not found` | 命令目录还按旧插件版本生成 | 回 4.4 重生成 + 重启 `dsh web` |
| Unity 里仍是旧版本 | 只改了 `Packages\manifest.json`，Unity 没重新解析包 | 让 Unity 重新加载项目 / 重启编辑器，再查 `Library\PackageCache` |
| 升级后连不上 | 端口 / 端点 / token 变了 | 用 `/unity-mcp-check` 验端口 20000 与连通性 |
