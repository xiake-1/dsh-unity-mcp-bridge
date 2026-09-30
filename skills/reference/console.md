# Console — 2 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `console-clear-logs` [off] — Clears the MCP log cache (used by console-get-logs) and the Unity Editor Console window.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Console.ClearLogs.cs`
- `console-get-logs` [on] — Retrieves Unity Editor logs.
  - 参数: maxEntries?, logTypeFilter?, includeStackTrace?, lastMinutes?
  - 源码: `Editor/Scripts/API/Tool/Console.GetLogs.cs`


