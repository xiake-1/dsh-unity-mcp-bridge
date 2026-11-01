---
name: unity-mcp-check
description: 检查 DSH 的 unity-mcp-bridge 与 Unity 项目这条链路是否就绪：Unity 插件是否安装成功、两端端口统一到 20000（项目侧不是 20000 就用 bootstrap-local 改过来）、DSH 侧依赖与 bundle 是否加载插件行、Unity 工具集是否初始化成只留 tool-set-enabled-state、/unity-mcp-tools 的命令目录是否按当前插件版本生成，最后用 unity_mcp_activate 实测能否连上 DSH。不做版本检查与升级（用 /unity-mcp-update），也不配 AI agent。
whenToUse: 用户要求「检查 / 排查 Unity-MCP 连接」、unity_mcp_activate 连不上、/unity-mcp-tools 激活失败、刚跑完 /unity-mcp-install 时；问「有没有新版本 / 要不要升级」请用 /unity-mcp-update。
---

# 检查 DSH ↔ Unity-MCP 连接

两端各有一半，缺一不可，**端口统一为 20000**：

| 端 | 东西 | 位置 |
|---|---|---|
| DSH | 桥接插件 `dsh-unity-mcp-bridge` | `%DSH_HOME%\profiles\%DSH_PROFILE%\`：`package.json` 的依赖 **和 `dsh.profile.bundles` 里的包名**（决定 bundle 是否加载）；`unity-mcp` 行由插件自带的 `node_modules\dsh-unity-mcp-bridge\cordis.patch.yml` 插入（`url` 默认 `http://localhost:20000/mcp`），profile 自己的 `cordis.patch.yml` 只在需要覆盖端点时出现 |
| Unity | 包 `com.ivanmurzak.unity.mcp` 起的 MCP 服务器 | 项目 `UserSettings\AI-Game-Developer-Config.json` 的 `host`（必须是 `http://localhost:20000`） |

检查项：① 插件是否装上 ② 端口是否 20000（不是就改）③ DSH 依赖与 bundle 是否加载插件行 ④ 工具集是否最小 ⑤ 命令目录是否跟得上插件版本 ⑥ 能否连上 DSH。

版本新旧、是否升级 → `/unity-mcp-update`；装插件 → `/unity-mcp-install`；配 AI agent 不在本技能范围内。

## 0. 定位 Unity 项目

找 `ProjectSettings\ProjectVersion.txt`（排除 `Library` / `Temp` / `obj` / `node_modules` / `.git`），取唯一那个；0 个或多个就停下来问用户。

```powershell
$ws = (Get-Location).Path
$projects = Get-ChildItem $ws -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'ProjectSettings\ProjectVersion.txt') } |
  Where-Object { $_.FullName -notmatch '\\(Library|Temp|obj|node_modules|\.git)\\' } |
  Select-Object -ExpandProperty FullName -Unique
$projects
```

## 1. 插件是否安装成功

```powershell
$manifest = Join-Path $proj 'Packages\manifest.json'
Select-String -Path $manifest -Pattern 'com\.ivanmurzak\.unity\.mcp'
Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp@*' -ErrorAction SilentlyContinue

# 若依赖是 file:，解析目标是否存在（Unity 相对 Packages 目录；绝对路径直接用）
$dep = (Get-Content $manifest -Raw | ConvertFrom-Json).dependencies.'com.ivanmurzak.unity.mcp'
if ($dep -like 'file:*') {
  $rel = $dep.Substring(5)
  $target = if ($rel -match '^[A-Za-z]:' -or $rel.StartsWith('/')) { $rel } else { Join-Path (Split-Path $manifest) $rel }
  "dep target: $target  exists=$(Test-Path $target)  points-into-node_modules=$($target -like '*node_modules*')"
}
```

- manifest 依赖 **和** `Library\PackageCache` 里都有 → 已装（依赖可能是 `file:` 本地包，属正常）。
- 只有 manifest、没有 `PackageCache` → Unity 还没解析包：让 Unity 打开/重新加载项目一次再看。
- 两处都没有 → **未装**：报告后交给 `/unity-mcp-install`，不要在这里装。
- `file:` 目标 **不存在** → Unity 解析必失败：重跑 `/unity-mcp-install`（现在默认 `--vendor project`，会复制 tarball 到工程 `UnityMcpOffline/` 并写相对路径）。
- `file:` 目标指向 **`node_modules`**（例如旧版写进 profile 的绝对路径）→ 现在能用，但 profile 重建/重装即失效：建议重跑 `/unity-mcp-install` 迁移到工程内相对路径。

