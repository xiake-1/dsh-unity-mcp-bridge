# dsh-unity-mcp-bridge

中文 → [README.zh.md](README.zh.md)

A DeepSeek Harness (DSH) plugin that bridges a Unity MCP server (`com.ivanmurzak.unity.mcp` / AI Game Developer) into DSH. It stays dormant until you ask for Unity.

## Intro

- Dormant from boot: no connection, no Unity tools — two hook tools, ~224 tokens.
- `/unity-mcp-tools` then `unity_mcp_activate` connects and registers `mcp__unity__*`.
- Enabled commands take effect on the **next** step; `unity_tools_restore` disables them and disconnects.
- Ships the command catalog for plugin 1.2.0 (18 commands, RQL-first) and the `/unity-mcp-install` / `/unity-mcp-check` skills.
- `resyncAfterTools`: after a management-tool call the bridge re-fetches `tools/list` itself, because DSH's long-lived session never receives `list_changed`.

## Install

```powershell
dsh plugin --profile <profile> add git+https://github.com/xiake-1/dsh-unity-mcp-bridge.git
```

`<profile>` is `web` (`dsh web`) or `desktop`. Restart the app. The shipped bundle patch inserts the `unity-mcp` row (`http://localhost:20000/mcp`) itself — nothing to write by hand.

Override the row only when this profile uses a different endpoint, in `%DSH_HOME%/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: unity-mcp
  config:
    url: http://localhost:20000/p/<your-token>
```

Uninstall: `dsh plugin --profile <profile> remove dsh-unity-mcp-bridge`

## Usage

| Entry | What it does |
|---|---|
| `/unity-mcp-install` | Installs the Unity-side plugin and the MCP Server into the workspace's Unity project |
| `/unity-mcp-check` | Pins both ends to port 20000, sets the AI agent, initializes the minimal tool set, checks versions |
| `/unity-mcp-tools` | Opens Unity capability: activate → find the command → enable only what the task needs |
| `unity_tools_restore` | Disables everything except the management tool and returns to dormant |

Everything else — configuration fields, the offline `vendor/` package, catalog regeneration, self-test — is in [docs/DETAILS.md](docs/DETAILS.md); measured feature comparison in [FEATURES-AND-COMPARISON.md](FEATURES-AND-COMPARISON.md).
