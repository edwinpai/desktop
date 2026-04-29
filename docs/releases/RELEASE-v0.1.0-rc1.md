# EdwinPAI Desktop v0.1.0-rc1 Release Notes

## Overview
First release candidate for EdwinPAI Desktop — a native macOS/Linux desktop app for EdwinPAI AI gateway.

## Features

### Chat
- WebSocket-based real-time chat with streaming responses
- Session key: `main` (gateway primary session)
- Client mode: `ui` with `edwinpai-macos` client ID
- React strict mode safe (no connection race conditions)

### Settings
- **Gateway URL**: configurable, persists across navigation and restart
- **Auth Token**: password field, reads from desktop config or shared `~/.edwinpai/edwinpai.json`
- **Theme**: light/dark/system
- **AI Providers**: add/remove Anthropic, OpenAI, Google, OpenRouter API keys
- **Connection Test**: HTTP probe + WebSocket handshake test with version display
- Immediate save (no debounce delay)

### Onboarding
- 7-step wizard: Welcome → API Key → Identity → Gateway → Test Chat → Channels → Done
- API key step auto-detects provider from key prefix
- Gateway step auto-detects running gateway, skip option for external gateways
- No CLI required for first-run setup

### Access Control
- Create invitations with QR code (SVG) and deep links (`edwinpai://invite/...`)
- Redeem invitations (paste deep link or raw token)
- View/revoke invitations
- Authorized users list with Remove capability

### Error UX
- "Not connected to gateway" banner with **Open Settings** button
- "No API key configured" banner with **Add API Key** button
- Gateway status indicator probes configured URL (not just default port)
- Shows "Connected (host:port)" for non-default gateways
- Treats 401/403 as "gateway running" (auth required ≠ down)

### Channel Integrations
- Matrix, Telegram, Discord, Slack, WhatsApp, Signal wizards
- Read channel config from gateway in gateway mode

## Bug Fixes
- WebSocket origin check: use `mode: 'ui'` instead of `webchat` (Tauri origin)
- React strict mode: close handler only nulls ref for active connection
- Session key: `"main"` not `"agent:main:desktop"`
- Settings persistence: explicit Tauri v2 fs write permissions for AppData
- Provider dedup: removes existing entries for same provider on add
- Mode select card: always clickable (not disabled when already selected)
- Token re-read: config read on every WS connect, not cached

## Technical
- **Framework**: Tauri v2 + React 19 + shadcn/ui + Tailwind v4
- **Tests**: 58 files, 1048 passing, 26 skipped
- **Build**: Linux + macOS verified
- **Config**: Two-file system — `desktop-config.json` (Tauri AppData) + `~/.edwinpai/edwinpai.json` (shared)

## Known Limitations
- Provider keys are saved locally; remote/Docker gateways need env var or mounted volume
- Client mode (mDNS discovery, deep link handler, BRC-103) is stubbed
- DMG packaging needs cosmetic polish (`.app` works fine)
- Dual WebSocket connections in dev mode (React strict mode, harmless)

## Commit Chain (17 commits)
```
8c2f25b  settings persistence (fs write permission)
91bc51a  settings save immediate
15f0a25  auth token field
d24369d  mode select clickable
27e6b78  token re-read on reconnect
f76bc18  AI provider management
b75e546  onboarding wired to add_provider
cc4a33e  chat error UX banners
7f955ce  gitignore tsbuildinfo
ac464b2  provider dedup + remote notice
c82a3df  gateway probe 401 fix
161aead  session key = "main"
a1894e5  WS race fix (strict mode)
254a605  mode: 'ui' (chat working)
539984c  debug cleanup
ed770a4  connection test button
38031a6  onboarding gateway auto-detect
```
