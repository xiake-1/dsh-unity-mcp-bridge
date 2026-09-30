# GameObject / Component — 5 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `gameobject-component-add` [on] — Add Component to GameObject in opened Prefab or in a Scene.
  - 参数: componentNames, gameObjectRef
  - 源码: `Editor/Scripts/API/Tool/GameObject.Component.Add.cs`
- `gameobject-component-destroy` [on] — Destroy one or many components from target GameObject.
  - 参数: gameObjectRef, destroyComponentRefs
  - 源码: `Editor/Scripts/API/Tool/GameObject.Component.Destroy.cs`
- `gameobject-component-get` [on] — Get detailed information about a specific Component on a GameObject.
  - 参数: gameObjectRef, componentRef, includeFields?, includeProperties?, deepSerialization?, paths?, viewQuery?
  - 源码: `Editor/Scripts/API/Tool/GameObject.Component.Get.cs`
- `gameobject-component-list-all` [on] — List C# class names extended from UnityEngine.Component.
  - 参数: search?, page?, pageSize?
  - 源码: `Editor/Scripts/API/Tool/GameObject.Component.ListAll.cs`
- `gameobject-component-modify` [on] — Modify a specific Component on a GameObject in opened Prefab or in a Scene.
  - 参数: gameObjectRef, componentRef, componentDiff?, pathPatches?, jsonPatch?
  - 源码: `Editor/Scripts/API/Tool/GameObject.Component.Modify.cs`


