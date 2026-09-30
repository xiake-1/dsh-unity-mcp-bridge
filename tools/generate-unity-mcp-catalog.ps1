#requires -Version 5.1
<#
.SYNOPSIS
  从 Unity-MCP 插件源码生成「分层」工具目录 Skill。

.DESCRIPTION
  输出结构（分层 = 按需付费）：
    SKILL.md                 L1 索引：分类 + 命令名（不含解释），常驻只有 frontmatter 一行
    reference/<分类>.md       L2 详情：每个命令的一行用途 + 参数名 + 默认开关 + 源码路径

  分类取自插件自身的 [AiTool(Title = "Assets / Prefab / Create")]，
  命令名取自同一特性里的常量，用途取自 [Description]，参数名从方法签名解析。

  重要前提：本目录只是「知识」。Unity 侧**未启用**的命令无法被调用；
  MCP 服务未运行则一个命令都调不到。文档不产生能力。
#>
[CmdletBinding()]
param(
    [string]$PackageRoot,
    [string]$ProjectRoot,
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
    $d = $PSScriptRoot
    while ($d -and -not (Test-Path (Join-Path $d 'Assets'))) {
        $parent = Split-Path -Parent $d
        if (-not $parent -or $parent -eq $d) { throw "未能定位 Unity 工程根（从 $PSScriptRoot 向上没找到 Assets）。" }
        $d = $parent
    }
    $ProjectRoot = $d
}

if (-not $PackageRoot) {
    $cand = Get-ChildItem (Join-Path $ProjectRoot 'Library/PackageCache') -Directory -Filter 'com.ivanmurzak.unity.mcp@*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $cand) { throw "未找到 com.ivanmurzak.unity.mcp@* 包，请用 -PackageRoot 指定。" }
    $PackageRoot = $cand.FullName
}

$apiRoot = Join-Path $PackageRoot 'Editor/Scripts/API'
$toolRoot = Join-Path $apiRoot 'Tool'
if (-not (Test-Path $toolRoot)) { throw "未找到 API/Tool 目录: $toolRoot" }

$pkgName = Split-Path $PackageRoot -Leaf
$files = Get-ChildItem $apiRoot -Recurse -File -Filter '*.cs'
$toolFiles = Get-ChildItem $toolRoot -Recurse -File -Filter '*.cs'

# ---------- 常量表：常量名 -> 真实命令名 ----------
$constMap = @{}
foreach ($f in $files) {
    $text = Get-Content $f.FullName -Raw
    foreach ($m in [regex]::Matches($text, '(?m)^\s*(?:public|internal|private)?\s*(?:const|static\s+readonly)\s+string\s+(?<id>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*"(?<v>[^"]*)"')) {
        $constMap[$m.Groups['id'].Value] = $m.Groups['v'].Value
    }
}

function Get-StringLiterals([string]$s) {
    ($([regex]::Matches($s, '"((?:[^"\\]|\\.)*)"') | ForEach-Object { $_.Groups[1].Value }) -join ' ')
}

<#
  从 [AiTool] 之后的文本里解析方法参数名。
  做法：找到方法签名的 '('，然后配平括号扫描；扫描时跳过 [特性] 内容与字符串，
  在顶层逗号处切分，每段取第一个顶层 '=' 左侧的最后一个标识符作为参数名。
