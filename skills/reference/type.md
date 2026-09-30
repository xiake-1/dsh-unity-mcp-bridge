# Type — 1 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `type-get-json-schema` [off] — Generates a JSON Schema for a given C# type name using reflection.
  - 参数: typeName, descriptionMode?, propertyDescriptionMode?, includeNestedTypes?, writeIndented?
  - 源码: `Editor/Scripts/API/Tool/Type.GetJsonSchema.cs`


