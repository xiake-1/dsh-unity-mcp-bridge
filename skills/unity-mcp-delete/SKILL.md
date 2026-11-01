---
name: unity-mcp-delete
description: 从当前工作区的 Unity 工程里**卸载** Unity-MCP 插件（com.ivanmurzak.unity.mcp）及其扩展包：先备份 Packages/manifest.json 与项目配置，关闭正在运行的编辑器，用 unity-mcp-cli remove-plugin 删掉基础包，再手动移除 com.ivanmurzak.unity.mcp.* 扩展依赖，清理 UserSettings 配置与 Library 下的 mcp-server / PackageCache 残留，最后校验 manifest 已干净。与 /unity-mcp-install 相反；只删 Unity 工程里的插件，不动 DSH 桥接插件、不动 CLI 全托管 Server、不动其他工程。
whenToUse: 用户要求「卸载 / 删除 Unity 项目里的 Unity-MCP 插件」「把 AI Game Developer 从工程里移除」「删掉后重装」时。只想删某个扩展、或只想停用连接，不要用本技能。
---

# 卸载 Unity 工程里的 Unity-MCP 插件

本技能只处理**当前工作区**里的一个 Unity 工程；删除范围：

| 删除 | 位置 |
|---|---|
| 基础包 `com.ivanmurzak.unity.mcp` | `Packages\manifest.json` 的 `dependencies`（`unity-mcp-cli remove-plugin` 负责） |
| 扩展包 `com.ivanmurzak.unity.mcp.*`（Animation / Cinemachine / InputSystem / Navigation / ParticleSystem / ProBuilder / Splines / Terrain / Tilemap / Timeline） | 同一个 `dependencies`（CLI 不删，本技能手动删；它们依赖基础包，必须一起走） |
| 插件配置 | `UserSettings\AI-Game-Developer-Config.json` |
| 运行时残留 | `Library\mcp-server\`、`Library\PackageCache\com.ivanmurzak.unity.mcp@*` |

**不动**：DSH 的 `dsh-unity-mcp-bridge` 插件、CLI 的全托管 Server `~\.ai-game-dev\server\<rid>\`（其他工程可能还在用）、别的 Unity 工程、`.kilocode\mcp.json` / `.agents\skills`（这些是 agent 配置，不是插件安装产物）。

## 1. 定位 Unity 项目

```powershell
$ws = (Get-Location).Path
$projects = Get-ChildItem $ws -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'ProjectSettings\ProjectVersion.txt') } |
  Where-Object { $_.FullName -notmatch '\\(Library|Temp|obj|node_modules|\.git)\\' } |
  Select-Object -ExpandProperty FullName -Unique
$projects
```

恰好 1 个 → `$proj = $projects[0]`；0 个或多个 → 停下来问用户，不要替他挑。

## 2. 判断装了什么（只读）

```powershell
$manifestPath = Join-Path $proj 'Packages\manifest.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.dependencies.PSObject.Properties |
  Where-Object { $_.Name -like 'com.ivanmurzak.unity.mcp*' } |
  Select-Object Name, Value

Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp*' -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty Name
```

- 两处都没有 → 报告「未安装，无需卸载」，**结束**。
- 有基础包 + 扩展包 → 都要删；把将删除的包名列表念给用户。
- 只有 `PackageCache` 残留、manifest 已无依赖 → 跳过 CLI，只清理残留（第 5 步）。

## 3. 备份 + 关闭编辑器

```powershell
$stamp = Get-Date -Format yyyyMMdd-HHmmss
Copy-Item $manifestPath "$manifestPath.bak-$stamp"
$cfgPath = Join-Path $proj 'UserSettings\AI-Game-Developer-Config.json'
if (Test-Path $cfgPath) { Copy-Item $cfgPath "$cfgPath.bak-$stamp" }