#>
function Get-ParamList([string]$tail) {
    $pm = [regex]::Match($tail, 'public\s+[A-Za-z_][\w\.<>\[\]\?,\s]{0,300}?\(')
    if (-not $pm.Success) { return '' }
    $i = $pm.Index + $pm.Length
    $depth = 1; $brk = 0; $brace = 0; $inStr = $false
    $seg = New-Object System.Text.StringBuilder
    $segs = New-Object System.Collections.Generic.List[string]
    while ($i -lt $tail.Length -and $depth -gt 0) {
        $ch = $tail[$i]
        if ($inStr) {
            if ($ch -eq '\') { $i += 2; continue }
            if ($ch -eq '"') { $inStr = $false }
            if ($brk -eq 0) { [void]$seg.Append($ch) }
            $i++; continue
        }
        switch -CaseSensitive ($ch) {
            '"' { $inStr = $true; if ($brk -eq 0) { [void]$seg.Append($ch) } }
            '[' { $brk++ }
            ']' { if ($brk -gt 0) { $brk-- } }
            '{' { $brace++; if ($brk -eq 0) { [void]$seg.Append($ch) } }
            '}' { if ($brace -gt 0) { $brace-- }; if ($brk -eq 0) { [void]$seg.Append($ch) } }
            '(' { $depth++; if ($brk -eq 0) { [void]$seg.Append($ch) } }
            ')' {
                $depth--
                if ($depth -eq 0) { $segs.Add($seg.ToString()); $seg.Clear() | Out-Null }
                elseif ($brk -eq 0) { [void]$seg.Append($ch) }
            }
            ',' {
                if ($brk -eq 0 -and $brace -eq 0 -and $depth -eq 1) { $segs.Add($seg.ToString()); $seg.Clear() | Out-Null }
                elseif ($brk -eq 0) { [void]$seg.Append($ch) }
            }
            default { if ($brk -eq 0) { [void]$seg.Append($ch) } }
        }
        $i++
    }

    $names = New-Object System.Collections.Generic.List[string]
    foreach ($s in $segs) {
        $t = $s.Trim()
        if (-not $t) { continue }
        $opt = $t.Contains('=')
        $left = ($t -split '=', 2)[0].Trim()
        $nm = [regex]::Match($left, '([A-Za-z_][A-Za-z0-9_]*)$')
        if ($nm.Success) { $names.Add($nm.Groups[1].Value + $(if ($opt) { '?' } else { '' })) }
    }
    return ($names -join ', ')
}

# ---------- 抽取 ----------
$rows = New-Object System.Collections.Generic.List[object]
foreach ($f in $toolFiles) {
    $text = Get-Content $f.FullName -Raw
    foreach ($m in [regex]::Matches($text, '\[AiTool\s*\(\s*(?<id>[A-Za-z_][A-Za-z0-9_]*)\s*,(?<body>.*?)\)\s*\]', 'Singleline')) {
        $id = $m.Groups['id'].Value
        $body = $m.Groups['body'].Value

        $toolName = if ($constMap.ContainsKey($id)) { $constMap[$id] } else { $id }
        $tm = [regex]::Match($body, 'Title\s*=\s*"([^"]*)"')
        $title = if ($tm.Success) { $tm.Groups[1].Value } else { $toolName }
        $em = [regex]::Match($body, 'Enabled\s*=\s*(true|false)')
        $enabled = if ($em.Success) { $em.Groups[1].Value } else { 'true' }

        $tail = $text.Substring($m.Index + $m.Length)
        $dm = [regex]::Match($tail, '\[Description\((?<b>.*?)\)\]', 'Singleline')
        if (-not $dm.Success) { $dm = [regex]::Match($tail, '\[AiSkillDescription\((?<b>.*?)\)\]', 'Singleline') }
        $purpose = if ($dm.Success) { (Get-StringLiterals $dm.Groups['b'].Value) } else { '' }
        $purpose = ($purpose -replace '\s+', ' ').Trim()
        $oneLine = ($purpose -split '(?<=\.)\s')[0]
        if ($oneLine.Length -gt 140) { $oneLine = $oneLine.Substring(0, 137) + '...' }

        $parts = $title -split '\s*/\s*'
        $category = if ($parts.Count -gt 1) { ($parts[0..($parts.Count - 2)] -join ' / ') } else { 'Other' }

        $rows.Add([pscustomobject]@{
            Tool     = $toolName
            Category = $category
            Default  = if ($enabled -eq 'true') { 'on' } else { 'off' }
            Purpose  = $oneLine
            Params   = (Get-ParamList $tail)
            Source   = $f.FullName.Substring($PackageRoot.Length).TrimStart('\', '/')
        })
    }
}
$rows = $rows | Group-Object Tool | ForEach-Object { $_.Group[0] } | Sort-Object Category, Tool

function Get-Slug([string]$s) {
    $x = $s.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
    return $x.Trim('-')
}

$outDir = if ($OutDir) { $OutDir } else { Join-Path (Split-Path -Parent $PSScriptRoot) 'skills' }
$refDir = Join-Path $outDir 'reference'
if (Test-Path $refDir) { Remove-Item $refDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $refDir | Out-Null

$stamp = Get-Date -Format 'yyyy-MM-dd'
$on = ($rows | Where-Object Default -eq 'on').Count

# ---------- L1：索引（只有分类 + 命令名） ----------
$s1 = New-Object System.Text.StringBuilder
[void]$s1.AppendLine('---')
[void]$s1.AppendLine('name: unity-mcp-tools')
[void]$s1.AppendLine('description: Unity-MCP 命令索引（分类 + 命令名），含「激活 → 按需开启 → 用完恢复休眠」工作流。需要某命令的用途或参数时，读 reference/<分类>.md。')
[void]$s1.AppendLine('whenToUse: 由用户以 /unity-mcp-tools 调用：Unity 能力默认完全关闭，调用本技能后先激活，再按索引定位并开启所需命令，任务结束必须恢复休眠。')
[void]$s1.AppendLine('---')
[void]$s1.AppendLine('')
[void]$s1.AppendLine("# Unity-MCP 命令索引")
[void]$s1.AppendLine('')
[void]$s1.AppendLine("包 ``$pkgName`` ｜ 命令 $($rows.Count) 个（默认启用 $on）｜ 生成 $stamp")
[void]$s1.AppendLine('')
[void]$s1.AppendLine('调用名 `mcp__unity__<命令名>`。**本文件只是知识，不产生能力**：Unity 侧未启用的命令无法调用（服务未运行则全部无法调用）。')
[void]$s1.AppendLine('')
[void]$s1.AppendLine('## 工作流程（必须遵守）')
[void]$s1.AppendLine('')
[void]$s1.AppendLine('**Unity 能力默认完全关闭**：插件处于休眠状态，不连接 Unity、不注册任何 `mcp__unity__*` 工具。本技能是唯一的开启入口，由用户显式调用。')
[void]$s1.AppendLine('')
[void]$s1.AppendLine('0. **激活** —— 先调用 `unity_mcp_activate`，建立连接并注册 Unity 工具（本技能被调用后的第一步）。')
[void]$s1.AppendLine('1. **定位** —— 在本索引找到需要的能力，读对应的 `reference/<分类>.md`，拿到命令名与参数名。')
[void]$s1.AppendLine('2. **开启** —— 调用 `mcp__unity__tool-set-enabled-state`，把需要的命令设为 `enabled: true`（可一次传多个）。')
[void]$s1.AppendLine('   - 开启后**下一个步骤**才生效：工具注册表在请求边界重建，**不能在同一个步骤里开启并调用**。')
[void]$s1.AppendLine('3. **使用** —— 下一步直接调用 `mcp__unity__<命令名>`。')
[void]$s1.AppendLine('4. **恢复（必做，任务结束时）** —— 调用 `unity_tools_restore`：关闭除 `tool-set-enabled-state` 以外的全部已开启命令，并断开连接、注销全部 `mcp__unity__*` 工具，回到休眠状态。')
[void]$s1.AppendLine('   - 想保留个别命令：`unity_tools_restore({ "keep": ["gameobject-find"] })`（仍会断开休眠）。')
[void]$s1.AppendLine('')
[void]$s1.AppendLine('为什么必须恢复：**每个处于开启状态的命令，其完整 JSON Schema 都会进入之后每一次模型请求**（未开启的不会）。开启是临时的、可回收的成本；忘记关闭就等于把这个成本永久留在上下文里。')
[void]$s1.AppendLine('')
foreach ($g in ($rows | Group-Object Category | Sort-Object Name)) {
    $names = ($g.Group | ForEach-Object { $_.Tool }) -join ', '
    [void]$s1.AppendLine("## $($g.Name) ($($g.Count)) → ``reference/$(Get-Slug $g.Name).md``")
    [void]$s1.AppendLine($names)
    [void]$s1.AppendLine('')
}
Set-Content -Path (Join-Path $outDir 'SKILL.md') -Value $s1.ToString() -Encoding UTF8

# ---------- L2：分类详情 ----------
foreach ($g in ($rows | Group-Object Category | Sort-Object Name)) {
    $s2 = New-Object System.Text.StringBuilder
    [void]$s2.AppendLine("# $($g.Name) — $($g.Count) 个命令")
    [void]$s2.AppendLine('')
    [void]$s2.AppendLine('调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。')
    [void]$s2.AppendLine('')
    foreach ($r in ($g.Group | Sort-Object Tool)) {
        $tag = if ($r.Default -eq 'on') { '[on]' } else { '[off]' }
        [void]$s2.AppendLine("- ``$($r.Tool)`` $tag — $($r.Purpose)")
        if ($r.Params) { [void]$s2.AppendLine("  - 参数: $($r.Params)") } else { [void]$s2.AppendLine('  - 参数: 无') }
        [void]$s2.AppendLine("  - 源码: ``$(($r.Source -replace '\\','/'))``")
    }
    [void]$s2.AppendLine('')
    Set-Content -Path (Join-Path $refDir "$(Get-Slug $g.Name).md") -Value $s2.ToString() -Encoding UTF8
}

# ---------- 报告各层大小 ----------
$l1 = (Get-Content (Join-Path $outDir 'SKILL.md') -Raw).Length
Write-Host "L1 索引 SKILL.md : $l1 chars (~$([math]::Round($l1/4)) tok)"
Write-Host "L2 分类文件:"
Get-ChildItem $refDir -File | Sort-Object Length -Descending | ForEach-Object {
    Write-Host ("  {0,-24} {1,6} chars (~{2} tok)" -f $_.Name, $_.Length, [math]::Round($_.Length / 4))
}
$l2all = (Get-ChildItem $refDir -File | Measure-Object -Property Length -Sum).Sum
Write-Host "L2 全部: $l2all chars (~$([math]::Round($l2all/4)) tok) / L1+L2: $($l1+$l2all) chars"
Write-Host "命令数: $($rows.Count)  分类数: $(($rows | Select-Object -ExpandProperty Category -Unique).Count)"
