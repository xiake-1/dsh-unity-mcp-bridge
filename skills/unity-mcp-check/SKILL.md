---
name: unity-mcp-check
description: 检查 DSH 的 unity-mcp-bridge 与 Unity 项目的 MCP 插件是否连通：两端端口统一到 20000（项目侧不是 20000 就用 bootstrap-local 改过来）、把 AI agent 配成 Kilo Code（写 .kilocode/mcp.json，端口跟着 20000）、按 reference/tool.md 把 Unity 工具集初始化为只留 tool-set-enabled-state，再用 unity_mcp_activate 实测。
whenToUse: 用户要求「检查 / 排查 Unity-MCP 连接」，或 unity_mcp_activate 连不上、/unity-mcp-tools 激活失败、刚跑完 /unity-mcp-install 时。
---

# 检查 DSH ↔ Unity-MCP 连接

两端各有一半，缺一不可，**端口统一为 20000**：

| 端 | 东西 | 位置 |
|---|---|---|
| DSH | 桥接插件 `dsh-unity-mcp-bridge` | `%DSH_HOME%\profiles\%DSH_PROFILE%\`：`package.json` 的依赖 + `cordis.patch.yml` 里的 `unity-mcp` 行（`url` 必须是 `http://localhost:20000/mcp`） |
| Unity | 包 `com.ivanmurzak.unity.mcp` 起的 MCP 服务器 | 项目 `UserSettings\AI-Game-Developer-Config.json` 的 `host`（必须是 `http://localhost:20000`） |
| AI agent | 客户端侧的 MCP 配置（本技能默认 **Kilo Code**） | 项目 `.kilocode\mcp.json` 的 `mcpServers.*.url`（端口必须是 20000）+ 同文件所在项目的 `skillsPath`（`.kilocode\skills`） |

> **20000 是唯一标准端口。** 哪一端不是 20000，就把**那一端**改成 20000：Unity 侧用 `unity-mcp-cli bootstrap-local`，DSH 侧改 `cordis.patch.yml`，AI agent 侧重新跑 `configure --agent`（见第 5 步，它会跟着 `--url` 的端口走）。

## 1. DSH 侧现状

```powershell
$prof = $env:DSH_PROFILE_DIR          # 例如 C:\Users\<you>\.dsh\profiles\desktop
Get-Content (Join-Path $prof 'package.json') -Raw | Select-String 'dsh-unity-mcp-bridge'
Select-String -Path (Join-Path $prof 'cordis.patch.yml') -Pattern 'unity-mcp' -Context 0,12
```

确认三件事：依赖在不在、`url:` 是不是 `http://localhost:20000/mcp`、`serverName`（默认 `unity`）。同时确认**没有**第二份指向同一 `serverName` 的 stock `@deepseek-ai/dsh-mcp-client` 配置。

## 2. 定位 Unity 项目

找 `ProjectSettings\ProjectVersion.txt`（排除 `Library` / `Temp` / `node_modules` / `.git`），取唯一那个；0 个或多个就停下来问用户。

## 3. 读两端的端口

```powershell
# Unity 侧：项目配置里的 host / token（configure --list 也会打印 Host）
unity-mcp-cli configure $proj --list | Select-String 'Host'
Get-Content (Join-Path $proj 'UserSettings\AI-Game-Developer-Config.json') -Raw |
  Select-String '"host"|"token"|"connectionMode"'

# Unity 侧实际监听的端口（编辑器在跑时才有意义，取最后一条）
Select-String -Path (Join-Path $proj 'Library\mcp-server\win-x64\logs\server-log.txt') `
  -Pattern 'Start listening on port' | Select-Object -Last 1

