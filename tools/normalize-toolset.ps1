#requires -Version 5.1
<#
.SYNOPSIS
  把 Unity 工程的 MCP 工具集收敛成「只有管理开关可见」。

.DESCRIPTION
  unity-mcp-cli 1.6.0 的 updateFeatures 只修改配置里**已存在**的条目：
  新工程的 tools 数组为空时，--disable-all-tools 是空操作，随后 --enable-tools
  只会 push 一条，可见工具仍会是「默认 7 个 + 开关 = 8 个」。

  本脚本改用显式名单（读 /unity-mcp-tools 的命令目录）把全部基础工具物化，
  再只显示开关，最后用 `configure --list` 校验：
    - Tools 条目数 >= 命令目录里的工具数
    - [visible] 恰好 1 条，且就是管理开关

.PARAMETER ProjectPath
  Unity 工程路径。

.PARAMETER BridgeRoot
  插件目录（默认取本脚本上一级）。已安装副本在
  %DSH_PROFILE_DIR%\node_modules\dsh-unity-mcp-bridge。

.PARAMETER Cli
  unity-mcp-cli 的命令名或绝对路径。

.PARAMETER SwitchTool
  要保留为可见的管理工具名（默认 tool-set-enabled-state）。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\normalize-toolset.ps1 -ProjectPath D:\Work\Unity\MyProject
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectPath,
    [string]$BridgeRoot,
    [string]$Cli = 'unity-mcp-cli',
    [string]$SwitchTool = 'tool-set-enabled-state'
)

$ErrorActionPreference = 'Stop'

if (-not $BridgeRoot) {
    $BridgeRoot = Split-Path -Parent $PSScriptRoot
    if (-not $BridgeRoot) { throw "无法推断插件目录，请用 -BridgeRoot 指定" }
}

$proj = (Resolve-Path $ProjectPath).Path
$refDir = Join-Path $BridgeRoot 'skills\unity-mcp-tools\reference'
if (-not (Test-Path $refDir)) {
    throw "找不到命令目录: $refDir（先跑 /unity-mcp-update-tools 生成，或用 -BridgeRoot 指向插件目录）"
}

$names = @(Get-ChildItem $refDir -Filter *.md |
    Where-Object { $_.Name -ne 'extensions.md' } |
    ForEach-Object { Select-String -Path $_.FullName -Pattern '^- `([a-z0-9-]+)`' -AllMatches } |
    ForEach-Object { $_.Matches } |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique)

if ($names.Count -eq 0) { throw "命令目录里没有解析到工具名: $refDir" }
if ($names -notcontains $SwitchTool) {
    throw "命令目录里没有 $SwitchTool —— 目录与插件版本不一致，先重生成命令目录"
}

if (-not (Get-Command $Cli -ErrorAction SilentlyContinue)) {
    throw "找不到 $Cli；先 npm install -g unity-mcp-cli"
}

Write-Host "工程: $proj"
Write-Host "命令目录: $($names.Count) 个工具（$BridgeRoot）"

# 1) 显式名单：disable-tools 会为缺失条目 push 一条 visible=false
& $Cli configure $proj --disable-tools ($names -join ',')
if ($LASTEXITCODE -ne 0) { throw "configure --disable-tools 失败（exit $LASTEXITCODE）" }

# 2) 只显示管理开关
& $Cli configure $proj --enable-tools $SwitchTool
if ($LASTEXITCODE -ne 0) { throw "configure --enable-tools 失败（exit $LASTEXITCODE）" }

# 3) 校验：解析 --list 的 Tools 段（1.6.0 用 [visible]/[hidden]，旧版用 [enabled]/[disabled]）
$list = (& $Cli configure $proj --list 2>&1 | Out-String)
$inTools = $false
$total = 0
$visible = New-Object System.Collections.Generic.List[string]
foreach ($line in ($list -split "`r?`n")) {
    if ($line -match '^\s*Tools\s*$') { $inTools = $true; continue }
    if ($line -match '^\s*(Prompts|Resources)\s*$') { $inTools = $false; continue }
    if (-not $inTools) { continue }
    $m = [regex]::Match($line, '^\s*\[(?<state>visible|hidden|enabled|disabled)\]\s+(?<name>\S+)')
    if (-not $m.Success) { continue }
    $total++
    if ($m.Groups['state'].Value -in @('visible', 'enabled')) {
        $visible.Add($m.Groups['name'].Value)
    }
}

Write-Host "配置条目: $total  可见: $($visible.Count) [$($visible -join ', ')]"

if ($total -lt $names.Count) {
    throw "配置条目 $total 少于命令目录的 $($names.Count) —— 工具集没有完全物化"
}
if ($visible.Count -ne 1 -or $visible[0] -ne $SwitchTool) {
    throw "工具集未收敛：期望只有 $SwitchTool 可见，实际可见 [$($visible -join ', ')]"
}

Write-Host "OK: 只有 $SwitchTool 可见（条目 $total / 目录 $($names.Count)）"
exit 0
