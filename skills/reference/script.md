# Script — 4 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `script-delete` [off] — Delete the script file(s).
  - 参数: files, requestId?
  - 源码: `Editor/Scripts/API/Tool/Script.Delete.cs`
- `script-execute` [on] — Compiles and executes C# code dynamically using Roslyn.
  - 参数: csharpCode, className?, methodName?, parameters?, isMethodBody?
  - 源码: `Editor/Scripts/API/Tool/Script.Execute.cs`
- `script-read` [off] — Reads the content of a script file and returns it as a string.
  - 参数: filePath, lineFrom?, lineTo?
  - 源码: `Editor/Scripts/API/Tool/Script.Read.cs`
- `script-update-or-create` [off] — Updates or creates script file with the provided C# code.
  - 参数: filePath, content, requestId?
  - 源码: `Editor/Scripts/API/Tool/Script.UpdateOrCreate.cs`


