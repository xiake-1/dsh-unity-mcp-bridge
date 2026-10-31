# RQL — 3 个命令

调用名 `mcp__unity__<命令名>`；`[on]` = Unity 侧默认启用（可直接调），`[off]` = 默认关闭 —— 用 `mcp__unity__tool-set-enabled-state` 开启后，**从下一个步骤起可调用**（工具注册表在请求边界重建）。

- `rql-mutate` [on] — Change the live Unity Editor scene with an RQL query whose last stage is set or call.
  - 参数: query, dry_run?
  - 源码: `Editor/Scripts/API/Tool/Rql.Mutate.cs`
- `rql-query` [on] — Run a read-only RQL query against the live Unity Editor scene and return compact rows.
  - 参数: query
  - 源码: `Editor/Scripts/API/Tool/Rql.Query.cs`
- `rql-schema` [on] — Without a type: RQL sources, asset functions, and the component types present in the loaded scenes (with counts), plus GameObject and Tra...
  - 参数: type?
  - 源码: `Editor/Scripts/API/Tool/Rql.Schema.cs`

### `rql-query` 的完整用法（插件喂给模型的原文，已按段落去重）

```text
Run a read-only RQL query against the live Unity Editor scene and return compact rows. One precise query beats many exploratory calls. Changes need rql-mutate.

RQL: source | stage | stage ...
Sources: objects (every GameObject in the loaded scenes, inactive included), roots, scenes, selection, prefab (the prefab open in prefab editing mode), console (Editor log entries), shaders, componentTypes, profiler (memory / rendering / frame snapshots; call Start / Stop / Save), tests (test methods; run a selection with tests-run query), testResults (last run), editor (Editor state and operations). Assets: unity.assets("t:Material") or unity.assets("t:Prefab", "Assets/Enemies"), unity.asset("Assets/Mats/Red.mat"). ref("Light#1234") resolves a $ref; unity.find("Player") or unity.find("Level/Pillar_1") a GameObject by unique name or path.
Stages:
  where <predicate>                  filter
  select a b.c alias=(expr)          project columns (wrap computed expressions in parentheses)
  sort <expr> [desc], ...            stable sort
  first N | skip N | count
  get <path>                         replace each item by a member (lists are flattened)
  recurse children [max-depth=N] [include-self=false]   walk the hierarchy (input items included by default)
  distinct [expr] | group-by expr | sum expr | min expr | max expr | avg expr
Expressions: == != < <= > >= and or not + - * / %; contains, starts-with, ends-with (case-insensitive); matches "regex"; x in [a, b]; x is null; x is not null; $ is Light (includes subclasses); has(member). Literals: numbers, "strings", true/false/null, lists [a, b], objects {x: 1, y: 2}.
Paths: a.b.c, list[0], map["key"]; .member on a list maps over its elements. List methods: .any(pred) .all(pred) .count([pred]) .sum(e) .min(e) .max(e) .first([pred]); inside them bare names refer to the element, falling back to the outer item.
Meta: $ (current item), $ref (stable id such as Light#1234), $type, $path, $index, $depth. Enums compare to strings (type == "Spot"); == on strings is case-sensitive.
Unity: GameObject has components (list), children (list), active, name, tag, layer, transform (position, localPosition, eulerAngles, localScale, parent). Component members are the C# members (public + [SerializeField]); find them via objects | get components | where $ is Light. Vectors/colors print as (x, y, z); write "(1, 2, 3)", [1, 2, 3] or {x: 1, y: 2, z: 3}; colors also "#ff8800". Material shader properties: properties["_Color"]. Destroyed objects read as null (missing references: where target == null). Navigate with paths or get; select only projects output columns.
Results come back as compact rows (header line, then col|col). Long results are truncated — refine with where/first or use count. Unknown members produce warnings with suggestions; rql-schema(type) lists a type's members.

Examples:
  objects | where name contains "Enemy" and active | select $ref name transform.position
  objects | get components | where $ is Light and intensity > 2 | select gameObject.name intensity color
  roots | recurse children | where components.count() == 1 | select $path name
  unity.assets("t:Material") | select name shader.name properties["_Color"]
  console | where logType == "Error" | sort sequence desc | first 5 | select message
  scenes | select name path isDirty rootCount
  componentTypes | where name contains "Collider" | select name
  editor | select isPlaying isPaused selection
```

