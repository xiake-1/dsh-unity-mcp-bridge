# Object — 2 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `object-get-data` [on] — Get data of the specified Unity Object.
  - 参数: objectRef, paths?, viewQuery?
  - 源码: `Editor/Scripts/API/Tool/Object.GetData.cs`
- `object-modify` [on] — Modify the specified Unity Object.
  - 参数: objectRef, objectDiff?, pathPatches?, jsonPatch?
  - 源码: `Editor/Scripts/API/Tool/Object.Modify.cs`


