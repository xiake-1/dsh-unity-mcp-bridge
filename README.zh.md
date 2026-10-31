# dsh-unity-mcp-bridge — 插件说明

给 **DeepSeek Harness（DSH）** 用的 Unity MCP 桥接插件：把 Unity 编辑器里的 MCP 服务端（AI Game Developer / `com.ivanmurzak.unity.mcp`）接到 DSH，让模型能按需调用 Unity 工具。

> English README → [README.md](README.md) ｜ 特性与实测数据 → [FEATURES-AND-COMPARISON.md](FEATURES-AND-COMPARISON.md) ｜ 官方文档 → <https://ai-game.dev/engines/unity>

## 它解决什么

- **默认休眠**：开机不连接 Unity、不注册任何 Unity 工具。不碰 Unity 的会话只多出 2 个钩子工具（约 224 tokens）。
- **按需开启**：`/unity-mcp-tools` 激活后，只开启本次任务要用的命令。每个已开启命令的完整 JSON Schema 都会进入**之后每一次**模型请求，所以用完必须收回。
- **自动重同步**：调用 `tool-set-enabled-state` 之后，桥接自己重新拉 `tools/list` 并替换注册表，不依赖服务端的 `list_changed` 通知（DSH 长会话收不到）。
- **一键收回**：`unity_tools_restore` 关闭除管理工具外的全部工具**并断开连接**，回到休眠。
- **自带命令目录**：按分类随包发布，模型按需只读一个分类文件。命令名随插件版本变——1.2.0 是 18 个（旧版 73 个细粒度命令已被 `rql-query` / `rql-mutate` / `rql-schema` 取代），换版本后用 `tools/generate-unity-mcp-catalog.ps1` 重新生成。

## 安装

`<profile>` 指 DSH profile：`web` 对应 `npx dsh web`，`desktop` 对应桌面端。

```powershell
# 从 git 安装
dsh plugin --profile <profile> add git+https://github.com/xiake-1/dsh-unity-mcp-bridge.git

# 或从本地源码目录安装
dsh plugin --profile <profile> add file:<path-to-this-checkout>
```

插件包自带的 bundle patch 会插入 `unity-mcp` 这一行（`url: http://localhost:20000/mcp`），**不需要**再往 profile 的 `cordis.patch.yml` 里写任何东西。只有当这个 profile 要连别的端点时才覆盖它——用普通的 `id` 条目，不要再 `insert` 一遍：

```yaml
# %DSH_HOME%\profiles\<profile>\cordis.patch.yml（仅在端点不同时需要）
- id: unity-mcp
  config:
    url: http://localhost:20000/p/<your-token>
```

> 为什么不再要求手写：bundle patch 不插入任何行时，插件会显示「已安装，未生效」；而桌面端会把 profile 的 `cordis.patch.yml` 当成自己设置的导出文件重写，手写行会在下次重启后消失。若插件页仍显示未生效，检查该 profile `package.json` 里的 `dsh.profile.bundles` 是否包含 `dsh-unity-mcp-bridge`——决定 bundle 是否加载的是它，不是 patch。

## 三个技能

| 技能 | 用途 |
|---|---|
| `/unity-mcp-tools` | 打开 Unity 能力：激活 → 查命令目录 → 按需开启 → 用完恢复休眠 |
| `/unity-mcp-install` | 在工作区内定位 Unity 项目，安装 Unity-MCP 插件**与 MCP Server**（`--with-server`）；**先看 `vendor/` 离线包**（有则 `tools/offline-package.mjs install` 写 `file:` 本地依赖 + `--server-source`，不联网）；缺 `unity-mcp-cli` 就先装、并核对 CLI/插件/Server 版本 lockstep；GitHub 下载失败时用本机代理（Clash，需 `NODE_USE_ENV_PROXY=1`）重试，或离线 zip 过 `SHA256SUMS` 校验后 `--server-source` |
| `/unity-mcp-check` | 把两端端口统一到 **20000**、把 AI agent 配成 **Kilo Code**（写 `.kilocode/mcp.json`，走 `configure --agent` 而不是 `setup-mcp`）、把工具集初始化成只留 `tool-set-enabled-state`、**比对「上游最新 / `vendor/` 离线包 / 项目已装」三层版本并给出更新路径**（下载新版本优先走代理），再实测连通性 |

## 离线包与更新检查（`vendor/`）

