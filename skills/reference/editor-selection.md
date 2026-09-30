# Editor / Selection — 2 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `editor-selection-get` [off] — Get information about the current Selection in the Unity Editor.
  - 参数: includeGameObjects?, includeTransforms?, includeInstanceIDs?, includeAssetGUIDs?, includeActiveObject?, includeActiveTransform?
  - 源码: `Editor/Scripts/API/Tool/Editor.Selection.Get.cs`
- `editor-selection-set` [off] — Set the current Selection in the Unity Editor to the provided objects.
  - 参数: select
  - 源码: `Editor/Scripts/API/Tool/Editor.Selection.Set.cs`


