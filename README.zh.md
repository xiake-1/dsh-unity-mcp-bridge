# dsh-unity-mcp-bridge — 插件说明

给 **DeepSeek Harness（DSH）** 用的 Unity MCP 桥接插件：把 Unity 编辑器里的 MCP 服务端（AI Game Developer / `com.ivanmurzak.unity.mcp`）接到 DSH，让模型能按需调用 Unity 工具。

> English README → [README.md](README.md) ｜ 特性与实测数据 → [FEATURES-AND-COMPARISON.md](FEATURES-AND-COMPARISON.md) ｜ 官方文档 → <https://ai-game.dev/engines/unity>

## 它解决什么

- **默认休眠**：开机不连接 Unity、不注册任何 Unity 工具。不碰 Unity 的会话只多出 2 个钩子工具（约 224 tokens）。
- **按需开启**：`/unity-mcp-tools` 激活后，只开启本次任务要用的命令。每个已开启命令的完整 JSON Schema 都会进入**之后每一次**模型请求，所以用完必须收回。
- **自动重同步**：调用 `tool-set-enabled-state` 之后，桥接自己重新拉 `tools/list` 并替换注册表，不依赖服务端的 `list_changed` 通知（DSH 长会话收不到）。
- **一键收回**：`unity_tools_restore` 关闭除管理工具外的全部工具**并断开连接**，回到休眠。
- **自带命令目录**：73 个 Unity 命令按分类随包发布，模型按需只读一个分类文件。

## 安装

`<profile>` 指 DSH profile：`web` 对应 `npx dsh web`，`desktop` 对应桌面端。

```powershell
# 从 git 安装
dsh plugin --profile <profile> add git+https://github.com/xiake-1/dsh-unity-mcp-bridge.git

# 或从本地源码目录安装
dsh plugin --profile <profile> add file:<path-to-this-checkout>
```

然后把下面这段加进 `%DSH_HOME%\profiles\<profile>\cordis.patch.yml`，再重启对应应用：

```yaml
- insert:
    - id: unity-mcp
      name: 'dsh-unity-mcp-bridge'
      config:
        serverName: unity
        transport: streamable-http
        url: http://localhost:20000/mcp
        resyncAfterTools:
          - tool-set-enabled-state
        resyncIntervalMs: 0
```

## 三个技能

| 技能 | 用途 |
|---|---|
| `/unity-mcp-tools` | 打开 Unity 能力：激活 → 查命令目录 → 按需开启 → 用完恢复休眠 |
| `/unity-mcp-install` | 在工作区内定位 Unity 项目并安装 Unity-MCP 插件（缺 `unity-mcp-cli` 就先装它） |
| `/unity-mcp-check` | 把两端端口统一到 **20000**、把工具集初始化成只留 `tool-set-enabled-state`，再实测连通性 |

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

再从 `cordis.patch.yml` 删掉上面的 `unity-mcp` 行即可，不会改动包以外的文件。

## 许可与出处

MIT。`lib/index.js` 派生自 `@deepseek-ai/dsh-mcp-client` v0.1.5-rc.2（MIT, © 2026 DeepSeek）并做了四处修改，详见文件头与 [LICENSE](LICENSE)。
