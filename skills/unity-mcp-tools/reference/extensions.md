# Extensions — 10 个可选扩展

来源：插件包 `com.ivanmurzak.unity.mcp@1.5.0` 内的 `extensions.catalog.json`（生成 2026-11-01）。

这些是**可选扩展**，每个都是独立 UPM 包；装进 Unity 工程后才会新增命令，**且不会出现在本索引其余分类里**：

- 安装：Unity 的 AI Game Developer 窗口 → Extensions → Install；或 `unity-mcp-cli install-extension <名称> <Unity工程>`。
- 装完用 `mcp__unity__unity-tool-list`（可带 `regexSearch` / `includeInputs`）取实时清单，再用 `mcp__unity__tool-set-enabled-state` 按需开启。
- 扩展工具随扩展版本变，本文件只保证「依据哪个插件版本的 catalog 生成」；换离线包后由 `/unity-mcp-update-tools` 重生成。

## Animation — `com.ivanmurzak.unity.mcp.animation`

AI-driven animation control and playback tools.

- `animation-create` — Create AnimationClip assets with keyframes
- `animation-get-data` — Inspect clip curves, events, and properties
- `animation-modify` — Edit curves, events, and settings on a clip
- `animator-create` — Create AnimatorController assets
- `animator-get-data` — Inspect controller layers, states, and parameters
- `animator-modify` — Edit parameters, states, and transitions

## Cinemachine — `com.ivanmurzak.unity.mcp.cinemachine`

AI-assisted Cinemachine camera setup and configuration tools.

- `cinemachine-camera-create` — Create a CinemachineCamera in the scene
- `cinemachine-set-targets` — Set the Follow and LookAt targets
- `cinemachine-set-lens` — Configure FOV, clip planes, and dutch
- `cinemachine-set-body` — Set the position-control component (Follow/Orbital/...)
- `cinemachine-set-noise` — Add camera shake via Perlin noise

## InputSystem — `com.ivanmurzak.unity.mcp.inputsystem`

AI-assisted Unity Input System authoring: InputActionAssets, maps, actions, bindings, and control schemes.

- `inputsystem-asset-create` — Create a new .inputactions InputActionAsset
- `inputsystem-actionmap-add` — Add an ActionMap to the asset
- `inputsystem-action-add` — Add an Action (type + expectedControlType)
- `inputsystem-binding-add` — Add a binding path to an Action
- `inputsystem-binding-composite-add` — Add a composite binding (2DVector/1DAxis)
- `inputsystem-controlscheme-add` — Add a control scheme with device requirements
- `inputsystem-get` — Read the asset's maps, actions, and bindings

## Navigation — `com.ivanmurzak.unity.mcp.navigation`

AI-driven NavMesh navigation: surfaces, baking, agents, and links.

- `navigation-surface-add` — Add and configure a NavMeshSurface
- `navigation-set-bake-settings` — Set agent radius/height/slope/step and voxel size
- `navigation-surface-bake` — Bake or clear a NavMeshSurface
- `navigation-modifier-add` — Add a NavMeshModifier (override area / ignore)
- `navigation-modifier-volume-add` — Add a NavMeshModifierVolume
- `navigation-link-add` — Add a NavMeshLink between two points
- `navigation-agent-add` — Add and configure a NavMeshAgent
- `navigation-agent-set-destination` — Set a NavMeshAgent's destination
- `navigation-list` — List NavMeshSurfaces and NavMeshAgents
- `navigation-get` — Serialize any NavMesh component
- `navigation-modify` — Modify any NavMesh component via ReflectorNet

## ParticleSystem — `com.ivanmurzak.unity.mcp.particlesystem`

AI-powered particle system creation and control tools.

- `particle-system-get` — Inspect ParticleSystem modules and settings
- `particle-system-modify` — Modify emission, shape, color, noise, and more

## ProBuilder — `com.ivanmurzak.unity.mcp.probuilder`

AI-assisted ProBuilder geometry modeling tools.

- `probuilder-create-shape` — Create editable 3D primitives in the scene
- `probuilder-get-mesh-info` — Retrieve faces, vertices, and edges data
- `probuilder-extrude` — Extrude faces along their normals
- `probuilder-delete-faces` — Remove faces to create holes or trim geometry
- `probuilder-set-face-material` — Assign materials to individual faces

## Splines — `com.ivanmurzak.unity.mcp.splines`

AI-assisted Spline authoring: containers, knots, tangents, and evaluation.

- `splines-container-create` — Create a SplineContainer in the scene
- `splines-add-knot` — Append a knot to a spline
- `splines-set-knot` — Set a knot's position, tangents, and rotation
- `splines-set-tangent-mode` — Set a knot's tangent mode
- `splines-evaluate` — Evaluate position/tangent/up along a spline
- `splines-modify` — Modify any Splines component via ReflectorNet

## Terrain — `com.ivanmurzak.unity.mcp.terrain`

AI-powered Unity Terrain authoring tools.

- `terrain-create` — Create a Terrain GameObject backed by new TerrainData
- `terrain-set-heights` — Sculpt heightmap values over a region or the whole terrain
- `terrain-paint-layer` — Paint a TerrainLayer onto the alphamap (splatmap)
- `terrain-place-trees` — Scatter or place trees from a tree prototype
- `terrain-set-neighbors` — Stitch neighbor Terrains so Unity blends seams

## Tilemap — `com.ivanmurzak.unity.mcp.tilemap`

AI-assisted 2D Tilemap creation, painting, and tile/RuleTile asset tools.

- `tilemap-create` — Create a Grid + Tilemap + TilemapRenderer
- `tilemap-set-tile` — Paint a tile into a cell
- `tilemap-box-fill` — Fill a rectangular region with a tile
- `tilemap-create-tile-asset` — Create a Tile asset from a Sprite
- `tilemap-create-rule-tile` — Create a RuleTile asset (2D Tilemap Extras)

## Timeline — `com.ivanmurzak.unity.mcp.timeline`

AI-assisted Timeline cutscene and sequence authoring tools.

- `timeline-create` — Create a TimelineAsset (.playable)
- `timeline-track-add` — Add Animation/Activation/Audio/Signal/Control tracks
- `timeline-clip-add` — Add clips to a track with start and duration
- `timeline-director-bind` — Bind a TimelineAsset to a scene PlayableDirector
- `timeline-modify` — Modify any Timeline object via ReflectorNet