### `rql-mutate` 的完整用法（插件喂给模型的原文，已按段落去重）

```text
Change the live Unity Editor scene with an RQL query whose last stage is set or call. All-or-nothing: every target and value is checked before anything is written; a failure changes nothing. Undoable in the Editor (Ctrl+Z). Changed assets, scenes and the open prefab are saved to disk automatically; an untitled scene needs SaveAs(path). dry_run=true returns the receipt ($ref, member, old, new) without changing anything. Do exactly the change requested; a read-only member fails with readonly-member instead of being approximated.
  set path = expr, ...   assign members (paths may go through structs: set transform.position.y = transform.position.y + 1)
  call Method(args)      invoke a method the tools expose
Examples:
  objects | where name == "Player" | set transform.position = "(0, 1, 0)"
  objects | get components | where $ is Light | set intensity = intensity * 2, color = "#ffcc88"
  objects | where tag == "Enemy" | set active = false
  unity.asset("Assets/Mats/Red.mat") | set properties["_Color"] = "(1, 0, 0, 1)"
  objects | where name == "Spawner" | set targets = append(targets, ref("GameObject#1234"))
Create / add / remove (call; the receipt's result column holds the new object's $ref for follow-up queries):
  editor | call CreateGameObject("Props")                                   new root GameObject
  editor | call CreateGameObject("Crate", ref("GameObject#1234"), "Cube")    child of a parent, optional primitive
  objects | where name == "Crate" | call AddComponent("Rigidbody")           add a component by type name
  objects | where name == "Old" | call Destroy()                             remove a GameObject (components: get components | where $ is X | call Destroy())
  objects | where name == "Lamp" | set transform.parent = ref("GameObject#1234")   reparent (keeps the world position)
  objects | where name == "Crate" | call Duplicate()                          copy next to it (returns the copy)
Scenes, prefabs, assets, Editor state:
  editor | call OpenScene("Assets/Scenes/Level.unity")          editor | call NewScene("Assets/Scenes/New.unity")
  scenes | where path == "" | call SaveAs("Assets/Scenes/New.unity")   scenes | where name == "Level" | call SetActive()
  editor | call InstantiatePrefab("Assets/Prefabs/Enemy.prefab", ref("GameObject#1234"), "(0, 0, 5)")
  objects | where name == "Crate" | call SaveAsPrefab("Assets/Prefabs/Crate.prefab")
  editor | call OpenPrefab("Assets/Prefabs/Enemy.prefab")  then  prefab | recurse children | …  then  editor | call ClosePrefab()
  editor | call CreateMaterial("Assets/Mats/Glow.mat")        editor | call MoveAsset("Assets/A.mat", "Assets/Mats/A.mat")
  editor | set selection = [ref("GameObject#1234")]         editor | set isPlaying = true
  profiler | call Start()      profiler | call Save("Logs/profile.json")      (read: profiler | select memory frame)
Object literals build values: set settings = {speed: 2, "$type": "FastSettings"}. At most 20 targets per call.

Query part: the RQL of rql-query (full guide and the sources in its description); unity.assets("t:Material"), unity.asset(path), unity.find("Name"), ref("Light#1234"). Stages: where, select, sort, first N, get <path>, recurse children. Operators: == != < > and or not, contains, starts-with, $ is Light. Paths a.b.c, list[0], map["key"]. Vectors/colors as "(1, 2, 3)" or "#ff8800"; enums as strings.
```

### `rql-schema` 的完整用法（插件喂给模型的原文，已按段落去重）

```text
Without a type: RQL sources, asset functions, and the component types present in the loaded scenes (with counts), plus GameObject and Transform members. With a type name (e.g. "Light", "Enemy", "Vector3"): that type's members (name type; ro = read-only) and methods. Use it before querying an unfamiliar component.
```


