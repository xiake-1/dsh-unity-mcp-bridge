# GameObject — 6 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `gameobject-create` [on] — Create a new GameObject in opened Prefab or in a Scene.
  - 参数: name, parentGameObjectRef?, position?, rotation?, scale?, isLocalSpace?, primitiveType?
  - 源码: `Editor/Scripts/API/Tool/GameObject.Create.cs`
- `gameobject-destroy` [on] — Destroy GameObject and all nested GameObjects recursively in opened Prefab or in a Scene.
  - 参数: gameObjectRef
  - 源码: `Editor/Scripts/API/Tool/GameObject.Destroy.cs`
- `gameobject-duplicate` [on] — Duplicate GameObjects in opened Prefab or in a Scene.
  - 参数: gameObjectRefs
  - 源码: `Editor/Scripts/API/Tool/GameObject.Duplicate.cs`
- `gameobject-find` [on] — Finds specific GameObject by provided information in opened Prefab or in a Scene.
  - 参数: gameObjectRef, includeData?, includeComponents?, includeBounds?, includeHierarchy?, hierarchyDepth?, paths?, viewQuery?
  - 源码: `Editor/Scripts/API/Tool/GameObject.Find.cs`
- `gameobject-modify` [on] — Modify GameObject fields and properties in opened Prefab or in a Scene.
  - 参数: gameObjectRefs, gameObjectDiffs?, pathPatchesPerGameObject?, jsonPatchesPerGameObject?
  - 源码: `Editor/Scripts/API/Tool/GameObject.Modify.cs`
- `gameobject-set-parent` [on] — Set parent GameObject to list of GameObjects in opened Prefab or in a Scene.
  - 参数: gameObjectRefs, parentGameObjectRef, worldPositionStays?
  - 源码: `Editor/Scripts/API/Tool/GameObject.SetParent.cs`