# DSH 侧
Select-String -Path (Join-Path $prof 'cordis.patch.yml') -Pattern 'url:'
```

`unity-mcp-cli status $proj` 会同时列出 **Config Server**（项目配置里的地址，就是 Unity 插件对外服务的地址）和它自己的 **Local MCP Server** 地址 —— **以 Config Server 为准**，不要被另一个端口带跑。

## 4. 把两端统一到 20000

**Unity 侧不是 20000 时**（改写项目自己的配置，不是改 DSH）：

```powershell
# 先看它会改什么，不落盘
unity-mcp-cli bootstrap-local $proj --url 'http://localhost:20000/' --token '<项目现有 token>' --dry-run

# 备份后落盘
Copy-Item (Join-Path $proj 'UserSettings\AI-Game-Developer-Config.json') `
  (Join-Path $proj ("UserSettings\AI-Game-Developer-Config.json.bak-" + (Get-Date -Format yyyyMMdd-HHmmss)))
unity-mcp-cli bootstrap-local $proj --url 'http://localhost:20000/' --token '<项目现有 token>'
```

- 该命令把配置里的 `host` 改成 `http://localhost:20000`（`connectionMode` 保持 `Custom`，或从 Cloud 切到 Custom），**幂等**，可重复执行。
- token 用**项目里已有的那个**，不要凭空生成；`--dry-run` 的 diff 要念给用户看。
- **必须让 Unity 重新加载项目**（或重启编辑器），服务器才会在新端口上监听 —— 只改文件不算生效。
- ⚠️ 顺手检查还有谁 pin 了旧端口（项目里的 `.kilocode\mcp.json`、其它 MCP 客户端配置），一并改成 20000，否则那些客户端会连不上。Kilo Code 那份**不要手改**，走第 5 步的 `configure --agent` 重配（它会连 pin 一起重写）。**改动了哪些文件必须报给用户。**
- 如果用户明确要求保留项目原端口（例如别的客户端已经固定用它），**停下来问**，不要强行统一 —— 本技能的默认策略是统一到 20000。

**DSH 侧不是 20000 时**：备份 `cordis.patch.yml`，把 `unity-mcp` 行的 `url:` 改成 `http://localhost:20000/mcp`；profile 有 `patchReload: live` 则存盘即热重载，否则重启 DSH。只改这一行。

## 5. 把 AI agent 配成 Kilo Code（`.kilocode\mcp.json`）

**端口定死 20000 之后**再做这步 —— 写进去的 URL 是从 `--url` 推导的，先配后改端口只会留下连不上的客户端配置。

```powershell
# 现状：UI 里选中的 agent、skills 目录、是否已有 mcp.json
Get-Content (Join-Path $proj 'UserSettings\AI-Game-Developer-Config.json') -Raw |
  Select-String '"skillAutoGenerate"|"skillsPath"|"kilo-code"'
Test-Path (Join-Path $proj '.kilocode\mcp.json')

# 已存在就先备份，再写
Copy-Item (Join-Path $proj '.kilocode\mcp.json') `
  (Join-Path $proj ('.kilocode\mcp.json.bak-' + (Get-Date -Format yyyyMMdd-HHmmss))) -ErrorAction SilentlyContinue
unity-mcp-cli configure $proj --agent kilo-code --url 'http://localhost:20000'
Get-Content (Join-Path $proj '.kilocode\mcp.json') -Raw
```

- 实测输出 `Configured Kilo Code (kilo-code).` + `config: <proj>\.kilocode\mcp.json`，写出来的是
  `{"mcpServers":{"ai-game-developer":{"disabled":false,"type":"streamable-http","url":"http://localhost:20000/p/<pin>"}}}`。
  端口跟着 `--url` 走；路径是**项目 pin**（`/p/<pin>`）而不是 `/mcp`。实测 `http://localhost:20000/mcp` 与 `/p/<pin>` 都返回 200，DSH 侧仍固定用 `/mcp`，两边不冲突。
