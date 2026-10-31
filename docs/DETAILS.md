# dsh-unity-mcp-bridge — 详细文档 / Details

README 只写简介、安装、使用。这里放其余全部细节。

This file holds everything the README leaves out.

---

## 为什么不用直接 patch 已装包 / Why not patch the installed package

`@deepseek-ai/dsh-mcp-client` 是 npx 缓存里的构建产物，`npx @deepseek-ai/dsh` 随时可能重装或升级它，手工 patch 会被静默抹掉。本包自带实现，版本由自己钉住。

The bridge is vendored here, so a DSH/npx upgrade cannot silently revert it.

核心修复是 **`resyncAfterTools`**：列出的工具调用返回后，桥接自己重新拉 `tools/list` 并替换注册表，不等服务端的 `notifications/tools/list_changed`（DSH 长会话收不到该通知）。

---

## DSH 版本兼容 / Version compatibility

五个 `@deepseek-ai/dsh-*` peer 声明的是下限而非钉版（`>=0.1.5-rc.2`），一份 checkout 可装进 0.1.5-rc.2 起的任意 DSH 运行时。已按宿主自己的门禁（`dsh-app-boot` → `evaluatePluginCompatibility`，即 `semver.satisfies(version, range, { includePrerelease: true })`）验证 0.1.5-rc.2、0.1.7-rc.2、0.2.0-rc.2。`@deepseek-ai/cordis` 保持 `^4.0.2`（独立版本线，宿主不 gate）。真正不兼容的未来运行时由宿主安装期门禁报出。

---

## 安装细节 / Install details

本地源码安装：

```powershell
dsh plugin --profile <profile> add file:<path-to-this-checkout>
```

插件包自带的 bundle patch 会插入 `unity-mcp` 行（`url: http://localhost:20000/mcp`），不需要手写 profile patch。bundle 不插入任何行时插件会显示「已安装，未生效」；桌面端会把 profile 的 `cordis.patch.yml` 当成自己设置存储的导出文件重写，手写行下次重启即消失。若仍显示未生效，检查该 profile `package.json` 的 `dsh.profile.bundles` 是否包含 `dsh-unity-mcp-bridge`——决定 bundle 是否加载的是它，不是 patch。

> 不要同时运行本桥接和原版 `@deepseek-ai/dsh-mcp-client` 连同一个 `serverName`：两者是不同模块实例，各自认为命名空间归自己，会发布同名工具。

---

## 配置 / Configuration

原版客户端接受的字段（`serverName`、`transport`、stdio 的 `command`/`args`/`env`/`cwd`、streamable-http 的 `url`/`headers`、`toolCallTimeoutMs`、`failOnStartupError`、`reconnect.*`）全部照旧可用。此外：

| 字段 | 默认 | 说明 |
|---|---|---|
| `autoStart` | **`false`** | 默认休眠：不连接、不注册桥接工具。设 `true` 则开机即连（旧的常驻行为）。 |
| `activateToolName` | `unity_mcp_activate` | 常驻激活钩子的名字。 |
| `restoreDeactivates` | `true` | `unity_tools_restore` 同时断开连接，回到休眠；`false` 保持连接。 |
| `skillModelInvocable` | **`false`** | 命令目录技能不提供给模型，因此不会自动加载，Unity 能力不会自己开启。 |
| `skillUserInvocable` | `true` | 用户可调用：`/unity-mcp-tools` 是唯一的开启入口。 |
| `resyncAfterTools` | `[]` | 这些原始 MCP 工具名的**调用完成**会触发一次 `tools/list` 重同步与注册表替换。按需工作流设为 `['tool-set-enabled-state']`。触发在调用返回后约 200 ms，先让本次结果收尾。 |
| `resyncIntervalMs` | `0` | 周期性重同步（ms），`0` 关闭。开启后也能发现手工在 Unity 窗口里改的开关，代价是每轮重建工具注册。 |
| `restoreToolName` | `unity_tools_restore` | 原生恢复钩子的名字。 |
| `keepEnabledTools` | `[]` | 恢复时额外保留的原始工具名（除 `tool-set-enabled-state` 之外）。 |
| `registerCatalogSkill` | `true` | 是否注册随包的命令目录技能。 |
| `skillName` | `unity-mcp-tools` | 技能名 / 斜杠命令。 |
| `registerHelperSkills` | `true` | 是否注册两个辅助技能。 |
| `installSkillName` | `unity-mcp-install` | 安装 Unity 侧插件的技能名。 |
| `checkSkillName` | `unity-mcp-check` | 检查连通性的技能名。 |
| `helperSkillsModelInvocable` | `true` | 辅助技能与目录不同，会提供给模型。 |
| `helperSkillsUserInvocable` | `true` | 同时也是用户斜杠命令。 |

