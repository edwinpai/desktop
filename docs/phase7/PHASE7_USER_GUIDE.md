# EdwinPAI Desktop v1.0.0 - User Guide

**Welcome to EdwinPAI Desktop!** 🎉

EdwinPAI Desktop is your personal AI gateway, providing secure local access to AI models with blockchain-based identity and subscription management.

---

## Table of Contents

1. [Installation](#installation)
2. [First Launch](#first-launch)
3. [Gateway Mode vs Client Mode](#gateway-mode-vs-client-mode)
4. [Chat Interface](#chat-interface)
5. [Channel Configuration](#channel-configuration)
6. [Settings](#settings)
7. [Troubleshooting](#troubleshooting)

---

## Installation

### Linux

```bash
# Debian/Ubuntu (.deb)
sudo dpkg -i edwinpai-desktop_1.0.0_amd64.deb

# AppImage (universal)
chmod +x edwinpai-desktop_1.0.0_x86_64.AppImage
./edwinpai-desktop_1.0.0_x86_64.AppImage
```

### macOS

1. Download `edwinpai-desktop_1.0.0_x64.dmg`
2. Open DMG file
3. Drag EdwinPAI Desktop to Applications folder
4. Right-click → Open (first launch only, bypasses Gatekeeper)

### Windows

1. Download `edwinpai-desktop_1.0.0_x64-setup.msi`
2. Double-click to run installer
3. Follow installation wizard
4. Launch from Start Menu

---

## First Launch

### 1. Identity Setup

On first launch, EdwinPAI Desktop will generate your BSV identity:

- **Petname**: Human-readable identifier (e.g., `crimson-thunder-92`)
- **Identicon**: Unique visual representation of your public key
- **Public Key**: Used for BRC-103 authentication

**Note**: Your private key is stored securely in the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).

### 2. Choose Mode

EdwinPAI Desktop operates in two modes:

- **Gateway Mode**: Run a local AI gateway (requires subscription)
- **Client Mode**: Connect to another gateway on your LAN

**First-time users**: Start with Gateway Mode to explore all features.

---

## Gateway Mode vs Client Mode

### Gateway Mode

**Purpose**: Run a local AI gateway that forwards requests to AI providers (OpenAI, Anthropic, etc.).

**Requirements**:
- Active BSV blockchain subscription
- Gateway binary (bundled with EdwinPAI Desktop)
- Port 3000 available (configurable)

**Features**:
- Full access to all AI models
- Invite others to connect (multi-user support)
- Channel configuration for external platforms
- System tray integration

**Use Case**: Primary device, home server, or shared team gateway

### Client Mode

**Purpose**: Connect to a gateway running on your LAN.

**Requirements**:
- Gateway invitation token (64-char hex)
- LAN network access to gateway

**Features**:
- Chat interface (read-only access)
- No subscription required
- Auto-discovery via mDNS

**Use Case**: Secondary devices, team members, guests

---

## Chat Interface

### Sending Messages

1. Type your message in the input field at the bottom
2. Press **Enter** or click **Send**
3. Wait for streaming response (typing indicator shows progress)

### Tool Use

When the AI uses tools, you'll see collapsible **Tool Use Cards**:

- **Tool Name**: Function called by the AI (e.g., `get_weather`)
- **Tool ID**: Unique identifier (e.g., `toolu_abc123`)
- **Input**: JSON parameters passed to the tool

**Example**:

```json
{
  "location": "San Francisco",
  "unit": "celsius"
}
```

Click the card to expand/collapse details.

### Markdown Rendering

EdwinPAI Desktop supports **GitHub-Flavored Markdown**:

- **Bold**: `**text**`
- **Italic**: `*text*`
- **Code**: `` `code` ``
- **Code blocks**: ` ```language\ncode\n``` `
- **Links**: `[text](url)`
- **Tables**: `| Header | Header |\n| --- | --- |\n| Cell | Cell |`
- **Task lists**: `- [ ] Todo item`

### Keyboard Shortcuts

- **Ctrl/Cmd + L**: Clear messages
- **Ctrl/Cmd + R**: Retry last message
- **Esc**: Cancel streaming response

---

## Channel Configuration

**Channels** allow EdwinPAI Gateway to interface with external platforms (WhatsApp, Telegram, Matrix, Discord, Slack, Signal).

### Adding a Channel

1. Go to **Settings → Channels**
2. Click **Add Channel**
3. Select platform (e.g., WhatsApp, Telegram)
4. Follow platform-specific wizard:
   - **WhatsApp**: Scan QR code with WhatsApp mobile
   - **Telegram**: Provide bot token from @BotFather
   - **Matrix**: Enter homeserver URL + access token
   - **Discord**: Provide bot token from Discord Developer Portal
   - **Slack**: Complete OAuth flow
   - **Signal**: Link device with phone number

### Managing Channels

- **Enable/Disable**: Toggle channel on/off
- **Edit**: Update credentials (re-runs wizard)
- **Delete**: Remove channel (credentials encrypted with BRC-42)

**Note**: Channel credentials are stored encrypted using BRC-42 key derivation. Each channel uses a separate encryption key.

---

## Settings

### General Settings

- **Gateway Port**: Port number for gateway server (default: 3000)
- **Auto-start**: Launch gateway on app startup
- **Minimize to Tray**: Hide window instead of closing
- **Dark Mode**: Toggle theme (auto-detects system preference)

### Identity Settings

- **Petname**: View your generated petname
- **Public Key**: Copy your public key (for sharing)
- **Identicon**: Visual representation of your identity

### Subscription Settings

- **Status**: Active / Cached / Expired / Grace Exceeded / Not Found
- **Expiry Date**: When your subscription expires
- **Renew**: Opens BSV blockchain payment flow

**Subscription States**:

| State | Description |
|-------|-------------|
| **Active** | Valid subscription, full access |
| **Cached** | Recent subscription, grace period (24 hours) |
| **Expired** | Subscription expired, gateway blocked |
| **Grace Exceeded** | Grace period expired, gateway blocked |
| **Not Found** | No subscription found, gateway blocked |

### Access Control (Gateway Mode Only)

- **Owner**: Full access (you)
- **Member**: Can chat, configure channels
- **Guest**: Read-only chat access

**Invitations**:

1. Click **Create Invitation**
2. Select permission level (Member / Guest)
3. Share QR code or 64-char hex token
4. Token is valid for 24 hours
5. Revoke invitation at any time

---

## Troubleshooting

### Gateway won't start

**Symptoms**: Gateway status shows "Stopped" or "Error"

**Solutions**:

1. Check subscription status (Settings → Subscription)
2. Verify port 3000 is available: `lsof -i :3000` (Linux/macOS) or `netstat -an | findstr 3000` (Windows)
3. Check gateway logs: `~/.config/edwinpai-desktop/logs/gateway.log`
4. Restart gateway: Settings → Gateway → Restart

### Client mode can't discover gateway

**Symptoms**: LAN scan shows no gateways

**Solutions**:

1. Verify both devices are on same LAN (subnet)
2. Check firewall allows mDNS (port 5353 UDP)
3. Manually enter gateway IP: Settings → Client Mode → Manual Connect
4. Check gateway is advertising: `avahi-browse -a` (Linux) or `dns-sd -B _edwinpai._tcp` (macOS)

### Chat messages not streaming

**Symptoms**: Messages appear all at once instead of streaming

**Solutions**:

1. Check browser console for errors (Ctrl+Shift+I)
2. Verify gateway `/health` endpoint: `curl http://localhost:3000/health`
3. Disable browser extensions (may block SSE)
4. Update EdwinPAI Desktop to latest version

### Tool use cards not expanding

**Symptoms**: Click doesn't expand card

**Solutions**:

1. Check browser console for React errors
2. Clear localStorage: Settings → Advanced → Clear Cache
3. Restart EdwinPAI Desktop

### Subscription check fails

**Symptoms**: Error: "Failed to check subscription"

**Solutions**:

1. Verify internet connection (BSV blockchain queries)
2. Check public key is correct: Settings → Identity → Public Key
3. Wait 60 seconds (rate limiting) and retry
4. Check BSV blockchain status: https://whatsonchain.com

### Dark mode not working

**Symptoms**: Theme doesn't match system preference

**Solutions**:

1. Manually toggle: Settings → General → Dark Mode
2. Clear localStorage: Settings → Advanced → Clear Cache
3. Check system theme preference (OS settings)

---

## Advanced Topics

### Custom Gateway Port

**Default**: 3000
**Change**: Settings → General → Gateway Port

**Important**: Update client devices after changing port.

### Multi-User Scenarios

**Home Network**:

- 1 gateway (desktop) + 3 clients (laptop, tablet, phone)
- Owner: Full access (desktop)
- Members: Chat + channels (laptop)
- Guests: Read-only (tablet, phone)

**Team**:

- 1 gateway (server) + 10 clients (team members)
- Owner: Admin (server)
- Members: All team members
- Guests: External contractors

### Backup & Restore

**Backup** (Gateway Mode):

1. Export config: Settings → Advanced → Export Config
2. Includes: identity, channels, subscriptions
3. **Does NOT include**: private key (stored in system keychain)

**Restore** (Gateway Mode):

1. Import config: Settings → Advanced → Import Config
2. Private key must be restored separately (system-specific)

**Client Mode**: No backup needed (config stored on gateway)

---

## Getting Help

- **GitHub Issues**: https://github.com/yourusername/edwinpai-ux/issues
- **Documentation**: https://edwinpai-desktop.dev/docs
- **Community**: https://discord.gg/edwinpai-desktop

---

## Appendix: Technical Specifications

### Supported Platforms

- **Linux**: Ubuntu 20.04+, Debian 11+, Arch, Fedora 36+
- **macOS**: 11.0 (Big Sur) or later (Intel + Apple Silicon)
- **Windows**: 10 (1809+) or Windows 11

### System Requirements

- **RAM**: 512 MB minimum, 2 GB recommended
- **Disk**: 100 MB for app, 500 MB for logs/cache
- **Network**: LAN access for client mode, internet for gateway mode

### Security

- **Private Key Storage**: System keychain (AES-256 encrypted)
- **Channel Credentials**: BRC-42 key derivation (secp256k1)
- **Authentication**: BRC-103 challenge-response handshake
- **TLS**: Optional (use reverse proxy for HTTPS)

### Compliance

- **BRC-42**: Key derivation and encryption ✅
- **BRC-103**: Authentication handshake ✅
- **RFC 6979**: Deterministic ECDSA signatures ✅

---

**EdwinPAI Desktop v1.0.0** - Built with Tauri v2, React 19, and TypeScript
**License**: MIT
**Copyright**: 2026 EdwinPAI Desktop Contributors
