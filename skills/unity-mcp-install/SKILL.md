---
name: unity-mcp-install
description: 在当前工作区的 Unity 项目里安装 Unity-MCP 插件：先查 unity-mcp-cli（缺则 npm install -g unity-mcp-cli），再对工作区内探测到的 Unity 项目执行 unity-mcp-cli install-plugin，含项目定位、已装判定与验证。
whenToUse: 用户要求「在工作区的 Unity 项目里安装 / 补装 Unity-MCP 插件（AI Game Developer）」时；或 unity-mcp-check 报「Unity 项目里没有 MCP 包」时。
---

# 安装 Unity-MCP 插件（工作区内的 Unity 项目）

把 Unity 侧的 MCP 插件（包名 `com.ivanmurzak.unity.mcp`，即 AI Game Developer）装进**当前工作区**里的 Unity 项目。DSH 侧的桥接插件 `dsh-unity-mcp-bridge` 是另一半，装完用 `/unity-mcp-check` 验通。

官方文档：<https://ai-game.dev/engines/unity>

## 0. 范围与前置

- 本技能只碰**当前工作区内**的项目文件，不修改工作区外的任何东西。
- 安装这一步不需要 Unity 编辑器在运行；但包要等 Unity 打开时才真正解析进 `Library/PackageCache`。
- 全部命令在 PowerShell 下给出（DSH 的 shell 就是 pwsh）。

## 1. 检查 unity-mcp-cli

```powershell
$cli = Get-Command unity-mcp-cli -ErrorAction SilentlyContinue
if ($cli) { unity-mcp-cli --version } else { 'NOT INSTALLED' }
```

- 打印出版本（如 `v0.91.0`）→ 跳到第 3 步。
- 打印 `NOT INSTALLED` → 走第 2 步。
- 命令在但执行报错，或怀疑「装了但不在 PATH」：`npm ls -g unity-mcp-cli`（全局 bin 目录一般是 `%APPDATA%\npm`）。

## 2. 安装 unity-mcp-cli（仅当第 1 步缺失）

```powershell
npm install -g unity-mcp-cli
unity-mcp-cli --version    # 复验
```

- 需要 Node.js 与 npm（`node -v`、`npm -v`）。缺 npm 就先解决 npm，别换别的包管理器猜。
- 已装但偏旧：`unity-mcp-cli update`。
- 装完仍找不到命令：把 `%APPDATA%\npm` 加进 PATH，或直接用绝对路径 `& "$env:APPDATA\npm\unity-mcp-cli.cmd" --version`。

## 3. 在工作区里定位 Unity 项目

判据用 **`ProjectSettings\ProjectVersion.txt`**（最可靠，比只看 `Assets/` 稳）：

```powershell
$ws = (Get-Location).Path
$projects = Get-ChildItem $ws -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'ProjectSettings\ProjectVersion.txt') } |
  Where-Object { $_.FullName -notmatch '\\(Library|Temp|obj|node_modules|\.git)\\' } |
  Select-Object -ExpandProperty FullName -Unique
$projects
```

- **恰好 1 个** → `$proj = $projects[0]`，继续。
- **0 个** → 停下来问用户：是指定一个已有项目路径，还是要新建（`unity-mcp-cli create-project <path>`）。不要擅自创建。
- **多个** → 列出路径让用户选，不要替他挑。

## 4. 判断插件是否已安装

```powershell
$manifest = Join-Path $proj 'Packages\manifest.json'
Select-String -Path $manifest -Pattern 'com\.ivanmurzak\.unity\.mcp' -Quiet
Get-ChildItem (Join-Path $proj 'Library\PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp*' -ErrorAction SilentlyContinue
```

- manifest 里已有该依赖 → 已装。`install-plugin` 是幂等的，重跑可用于升级或补齐。
- 既无依赖、也无 `PackageCache` 目录 → 未装。

## 5. 安装

```powershell
unity-mcp-cli install-plugin $proj
```

常用开关（按需，不要无脑加）：

| 开关 | 用途 |
|---|---|
| `--with-server` | 同时下载与本机 RID 匹配的 GameDev-MCP-Server 二进制（默认 9.2.7） |
| `--plugin-version <version>` | 指定插件版本（默认 latest） |
| `--enroll <code>` / `--enroll-stdin` | 兑换云端 enrollment code（用自建本地端点时不需要） |
| `--path <path>` | 等价于位置参数 |

命令的原始输出（含报错）要照实报告，不要吞掉或改写。

## 6. 验证与下一步

```powershell
Select-String -Path (Join-Path $proj 'Packages\manifest.json') -Pattern 'com\.ivanmurzak\.unity\.mcp'
```

然后告诉用户三条：

1. 用 Unity 打开该项目（`unity-mcp-cli open $proj`）—— 包在编辑器里解析，`Library/PackageCache/` 才会出现。
2. 在 Unity 里打开 **Window → AI Game Developer**，确认连接方式（自建本地端点选 Custom，或走 Cloud）。
3. 回到 DSH 跑 `/unity-mcp-check`，验证 DSH ↔ Unity 是否真的连通。

## 注意

- 不要手改 `Library/`；不要在工作区外装插件。
- 本技能只负责 **Unity 侧**。DSH 侧的依赖与 `cordis.patch.yml` 配置属于 `dsh-unity-mcp-bridge` 自身；端口/端点不匹配由 `/unity-mcp-check` 修正。
- 与 `install-plugin` 无关的 `install-unity`（装编辑器）、`create-project`（建项目）只在与用户确认后才用。