## 2. 端口是不是 20000、模式是不是 Custom（不对就改）

**20000 是唯一标准端口；并且必须是 `connectionMode: Custom`** —— Cloud 模式不会启动本地服务器，DSH 永远连不上。

### 2.1 读现状

```powershell
$cfgPath = Join-Path $proj 'UserSettings\AI-Game-Developer-Config.json'
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$cfg.host; $cfg.connectionMode; $cfg.keepServerRunning

# Unity 侧实际监听的端口（编辑器在跑时才有意义，取最后一条）
Select-String -Path (Join-Path $proj 'Library\mcp-server\win-x64\logs\server-log.txt') `
  -Pattern 'Start listening on port' | Select-Object -Last 1

# DSH 侧：生效的 url（bundle 默认 20000/mcp；profile 层覆盖行优先）
$prof = $env:DSH_PROFILE_DIR
Select-String -Path (Join-Path $prof 'node_modules\dsh-unity-mcp-bridge\cordis.patch.yml') -Pattern 'url:'
Select-String -Path (Join-Path $prof 'cordis.patch.yml') -Pattern 'unity-mcp' -Context 0,12
```

`unity-mcp-cli status $proj` 会同时列出 **Config Server**（项目配置里的地址，就是 Unity 插件对外服务的地址）和它自己的 **Local MCP Server** 地址 —— **以 Config Server 为准**，不要被另一个端口带跑。

### 2.2 Unity 侧不是 20000 / 仍是 Cloud → 改配置（重启统一在 4.5）

判定：`host` 不是 `http://localhost:20000` **或** `connectionMode` 不是 `Custom`，就执行下面整段。改写的是项目自己的配置，不是 DSH。需要 `unity-mcp-cli`；缺了就按 `/unity-mcp-install` 第 2 步装（`npm install -g unity-mcp-cli`）。

```powershell
$cfgPath = Join-Path $proj 'UserSettings\AI-Game-Developer-Config.json'
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$token = $cfg.token

# 0) 执行前提醒用户保存未保存的场景/改动（close 会优雅退出，30s 不退则强杀）
# 先看会改什么，不落盘
unity-mcp-cli bootstrap-local $proj --url 'http://localhost:20000/' --token $token --dry-run

# 备份后落盘（Cloud → Custom，host → 20000）
Copy-Item $cfgPath "$cfgPath.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
unity-mcp-cli bootstrap-local $proj --url 'http://localhost:20000/' --token $token
```

- **这里先不重启**：第 4 步还要写工具集配置；所有文件改完后在 **4.5 统一重启一次编辑器**（直接 `close`/`open`，不再给别的选项）。
- **为什么必须重启编辑器**：`McpServerManager` 是 `[InitializeOnLoad]`，静态构造函数只在**域重载**时读一次 `connectionMode`；Cloud 模式下 `StartServerIfNeeded()` 打印 `Cloud mode active, skipping local server auto-start` 后直接返回，并且该方法第一行就 `EditorApplication.update -= StartServerIfNeeded`（**只跑一次**）。所以只改 JSON 不会启动服务器。
- `keepServerRunning` 必须是 `true`：false 时 `StartServerIfNeeded()` 同样会跳过（日志 `KeepServerRunning is false, skipping auto-start`）。
- token 用**项目里已有的那个**，不要凭空生成；`--dry-run` 的 diff 要念给用户看。
- 用户明确要求保留项目原端口时**停下来问**，不要强行统一。

### 2.3 DSH 侧不是 20000 → 改回 20000

bundle 默认就是 `http://localhost:20000/mcp`。出现别的端口说明 profile 层有**覆盖行**：备份 `%DSH_PROFILE_DIR%\cordis.patch.yml`，把它的 `url:` 改成 `http://localhost:20000/mcp`，或整块删掉、回落到 bundle 默认；profile 有 `patchReload: live` 则存盘即热重载，否则重启 DSH。只改这一处。

> ⚠️ 桌面端会把 profile 层的 `cordis.patch.yml` 当成自己设置的导出文件重写。能删覆盖行就删，靠 bundle 提供。

## 3. DSH 侧：依赖与 bundle 自查

```powershell
$prof = $env:DSH_PROFILE_DIR          # 例如 C:\Users\<you>\.dsh\profiles\desktop
# 依赖 + bundle 列表：两者都在，bundle 才会被加载
Get-Content (Join-Path $prof 'package.json') -Raw | Select-String 'dsh-unity-mcp-bridge'
# 生效的 unity-mcp 行：默认由插件自带的 bundle patch 插入
Select-String -Path (Join-Path $prof 'node_modules\dsh-unity-mcp-bridge\cordis.patch.yml') `
  -Pattern 'id: unity-mcp' -Context 0,12
