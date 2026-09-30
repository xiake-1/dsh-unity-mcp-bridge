---
name: unity-mcp-check
description: 检查 DSH 的 unity-mcp-bridge 与 Unity 项目的 MCP 插件是否连通：定位项目、取真实端点（默认端口 20000）、探端口与 HTTP、用 unity_mcp_activate 实测，失败时按项目实际端口改写 profile 的 cordis.patch.yml。
whenToUse: 用户要求「检查 / 排查 Unity-MCP 连接」，或 unity_mcp_activate 连不上、/unity-mcp-tools 激活失败、刚跑完 /unity-mcp-install 时。
---

# 检查 DSH ↔ Unity-MCP 连接

两端各有一半，缺一不可：

| 端 | 东西 | 位置 |
|---|---|---|
| DSH | 桥接插件 `dsh-unity-mcp-bridge` | `%DSH_HOME%\profiles\%DSH_PROFILE%\`：`package.json` 的依赖 + `cordis.patch.yml` 里的 `unity-mcp` 行 |
| Unity | 包 `com.ivanmurzak.unity.mcp` 起的 MCP 服务器 | 项目内，HTTP 端点默认 `http://localhost:20000/mcp` |

> 默认端口 **20000**。若项目自己的配置不是 20000，**以项目为准**，并按第 5 步改写 DSH 侧。

## 1. DSH 侧现状

```powershell
$prof = $env:DSH_PROFILE_DIR          # 例如 C:\Users\<you>\.dsh\profiles\desktop
Get-Content (Join-Path $prof 'package.json') -Raw | Select-String 'dsh-unity-mcp-bridge'
Select-String -Path (Join-Path $prof 'cordis.patch.yml') -Pattern 'unity-mcp' -Context 0,12
```

记下：依赖在不在、`url:` 写的什么、`serverName`（默认 `unity`）。同时确认**没有**第二份指向同一 `serverName` 的 stock `@deepseek-ai/dsh-mcp-client` 配置——两者同时跑会抢同一命名空间。

## 2. 定位 Unity 项目

同 `/unity-mcp-install` 第 3 步：找 `ProjectSettings\ProjectVersion.txt`，取唯一那个；0 个或多个就停下来问用户。

## 3. 取项目真实端点（按顺序，先命中先用）

```powershell
# a) CLI 自动探测（最省事，需要 unity-mcp-cli）
unity-mcp-cli status $proj

# b) 项目自己的配置：host + token
Get-Content (Join-Path $proj 'UserSettings\AI-Game-Developer-Config.json') -Raw

# c) 服务器日志里的实际监听端口（取最后一条）
Select-String -Path (Join-Path $proj 'Library\mcp-server\win-x64\logs\server-log.txt') -Pattern 'Start listening on port'
```

- `status` 直接给 Editor 与 MCP 服务器的连接状态，可用 `--url` / `--token` / `--timeout` 覆盖。
- 配置里的 `host` 形如 `http://localhost:24009`，另有 `token`、`transportMethod`、`authOption`。
- 端点形式两种都试，哪个通用哪个：`http://localhost:<port>/mcp`，或把 token 放进路径 `http://localhost:<port>/p/<token>`。
- 日志只反映历史，取**最后一条** `Start listening on port: N`。

## 4. 探测与实测

```powershell
$port = 20000        # 或第 3 步得到的真实端口
Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet
netstat -ano | Select-String ":$port\s" | Select-String 'LISTENING'

# Unity 侧自检（带 token；不必先激活桥接）
unity-mcp-cli status --url "http://localhost:$port/mcp" --token '<token>' --timeout 5000
unity-mcp-cli wait-for-ready --url "http://localhost:$port/mcp" --token '<token>'   # 最长 120s
```

DSH 侧只有一条真正的实测：**调用 `unity_mcp_activate`**。

- 成功 → 桥接连上并注册 `mcp__unity__*` 工具，检查完成。若本次任务并不需要 Unity，立刻 `unity_tools_restore` 回到休眠（激活状态下每个已启用命令的 schema 都会进入之后每一次请求）。
- 失败 → 保留错误原文（`ECONNREFUSED` = 端口没人听；404/405 = 路径不对；401/403 = token 不对），继续第 5 步。

## 5. 失败时：按项目端口修正 DSH 配置

只有确认「项目端点是 X、DSH 里写的是 Y」且确实不一致时才动手：

1. 先备份：`Copy-Item (Join-Path $prof 'cordis.patch.yml') (Join-Path $prof ("cordis.patch.yml.bak-" + (Get-Date -Format yyyyMMdd-HHmmss)))`
2. 把 `unity-mcp` 行的 `url:` 改成项目真实端点（端口 + `/mcp` 或 `/p/<token>`）。
3. 让改动生效：
   - profile 有 `patchReload: live` → 存盘即热重载；
   - 否则**重启 DSH**（桌面端就重启应用）。
4. 重跑第 4 步复验。
5. profile 里**根本没有** `unity-mcp` 行 → 这属于「没装/没配」，交给 `/unity-mcp-install` 处理，别在这里现编配置。

只改 `url:` 那一行；其余内容和 `package.json` 里的既有写法都不要顺手改。

## 6. 报告格式

给一张表，不要只报结论：

| 检查项 | 结果 |
|---|---|
| `unity-mcp-cli` | 已装 v0.91.0 / 未装 |
| Unity 包 `com.ivanmurzak.unity.mcp` | 已装 / 未装 |
| Unity 编辑器 | 运行中 / 未运行 |
| 端口 | 配置 20000 ↔ 实际 24009（一致 / 不一致） |
| `unity_mcp_activate` | 成功 / 失败（原文错误） |
| 已做的修改 | 无 / 改 `cordis.patch.yml` 的 `url`（附备份路径） |

## 常见故障

| 现象 | 原因 | 处理 |
|---|---|---|
| 端口没人听 | Unity 没开，或服务器没启动 | 打开项目，在 Window → AI Game Developer 里启动服务器 |
| manifest 里有包但连不上 | Unity 还没解析包 | 用 Unity 打开项目一次 |
| 404 / 405 | 端点路径不对（`/mcp` ↔ `/p/<token>`） | 换另一种端点形式重试 |
| 401 / 403 | token 缺失或过期 | 用项目配置里的 token；或用 `unity-mcp-cli bootstrap-local --url <url> --token <token>` 重新固定 |
| 工具名冲突 / 行为异常 | stock `dsh-mcp-client` 与桥接插件同时跑同一 `serverName` | 只留一个 |
| 改了 `url` 仍连不上 | profile 没有热重载 | 重启 DSH |
| 端口每次都变 | 项目用的是随机/自定义端口 | 以第 3 步的探测结果为准，必要时用 `bootstrap-local` 固定端口 |
