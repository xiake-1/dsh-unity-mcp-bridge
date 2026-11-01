---
name: unity-mcp-update-tools
description: 把插件自带的本地离线包（vendor/）升到上游最新版，并依据这份离线包重生成 /unity-mcp-tools 的命令索引（skills/unity-mcp-tools/SKILL.md + reference/*.md）与可选扩展索引（reference/extensions.md，列出 10 个扩展及各自会带哪些命令）；只改插件目录（vendor + skills），不碰 Unity 工程、不需要 Unity 在运行。要安装/升级工程内插件请用 /unity-mcp-update。
whenToUse: 用户要求「更新 /unity-mcp-tools 的命令目录」「把离线包升到最新并刷新命令索引」「看看有哪些扩展可选」时；或 /unity-mcp-check 报命令目录版本落后、/unity-mcp-update 刚升级完插件之后。
---

# 刷新离线包并重生成 `/unity-mcp-tools` 目录

两个产物，都只落在插件目录 `<bridge>`：

| 产物 | 位置 |
|---|---|
| 本地离线包 | `<bridge>\vendor\`：`manifest.json` + 插件 tarball + `GameDev-MCP-Server` zip + `SHA256SUMS-*` |
| 命令索引 | `<bridge>\skills\unity-mcp-tools\SKILL.md` + `reference\<分类>.md` + `reference\extensions.md` |

`<bridge>` = 插件目录：源码仓库就是本仓库根；已安装副本在 `%DSH_PROFILE_DIR%\node_modules\dsh-unity-mcp-bridge`（看 `vendor\manifest.json` 是否存在即可判断）。

**边界**：本技能不改 Unity 工程的 `Packages\manifest.json`、不装插件、不需要 Unity 在运行。工程内插件的安装/升级走 `/unity-mcp-update`（它会先问用户）；本技能只刷新离线包与命令索引。

## 1. 看现状（只读）

```powershell
# 离线包当前版本与平台
$m = Get-Content "<bridge>\vendor\manifest.json" -Raw | ConvertFrom-Json
$m.plugin.version; $m.plugin.pinnedServerVersion; $m.server.version; $m.server.rid

# 命令索引是按哪个插件版本生成的（SKILL.md 标题行）
Select-String -Path "<bridge>\skills\unity-mcp-tools\SKILL.md" -Pattern 'com\.ivanmurzak\.unity\.mcp@'
# 现有扩展索引条目数
(Select-String -Path "<bridge>\skills\unity-mcp-tools\reference\extensions.md" -Pattern '^## ').Count
```

上游最新（= 离线包目标版本）：

```powershell
# 代理优先（GitHub 资产直连常被掐断）
$px = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' |
        Where-Object ProxyEnable -eq 1).ProxyServer
if ($px) { $env:HTTPS_PROXY = "http://$px"; $env:NODE_USE_ENV_PROXY = '1' }

node "<bridge>\tools\offline-package.mjs" check --cli-version (unity-mcp-cli --version)
```

- 不带 `--project`：只比「上游最新 / `vendor/` / 本机 CLI」，正好是本技能关心的两层。
- `--json` 给机器可读结果；`NODE_USE_ENV_PROXY=1` 不能省（Node 24 的 `fetch` 否则无视代理）。
- 结论：`vendor` 版本 = 上游最新，且 `SKILL.md` 标题行版本 = `vendor` 版本 → 已一致，报告后结束；否则继续。

## 2. 升级本地离线包

```powershell
node "<bridge>\tools\offline-package.mjs" fetch --plugin-version <latest>
```

- 目标版本不指定就取上游最新；用户要求固定版本就显式传 `--plugin-version`。
- Server 不用指定：脚本按新 tarball 里的 `McpServerManager.ServerVersion` 拉，lockstep 自动成立。
- 已存在同名文件会跳过下载（`--force` 强制重下）；下载 4 次退避重试，失败保留 `.part`，重跑续传；zip 的 SHA256 对着同一 release 的 `SHA256SUMS` 校验。
- 只换平台：`fetch --rid osx-arm64`（注意 `manifest.json` 只记最后一次 fetch 的 rid）。

## 3. 依据新离线包重生成命令索引

生成器支持直接读 tarball 解出的包目录（`-PackageRoot`，版本从包内 `package.json` 读，不需要 Unity 工程）：

```powershell
$m = Get-Content "<bridge>\vendor\manifest.json" -Raw | ConvertFrom-Json
$tgz = Join-Path "<bridge>" ("vendor\" + $m.plugin.file)
$tmp = Join-Path $env:TEMP ("unity-mcp-catalog-" + $m.plugin.version)
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory $tmp | Out-Null
tar -xzf $tgz -C $tmp
powershell -NoProfile -ExecutionPolicy Bypass -File "<bridge>\tools\generate-unity-mcp-catalog.ps1" `
  -PackageRoot (Join-Path $tmp 'package') `
  -OutDir (Join-Path "<bridge>" 'skills\unity-mcp-tools')
Remove-Item $tmp -Recurse -Force
```

- 生成器会**清空并重写** `skills\unity-mcp-tools\reference\`，再写 `SKILL.md`；输出会报「命令数 / 分类数 / 扩展数」。
- 生成器脚本必须存为**带 BOM 的 UTF-8**（仓库里已经是）；Windows PowerShell 5.1 把无 BOM 的 UTF-8 当 ANSI，中文会变成解析错误。
- 生成范围只有基础包：扩展命令**不进索引**。`reference\extensions.md` 只回答「有哪些扩展可选 + 每个扩展会带哪些命令」，装完仍要用 `unity-tool-list` 取实时清单。

## 4. 校验

```powershell
# 标题行版本必须等于 vendor/manifest.json 的 plugin.version
Select-String -Path "<bridge>\skills\unity-mcp-tools\SKILL.md" -Pattern 'com\.ivanmurzak\.unity\.mcp@'
# 分类文件 + 扩展索引都在
Get-ChildItem "<bridge>\skills\unity-mcp-tools\reference" | Select-Object Name,Length
# 扩展条目数应等于离线包 extensions.catalog.json 里的扩展数（当前 10）
Select-String -Path "<bridge>\skills\unity-mcp-tools\reference\extensions.md" -Pattern '^## '
```

## 5. 重启

重启 `dsh web` / 应用：技能在插件启动时注册，不重启仍是旧目录。若 `<bridge>` 是 profile 里的安装副本，确认改动落在该副本上（`dsh plugin add` 重装会整份替换，重装后要重跑本技能）。

## 6. 报告格式

| 项 | 结果 |
|---|---|
| 本地离线包 | 旧 a + s → 新 b + t（或「已是最新 a + s」） |
| 命令索引 | 旧 a（N 个命令 / K 分类）→ 新 b（M 个命令 / K 分类） |
| 扩展索引 | 10 个可选扩展（Animation … Timeline），按 b 生成 / 离线包无 catalog |
| 改动文件 | `vendor\manifest.json` + 新增 tarball / zip / `SHA256SUMS-*`；`skills\unity-mcp-tools\SKILL.md` + `reference\*.md` |
| 重启 | 需要重启 `dsh web` / 应用 |

## 常见故障

| 现象 | 原因 | 处理 |
|---|---|---|
| 生成器报中文乱码 / 语法解析错误 | 脚本是无 BOM 的 UTF-8（PS 5.1 当 ANSI） | 存成 UTF-8 with BOM 再跑 |
| 报「未能定位 Unity 工程根」 | 没传 `-PackageRoot`，又不在 Unity 工程内 | 按第 3 步传 `-PackageRoot <解出的 package 目录>` |
| 报「未找到 com.ivanmurzak.unity.mcp@* 包」 | 同上：只给了 `-ProjectRoot` 但 `PackageCache` 里没有包 | 传 `-PackageRoot`，或让 Unity 先解析一次包 |
| 生成后标题行还是旧版本 | `-PackageRoot` 指向旧包，或 `fetch` 没真的换版本 | 核对 `vendor\manifest.json` 与解出的 `package.json` 的 `version` |
| `reference\extensions.md` 缺失 | 离线包里没有 `extensions.catalog.json`（包太旧） | 先 `fetch` 到带 catalog 的版本；否则报告「无扩展索引」 |
| 重启后技能仍是旧内容 | 没重启，或改的不是 profile 安装副本 | 重启 `dsh web`；确认 `<bridge>` 路径 |
| `fetch` 报 `SHA256 不匹配` / 下载不完整 | 代理改写或连接被掐断 | 删掉该 zip 与 `*.part` 重跑；仍失败换代理节点 |