上游 `com.ivanmurzak.unity.mcp` 已经发到 **180 个 release**（`0.8.3` 2025-06-23 → `1.5.0` 2026-10-24），改得最狠的是 **`1.0.0`（2026-10-15）：RQL 取代数据类工具**（`feat(rql)!` 两条 breaking），命令从 0.9x 的 73 个细粒度命令缩到 18 个（`rql-query` / `rql-mutate` / `rql-schema`）—— 桥接的命令目录必须跟着重生成。其余大改造：`0.81.0`（MCP Server 拆成共享的 `GameDev-MCP-Server`，从此 Server 独立编号）、`0.84.0`/`0.85.0`（鉴权与 `ConnectionConfig.Token` 迁移、`cloudToken` 移除）、`1.1.0`（扩展包独立发布，现为 `2.0.x`）、`1.3.0`（`script-execute` 换 Code-Exec、CLI editor sessions、McpPlugin 8.11.0 工具超时）、`1.5.0`（独立 CLI 与 App skills）。

`vendor/` 就是为「GitHub 不通也能装」准备的离线包（明细见 [vendor/README.md](vendor/README.md)）：

| 内容 | 版本 | 校验 |
|---|---|---|
| `com.ivanmurzak.unity.mcp-1.5.0.tgz` | 插件 1.5.0（833,033 B） | SHA256 `7f32ec8e…417506` |
| `gamedev-mcp-server-win-x64-9.2.17.zip` | Server 9.2.17（45,558,728 B） | 对官方 `SHA256SUMS` 校验通过 |

**lockstep 不靠猜**：脚本从 tarball 里的 `Editor/Scripts/McpServerManager.cs` 读 `ServerVersion` 常量 —— 插件 1.5.0 钉 Server **9.2.17**；CLI 与插件同号（1.5.0）。

```powershell
# 查：上游最新 / vendor 离线包 / 项目已装 三层比对（--project 指 Unity 工程）
node "<插件目录>\tools\offline-package.mjs" check --project <Unity工程> --cli-version (unity-mcp-cli --version)

# 下载新版本：优先代理（GitHub release 资产直连常被掐断），断点续传 + SHA256 校验
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'; $env:NODE_USE_ENV_PROXY = '1'
node "<插件目录>\tools\offline-package.mjs" fetch

# 装到新的 Unity 工程：写 file: 本地依赖（自动备份 manifest）+ 离线补 Server
node "<插件目录>\tools\offline-package.mjs" install --project <Unity工程>
unity-mcp-cli install-plugin <Unity工程> --with-server --server-version 9.2.17 `
  --server-source "<插件目录>\vendor\gamedev-mcp-server-win-x64-9.2.17.zip"
```

> `unity-mcp-cli install-plugin` **没有** `--plugin-source`；离线靠 Unity 官方支持的 `file:` 本地 tarball 依赖。CLI 对 `file:` / `git+` / `http:` 这类非 semver 依赖不会覆盖（`dist/utils/manifest.js` 的 `nonSemverPrefixes`），所以之后重跑 `install-plugin` 也不会把它改回版本号。

## 用法（按需工作流）

0. 用户执行 **`/unity-mcp-tools`**（该技能默认不对模型可见，这是唯一的开启入口）
1. 调 **`unity_mcp_activate`** —— 连接 Unity 并注册 `mcp__unity__*` 工具
2. 在目录里找到需要的命令，用 `mcp__unity__tool-set-enabled-state` 开启 —— **下一步**才生效
3. 下一步调用 `mcp__unity__<命令名>`
4. 收工调 **`unity_tools_restore`**（可带 `keep` 保留个别命令）

## 常用配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `url` | — | Unity MCP 端点，统一用 `http://localhost:20000/mcp` |
| `autoStart` | `false` | 保持休眠；设 `true` 则开机即连 |
| `resyncAfterTools` | `[]` | 设为 `['tool-set-enabled-state']` 才是按需工作流 |
| `toolCallTimeoutMs` | `60000` | 单次工具调用超时 |
| `registerCatalogSkill` | `true` | 是否注册命令目录技能 |
| `registerHelperSkills` | `true` | 是否注册 `/unity-mcp-install`、`/unity-mcp-check` |

完整字段与排错见 [README.md](README.md#configuration)。

## 卸载

```powershell
dsh plugin --profile <profile> remove dsh-unity-mcp-bridge
```

`unity-mcp` 行随 bundle 一起消失，不需要再改别的文件。只有当你曾在本 profile 的 `cordis.patch.yml` 里加过覆盖行时，才把它删掉。

## 许可与出处

MIT。`lib/index.js` 派生自 `@deepseek-ai/dsh-mcp-client` v0.1.5-rc.2（MIT, © 2026 DeepSeek）并做了四处修改，详见文件头与 [LICENSE](LICENSE)。
