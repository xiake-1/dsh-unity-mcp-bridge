# Screenshot — 4 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `screenshot-camera` [off] — Captures a screenshot from a camera and returns it as an image.
  - 参数: cameraRef?, width?, height?
  - 源码: `Editor/Scripts/API/Tool/Screenshot.Camera.cs`
- `screenshot-game-view` [off] — Captures a screenshot from the Unity Editor Game View and returns it as an image.
  - 参数: nothing?
  - 源码: `Editor/Scripts/API/Tool/Screenshot.GameView.cs`
- `screenshot-isolated` [on] — Renders a screenshot of a target GameObject with configurable isolation, background, camera angle, and lighting.
  - 参数: gameObjectRef, includeChildren?, isolated?, backgroundMode?, backgroundColor?, cameraView?, fieldOfView?, nearClipPlane?, farClipPlane?, padding?, lights?, resolution?
  - 源码: `Editor/Scripts/API/Tool/Screenshot.Isolated.cs`
- `screenshot-scene-view` [off] — Captures a screenshot from the Unity Editor Scene View and returns it as an image.
  - 参数: width?, height?
  - 源码: `Editor/Scripts/API/Tool/Screenshot.SceneView.cs`


