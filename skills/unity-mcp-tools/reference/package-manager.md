# Package Manager — 4 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `package-add` [off] — Install a package from the Unity Package Manager registry, Git URL, or local path.
  - 参数: packageId, requestId?
  - 源码: `Editor/Scripts/API/Tool/Package.Add.cs`
- `package-list` [off] — List all packages installed in the Unity project (UPM packages).
  - 参数: sourceFilter?, nameFilter?, directDependenciesOnly?
  - 源码: `Editor/Scripts/API/Tool/Package.List.cs`
- `package-remove` [off] — Remove (uninstall) a package from the Unity project.
  - 参数: packageId, requestId?
  - 源码: `Editor/Scripts/API/Tool/Package.Remove.cs`
- `package-search` [off] — Search for packages in both Unity Package Manager registry and installed packages.
  - 参数: query, maxResults?, offlineMode?
  - 源码: `Editor/Scripts/API/Tool/Package.Search.cs`


