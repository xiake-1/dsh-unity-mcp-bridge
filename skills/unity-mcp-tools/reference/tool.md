# Tool — 3 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认可见（可直接调），`[off]` = 默认隐藏 —— 用 `mcp__unity__tool-set-enabled-state`（1.6.0 正式名 `tool-set-visibility`，等价）设为 visible 后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `tool-set-enabled-state` [off] — DEPRECATED, use tool-set-visibility.
  - 参数: tools, includeLogs?
  - 源码: `Editor/Scripts/API/Tool/Tool.SetEnabledState.cs`
- `tool-set-visibility` [off] — Show or hide MCP tools by name.
  - 参数: tools, includeLogs?
  - 源码: `Editor/Scripts/API/Tool/Tool.SetVisibility.cs`
- `unity-tool-list` [on] — List all Unity-MCP tools registered in the connected Unity Editor instance, hidden ones included (each with Visible).
  - 参数: regexSearch?, includeDescription?, includeInputs?
  - 源码: `Editor/Scripts/API/Tool/Tool.List.cs`