# manifest 若带 UTF-8 BOM，CLI 的 JSON.parse 会报 "Unexpected token '﻿'" —— 先去掉 BOM（上面已备份）
$bytes = [System.IO.File]::ReadAllBytes($manifestPath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  $text = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  [System.IO.File]::WriteAllText($manifestPath, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# 正在运行就先存盘，再优雅退出；30s 不退则强杀
unity-mcp-cli close $proj --timeout 30 --force
```

- `close` 会终止该工程的编辑器实例；**执行前必须提醒用户保存未保存的场景/改动**。
- 编辑器没在运行 → `close` 无操作，忽略报错继续。
- CLI 读 manifest 不做 BOM 容错；Unity 自己写出的文件通常无 BOM，但手改过的可能是 BOM UTF-8，所以上面先剥掉。

## 4. 删除基础包 + 扩展包

```powershell
# 4.1 基础包（官方命令，只删 com.ivanmurzak.unity.mcp）
unity-mcp-cli remove-plugin $proj

# 4.2 扩展包（CLI 不删，手动从 manifest 移除；文件已在第 3 步备份）
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$extIds = @($manifest.dependencies.PSObject.Properties.Name |
  Where-Object { $_ -like 'com.ivanmurzak.unity.mcp.*' })
foreach ($id in $extIds) { $manifest.dependencies.PSObject.Properties.Remove($id) }
if ($extIds.Count -gt 0) {
  $json = $manifest | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($manifestPath, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
  "removed extensions: $($extIds -join ', ')"
} else { 'no extension packages' }
```

- `remove-plugin` 是幂等的：已经删过会提示 not installed，不要当失败。
- 只删 `com.ivanmurzak.unity.mcp` 与 `com.ivanmurzak.unity.mcp.*`，**不要**动 `com.unity.*`、`extensions.unity.*` 或其它依赖。
- `scopedRegistries` 里的 OpenUPM 条目保留（其他包可能还在用），不清理。

## 5. 清理项目内残留

```powershell
# 插件配置（token/host/tool 列表都在这里；重新安装时会重建）
if (Test-Path $cfgPath) { Remove-Item $cfgPath -Force }

# 插件下载的 Server 二进制与日志（Library 是生成目录，下次打开会重建）
$serverDir = Join-Path $proj 'Library\mcp-server'
if (Test-Path $serverDir) { Remove-Item $serverDir -Recurse -Force }

# 新版 install 默认复制进工程的离线 tarball（UnityMcpOffline/，相对依赖用）
$offlineDir = Join-Path $proj 'UnityMcpOffline'
if (Test-Path $offlineDir) { Remove-Item $offlineDir -Recurse -Force }

# 已解析的包缓存（Unity 下次打开也会自动清；编辑器已关闭时手动删更干净）
Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp*' -ErrorAction SilentlyContinue |
  ForEach-Object { Remove-Item $_.FullName -Recurse -Force }
```

- `Library\PackageCache` 其他包不要动。
- `Packages\packages-lock.json` 里可能还留着条目，Unity 重新打开工程 sourcing manifest 后会自行修正；不手改。

## 6. 校验

```powershell
# manifest 里不应再有该插件/扩展
Select-String -Path $manifestPath -Pattern 'com\.ivanmurzak\.unity\.mcp'
# 残留目录
Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp*' -ErrorAction SilentlyContinue
# 配置与 server 目录
Test-Path $cfgPath
Test-Path (Join-Path $proj 'Library\mcp-server')
```

`Select-String` 无输出 + 目录都不存在 = 卸载完成。之后让用户用 Unity 打开工程一次，让包依赖重新解析（`Library/PackageCache` 会按新 manifest 重建）。

## 7. 报告格式

| 项 | 结果 |
|---|---|
| 定位到的工程 | `$proj` |
| 已删除的包 | `com.ivanmurzak.unity.mcp` + 扩展列表（或「未安装，无需卸载」） |
| 清理的配置/残留 | `UserSettings\AI-Game-Developer-Config.json`、`Library\mcp-server`、`UnityMcpOffline\`、PackageCache 条目 |
| 备份 | `Packages\manifest.json.bak-<stamp>`、`AI-Game-Developer-Config.json.bak-<stamp>` |
| 未动的 | DSH 桥接插件、CLI 托管 Server、其他工程、`.kilocode`/agent 配置 |
| 下一步 | 用 Unity 打开工程让其重新解析；之后 `/unity-mcp-check` 应报告「未装」 |

## 常见故障

| 现象 | 原因 | 处理 |
|---|---|---|
| `remove-plugin` 报 not installed / 未删除 | manifest 里本来就没基础包（可能只剩扩展或文件缓存） | 正常继续第 4.2/5 步；把扩展与残留清掉 |
| 删依赖后 Unity 仍能连上 20000 | 编辑器还开着旧域、或 `Library\mcp-server` 进程还在 | 先 `close --force` 再删；必要时任务管理器结束 `gamedev-mcp-server` |
| 打开 Unity 后包又回来了 | 工程里还有 `Packages\packages-lock.json` 或别的 manifest 引用了该包；或误删了备份里的内容 | 检查 manifest 与 lock 文件；确认没有其他依赖指向 `com.ivanmurzak.unity.mcp` |
| 重装后配置又出现旧 host/token | 第 5 步没删 `UserSettings\AI-Game-Developer-Config.json` | 删除该文件后重装；或重装后手工改 Custom/20000 |
| `/unity-mcp-check` 仍显示已装 | 检查的是别的工程/`PackageCache` 还没重建 | 确认 `$proj` 路径；用 Unity 打开一次 |
