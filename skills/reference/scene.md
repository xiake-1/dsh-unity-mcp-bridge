# Scene — 7 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `scene-create` [on] — Create new scene in the project assets.
  - 参数: path, newSceneSetup?, newSceneMode?
  - 源码: `Editor/Scripts/API/Tool/Scene.Create.cs`
- `scene-get-data` [on] — This tool retrieves the list of root GameObjects in the specified scene.
  - 参数: openedSceneName?, includeRootGameObjects?, includeChildrenDepth?, includeBounds?, includeData?, paths?, viewQuery?
  - 源码: `Editor/Scripts/API/Tool/Scene.GetData.cs`
- `scene-list-opened` [on] — Returns the list of currently opened scenes in Unity Editor.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Scene.ListOpened.cs`
- `scene-open` [on] — Open scene from the project asset file.
  - 参数: sceneRef, loadSceneMode?
  - 源码: `Editor/Scripts/API/Tool/Scene.Open.cs`
- `scene-save` [on] — Save Opened scene to the asset file.
  - 参数: openedSceneName?, path?
  - 源码: `Editor/Scripts/API/Tool/Scene.Save.cs`
- `scene-set-active` [on] — Set the specified opened scene as the active scene.
  - 参数: sceneRef
  - 源码: `Editor/Scripts/API/Tool/Scene.SetActive.cs`
- `scene-unload` [on] — Unload scene from the Opened scenes in Unity Editor.
  - 参数: name
  - 源码: `Editor/Scripts/API/Tool/Scene.Unload.cs`


