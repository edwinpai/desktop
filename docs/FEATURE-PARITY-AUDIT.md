# Feature Parity Audit: EdwinPAI Desktop vs Gateway Config

**Date:** 2026-02-19
**Auditor:** EdwinPAI-Desktop

## Summary

The desktop app exposes **2-4 config fields per channel** in the setup wizard + config editor.
The gateway supports **30-50+ fields per channel**.
Coverage is roughly **5-10%** of available configuration.

---

## Telegram

### Gateway supports (~45 fields):
| Field | Desktop Wizard | Config Editor | Priority |
|-------|:-:|:-:|:-:|
| botToken | ✅ | ✅ | - |
| enabled | ❌ | ❌ | **P0** |
| dmPolicy | ❌ | ✅ | - |
| groupPolicy | ❌ | ✅ | - |
| allowFrom | ❌ | ❌ | **P0** |
| groupAllowFrom | ❌ | ❌ | **P0** |
| historyLimit | ❌ | ❌ | **P0** |
| dmHistoryLimit | ❌ | ❌ | **P0** |
| name | ❌ | ❌ | P1 |
| streamMode | ❌ | ❌ | P1 |
| replyToMode | ❌ | ❌ | P1 |
| reactionNotifications | ❌ | ❌ | P1 |
| reactionLevel | ❌ | ❌ | P1 |
| linkPreview | ❌ | ❌ | P1 |
| textChunkLimit | ❌ | ❌ | P1 |
| chunkMode | ❌ | ❌ | P2 |
| mediaMaxMb | ❌ | ❌ | P1 |
| blockStreaming | ❌ | ❌ | P2 |
| blockStreamingCoalesce | ❌ | ❌ | P2 |
| draftChunk | ❌ | ❌ | P2 |
| actions.reactions | ❌ | ❌ | P1 |
| actions.sendMessage | ❌ | ❌ | P1 |
| actions.deleteMessage | ❌ | ❌ | P1 |
| actions.editMessage | ❌ | ❌ | P1 |
| actions.sticker | ❌ | ❌ | P2 |
| capabilities | ❌ | ❌ | P2 |
| markdown | ❌ | ❌ | P2 |
| commands | ❌ | ❌ | P2 |
| customCommands | ❌ | ❌ | P2 |
| configWrites | ❌ | ❌ | P2 |
| tokenFile | ❌ | ❌ | P2 |
| proxy | ❌ | ❌ | P2 |
| webhookUrl | ❌ | ❌ | P2 |
| webhookSecret | ❌ | ❌ | P2 |
| webhookPath | ❌ | ❌ | P2 |
| timeoutSeconds | ❌ | ❌ | P2 |
| retry | ❌ | ❌ | P2 |
| network | ❌ | ❌ | P2 |
| heartbeat | ❌ | ❌ | P2 |
| dms (per-DM overrides) | ❌ | ❌ | P2 |
| groups (per-group config) | ❌ | ❌ | P1 |

**Desktop coverage: 3/45 fields (7%)**

---

## Discord

### Gateway supports (~50+ fields):
| Field | Desktop Wizard | Config Editor | Priority |
|-------|:-:|:-:|:-:|
| token | ✅ | ✅ (as botToken) | - |
| enabled | ❌ | ❌ | **P0** |
| dm.policy (dmPolicy) | ❌ | ✅ | - |
| groupPolicy | ❌ | ✅ | - |
| dm.enabled | ❌ | ❌ | **P0** |
| dm.allowFrom | ❌ | ❌ | **P0** |
| dm.groupEnabled | ❌ | ❌ | P1 |
| allowBots | ❌ | ❌ | P1 |
| historyLimit | ❌ | ❌ | **P0** |
| dmHistoryLimit | ❌ | ❌ | **P0** |
| name | ❌ | ❌ | P1 |
| textChunkLimit | ❌ | ❌ | P1 |
| chunkMode | ❌ | ❌ | P2 |
| maxLinesPerMessage | ❌ | ❌ | P1 |
| mediaMaxMb | ❌ | ❌ | P1 |
| blockStreaming | ❌ | ❌ | P2 |
| blockStreamingCoalesce | ❌ | ❌ | P2 |
| replyToMode | ❌ | ❌ | P1 |
| actions.reactions | ❌ | ❌ | P1 |
| actions.stickers | ❌ | ❌ | P2 |
| actions.polls | ❌ | ❌ | P2 |
| actions.permissions | ❌ | ❌ | P2 |
| actions.messages | ❌ | ❌ | P1 |
| actions.threads | ❌ | ❌ | P1 |
| actions.pins | ❌ | ❌ | P2 |
| actions.search | ❌ | ❌ | P2 |
| actions.memberInfo | ❌ | ❌ | P2 |
| actions.roleInfo | ❌ | ❌ | P2 |
| actions.roles | ❌ | ❌ | P2 |
| actions.channelInfo | ❌ | ❌ | P2 |
| actions.voiceStatus | ❌ | ❌ | P2 |
| actions.events | ❌ | ❌ | P2 |
| actions.moderation | ❌ | ❌ | P2 |
| actions.emojiUploads | ❌ | ❌ | P2 |
| actions.stickerUploads | ❌ | ❌ | P2 |
| actions.channels | ❌ | ❌ | P2 |
| actions.presence | ❌ | ❌ | P2 |
| guilds (per-guild config) | ❌ | ❌ | P1 |
| intents.presence | ❌ | ❌ | P2 |
| intents.guildMembers | ❌ | ❌ | P2 |
| execApprovals | ❌ | ❌ | P2 |
| pluralkit | ❌ | ❌ | P2 |
| capabilities | ❌ | ❌ | P2 |
| markdown | ❌ | ❌ | P2 |
| commands | ❌ | ❌ | P2 |
| configWrites | ❌ | ❌ | P2 |
| retry | ❌ | ❌ | P2 |
| heartbeat | ❌ | ❌ | P2 |
| dms (per-DM overrides) | ❌ | ❌ | P2 |