# profile 层若有覆盖行，以它为准
Select-String -Path (Join-Path $prof 'cordis.patch.yml') -Pattern 'unity-mcp' -Context 0,12
```

确认四件事：依赖在不在、`dsh.profile.bundles` 里有没有 `dsh-unity-mcp-bridge`、生效的 `url:` 是不是 `http://localhost:20000/mcp`（读法见 2.1，改法见 2.3）、`serverName`（默认 `unity`）。同时确认**没有**第二份指向同一 `serverName` 的 stock `@deepseek-ai/dsh-mcp-client` 配置。

> 依赖和 bundles 都在、插件页却显示「已安装，未生效」→ 看 bundle patch 是不是空的。0.4.0 及以前它故意是 `[]`，要求使用者把行手写进 profile 层；桌面端会把 profile 层的 `cordis.patch.yml` 当成自己设置的导出文件重写，手写行下次重启就没了。0.5.0 起这一行随 bundle 提供，不再依赖 profile 层。

## 4. 初始化工具集（参考 `reference/tool.md`）与命令目录版本自检

Unity 侧**只留一个**可见工具 `tool-set-enabled-state`（1.6.0 正式名 `tool-set-visibility`，旧名等价）：它既是唯一的"开关"，也是桥接 `unity_tools_restore` 的保留集，等于最小常驻状态。

> **1.6.0 起是「可见性」而不是禁用**：默认只有 7 个核心工具可见，且管理开关本身默认隐藏。隐藏的工具仍可按名调用，但**不会出现在 `tools/list`**（不进入模型上下文，桥接激活后也注册不到），所以这一步必须把开关显式设为 visible。

**新工程不能先跑 `--disable-all-tools`**：CLI 1.6.0 的 `updateFeatures` 只修改配置里**已存在**的条目，`tools: []` 时 `--disable-all-tools` / `--enable-all-tools` 都是空操作；随后 `--enable-tools` 只 push 一条，结果仍是「默认 7 + 开关 = 8 个可见」。必须用**显式名单**把条目物化。

先看现状：如果 `--list` 里已经只有开关一条 `[visible]`，且第 2 步判定无需改端口/模式，就不必重写配置，直接去 4.5（20000 已监听则连 4.5 也跳过）：

```powershell
unity-mcp-cli configure $proj --list | Select-String '\[(visible|enabled)\]'
```

```powershell
$prof = $env:DSH_PROFILE_DIR
$bridge = Join-Path $prof 'node_modules\dsh-unity-mcp-bridge'
$refDir = Join-Path $bridge 'skills\unity-mcp-tools\reference'
$names = Get-ChildItem $refDir -Filter *.md |
  Where-Object Name -ne 'extensions.md' |
  ForEach-Object { Select-String -Path $_.FullName -Pattern '^- `([a-z0-9-]+)`' -AllMatches } |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } |
  Sort-Object -Unique

# 1) 显式关掉全部基础工具（缺失条目会被 push 进配置）
unity-mcp-cli configure $proj --disable-tools ($names -join ',')
# 2) 只显示开关
unity-mcp-cli configure $proj --enable-tools tool-set-enabled-state
# 3) 复验：Tools 条目数 = 命令数（1.6.0 为 19），[visible] 恰好 1 条
unity-mcp-cli configure $proj --list
```