- ⚠️ **别用 `setup-mcp`**：CLI 0.91.0 与 1.2.0 的 `setup-mcp --list` 都只有 14 个 agent，**不含 `kilo-code`**，直接 `ERROR: Unknown agent: "kilo-code"`。要用 `configure --agent` —— 它代理到托管 Server 的 configurator，那边实测有 16 个 agent（含 `kilo-code`、`zoo-code`、`other-custom`），用 `<server exe> configure --help` 列全。
- `configure --agent` 依赖托管二进制 `~\.ai-game-dev\server\<rid>\`；缺了会报 `No managed GameDev-MCP-Server binary found … Run 'unity-mcp-cli install-plugin --with-server' first`。项目里已有 `Library\mcp-server\<rid>\gamedev-mcp-server.exe` 时可直接顶替（实测与 CLI 代理等价）：

  ```powershell
  Push-Location $proj
  & (Join-Path $proj 'Library\mcp-server\win-x64\gamedev-mcp-server.exe') configure --agent kilo-code --url http://localhost:20000
  Pop-Location
  ```

- **Skills 侧**：`.kilocode\skills\<tool>\SKILL.md` 只由 Unity 窗口的 **Auto-generate** 生成（对应配置里的 `skillAutoGenerate: {"kilo-code": true}` 与 `skillsPath: ".kilocode/skills"`）；CLI 的 `setup-skills --list` 同样不含 `kilo-code`，用不了。
- 换别的 agent：`configure --agent <id>` 同理（`cursor` / `claude-code` / `vscode-copilot` …）。改动的文件（`.kilocode\mcp.json` 及其备份）要报给用户。

## 6. 初始化工具集（参考 `reference/tool.md`）

Unity 侧**只留一个**工具 `tool-set-enabled-state`：它是唯一的"开关"，关掉就再也开不回来；这也正是插件的 `unity_tools_restore` 保留集，等于最小常驻状态。

```powershell
unity-mcp-cli configure $proj --list | Select-String '\[enabled\]'   # 先看当前状态

# 必须分成两条执行 —— 见下面的顺序陷阱
unity-mcp-cli configure $proj --disable-all-tools
unity-mcp-cli configure $proj --enable-tools tool-set-enabled-state

unity-mcp-cli configure $proj --list | Select-String '\[enabled\]'   # 复验：恰好 1 条
```

- ⚠️ **顺序陷阱（实测）**：`--disable-all-tools` 与 `--enable-tools` **不能写在同一条命令里** —— disable-all 会覆盖 enable，结果连唯一的开关 `tool-set-enabled-state` 都被关掉（0 个启用），那就再也没有工具能把它开回来。必须分两条：先 disable-all，再 enable-tools。
- 万一已经被全部关掉：单独跑一条 `unity-mcp-cli configure $proj --enable-tools tool-set-enabled-state` 即可救回，不用重装插件。
- 复验结果应当**只有** `tool-set-enabled-state` 是 `[enabled]`，其余全是 `[disabled]`（参考实测：1 enabled / 119 disabled）。
- 这一步直接读写项目配置，**不需要 Unity 在运行**。
- prompts / resources 默认全关，保持关闭即可；除非用户明确要求，不要打开。
- 需要别的命令时，交给 `/unity-mcp-tools` 的按需流程（开启 → 用 → `unity_tools_restore` 收回），不要在这里预先全开：每个已启用命令的 schema 都会进入之后每一次模型请求。

## 7. 探测与实测

```powershell
Test-NetConnection -ComputerName localhost -Port 20000 -InformationLevel Quiet
netstat -ano | Select-String ':20000\s' | Select-String 'LISTENING'
unity-mcp-cli status $proj                 # 需要时用 --url / --token / --timeout 覆盖
unity-mcp-cli wait-for-ready $proj         # 最长 120s
```

DSH 侧只有一条真正的实测：**调用 `unity_mcp_activate`**。

- 成功 → 桥接连上并注册 `mcp__unity__*` 工具，检查完成；若本次任务不需要 Unity，立刻 `unity_tools_restore` 回到休眠（它同时把工具集还原成只留 `tool-set-enabled-state`）。
- 失败 → 保留错误原文（`ECONNREFUSED` = 20000 没人听；404/405 = 端点路径不对；401/403 = token 不对），再回到第 4 步核对两端端口。

## 8. 报告格式

| 检查项 | 结果 |
|---|---|
| `unity-mcp-cli` | 已装 v1.2.0（与插件 lockstep）/ 未装 / 已升级 0.91.0 → 1.2.0 |
| Unity 包 `com.ivanmurzak.unity.mcp` | 已装 1.2.0 / 未装 |
| MCP Server | 项目 `Library\mcp-server\win-x64\` 9.2.11 + CLI 托管目录 `~\.ai-game-dev\server\win-x64\`（含 `version` 标记）/ 缺 |
| Unity 编辑器 | 运行中 / 未运行 |
| Unity 侧端口 | 原 24009 → 已统一 20000（附备份路径）/ 本来就是 20000 |
| DSH 侧 url | `http://localhost:20000/mcp`（一致 / 已改） |
| AI agent | Kilo Code：`.kilocode\mcp.json` → `http://localhost:20000/p/<pin>`；`skillsPath=.kilocode\skills` |
| 工具集 | 只有 `tool-set-enabled-state` 为 `[enabled]` |
| `unity_mcp_activate` | 成功 / 失败（原文错误） |
| 改动的文件 | 列出（含备份路径）；无则写"无" |