**Desktop coverage: 3/50 fields (6%)**

---

## Slack

### Gateway supports (~40+ fields):
| Field | Desktop Wizard | Config Editor | Priority |
|-------|:-:|:-:|:-:|
| botToken | ✅ | ✅ | - |
| appToken | ✅ | ✅ | - |
| enabled | ❌ | ❌ | **P0** |
| dm.policy | ❌ | ✅ | - |
| dm.enabled | ❌ | ❌ | **P0** |
| dm.allowFrom | ❌ | ❌ | **P0** |
| userToken | ❌ | ❌ | P1 |
| userTokenReadOnly | ❌ | ❌ | P2 |
| mode | ❌ | ❌ | P1 |
| signingSecret | ❌ | ❌ | P1 |
| allowBots | ❌ | ❌ | P1 |
| requireMention | ❌ | ❌ | P1 |
| groupPolicy | ❌ | ❌ | **P0** |
| historyLimit | ❌ | ❌ | **P0** |
| dmHistoryLimit | ❌ | ❌ | **P0** |
| textChunkLimit | ❌ | ❌ | P1 |
| chunkMode | ❌ | ❌ | P2 |
| mediaMaxMb | ❌ | ❌ | P1 |
| blockStreaming | ❌ | ❌ | P2 |
| blockStreamingCoalesce | ❌ | ❌ | P2 |
| reactionNotifications | ❌ | ❌ | P1 |
| replyToMode | ❌ | ❌ | P1 |
| replyToModeByChatType | ❌ | ❌ | P2 |
| thread | ❌ | ❌ | P1 |
| slashCommand | ❌ | ❌ | P1 |
| actions.* | ❌ | ❌ | P1 |
| channels (per-channel) | ❌ | ❌ | P1 |
| capabilities | ❌ | ❌ | P2 |
| markdown | ❌ | ❌ | P2 |
| commands | ❌ | ❌ | P2 |
| configWrites | ❌ | ❌ | P2 |
| heartbeat | ❌ | ❌ | P2 |
| dms (per-DM) | ❌ | ❌ | P2 |
| name | ❌ | ❌ | P1 |

**Desktop coverage: 3/40 fields (8%)**

---

## Signal

### Gateway supports (~30+ fields):
| Field | Desktop Wizard | Config Editor | Priority |
|-------|:-:|:-:|:-:|
| enabled | ❌ | ❌ | **P0** |
| account | ❌ | ❌ | **P0** |
| dmPolicy | ❌ | ✅ | - |
| groupPolicy | ❌ | ✅ | - |
| allowFrom | ❌ | ❌ | **P0** |
| groupAllowFrom | ❌ | ❌ | **P0** |
| httpUrl | ❌ | ❌ | P1 |
| httpHost | ❌ | ❌ | P1 |
| httpPort | ❌ | ❌ | P1 |
| cliPath | ❌ | ❌ | P2 |
| autoStart | ❌ | ❌ | P1 |
| startupTimeoutMs | ❌ | ❌ | P2 |
| receiveMode | ❌ | ❌ | P2 |
| ignoreAttachments | ❌ | ❌ | P2 |
| sendReadReceipts | ❌ | ❌ | P1 |
| historyLimit | ❌ | ❌ | **P0** |
| dmHistoryLimit | ❌ | ❌ | **P0** |
| textChunkLimit | ❌ | ❌ | P1 |
| chunkMode | ❌ | ❌ | P2 |
| mediaMaxMb | ❌ | ❌ | P1 |
| blockStreaming | ❌ | ❌ | P2 |
| blockStreamingCoalesce | ❌ | ❌ | P2 |
| reactionNotifications | ❌ | ❌ | P1 |
| reactionLevel | ❌ | ❌ | P1 |
| actions.reactions | ❌ | ❌ | P1 |
| heartbeat | ❌ | ❌ | P2 |
| dms (per-DM) | ❌ | ❌ | P2 |
| name | ❌ | ❌ | P1 |

