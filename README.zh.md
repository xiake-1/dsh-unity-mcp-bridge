# dsh-unity-mcp-bridge

English → [README.md](README.md)

给 **DeepSeek Harness（DSH）** 用的 Unity-MCP 桥接插件：把 Unity 编辑器里的 MCP 服务端（`com.ivanmurzak.unity.mcp` / AI Game Developer）接入 DSH。默认休眠，要用的时候才连。

## 简介

- 开机即休眠：不连接、不注册任何 Unity 工具，只有 2 个钩子工具（约 224 tokens）。
- `/unity-mcp-tools` → `unity_mcp_activate` 才连接并注册 `mcp__unity__*`。
- 开启的命令**下一步**才生效；`unity_tools_restore` 关闭它们并断开，回到休眠。
- 随包发布插件 1.5.0 的命令目录（18 个命令，RQL-first；`/unity-mcp-update-tools` 可按新离线包重生成）与 `/unity-mcp-install`、`/unity-mcp-check`、`/unity-mcp-update`、`/unity-mcp-update-tools` 四个技能。
- `resyncAfterTools`：管理工具调用返回后桥接自己重拉 `tools/list`，不依赖 DSH 长会话收不到的 `list_changed` 通知。

## 安装

```powershell
dsh plugin --profile <profile> add git+https://github.com/xiake-1/dsh-unity-mcp-bridge.git
```

`<profile>` 是 `web`（`dsh web`）或 `desktop`。装完重启应用。包自带的 bundle patch 会自己插入 `unity-mcp` 行（`http://localhost:20000/mcp`），不需要手写 profile patch。

只有这个 profile 要连别的端点时才覆盖它，写在 `%DSH_HOME%/profiles/<profile>/cordis.patch.yml`：

```yaml
- id: unity-mcp
  config:
    url: http://localhost:20000/p/<your-token>
```

卸载：`dsh plugin --profile <profile> remove dsh-unity-mcp-bridge`

## 使用

| 入口 | 作用 |
|---|---|
| `/unity-mcp-install` | 给工作区里的 Unity 工程装上 Unity 侧插件与 MCP Server |
| `/unity-mcp-check` | 检查插件安装、端口 20000（不是就改）、DSH bundle 加载、工具集初始化、命令目录版本，再实测连通 |
| `/unity-mcp-update` | 检查 CLI、本地离线包（`vendor/`）与 Unity 插件的新版本，问过你才更新 |
| `/unity-mcp-update-tools` | 把离线包刷到最新并重生成 `/unity-mcp-tools` 的命令索引与扩展索引 |
| `/unity-mcp-tools` | 打开 Unity 能力：激活 → 找到命令 → 只开本次要用的 |
| `unity_tools_restore` | 关闭除管理工具外的全部工具并断开，回到休眠 |

其余全部细节（配置字段、`vendor/` 离线包、命令目录重生成、自测）见 [docs/DETAILS.md](docs/DETAILS.md)；特性与实测对比见 [FEATURES-AND-COMPARISON.md](FEATURES-AND-COMPARISON.md)。