---

## 激活模型 / Activation model

插件**开机即休眠**：只注册两个极小的钩子工具，不连接 Unity。不用 Unity 的会话只多约 **895 字符（~224 tokens）**。

```
boot ──► DORMANT ──(/unity-mcp-tools ─► unity_mcp_activate)──► ACTIVE ──(unity_tools_restore)──► DORMANT
           2 hook tools                                          bridged mcp__unity__* tools
```

每个已开启命令的完整 JSON Schema 都会进入**之后每一次**模型请求；关闭的命令贡献为零。开启是临时、可回收的成本——忘记第 4 步才会变成永久成本。恢复工具的存在就是为了让第 4 步不必枚举所有已注册名字（数量本身随版本变：0.9x 是 73 个，1.2.0 是 18 个）。

---

## 辅助技能做什么 / What the helper skills do

| 技能 | 内容 |
|---|---|
| `/unity-mcp-install` | 检查 `unity-mcp-cli` 是否在本机（缺则 `npm install -g unity-mcp-cli`），并核对 **CLI / Unity 插件 / MCP Server 三者 lockstep**（老 CLI 的 AI agent 列表会缺项，例如没有 `kilo-code`）。在工作区内按 `ProjectSettings/ProjectVersion.txt` 定位 Unity 工程；`Packages/manifest.json` 里已有 `com.ivanmurzak.unity.mcp` 就报告，否则 `unity-mcp-cli install-plugin <project> --with-server`（同时把 `GameDev-MCP-Server` 二进制放进 CLI 托管目录 `~/.ai-game-dev/server/<rid>/`），再重读 manifest 验证。GitHub 下载失败时走本机系统代理（Clash）：端口从注册表读而不是猜，`NODE_USE_ENV_PROXY=1` 必需（Node 24 的全局 `fetch` 否则忽略 `HTTP_PROXY`），`NO_PROXY` 必须让 OpenUPM/npm 直连。最后手段：带断点续传的代理下载 + 对 release `SHA256SUMS` 校验 + `--server-source` 安装。仓库带 `vendor/` 离线包时优先离线：`tools/offline-package.mjs install` 写 Unity 官方支持的 `file:` 本地 tarball 依赖（自动备份 manifest），Server 来自缓存 zip，全新工程不联网即可装好。 |
| `/unity-mcp-check` | 把两端统一到 **20000**：Unity 侧 `unity-mcp-cli bootstrap-local --url http://localhost:20000/`（改项目自己的 `UserSettings/AI-Game-Developer-Config.json`，先带时间戳备份 + `--dry-run` 比对）；DSH 侧 `unity-mcp` 行漂移就纠正回 `http://localhost:20000/mcp`；仍钉旧端口的其他客户端只报告、不静默改。**再把 AI agent 配成 Kilo Code**：`unity-mcp-cli configure <project> --agent kilo-code --url http://localhost:20000` 写 `.kilocode/mcp.json`（`url` 为 `http://localhost:20000/p/<pin>`）；`setup-mcp` 的列表没有 `kilo-code`，所以走 `configure --agent`，托管二进制缺失时回退到项目自己的 `Library/mcp-server/<rid>/gamedev-mcp-server.exe`。然后把 Unity 工具集初始化成只留 `tool-set-enabled-state`：两次 `configure` 调用——先 `--disable-all-tools`，再 `--enable-tools tool-set-enabled-state`，**不能合并成一条**（disable-all 优先，会把唯一能撤销它的管理工具也关掉）。最后探测端口与 HTTP 端点，并用 `unity_mcp_activate` 实测。之前还会跑 `tools/offline-package.mjs check`，比对**上游最新 / `vendor/` 缓存 / 项目已装**（外加 CLI）并给出优先走代理的更新路径——只报告，不自行升级。 |