## 常见故障

| 现象 | 原因 | 处理 |
|---|---|---|
| 20000 没人听 | Unity 没开、改了配置但没重载、或服务器没启动 | 重载项目 / 在 Window → AI Game Developer 里启动服务器 |
| 改了 host 但端口没变 | Unity 没重新加载项目 | 重启编辑器；`status` 再看 Config Server |
| 别的客户端连不上 | 它们仍 pin 在旧端口（如 24009） | 一并改成 20000，或与用户确认是否回退 |
| manifest 里有包但连不上 | Unity 还没解析包 | 用 Unity 打开项目一次 |
| 404 / 405 | 端点路径不对（`/mcp` ↔ `/p/<token>`） | 以 `http://localhost:20000/mcp` 为准；需要 token 路径时再补 |
| 401 / 403 | token 缺失或过期 | 用项目配置里的 token；或 `bootstrap-local --url ... --token ...` 重新固定 |
| 工具全被关掉（含 `tool-set-enabled-state`） | 把 `--disable-all-tools` 与 `--enable-tools` 写进了同一条命令（上面那个顺序陷阱） | 单独跑一条 `unity-mcp-cli configure $proj --enable-tools tool-set-enabled-state` 救回 |
| 工具名冲突 / 行为异常 | stock `dsh-mcp-client` 与桥接插件同时跑同一 `serverName` | 只留一个 |
| `ERROR: Unknown agent: "kilo-code"` | 用了 `setup-mcp`（CLI 0.91.0/1.2.0 的列表只有 14 个 agent，不含 `kilo-code`） | 改用 `unity-mcp-cli configure $proj --agent kilo-code --url http://localhost:20000`（托管 Server 侧有 16 个） |
| `No managed GameDev-MCP-Server binary found …` | 没装托管 Server（缺 `--with-server`） | 跑 `/unity-mcp-install` 的 `install-plugin --with-server`；或临时用项目 `Library\mcp-server\<rid>\gamedev-mcp-server.exe` 直接跑 `configure --agent` |
| 凭空多出个监听 8080 的 `gamedev-mcp-server` | 对 server exe 跑了裸 `--help`（它不是帮助，是直接启动） | 按端口找 PID 杀掉（`Get-NetTCPConnection -LocalPort 8080`）；只用 `configure --help` 这类子命令帮助 |
| DSH 通、Kilo Code 连不上 | `.kilocode\mcp.json` 里 pin 的端口不是 20000（端口改过后没重配 agent） | 重跑 `configure --agent kilo-code --url http://localhost:20000`，再核对 `url` 里的端口 |
