---
name: unity-mcp-check
description: 检查 DSH 的 unity-mcp-bridge 与 Unity 项目的 MCP 插件是否连通：两端端口统一到 20000（项目侧不是 20000 就用 bootstrap-local 改过来）、按 reference/tool.md 把 Unity 工具集初始化为只留 tool-set-enabled-state，再用 unity_mcp_activate 实测。
whenToUse: 用户要求「检查 / 排查 Unity-MCP 连接」，或 unity_mcp_activate 连不上、/unity-mcp-tools 激活失败、刚跑完 /unity-mcp-install 时。
---

# 检查 DSH ↔ Unity-MCP 连接

两端各有一半，缺一不可，**端口统一为 20000**：

| 端 | 东西 | 位置 |
|---|---|---|
| DSH | 桥接插件 `dsh-unity-mcp-bridge` | `%DSH_HOME%\profiles\%DSH_PROFILE%\`：`package.json` 的依赖 + `cordis.patch.yml` 里的 `unity-mcp` 行（`url` 必须是 `http://localhost:20000/mcp`） |
| Unity | 包 `com.ivanmurzak.unity.mcp` 起的 MCP 服务器 | 项目 `UserSettings\AI-Game-Developer-Config.json` 的 `host`（必须是 `http://localhost:20000`） |

> **20000 是唯一标准端口。** 哪一端不是 20000，就把**那一端**改成 20000：Unity 侧用 `unity-mcp-cli bootstrap-local`，DSH 侧改 `cordis.patch.yml`。

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
- ⚠️ 顺手检查还有谁 pin 了旧端口（项目里的 `.kilocode/mcp.json`、其它 MCP 客户端配置），一并改成 20000，否则那些客户端会连不上。**改动了哪些文件必须报给用户。**
- 如果用户明确要求保留项目原端口（例如别的客户端已经固定用它），**停下来问**，不要强行统一 —— 本技能的默认策略是统一到 20000。

**DSH 侧不是 20000 时**：备份 `cordis.patch.yml`，把 `unity-mcp` 行的 `url:` 改成 `http://localhost:20000/mcp`；profile 有 `patchReload: live` 则存盘即热重载，否则重启 DSH。只改这一行。

## 5. 初始化工具集（参考 `reference/tool.md`）

Unity 侧**只留一个**工具 `tool-set-enabled-state`：它是唯一的"开关"，关掉就再也开不回来；这也正是插件的 `unity_tools_restore` 保留集，等于最小常驻状态。

```powershell
unity-mcp-cli configure $proj --list                                                  # 看当前状态
unity-mcp-cli configure $proj --disable-all-tools --enable-tools tool-set-enabled-state
unity-mcp-cli configure $proj --list | Select-String '\[enabled\]'                    # 复验
```

- 复验结果应当**只有** `tool-set-enabled-state` 是 `[enabled]`，其余全是 `[disabled]`。
- 这一步直接读写项目配置，**不需要 Unity 在运行**。
- prompts / resources 默认全关，保持关闭即可；除非用户明确要求，不要打开。
- 需要别的命令时，交给 `/unity-mcp-tools` 的按需流程（开启 → 用 → `unity_tools_restore` 收回），不要在这里预先全开：每个已启用命令的 schema 都会进入之后每一次模型请求。

## 6. 探测与实测

```powershell
Test-NetConnection -ComputerName localhost -Port 20000 -InformationLevel Quiet
netstat -ano | Select-String ':20000\s' | Select-String 'LISTENING'
unity-mcp-cli status $proj                 # 需要时用 --url / --token / --timeout 覆盖
unity-mcp-cli wait-for-ready $proj         # 最长 120s
```

DSH 侧只有一条真正的实测：**调用 `unity_mcp_activate`**。

- 成功 → 桥接连上并注册 `mcp__unity__*` 工具，检查完成；若本次任务不需要 Unity，立刻 `unity_tools_restore` 回到休眠（它同时把工具集还原成只留 `tool-set-enabled-state`）。
- 失败 → 保留错误原文（`ECONNREFUSED` = 20000 没人听；404/405 = 端点路径不对；401/403 = token 不对），再回到第 4 步核对两端端口。

## 7. 报告格式

| 检查项 | 结果 |
|---|---|
| `unity-mcp-cli` | 已装 v0.91.0 / 未装 |
| Unity 包 `com.ivanmurzak.unity.mcp` | 已装 / 未装 |
| Unity 编辑器 | 运行中 / 未运行 |
| Unity 侧端口 | 原 24009 → 已统一 20000（附备份路径）/ 本来就是 20000 |
| DSH 侧 url | `http://localhost:20000/mcp`（一致 / 已改） |
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
| 工具被人为全关 | 误关 `tool-set-enabled-state` | `unity-mcp-cli configure $proj --enable-tools tool-set-enabled-state` |
| 工具名冲突 / 行为异常 | stock `dsh-mcp-client` 与桥接插件同时跑同一 `serverName` | 只留一个 |