两者都遵循官方安装流程 <https://ai-game.dev/engines/unity>。设 `registerHelperSkills: false` 可不发布它们。

---

## 离线包与更新检查（`vendor/`）/ Offline package cache

上游 `com.ivanmurzak.unity.mcp` 已发 **180 个 release**（`0.8.3` 2025-06-23 → `1.5.0` 2026-10-24）。改动最大的是 **`1.0.0`（2026-10-15）：RQL 取代数据类工具**——两条 `feat(rql)!` breaking 把 0.9x 的 73 个细粒度命令缩成 18 个（`rql-query` / `rql-mutate` / `rql-schema`），命令目录必须跨这个版本重生成。其余大改造：`0.81.0`（MCP Server 拆成共享的 `GameDev-MCP-Server`，从此独立编号）、`0.84.0`/`0.85.0`（鉴权重做：`ConnectionConfig.Token` 迁移、`cloudToken` 移除）、`1.1.0`（扩展包独立发布，现为 `2.0.x`）、`1.3.0`（`script-execute` 换 Code-Exec、CLI editor sessions、McpPlugin 8.11.0 工具超时）、`1.5.0`（独立 CLI 与 App skills）。

`vendor/` 缓存可安装产物，让新 Unity 工程不碰 GitHub 也能装（明细见 [vendor/README.md](../vendor/README.md)）：插件 tarball `com.ivanmurzak.unity.mcp-1.5.0.tgz`（833,033 B）与 `gamedev-mcp-server-win-x64-9.2.17.zip`（45,558,728 B，对 release `SHA256SUMS` 校验）。**lockstep 是读出来的，不是猜的**：`tools/offline-package.mjs` 从 tarball 里取 `McpServerManager.ServerVersion`（插件 `1.5.0` 钉 Server `9.2.17`），CLI 与插件同号。

```powershell
# 三层比对：上游最新 / vendor 缓存 / 项目已装
node "<plugin>\tools\offline-package.mjs" check --project <unity-project> --cli-version (unity-mcp-cli --version)

# 刷新：优先代理（GitHub release 资产是最不稳的一条），断点续传 + SHA256 校验
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'; $env:NODE_USE_ENV_PROXY = '1'
node "<plugin>\tools\offline-package.mjs" fetch

# 装进新的 Unity 工程
node "<plugin>\tools\offline-package.mjs" install --project <unity-project>
unity-mcp-cli install-plugin <unity-project> --with-server --server-version 9.2.17 `
  --server-source "<plugin>\vendor\gamedev-mcp-server-win-x64-9.2.17.zip"
