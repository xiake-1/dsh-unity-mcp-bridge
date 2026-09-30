# Editor / Application — 2 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `editor-application-get-state` [off] — Returns available information about 'UnityEditor.EditorApplication'.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Editor.Application.GetState.cs`
- `editor-application-set-state` [off] — Control the Unity Editor application state.
  - 参数: isPlaying?, isPaused?
  - 源码: `Editor/Scripts/API/Tool/Editor.Application.SetState.cs`


