# Assets — 11 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `assets-copy` [off] — Copy assets at given paths and store them at new paths.
  - 参数: sourcePaths, destinationPaths
  - 源码: `Editor/Scripts/API/Tool/Assets.Copy.cs`
- `assets-create-folder` [off] — Creates a new folder in the specified parent folder.
  - 参数: inputs
  - 源码: `Editor/Scripts/API/Tool/Assets.CreateFolders.cs`
- `assets-delete` [off] — Delete the assets at paths from the project.
  - 参数: paths
  - 源码: `Editor/Scripts/API/Tool/Assets.Delete.cs`
- `assets-find` [on] — Search the asset database using the search filter string.
  - 参数: filter?, searchInFolders?, maxResults?
  - 源码: `Editor/Scripts/API/Tool/Assets.Find.cs`
- `assets-find-built-in` [on] — Search the built-in assets of the Unity Editor located in the built-in resources: .
  - 参数: name?, type?, maxResults?
  - 源码: `Editor/Scripts/API/Tool/Assets.FindBuiltIn.cs`
- `assets-get-data` [on] — Get asset data from the asset file in the Unity project.
  - 参数: assetRef, paths?, viewQuery?
  - 源码: `Editor/Scripts/API/Tool/Assets.GetData.cs`
- `assets-material-create` [on] — Create new material asset with default parameters.
  - 参数: assetPath, shaderName
  - 源码: `Editor/Scripts/API/Tool/Assets.Material.Create.cs`
- `assets-modify` [on] — Modify asset file in the project.
  - 参数: assetRef, content?, pathPatches?, jsonPatch?
  - 源码: `Editor/Scripts/API/Tool/Assets.Modify.cs`
- `assets-move` [off] — Move the assets at paths in the project.
  - 参数: sourcePaths, destinationPaths
  - 源码: `Editor/Scripts/API/Tool/Assets.Move.cs`
- `assets-refresh` [on] — Refreshes the AssetDatabase.
  - 参数: options?, requestId?
  - 源码: `Editor/Scripts/API/Tool/Assets.Refresh.cs`
- `assets-shader-list-all` [on] — List all available shaders in the project assets and packages.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Assets.Shader.ListAll.cs`


