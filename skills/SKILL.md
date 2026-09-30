---
name: unity-mcp-tools
description: Unity-MCP 命令索引（分类 + 命令名），含「激活 → 按需开启 → 用完恢复休眠」工作流。需要某命令的用途或参数时，读 reference/<分类>.md。
whenToUse: 由用户以 /unity-mcp-tools 调用：Unity 能力默认完全关闭，调用本技能后先激活，再按索引定位并开启所需命令，任务结束必须恢复休眠。
---

# Unity-MCP 命令索引

包 `com.ivanmurzak.unity.mcp@0.91.0` ｜ 命令 73 个（默认启用 38）｜ 生成 2026-09-21

调用名 `mcp__unity__<命令名>`。**本文件只是知识，不产生能力**：Unity 侧未启用的命令无法调用（服务未运行则全部无法调用）。

## 工作流程（必须遵守）

**Unity 能力默认完全关闭**：插件处于休眠状态，不连接 Unity、不注册任何 `mcp__unity__*` 工具。本技能是唯一的开启入口，由用户显式调用。

0. **激活** —— 先调用 `unity_mcp_activate`，建立连接并注册 Unity 工具（本技能被调用后的第一步）。
1. **定位** —— 在本索引找到需要的能力，读对应的 `reference/<分类>.md`，拿到命令名与参数名。
2. **开启** —— 调用 `mcp__unity__tool-set-enabled-state`，把需要的命令设为 `enabled: true`（可一次传多个）。
   - 开启后**下一个步骤**才生效：工具注册表在请求边界重建，**不能在同一个步骤里开启并调用**。
3. **使用** —— 下一步直接调用 `mcp__unity__<命令名>`。
4. **恢复（必做，任务结束时）** —— 调用 `unity_tools_restore`：关闭除 `tool-set-enabled-state` 以外的全部已开启命令，并断开连接、注销全部 `mcp__unity__*` 工具，回到休眠状态。
   - 想保留个别命令：`unity_tools_restore({ "keep": ["gameobject-find"] })`（仍会断开休眠）。

为什么必须恢复：**每个处于开启状态的命令，其完整 JSON Schema 都会进入之后每一次模型请求**（未开启的不会）。开启是临时的、可回收的成本；忘记关闭就等于把这个成本永久留在上下文里。

## Assets (11) → `reference/assets.md`
assets-copy, assets-create-folder, assets-delete, assets-find, assets-find-built-in, assets-get-data, assets-material-create, assets-modify, assets-move, assets-refresh, assets-shader-list-all

## Assets / Prefab (5) → `reference/assets-prefab.md`
assets-prefab-close, assets-prefab-create, assets-prefab-instantiate, assets-prefab-open, assets-prefab-save

## Assets / Shader (1) → `reference/assets-shader.md`
assets-shader-get-data

## Console (2) → `reference/console.md`
console-clear-logs, console-get-logs

## Editor / Application (2) → `reference/editor-application.md`
editor-application-get-state, editor-application-set-state

## Editor / Selection (2) → `reference/editor-selection.md`
editor-selection-get, editor-selection-set

## GameObject (6) → `reference/gameobject.md`
gameobject-create, gameobject-destroy, gameobject-duplicate, gameobject-find, gameobject-modify, gameobject-set-parent

## GameObject / Component (5) → `reference/gameobject-component.md`
gameobject-component-add, gameobject-component-destroy, gameobject-component-get, gameobject-component-list-all, gameobject-component-modify

## Method C# (2) → `reference/method-c.md`
reflection-method-call, reflection-method-find

## Object (2) → `reference/object.md`
object-get-data, object-modify

## Package Manager (4) → `reference/package-manager.md`
package-add, package-list, package-remove, package-search

## Profiler (12) → `reference/profiler.md`
profiler-capture-frame, profiler-clear-data, profiler-enable-module, profiler-get-memory-stats, profiler-get-rendering-stats, profiler-get-script-stats, profiler-get-status, profiler-list-modules, profiler-load-data, profiler-save-data, profiler-start, profiler-stop

## Scene (7) → `reference/scene.md`
scene-create, scene-get-data, scene-list-opened, scene-open, scene-save, scene-set-active, scene-unload

## Screenshot (4) → `reference/screenshot.md`
screenshot-camera, screenshot-game-view, screenshot-isolated, screenshot-scene-view

## Script (4) → `reference/script.md`
script-delete, script-execute, script-read, script-update-or-create

## Tests (1) → `reference/tests.md`
tests-run

## Tool (2) → `reference/tool.md`
tool-set-enabled-state, unity-tool-list

## Type (1) → `reference/type.md`
type-get-json-schema


