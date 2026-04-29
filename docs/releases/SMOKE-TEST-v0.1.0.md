# EdwinPAI Desktop v0.1.0 Smoke Test Checklist

## Prerequisites
- [ ] Docker gateway running on port 19789 with `ANTHROPIC_API_KEY` env var
- [ ] Desktop app built from latest main (`38031a6` or later)
- [ ] Clear localStorage for fresh start: `localStorage.removeItem("edwinpai_onboarding_complete")`

## 1. First-Run Onboarding
- [ ] App shows onboarding wizard on fresh start
- [ ] Step 1 (Welcome): "Get Started" button advances
- [ ] Step 2 (API Key): paste key → auto-detects provider → "Validate & Continue"
- [ ] Step 3 (Identity): BSV identity generated with petname + avatar
- [ ] Step 4 (Gateway): auto-detects running gateway OR "Skip" works
- [ ] Step 5 (Test Chat): send test message → receive response
- [ ] Step 6 (Channels): shows channel setup options
- [ ] Step 7 (Done): completes onboarding, shows main app

## 2. Settings
- [ ] Gateway URL field: change to `http://127.0.0.1:19789`
- [ ] Auth Token field: enter `abc123docker`
- [ ] Save → navigate away → navigate back → values persisted
- [ ] **Test Connection** button: shows green checkmark + gateway version
- [ ] Theme selector: light/dark/system all work

## 3. AI Providers
- [ ] Add Anthropic key → appears in list with masked key
- [ ] No duplicate entries for same provider
- [ ] Remove button works
- [ ] Remote gateway notice shows when connected to non-default port

## 4. Chat
- [ ] Send "hello" → assistant response streams in
- [ ] User message appears immediately (optimistic)
- [ ] Streaming indicator shows during response
- [ ] Multiple messages in conversation work
- [ ] Gateway status indicator shows green "Gateway Running" or "Connected (host:port)"

## 5. Error UX
- [ ] Disconnect gateway → "Not connected" banner with "Open Settings" button
- [ ] Remove all providers → send message → "No API key" banner with "Add API Key" button
- [ ] Click "Open Settings" → navigates to settings page

## 6. Access Control
- [ ] Create invitation → QR code dialog appears
- [ ] View QR on existing invitation
- [ ] Revoke invitation → dialog closes, invitation removed
- [ ] Redeem invitation (paste deep link) → user appears in Authorized Users
- [ ] Remove user → user removed from list

## 7. Channel Integrations
- [ ] Matrix shows as configured (from gateway config)
- [ ] Channel wizard cards visible (Telegram, Discord, Slack, WhatsApp, Signal)

## 8. Navigation
- [ ] All sidebar items navigate correctly (Chat, Channels, Users, Access Control, Settings)
- [ ] No blank screens or crashes on rapid navigation
- [ ] Settings persist across navigation

## 9. Build
- [ ] `npm run tauri dev` — no compile errors
- [ ] `npx vitest run` — 58 files, 1048 tests green
- [ ] `npx tsc -b tsconfig.app.json` — no type errors

## Results
| Test | Pass/Fail | Notes |
|------|-----------|-------|
| Onboarding | | |
| Settings | | |
| Providers | | |
| Chat | | |
| Error UX | | |
| Access Control | | |
| Channels | | |
| Navigation | | |
| Build | | |
