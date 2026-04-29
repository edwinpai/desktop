# GUI Parity Audit: Desktop GUI vs CLI/Config

**Goal:** The GUI should completely replace terminal/config-file editing for non-dev users.

**Date:** 2026-02-20

## Current Coverage

### Settings Page (GeneralSettings.tsx)
| Config Area | GUI Coverage | Notes |
|---|---|---|
| Theme (light/dark/system) | ✅ Full | |
| Gateway URL + Token | ✅ Full | Test Connection button |
| Gateway port/bind/mode | ⚠️ Partial | GatewayConfigCard reads from gateway |
| AI Providers (API keys) | ✅ Full | ProviderSettings writes via config.patch |
| Agent: primary model | ✅ Full | AgentConfigCard |
| Agent: fallback models | ✅ Full | AgentConfigCard |
| Agent: memory search toggle | ✅ Full | AgentConfigCard |
| Agent: memory provider | ✅ Full | AgentConfigCard |
| Web search: enabled + API key | ✅ Full | WebToolsCard |
| Web fetch: enabled | ✅ Full | WebToolsCard |
| App Lock (passcode) | ✅ Full | AppLockSettings |
| Runtime status (Node/EdwinPAI) | ✅ Full | RuntimeStatus |

### Channels Page
| Config Area | GUI Coverage | Notes |
|---|---|---|
| Add/remove channels | ✅ Full | Wizards for all 6 platforms |
| Enable/disable toggle | ✅ Full | Channel cards |
| Live connection status | ✅ Full | channels.status API |
| Credentials (token, etc.) | ✅ Full | Config editor |
| DM/Group policy | ✅ Full | Config editor |
| Allow lists | ✅ Full | Config editor |
| History limits | ✅ Full | Config editor |
| Stream/reply mode | ✅ Full | Config editor |
| Text/media limits | ✅ Full | Config editor |
| Reaction settings | ✅ Full | Config editor (NEW) |
| Action toggles | ✅ Full | Config editor (NEW) |
| **Per-group overrides** | ❌ Missing | e.g. `channels.matrix.groups.{id}.allow` |
| **Per-DM overrides** | ❌ Missing | e.g. `channels.telegram.dms.{id}` |

### Access Control Page
| Config Area | GUI Coverage | Notes |
|---|---|---|
| BSV auth settings | ❌ Missing | `gateway.bsvAuth.*` |
| Security settings | ❌ Missing | `security.requireSignedRequests`, `authorizedKeys` |
| Invitation codes | ✅ Full | |
| User management | ✅ Full | |

### NOT in GUI at all
| Config Area | Priority | Notes |
|---|---|---|
| **TTS settings** | P0 | `messages.tts.auto`, `tts.provider`, `tts.edge.voice` — users need to enable/configure voice |
| **Heartbeat config** | P1 | `agents.defaults.heartbeat` — interval, enabled |
| **Compaction settings** | P1 | `agents.defaults.compaction.mode`, `autoThreshold` |
| **Max concurrent agents** | P1 | `agents.defaults.maxConcurrent`, `subagents.maxConcurrent` |
| **Workspace path** | P1 | `agents.defaults.workspace` |
| **Plugin config** | P1 | `plugins.entries.shad-context.config.*` (autoCapture, autoRecall, maxChars, vaultPaths) |
| **Commands config** | P2 | `commands.native`, `commands.nativeSkills` |
| **Gateway BSV auth** | P1 | `gateway.bsvAuth.enabled`, `ownerPublicKey`, etc. |
| **Gateway Tailscale** | P2 | `gateway.tailscale.mode`, `resetOnExit` |
| **Gateway HTTP endpoints** | P2 | `gateway.http.endpoints.chatCompletions.enabled` |
| **Ack reaction scope** | P2 | `messages.ackReactionScope` |
| **Per-group channel config** | P1 | `channels.*.groups.{id}.*` — allow, autoReply, tools, skills |
| **Cron jobs** | P1 | View/create/edit/delete cron jobs (reminders, scheduled tasks) |
| **Session management** | P2 | View active sessions, kill sessions |
| **Logs viewer** | P1 | View gateway logs without terminal |

## Priority Action Plan

### P0 — Must have for non-dev users
1. **TTS Settings card** — enable/disable auto-TTS, choose voice, preview
2. **Per-group channel config** — sub-editor for room/group overrides (allow, autoReply, tools)

### P1 — Important for self-service
3. **Agent tuning card** — compaction, max concurrent, workspace, heartbeat interval
4. **Plugin config card** — Shad context settings (autoCapture, autoRecall, vault paths)
5. **Security settings card** — BSV auth toggle, owner key display, authorized keys
6. **Logs viewer** — scrollable log output from gateway
7. **Cron job manager** — list, create, edit, delete scheduled tasks

### P2 — Power user / rare
8. Gateway Tailscale, HTTP endpoints, ack reaction scope
9. Commands config, session management
