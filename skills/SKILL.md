---
name: unity-mcp-tools
description: Unity-MCP 命令索引（分类 + 命令名），含「激活 → 按需开启 → 用完恢复休眠」工作流。需要某命令的用途或参数时，读 reference/<分类>.md。
whenToUse: 由用户以 /unity-mcp-tools 调用：Unity 能力默认完全关闭，调用本技能后先激活，再按索引定位并开启所需命令，任务结束必须恢复休眠。
---

# Unity-MCP 命令索引

包 `com.ivanmurzak.unity.mcp@1.2.0` ｜ 命令 18 个（默认启用 7）｜ 生成 2026-10-19

调用名 `mcp__unity__<命令名>`。**本文件只是知识，不产生能力**：Unity 侧未启用的命令无法调用（服务未运行则全部无法调用）。

## 工作流程（必须遵守）

**Unity 能力默认完全关闭**：插件处于休眠状态，不连接 Unity、不注册任何 `mcp__unity__*` 工具。本技能是唯一的开启入口，由用户显式调用。

0. **激活** —— 先调用 `unity_mcp_activate`，建立连接并注册 Unity 工具（本技能被调用后的第一步）。
1. **定位** —— 在本索引找到需要的能力，读对应的 `reference/<分类>.md`，拿到命令名与参数名。
   - 索引之外的命令名（例如装了扩展包后新增的）先调 `mcp__unity__unity-tool-list` 核对，不要凭记忆猜。
2. **开启** —— 调用 `mcp__unity__tool-set-enabled-state`，把需要的命令设为 `enabled: true`（可一次传多个）。
   - 开启后**下一个步骤**才生效：工具注册表在请求边界重建，**不能在同一个步骤里开启并调用**。
3. **使用** —— 下一步直接调用 `mcp__unity__<命令名>`。
   - 读写 Unity 内容优先走 RQL：`rql-schema` 认类型 → `rql-query` 读 → `rql-mutate` 写（`dry_run: true` 先预览；改动在编辑器里 Ctrl+Z 可撤销，全有或全无）。
4. **恢复（必做，任务结束时）** —— 调用 `unity_tools_restore`：关闭除 `tool-set-enabled-state` 以外的全部已开启命令，并断开连接、注销全部 `mcp__unity__*` 工具，回到休眠状态。
   - 想保留个别命令：`unity_tools_restore({ "keep": ["rql-query"] })`（仍会断开休眠）。

为什么必须恢复：**每个处于开启状态的命令，其完整 JSON Schema 都会进入之后每一次模型请求**（未开启的不会）。开启是临时的、可回收的成本；忘记关闭就等于把这个成本永久留在上下文里。

## 版本适配（读索引前先确认）

- 本索引由插件源码生成，**命令名随包版本变**；标题行的包版本就是本索引的依据。换版本后重新生成，不要沿用旧索引。
- **1.2.0 起**：`gameobject-*`、`assets-*`、`scene-*`、`profiler-*`、`console-*`、`editor-application-*`、`editor-selection-*`、`object-*`、`reflection-method-*`、`type-get-json-schema` 已从插件中移除，改由 `rql-query` / `rql-mutate` / `rql-schema` 承担（见 `reference/rql.md`）。按旧名字调用必然失败。
- 扩展包（Animation / Cinemachine / InputSystem / Navigation / ParticleSystem / ProBuilder / Splines / Terrain / Tilemap / Timeline）会新增命令，本索引不含它们 —— 用 `unity-tool-list` 取实时清单。
- 插件的 `toolFormat`（`Rql` | `Json`，1.2.0 默认 `Rql`）决定工具参数与结果的数据表示；写参数前看 `reference/<分类>.md` 的参数说明。

## Package Manager (4) → `reference/package-manager.md`
package-add, package-list, package-remove, package-search

## RQL (3) → `reference/rql.md`
rql-mutate, rql-query, rql-schema

## Screenshot (4) → `reference/screenshot.md`
screenshot-camera, screenshot-game-view, screenshot-isolated, screenshot-scene-view

## Script (4) → `reference/script.md`
script-delete, script-execute, script-read, script-update-or-create

## Tests (1) → `reference/tests.md`
tests-run

## Tool (2) → `reference/tool.md`
tool-set-enabled-state, unity-tool-list


