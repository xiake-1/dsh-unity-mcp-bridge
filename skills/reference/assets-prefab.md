# Assets / Prefab — 5 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `assets-prefab-close` [on] — Close currently opened prefab.
  - 参数: save?
  - 源码: `Editor/Scripts/API/Tool/Assets.Prefab.Close.cs`
- `assets-prefab-create` [on] — Create a prefab from a GameObject in the current active scene.
  - 参数: prefabAssetPath, gameObjectRef?, sourcePrefabAssetPath?, connectGameObjectToPrefab?
  - 源码: `Editor/Scripts/API/Tool/Assets.Prefab.Create.cs`
- `assets-prefab-instantiate` [on] — Instantiates prefab in the current active scene.
  - 参数: prefabAssetPath, gameObjectPath, position?, rotation?, scale?, isLocalSpace?
  - 源码: `Editor/Scripts/API/Tool/Assets.Prefab.Instantiate.cs`
- `assets-prefab-open` [on] — Open prefab edit mode for a specific GameObject.
  - 参数: gameObjectRef
  - 源码: `Editor/Scripts/API/Tool/Assets.Prefab.Open.cs`
- `assets-prefab-save` [on] — Save a prefab.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Assets.Prefab.Save.cs`