- 等价脚本（插件目录 `tools\normalize-toolset.ps1`，存在时优先用）：它完成上面三步，并断言「条目数 = 目录命令数、只有开关可见」，失败返回非 0：

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "<bridge>\tools\normalize-toolset.ps1" -ProjectPath $proj
  ```

- 以上规避的是 **CLI 1.6.0 的已知行为**：`updateFeatures` 只改已有条目，空配置时 `--disable-all-tools` / `--enable-all-tools` 是空操作。上游修了之后这段仍安全（幂等）。
- 扩展包的工具不在基础目录里：装完扩展后，激活连接再跑一次 `unity_tools_restore`，把剩余可见的扩展工具一并隐藏（开关保留）。
- 万一被全部隐藏：单独跑 `unity-mcp-cli configure $proj --enable-tools tool-set-enabled-state` 即可救回。
- 复验结果应当**只有** `tool-set-enabled-state` 是 `[visible]`（旧版 CLI 显示 `[enabled]`），其余全是 `[hidden]` / `[disabled]`。注册总数随插件版本变：**1.6.0 = 19 个（默认 7 可见）**，1.2.0 = 18 个（默认 7），0.9x = 73。
- 这一步直接读写项目配置，**不需要 Unity 在运行**。
- prompts / resources 默认全隐藏，保持关闭即可；除非用户明确要求，不要打开。
- 需要别的命令时，交给 `/unity-mcp-tools` 的按需流程（显示 → 用 → `unity_tools_restore` 收回），不要在这里预先全开：每个可见命令的 schema 都会进入之后每一次模型请求。
- **命令目录版本自检（必做）**：`/unity-mcp-tools` 的索引和 `reference/*.md` 是按某个插件版本从源码生成的，**命令名随版本变**。比对两边，不一致就提示重生成，不要照着旧目录去开工具：

  ```powershell
  # 桥接自带的目录是按哪个版本生成的（SKILL.md 标题行）
  Select-String -Path (Join-Path $prof 'node_modules\dsh-unity-mcp-bridge\skills\unity-mcp-tools\SKILL.md') `
    -Pattern 'com\.ivanmurzak\.unity\.mcp@'
  # 项目里实际装的版本
  (Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp@*').Name
  # 不一致 → 重生成命令目录，然后重启 dsh web（技能在插件启动时注册，不重启不生效）
  powershell -NoProfile -ExecutionPolicy Bypass -File "<dsh-unity-mcp-bridge>\tools\generate-unity-mcp-catalog.ps1" -ProjectRoot $proj
  ```

  实测代价：目录停在 0.91.0 而项目已是 1.2.0 时，18 个分类文件里有 13 个写的是**已删除**的命令（`gameobject-*`、`assets-*`、`scene-*`、`profiler-*`、`console-*`、`editor-application-*`、`editor-selection-*`、`object-*`、`reflection-method-*`、`type-get-json-schema`），1.2.0 由 `rql-query` / `rql-mutate` / `rql-schema` 承担 —— 照旧目录调用必然 `tool not found`。

### 4.5 重启编辑器让配置生效（直接重启，只一次）

**只要第 2 步改过 host/connectionMode，或第 4 步写过工具集配置**，就在这里统一重启一次编辑器（不要在 2.2 里先重启一遍）：

```powershell
# 执行前必须让用户保存未保存的场景/改动；30s 内没优雅退出会强杀
unity-mcp-cli close $proj --timeout 30 --force
unity-mcp-cli open $proj
unity-mcp-cli wait-for-ready $proj --timeout 300000

# 复验
unity-mcp-cli configure $proj --list | Select-String 'Host'
Select-String -Path (Join-Path $proj 'Library\mcp-server\win-x64\logs\server-log.txt') `
  -Pattern 'Start listening on port' | Select-Object -Last 1
```

- 为什么必须重启：`McpServerManager` 是 `[InitializeOnLoad]`，只在域重载时读 `connectionMode` 与工具集配置；Cloud 下 `StartServerIfNeeded()` 打印 `Cloud mode active, skipping local server auto-start` 后返回，且只跑一次。
- Unity 本来没开时 `close` 无操作，`open` 会直接启动；首次解析包 + 起服务器可能超过 2 分钟，`wait-for-ready` 给 300s。
- 什么都没改（第 2 步无需改 host/模式、`--list` 本就只有开关一条可见）且 20000 已在监听 → 跳过本节，直接去第 5 步。
- 如果 `Host` 不是 20000 或日志没有 20000 监听 → 回第 2 步核对配置与模式，不要继续第 5 步。

## 5. 是否连接到 DSH（实测）

```powershell
Test-NetConnection -ComputerName localhost -Port 20000 -InformationLevel Quiet
netstat -ano | Select-String ':20000\s' | Select-String 'LISTENING'
unity-mcp-cli status $proj                 # 需要时用 --url / --token / --timeout 覆盖
unity-mcp-cli wait-for-ready $proj         # 最长 120s
```

真正的实测只有一条：**调用 `unity_mcp_activate`**。

- 成功 → 桥接连上并注册 `mcp__unity__*` 工具，检查完成；若本次任务不需要 Unity，立刻 `unity_tools_restore` 回到休眠（它同时把工具集还原成只留 `tool-set-enabled-state`）。
- 失败 → 保留错误原文，按下面判断，再回第 2 步核对端口：`ECONNREFUSED` = 20000 没人听；404/405 = 端点路径不对；401/403 = token 不对。
- 工具 `unity_mcp_activate` 本身不存在 → 桥接插件没加载，属于 DSH 侧安装问题（用 `dsh plugin` 检查是否安装、重启应用）。

## 6. 报告格式

| 检查项 | 结果 |
|---|---|
| Unity 插件 `com.ivanmurzak.unity.mcp` | 已装（manifest 依赖 = …，PackageCache = …）/ 未装 → 交由 `/unity-mcp-install` |
| Unity 侧端口 | 本来就是 20000 + Custom / 原 24009 或 Cloud → 已改 20000 + Custom，并已重启编辑器（附备份路径） / 未改（用户要求保留） |
| DSH 侧 url | `http://localhost:20000/mcp`（一致 / 已改 / 无覆盖行） |
| 插件加载 | bundle 已插入 `unity-mcp` 行（0.5.0）/ bundle 为空 → 已补覆盖行 / `dsh.profile.bundles` 缺该包 |
| 命令目录（`/unity-mcp-tools`） | 按 1.6.0 生成，与项目一致 / 按 0.91.0 生成 → 已重生成（需重启 `dsh web`） |
| 工具集 | 只有 `tool-set-enabled-state` 为 `[visible]`（旧版 CLI 的 `[enabled]`） |
| `unity_mcp_activate` | 成功 / 失败（原文错误） |
| 改动的文件 | 列出（含备份路径）；无则写"无" |

## 常见故障

| 现象 | 原因 | 处理 |
|---|---|---|
| 20000 没人听 | Unity 没开、服务器没启动、或仍是 Cloud 模式 | 先看 `connectionMode`；Cloud 就 `bootstrap-local` 后**重启编辑器**（`close --force` → `open`） |
| 日志有 `Cloud mode active, skipping local server auto-start` | 改完配置没触发域重载；`StartServerIfNeeded` 只跑一次 | `bootstrap-local` 后重启编辑器（`unity-mcp-cli close $proj --timeout 30 --force` → `open $proj` → `wait-for-ready`） |
| 改了 host / 模式但服务器没起 | 插件静态构造只在域重载时读 `connectionMode`，只改 JSON 不生效 | 同上，重启编辑器后再看 `Start listening on port 20000` |
| 全新工程的可见工具是 8 个（默认 7 + 开关） | `tools: []` 时 `--disable-all-tools` 是空操作（CLI 1.6.0 只改已有条目） | 按第 4 步用 `--disable-tools <显式名单>` 物化条目，再 `--enable-tools tool-set-enabled-state` |
| manifest 里有包但连不上 | Unity 还没解析包 | 用 Unity 打开项目一次 |
| `file:` 依赖找不到目标 | tarball 被删/工程从别的机器拷来但没带 `UnityMcpOffline/`，或旧版指向了已重建的 profile 路径 | 重跑 `/unity-mcp-install`（默认 `--vendor project`，复制 tarball 到工程并写相对路径） |
| `file:` 路径里含 `node_modules` | 旧版 `install` 写的是插件目录绝对路径，生命周期绑在 profile 上 | 能连就先不动；建议重跑 `/unity-mcp-install` 迁移到 `UnityMcpOffline/` 相对路径 |
| 404 / 405 | 端点路径不对（`/mcp` ↔ `/p/<token>`） | 以 `http://localhost:20000/mcp` 为准；需要 token 路径时再补 |
| 401 / 403 | token 缺失或过期 | 用项目配置里的 token；或 `bootstrap-local --url ... --token ...` 重新固定 |
| 工具全被隐藏（含 `tool-set-enabled-state`） | 被 `--disable-all-tools` 或历史上写死的配置隐藏 | 单独跑一条 `unity-mcp-cli configure $proj --enable-tools tool-set-enabled-state` 救回 |
| `mcp__unity__gameobject-find` 之类报 `tool not found` | 命令目录是按旧插件版本生成的（1.2.0 已移除 `gameobject-*` / `assets-*` / `scene-*` / `profiler-*` 等） | 按第 4 步做目录版本自检并重生成 + 重启 `dsh web`；读写 Unity 内容改走 `rql-query` / `rql-mutate` / `rql-schema` |
| 工具名冲突 / 行为异常 | stock `dsh-mcp-client` 与桥接插件同时跑同一 `serverName` | 只留一个 |
| 插件页显示「已安装，未生效」 | bundle 没有插入插件行（0.4.0 及以前 bundle patch 是 `[]`），或 profile 的 `dsh.profile.bundles` 里没有这个包 | 升级到 ≥0.5.0（行随 bundle 提供）；确认 `dsh.profile.bundles` 含 `dsh-unity-mcp-bridge`；重启 |
| 重启后手写进 profile 层的配置不见了 | 桌面端把 profile 的 `cordis.patch.yml` 当自己的设置导出重写，不在它设置模型里的条目会被抹掉 | 插件行交给 bundle，别手写；其它设置走 UI |
