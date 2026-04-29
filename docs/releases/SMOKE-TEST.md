# EdwinPAI Desktop v0.1.1 — Smoke Test Checklist

## Prerequisites
- EdwinPAI Desktop built and running (`cargo tauri dev` or release binary)
- EdwinPAI gateway installed (`npm install -g edwinpai` or bundled)
- At least one AI provider API key (Anthropic recommended)

## 1. Fresh Launch
- [ ] App opens to onboarding wizard (or chat if previously configured)
- [ ] Welcome step shows EdwinPAI branding

## 2. Gateway Discovery
- [ ] Scan finds running local gateway (if running)
- [ ] "No gateways found" shows if none running
- [ ] Runtime status shows Node.js + EdwinPAI binary detection
- [ ] "Start Local Gateway" works (if runtime available)
- [ ] Manual URL entry works for remote gateways
- [ ] Auth token field accepts and saves token

## 3. Provider Configuration
- [ ] Navigate to Settings → AI Providers
- [ ] Target label shows: "Configuring providers on: <host:port>"
- [ ] Add Anthropic API key → success message includes target
- [ ] Provider appears in list with "gateway" badge
- [ ] Refresh button reloads from gateway config
- [ ] For remote gateway: no local auth-profiles.json written

## 4. Agent Configuration
- [ ] Settings → Agent Configuration card visible
- [ ] Primary model dropdown works (select a model)
- [ ] Fallback models input accepts comma-separated values
- [ ] Memory search toggle works
- [ ] "Apply to Gateway" saves and shows success

## 5. Chat
- [ ] Navigate to Chat
- [ ] Empty state shows ⚡ EdwinPAI branding + hint chips
- [ ] Click hint chip → fills input
- [ ] Send message → streaming response appears
- [ ] Response completes (final state)
- [ ] Copy button works on assistant messages

## 6. Memory Citations
- [ ] Ask something the agent would recall from workspace files
- [ ] If memory search is enabled + verbose mode on:
  - [ ] 📚 sources badge appears on assistant message
  - [ ] Clicking expands to show file paths, scores, snippets

## 7. Channel Status
- [ ] Navigate to Channels
- [ ] Configured channels show with status badges (Connected/Offline)
- [ ] Status updates on 30-second polling cycle

## 8. Channel Setup (Matrix)
- [ ] Click "Add Channel" → Matrix
- [ ] Enter homeserver URL, user ID, access token
- [ ] Wizard saves via config.patch (check gateway config updated)
- [ ] Verification banner: ✅ Connected or ⚠️ Failed
- [ ] Channel appears in list with Connected status

## 9. Channel Setup (Telegram)
- [ ] Click "Add Channel" → Telegram
- [ ] Enter bot token (format: BOT_ID:AUTH_TOKEN)
- [ ] Wizard saves via config.patch
- [ ] Verification banner shows connection result

## 10. Gateway Config
- [ ] Settings → Gateway Configuration
- [ ] Port field accepts valid port (1024-65535)
- [ ] Bind mode dropdown (loopback/lan/tailnet)
- [ ] Auth token field
- [ ] Start/Stop/Restart buttons work

## 11. Connection Recovery
- [ ] Stop gateway → Chat shows "Not connected" banner
- [ ] "Open Settings" button in banner works
- [ ] Restart gateway → Chat auto-reconnects
- [ ] Test Connection button in Settings shows success

## 12. Access Control
- [ ] Navigate to Access Control
- [ ] Create invitation → QR code dialog appears
- [ ] View QR button on existing invitation works
- [ ] Redeem invitation (paste deep link) → user appears in list

## 13. Runtime Status
- [ ] Settings → Runtime Status card shows Node.js + EdwinPAI versions
- [ ] Ready/Not Ready badge accurate

---

## Known Issues / Limitations (v0.1.1)
- WhatsApp channel requires gateway-side QR pairing (v0.2)
- Channel wizards for Discord/Slack/Signal still use old IPC path
- Memory citations only visible when gateway verbose mode is on
- Runtime bundle auto-installer not yet implemented (manual Node.js + npm required)
- No 2FA gate on app launch yet
- No device sub-key signing on channels yet