**Desktop coverage: 2/30 fields (7%)**

---

## WhatsApp

### Gateway supports (~30+ fields):
| Field | Desktop Wizard | Config Editor | Priority |
|-------|:-:|:-:|:-:|
| enabled | ❌ | ❌ | **P0** |
| dmPolicy | ❌ | ✅ | - |
| groupPolicy | ❌ | ✅ | - |
| sendReadReceipts | ❌ | ✅ | - |
| allowFrom | ❌ | ❌ | **P0** |
| groupAllowFrom | ❌ | ❌ | **P0** |
| selfChatMode | ❌ | ❌ | P1 |
| messagePrefix | ❌ | ❌ | P1 |
| historyLimit | ❌ | ❌ | **P0** |
| dmHistoryLimit | ❌ | ❌ | **P0** |
| textChunkLimit | ❌ | ❌ | P1 |
| chunkMode | ❌ | ❌ | P2 |
| mediaMaxMb | ❌ | ❌ | P1 |
| blockStreaming | ❌ | ❌ | P2 |
| blockStreamingCoalesce | ❌ | ❌ | P2 |
| actions.reactions | ❌ | ❌ | P1 |
| actions.sendMessage | ❌ | ❌ | P1 |
| actions.polls | ❌ | ❌ | P2 |
| groups (per-group) | ❌ | ❌ | P1 |
| ackReaction | ❌ | ❌ | P1 |
| debounceMs | ❌ | ❌ | P2 |
| capabilities | ❌ | ❌ | P2 |
| markdown | ❌ | ❌ | P2 |
| configWrites | ❌ | ❌ | P2 |
| heartbeat | ❌ | ❌ | P2 |
| dms (per-DM) | ❌ | ❌ | P2 |
| name | ❌ | ❌ | P1 |

**Desktop coverage: 3/30 fields (10%)**

---

## Matrix (desktop only — no gateway type file found, config comes from extension)

Config editor exposes: homeserver, userId, groupPolicy, autoJoin (4 fields)

---

## P0 (Critical) — Missing Fields Every User Needs

These should be added to both setup wizards AND the config editor:

1. **enabled** (all channels) — toggle channel on/off without removing config
2. **allowFrom** (Telegram, Signal, WhatsApp) — who can DM the bot
3. **groupAllowFrom** (Telegram, Signal, WhatsApp) — who can message in groups
4. **dm.allowFrom** (Discord, Slack) — DM sender allowlist
5. **historyLimit** (all channels) — context window for groups
6. **dmHistoryLimit** (all channels) — context window for DMs

## P1 (Important) — Power User Fields

Should be in the config editor (not necessarily setup wizard):

1. **name** — display name for multi-account setups
2. **streamMode / blockStreaming** — streaming behavior
3. **replyToMode** — reply threading control
4. **reactionNotifications / reactionLevel** — reaction behavior
5. **textChunkLimit / mediaMaxMb** — message size limits
6. **actions.\*** — enable/disable specific bot capabilities
7. **groups/channels** — per-group/channel config (requireMention, tools, skills)
8. **allowBots** (Discord, Slack) — respond to other bots
9. **userToken** (Slack) — enhanced Slack features
10. **selfChatMode** (WhatsApp) — same-phone setup

## P2 (Nice to Have) — Advanced/Rare

Lower priority, maybe behind an "Advanced" toggle:
- proxy, webhook config, network tuning, retry policies
- capabilities, markdown, commands, configWrites
- heartbeat visibility, per-DM overrides
- intents (Discord), pluralkit, execApprovals

---

## Recommendations

1. **Quick win**: Add `enabled` toggle + `allowFrom` + `historyLimit` to all channel config editors (~1 day)
2. **Medium effort**: Add collapsible "Advanced" section with P1 fields (~2-3 days)
3. **Setup wizards**: After credentials, add optional "Configure access" step with dmPolicy + allowFrom + groupPolicy (~1 day)
4. **Per-group/channel config**: Needs a sub-editor UI component (~1 week)