```

`install-plugin` **没有** `--plugin-source`；离线路径是 Unity 官方支持的 `file:` 本地 tarball 依赖。CLI 不会覆盖 `file:` / `git+` / `http:` 依赖（`dist/utils/manifest.js` 的 `nonSemverPrefixes`），所以之后重跑 `install-plugin` 也安全。

---

## 重新生成命令目录 / Regenerating the catalog

`tools/generate-unity-mcp-catalog.ps1` 扫描已安装的 `com.ivanmurzak.unity.mcp@*` 包，重写 `skills/SKILL.md` 与 `skills/reference/*.md`（分类取自插件自己的 `[AiTool(Title = ...)]` 属性）。升级 Unity 插件后重跑，再重启 `dsh web`。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/generate-unity-mcp-catalog.ps1 -ProjectRoot <your-unity-project>
```

插件 1.2.0 不再把工具描述写成字符串字面量，而是常量引用（如 `[Description(RqlGuide.QueryDescription)]`），`RqlGuide` 还会把字面量与其他常量拼接。生成器会求值这些常量，RQL 语言手册因此能落到 `reference/rql.md`：`-BodyTools`（默认 `rql-*`）决定哪些命令带上插件自己的 `[AiToolBody]`/`[AiSkillBody]` 正文，于是机械类命令保持一行，语言类工具带完整指南。脚本必须存为 **带 BOM 的 UTF-8**——Windows PowerShell 5.1 会把无 BOM 的 UTF-8 当 ANSI，中文会变成解析错误。

---

## 卸载 / Uninstall

```powershell
dsh plugin --profile <profile> remove dsh-unity-mcp-bridge
```

`unity-mcp` 行随 bundle 一起消失。只有曾在本 profile 的 `cordis.patch.yml` 里加过覆盖行时才需要删掉它。本包不修改自身以外的文件，所以回滚就是移除。

---

## 出处与许可 / Provenance and license

MIT。`lib/index.js` 派生自 `@deepseek-ai/dsh-mcp-client` v0.1.5-rc.2（MIT, Copyright (c) 2026 DeepSeek，见 [LICENSE](../LICENSE)）。文件头列明改动：插件改名、`resyncAfterTools`/`resyncIntervalMs`、同步完成回报、恢复钩子、运行时命令目录技能。MIT 允许这样做，上游版权声明保留。

---

## 自测 / Self-test

`tools/selftest.mjs` 用一个最小假宿主上下文驱动真实插件连一个活的 Unity MCP 服务端，不需要重启 DSH。需要先装好包依赖（包内 `pnpm install`，或从已有依赖的 profile 里跑），端点从 `UNITY_MCP_URL` 读，仓库里不存项目 token。

```powershell
$env:UNITY_MCP_URL = 'http://localhost:24009/p/<your-token>'
node tools/selftest.mjs
```

依次断言：模块导出；`Config` 接受全部新字段且默认值与上游兼容；`apply()` 连接并注册桥接工具与原生钩子；命令目录技能以正确的 `resourceBase` 注册且正文含工作流；**调用桥接管理工具会让桥接自行重同步**（新开启的工具出现在注册表里）；恢复钩子关闭 keep 集之外的一切。

参考环境上的实测输出：

```
3) apply() 启动…
   [info] unity-mcp-bridge: catalog skill "unity-mcp-tools" registered
   桥接工具: mcp__unityprobe__tool-set-enabled-state
   原生工具: unity_tools_restore
   技能正文包含工作流与恢复指令: true
4) 通过桥接工具开启 gameobject-find …
   [info] unity-mcp-bridge(unityprobe): tool tool-set-enabled-state returned, re-syncing tool list
   >>> 自动重同步是否生效: 是 ✓
5) 调用恢复工具 keep=[unity-tool-list] …
   返回: Disabled 1 Unity-MCP tool(s); kept enabled: tool-set-enabled-state, unity-tool-list.
   恢复后桥接工具: mcp__unityprobe__tool-set-enabled-state
```

---

## 验证状态 / Status

- **已对活服务端验证**：模块加载、`Config` 默认值、`apply()` 注册（桥接工具 + 原生钩子）、运行时技能注册与 `resourceBase`、管理工具调用后的自驱动重同步、恢复钩子的「关闭除 keep 之外全部」行为。见 `tools/selftest.mjs`。
- **未在此验证**：通过 `dsh plugin --profile web add` 的安装与完整 `dsh web` 启动挂载——那需要 profile 安装与一次 DSH 重启。
