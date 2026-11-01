# vendor/ — AI Game Developer 离线包缓存

插件自带的离线包目录。目的：**GitHub 不通 / 网络慢时也能给新的 Unity 工程装上 MCP 插件**，并且让 `/unity-mcp-update` 能做「上游 vs 本地」的更新检查。

## 当前内容

| 文件 | 是什么 | 版本 | 大小 | SHA256 |
|---|---|---|---|---|
| `com.ivanmurzak.unity.mcp-1.6.0.tgz` | Unity 侧 UPM 包（AI Game Developer 插件） | 1.6.0 | 960,306 B | `13fd25794e6b13f1b179b9870a47c8548b0daefefd92c2bdb38aefe8f3c5178b` |
| `gamedev-mcp-server-win-x64-9.3.0.zip` | MCP Server 二进制（win-x64） | 9.3.0 | 44,088,479 B | `53a79b42fe42a595a673c3a5cb80a42f9f1b7028f5bb164f37df903e3e01dc2f` |
| `SHA256SUMS-9.3.0` | 官方发布页的校验清单（zip 的哈希就是对着它验的） | — | 689 B | — |
| `manifest.json` | 上面三者的机器可读记录（版本、哈希、来源 URL、插件钉住的 Server 版本） | — | — | — |

目录里还留着旧版 `com.ivanmurzak.unity.mcp-1.5.0.tgz` / `SHA256SUMS-9.2.17` / `gamedev-mcp-server-win-x64-9.2.17.zip` 供回滚，`manifest.json` 只指向当前版本（1.6.0 + 9.3.0），旧文件不参与解析。

**lockstep 事实来源**：插件 tarball 里 `Editor/Scripts/McpServerManager.cs` 写死 `public const string ServerVersion = "9.3.0"` —— 插件 1.6.0 只认 Server 9.3.0。`offline-package.mjs` 会直接从 tarball 里读这个常量，不靠猜。CLI（`unity-mcp-cli`）与插件同号（插件 1.6.0 ↔ CLI 1.6.0）。

## 刷新（更新检查 → 下载新版本）

```powershell
# 只查：上游最新 / vendor 缓存 / 项目已装 / 本机 CLI 四层比对
node "<插件目录>\tools\offline-package.mjs" check --project <Unity工程> --cli-version (unity-mcp-cli --version)

# 下载：优先代理（GitHub 资产直连常被掐断），失败自动回落直连；断点续传 + SHA256 校验
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'; $env:NODE_USE_ENV_PROXY = '1'
node "<插件目录>\tools\offline-package.mjs" fetch
```

哈希不匹配 → 脚本直接失败并让你删掉重下，不会留下「装上了但内容不对」的包。

日常刷新这个目录走 `/unity-mcp-update`：先只读比对「上游最新 / 本地 vendor / 项目已装 / 本机 CLI」，有更新先问用户，同意后才跑上面的 `fetch`（只动 `vendor/`，不碰 Unity 工程）。刷完之后要同步 `/unity-mcp-tools` 的命令索引与扩展索引，跑 `/unity-mcp-update-tools`。

## 离线装进 Unity 工程

```powershell
node "<插件目录>\tools\offline-package.mjs" install --project <Unity工程>   # 写 file: 依赖 + 备份 manifest
unity-mcp-cli install-plugin <Unity工程> --with-server --server-version 9.3.0 --server-source "<插件目录>\vendor\gamedev-mcp-server-win-x64-9.3.0.zip"
```

`install` 写的是 Unity 官方支持的本地 tarball 依赖（`"com.ivanmurzak.unity.mcp": "file:D:/…/vendor/com.ivanmurzak.unity.mcp-1.6.0.tgz"`，见 Unity 手册 *Local folder or tarball paths*）。`unity-mcp-cli` **没有** `--plugin-source`，但它对 `file:` 这类非 semver 依赖**不会覆盖**（`dist/utils/manifest.js` 的 `nonSemverPrefixes`），所以两条命令可以并存。

## 进 git 的边界

- 进：`manifest.json`、`SHA256SUMS-*`、插件 `.tgz`（≈0.8 MB，MIT 再分发）。
- 不进：`*.zip`（40 MB 级二进制）、`*.part`（续传中间态）。换机器时跑一次 `fetch` 就补回来。
