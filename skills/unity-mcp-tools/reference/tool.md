# Tool — 2 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `tool-set-enabled-state` [off] — Enable or disable MCP tools by name.
  - 参数: tools, includeLogs?
  - 源码: `Editor/Scripts/API/Tool/Tool.SetEnabledState.cs`
- `unity-tool-list` [on] — List all Unity-MCP tools registered in the connected Unity Editor instance.
  - 参数: regexSearch?, includeDescription?, includeInputs?
  - 源码: `Editor/Scripts/API/Tool/Tool.List.cs`


