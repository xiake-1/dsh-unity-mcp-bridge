# Profiler — 12 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `profiler-capture-frame` [off] — Captures current frame timing data (delta time, FPS, total + rendered frame counts, runtime).
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.CaptureFrame.cs`
- `profiler-clear-data` [off] — Clears all frames currently held by the Unity Editor Profiler.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.ClearData.cs`
- `profiler-enable-module` [off] — Enables or disables a profiler module name in the wrapper's local bookkeeping set.
  - 参数: moduleName, enabled?
  - 源码: `Editor/Scripts/API/Tool/Profiler.EnableModule.cs`
- `profiler-get-memory-stats` [off] — Returns memory statistics from the Unity Profiler (all values in MB).
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.GetMemoryStats.cs`
- `profiler-get-rendering-stats` [off] — Returns rendering statistics: frame time, FPS, vsync, target frame rate, threading mode, graphics device type.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.GetRenderingStats.cs`
- `profiler-get-script-stats` [off] — Returns script execution statistics including timing and Mono / GC memory usage.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.GetScriptStats.cs`
- `profiler-get-status` [off] — Returns the current state of the Unity Profiler (enabled flag, active modules, max-used memory, platform support).
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.GetStatus.cs`
- `profiler-list-modules` [off] — Lists all available profiler modules and whether the wrapper considers each enabled.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.ListModules.cs`
- `profiler-load-data` [off] — Reads a profiler snapshot JSON file and returns its raw text content.
  - 参数: filePath
  - 源码: `Editor/Scripts/API/Tool/Profiler.LoadData.cs`
- `profiler-save-data` [off] — Saves a profiler snapshot (status + memory + rendering + script + frame) to a JSON file.
  - 参数: filePath
  - 源码: `Editor/Scripts/API/Tool/Profiler.SaveData.cs`
- `profiler-start` [off] — Enable the Unity Profiler and open the Profiler window.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.Start.cs`
- `profiler-stop` [off] — Disable the Unity Profiler.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Profiler.Stop.cs`


