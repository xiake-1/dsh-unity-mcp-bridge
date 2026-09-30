# dsh-unity-mcp-bridge

> Feature overview and a measured comparison of "tools vs handling it directly from files"
> (token cost and latency, with the numbers behind them):
> **[FEATURES-AND-COMPARISON.md](FEATURES-AND-COMPARISON.md)** (Chinese).

A self-contained **DeepSeek Harness (DSH) plugin** that connects **on demand** to a Unity MCP
server (AI Game Developer / `com.ivanmurzak.unity.mcp`). It is **dormant until the user runs
`/unity-mcp-tools`** — Unity capability never turns on by itself (see
[Activation model](#activation-model-opt-in)). On top of that it adds the three things the
stock `@deepseek-ai/dsh-mcp-client` does not give you:

1. **A vendored implementation** — the bridge lives in this package, so a DSH/npx upgrade
   cannot silently revert it. (Patching the installed `lib/index.js` gets wiped on upgrade;
   this does not.)
2. **A shipped tool catalog skill** — `skills/SKILL.md` (index) plus `skills/reference/*.md`
   (per-category detail) are registered as a runtime skill at activation. The model loads the
   index on demand and reads one category file only when it needs it.
3. **A restore-when-done helper tool** — `unity_tools_restore` disables every Unity tool
   except the tool-management ones, so an on-demand tool set collapses back to the minimal
   resident set when the task is over.

It also carries the original fix that makes the workflow possible at all:
**`resyncAfterTools`** — after a listed tool call returns, the bridge re-fetches `tools/list`
itself and swaps the registry, instead of waiting for the server's
`notifications/tools/list_changed` (which DSH's long-lived session does not receive).

## Why not just patch the installed package?

`@deepseek-ai/dsh-mcp-client` is a build artifact inside the npx cache
(`.../node_modules/@deepseek-ai/dsh-mcp-client/lib/index.js`). `npx @deepseek-ai/dsh` can
reinstall or upgrade it at any time, silently dropping a hand-applied patch. Vendoring the
implementation here makes the behaviour yours and version-pinned.

## Install

The plugin is a normal npm package with `@deepseek-ai/*` declared as **peer dependencies**
(the host provides them, exactly like upstream and like third-party plugins such as
`dshmarket`). Only `@modelcontextprotocol/sdk`, `zod` and `@deepseek-ai/schemastery` are real
dependencies.

### DSH version compatibility

The five `@deepseek-ai/dsh-*` peers declare a **floor, not a pin** (`>=0.1.5-rc.2`), so one
checkout installs into any DSH runtime from 0.1.5-rc.2 onward. Verified against the host's own
gate (`dsh-app-boot` → `evaluatePluginCompatibility`, i.e.
`semver.satisfies(version, range, { includePrerelease: true })`) for 0.1.5-rc.2, 0.1.7-rc.2 and
0.2.0-rc.2; the host API this package uses is unchanged across them. `@deepseek-ai/cordis` keeps
`^4.0.2` — it is a separate version line and the host does not gate it. A genuinely
incompatible future runtime is still reported by the host's install-time gate.

```powershell
# 1) install into the profile that runs the MCP bridge (this profile forwards to pnpm)
#    <profile> is `web` for `dsh web`, `desktop` for the DeepSeek Harness desktop app
dsh plugin --profile <profile> add file:<path-to-this-checkout>
#    or straight from git:
dsh plugin --profile <profile> add git+https://github.com/xiake-1/dsh-unity-mcp-bridge.git

# 2) point your profile patch entry at this package instead of the stock client
#    %DSH_HOME%/profiles/<profile>/cordis.patch.yml
```

```yaml
- insert:
    - id: unity-mcp
      name: 'dsh-unity-mcp-bridge'
      config:
        serverName: unity
        transport: streamable-http
        url: http://localhost:24009/p/<your-token>
        resyncAfterTools:
          - tool-set-enabled-state
        resyncIntervalMs: 0
```

3. Restart the app (`dsh web`, or the desktop app). The skill and the helper tool appear
   automatically.

> **Do not run this bridge and the stock `@deepseek-ai/dsh-mcp-client` against the same
> `serverName` at the same time.** They are separate module instances, so each believes it
> owns the namespace, and both would publish the same public tool names.

## Companion skills: install and check

Two more shipped runtime skills cover the other half of the setup — the Unity-side plugin, and
the link between the two halves. Unlike the catalog they are **model-visible by default** (they
are the on-ramp and the doctor, not the Unity capability itself), and both are also slash
commands:

| Skill | What it does |
|---|---|
| `/unity-mcp-install` | Checks whether `unity-mcp-cli` is on the machine — installs it with `npm install -g unity-mcp-cli` when it is missing — then finds the Unity project **inside the current workspace** (by `ProjectSettings/ProjectVersion.txt`). If `com.ivanmurzak.unity.mcp` is already in `Packages/manifest.json` it says so; otherwise it runs `unity-mcp-cli install-plugin <project>` and re-reads the manifest to verify. |
| `/unity-mcp-check` | Finds the same project, reads its real endpoint (the CLI's own auto-detection, then `UserSettings/AI-Game-Developer-Config.json`, then the last `Start listening on port:` line in the MCP server log), probes the port and the HTTP endpoint, and finally loads the bridge with `unity_mcp_activate` to prove the link. **Default port 20000**; when the project listens somewhere else it rewrites the `unity-mcp` row's `url` in the profile's `cordis.patch.yml` — after a timestamped backup — and says whether a restart is needed, because only a `patchReload: live` profile picks the change up on save. |

Both follow the documented setup flow at <https://ai-game.dev/engines/unity>. Set
`registerHelperSkills: false` to ship without them; the configuration table below has the name
and invocation knobs.

## Configuration

Everything the stock client accepts (`serverName`, `transport`, `command`/`args`/`env`/`cwd`
for stdio, `url`/`headers` for streamable-http, `toolCallTimeoutMs`, `failOnStartupError`,
`reconnect.*`) works unchanged. On top of that:

| Field | Default | Meaning |
|---|---|---|
| `autoStart` | **`false`** | Dormant by default: no connection and no bridged tools until a session opts in. Set `true` to connect at boot (the old always-on behaviour). |
| `activateToolName` | `unity_mcp_activate` | Name of the always-registered activation hook. |
| `restoreDeactivates` | `true` | `unity_tools_restore` also disconnects, returning the session to dormant. `false` keeps the connection alive. |
| `skillModelInvocable` | **`false`** | The catalog skill is **not** offered to the model, so it never auto-loads and Unity capability never turns on by itself. |
| `skillUserInvocable` | `true` | The skill is user-invocable: `/unity-mcp-tools` is the opt-in entry point. |
| `resyncAfterTools` | `[]` | Raw MCP tool names whose **call completion** triggers a `tools/list` re-sync and registry swap. Set it to `['tool-set-enabled-state']` for the on-demand workflow. The trigger runs ~200 ms after the call returns, so the in-flight result finalizes first. |
| `resyncIntervalMs` | `0` | Periodic re-sync (ms); `0` disables. Enabling it also picks up switches flipped by hand in the Unity window, at the cost of rebuilding the tool registrations every tick. |
| `restoreToolName` | `unity_tools_restore` | Name of the native restore hook. |
| `keepEnabledTools` | `[]` | Extra raw tool names the restore hook leaves enabled (on top of `tool-set-enabled-state`). |
| `registerCatalogSkill` | `true` | Register the shipped catalog as a runtime skill. |
| `skillName` | `unity-mcp-tools` | Skill name / slash command (`/unity-mcp-tools`). |
| `registerHelperSkills` | `true` | Register the two shipped helper skills (`/unity-mcp-install`, `/unity-mcp-check`). |
| `installSkillName` | `unity-mcp-install` | Name of the skill that installs the Unity-side plugin into the workspace's Unity project. |
| `checkSkillName` | `unity-mcp-check` | Name of the skill that verifies the bridge reaches Unity and repairs the profile URL. |
| `helperSkillsModelInvocable` | `true` | The helpers, unlike the catalog, are offered to the model so it can reach for them unprompted. |
| `helperSkillsUserInvocable` | `true` | They are also user-invocable slash commands. |

## Activation model (opt-in)

The plugin is **dormant from boot**: it registers exactly two tiny hook tools and does not
connect to Unity, so a session that never asks for Unity pays ~**895 characters (~224 tokens)**
and nothing else.

```
boot ──► DORMANT ──(/unity-mcp-tools ─► unity_mcp_activate)──► ACTIVE ──(unity_tools_restore)──► DORMANT
          2 hook tools                                          bridged mcp__unity__* tools
```

1. The user invokes **`/unity-mcp-tools`**. The skill is model-invisible (`skillModelInvocable:
   false`), so this is the only way in; its body is injected as instructions.
2. The model calls **`unity_mcp_activate`** → the bridge connects, and the Unity tools currently
   enabled on the Unity side are registered (`mcp__unity__*`).
3. Work proceeds with the on-demand enable/use workflow below.
4. **`unity_tools_restore`** disables every Unity tool except `tool-set-enabled-state` **and
   disconnects**, so the session is dormant again.

## Workflow the model is told to follow

The skill body states it, and the hook tools enforce the ends of it:

0. **Activate** — `unity_mcp_activate` (the first step after `/unity-mcp-tools`).
1. **Locate** — read the index, then the one `reference/<category>.md` that matters.
2. **Enable** — `mcp__unity__tool-set-enabled-state` with the needed commands set to
   `enabled: true`. Takes effect on the **next** step (the registry is rebuilt at request
   boundaries), never in the same step.
3. **Use** — call `mcp__unity__<command>` on the next step.
4. **Restore** — call `unity_tools_restore` when the Unity work is done. It disables
   everything except the management tool. Keep specific tools with
   `unity_tools_restore({ "keep": ["gameobject-find"] })`.

Every enabled command contributes its full JSON schema to **every subsequent model request**;
disabled ones contribute nothing. Enabling is a temporary, reclaimable cost — forgetting step 4
is what turns it permanent. The restore helper exists so step 4 never requires enumerating 73
names.

## Regenerating the catalog

`tools/generate-unity-mcp-catalog.ps1` scans the installed
`com.ivanmurzak.unity.mcp@*` package and rewrites `skills/SKILL.md` plus
`skills/reference/*.md` (categories come from the plugin's own `[AiTool(Title = ...)]`
attributes). Re-run it after a Unity plugin upgrade, then restart `dsh web`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/generate-unity-mcp-catalog.ps1 -ProjectRoot <your-unity-project>
```

## Uninstall / rollback

```powershell
dsh plugin --profile web remove dsh-unity-mcp-bridge
```

Then point the profile patch entry back at `@deepseek-ai/dsh-mcp-client` (or delete the row).
No files outside this package are modified, so rollback is just the removal.

## Provenance and license

`lib/index.js` is derived from `@deepseek-ai/dsh-mcp-client` v0.1.5-rc.2
(MIT, Copyright (c) 2026 DeepSeek — see `LICENSE`). The file header lists the exact
modifications: plugin rename, `resyncAfterTools`/`resyncIntervalMs`, sync-completion
reporting, the restore helper, and the runtime catalog skill. The MIT license permits this;
the upstream copyright notice is retained.

## Self-test

`tools/selftest.mjs` drives the real plugin against a live Unity MCP server with a minimal
fake host context — no DSH restart needed. It needs the package dependencies installed
(`pnpm install` inside the package, or run it from a profile that already has them), and it
reads the endpoint from `UNITY_MCP_URL`, so no project token is stored in the repository.

```powershell
$env:UNITY_MCP_URL = 'http://localhost:24009/p/<your-token>'   # your project's own endpoint
node tools/selftest.mjs
```

It asserts, in order: the module exports; `Config` accepts every new field with
upstream-compatible defaults; `apply()` connects and registers both the bridged tool and the
native helper; the catalog skill registers with the right `resourceBase` and a body containing
the workflow; **calling the bridged management tool makes the bridge re-sync on its own** (the
newly enabled tool appears in the registry); and the restore helper disables everything outside
its keep set. Observed output on the reference setup:

```
3) apply() 启动…
   [info] unity-mcp-bridge: catalog skill "unity-mcp-tools" registered
   桥接工具: mcp__unityprobe__tool-set-enabled-state
   原生工具: unity_tools_restore
   技能正文包含工作流与恢复指令: true
4) 通过桥接工具开启 gameobject-find …
   [info] unity-mcp-bridge(unityprobe): tool tool-set-enabled-state returned, re-syncing tool list
   >>> 自动重同步是否生效: 是 ✓
5) 调用恢复工具 keep=[unity-tool-list] …
   返回: Disabled 1 Unity-MCP tool(s); kept enabled: tool-set-enabled-state, unity-tool-list.
   恢复后桥接工具: mcp__unityprobe__tool-set-enabled-state
```

## Status

- **Verified against a live Unity MCP server**: module load, `Config` defaults, `apply()`
  registration (bridged tools + native helper), runtime skill registration with
  `resourceBase`, self-driven re-sync after a management-tool call, and the restore helper's
  disable-everything-except-keep behaviour. See `tools/selftest.mjs`.
- **Not verified here**: installation via `dsh plugin --profile web add` and a full `dsh web`
  boot with the plugin mounted — that needs a profile install and a DSH restart.

