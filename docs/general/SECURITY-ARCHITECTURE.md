# EdwinPAI Security Architecture — Three-Layer Model

> Discussed 2026-02-15 between Jake, EdwinPAI Desktop, and EdwinPAI Macbook agents.
> This is the agreed security foundation for EdwinPAI.

## Overview

EdwinPAI's security model has three distinct layers, each protecting a different attack surface. The core principle: **the AI model never has access to signing keys or authorization capabilities**.

## Layer 1: Desktop App Access (Physical Boundary)

**Problem:** Attacker with physical/remote access to the machine could use the desktop app.

**Solution:** Gate access to the EdwinPAI Desktop app itself with a second factor:
- **YubiKey** (FIDO2/WebAuthn) — physical presence required
- **TOTP** (Google Authenticator) — time-based one-time password
- **Biometrics** — fingerprint, Face ID (on supported platforms)

**Flow:**
1. User opens EdwinPAI Desktop
2. 2FA challenge presented (YubiKey touch, TOTP code, biometric)
3. On success: BSV private key in OS keychain is unlocked
4. Every gateway control request is signed with BSV key + time-based envelope

**Key storage:** BSV private key lives in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service), never in plaintext config files. YubiKey could optionally *store* the BSV key itself (hardware-backed).

## Layer 2: Messaging Channel Security (Device Sub-Identities)

**Problem:** Messages arrive from external platforms (WhatsApp, Telegram, Matrix). How to verify they're from authorized devices, not spoofed?

**Solution:** Each device gets a BSV sub-identity derived from the owner's master key.

**Architecture:**
- **Owner master key** → signs sub-key certificates for each device
- **Device sub-key** → generated on the device (phone, tablet, second computer)
- **Message envelope** → every message carries: `{from: device-sub-pubkey, iat, exp, nonce, scope, payload, sig}`
- **Gateway verification** → checks: valid signature + sub-key chains to owner + within time window

**Invitation flow (already partially built):**
1. Owner creates invitation in EdwinPAI Desktop → generates invite token
2. Device redeems invitation → generates its own BSV keypair
3. Owner's master key signs the device's public key (certificate)
4. All subsequent messages from that device are signed with its sub-key
5. Gateway verifies signature chain: message sig → device sub-key → owner master cert

**Trust chain:** `Owner Master Key → Device Sub-Keys → Time-Bound Signed Messages`

## Layer 3: Model Sandbox (Prompt Injection Defense)

**Problem:** AI model could be tricked via prompt injection into executing dangerous actions.

**Solution:** The model runs in a sandboxed environment with **no access to signing keys, authorization tokens, or direct gateway control**.

**How it works:**
- Model generates text/tool calls but cannot authorize them
- All privileged actions require cryptographic signature from Layer 1 or Layer 2
- Even if prompt injection succeeds, the model can only *request* an action — it can't *sign* it
- Gateway rejects any unsigned or improperly signed control requests

**Pitch:** *"Your AI can't be tricked into betraying you because it doesn't have the keys to."*

## BSV Time-Based Token Format

EdwinPAI uses BSV (Bitcoin SV) for all cryptographic operations, NOT switching to other signing schemes.

**Token envelope:**
```json
{
  "kid": "<owner-pubkey-fingerprint>",
  "alg": "BSV/BRC-42",
  "iat": 1708000000,
  "exp": 1708000060,
  "nonce": "<random-32-bytes>",
  "scope": "chat.send",
  "target": "<gateway-id>",
  "payload": "<action-hash>",
  "sig": "<detached-BSV-signature>"
}
```

**Properties:**
- **Time-bound:** `iat` (issued at) + `exp` (expiry) — short-lived (30-60s)
- **Replay-proof:** `nonce` prevents replay attacks
- **Scoped:** `scope` limits what the token can authorize
- **Targeted:** `target` binds to a specific gateway instance
- **Verifiable:** Gateway checks signature against known owner/device public keys

## Attack Scenarios

| Scenario | Protection |
|---|---|
| Stolen laptop | Layer 1: 2FA required to unlock app/keys |
| Compromised host (malware) | Layer 1: YubiKey requires physical touch |
| Spoofed WhatsApp message | Layer 2: No valid device sub-key signature |
| Prompt injection | Layer 3: Model can't sign, gateway rejects unsigned |
| Replay attack | Time-bound tokens with nonce |
| Man-in-the-middle | Signatures are non-repudiable, tampering detectable |
| Rogue EdwinPAI instance | Sub-key certificates pin to specific owner master key |

## Implementation Status

| Component | Status | Notes |
|---|---|---|
| BSV auth (gateway side) | ✅ Deployed | bsvAuth verifier on all 3 instances |
| Owner keypair generation | ✅ Done | Owner generated key, pubkey in config |
| Desktop keychain storage | ✅ Done | `com.edwinpai.desktop` / `main-identity` |
| Invitation system | ✅ Done | Create, QR, redeem, revoke |
| Device sub-identities | ❌ v0.2 | Devices don't sign messages yet |
| 2FA gate (YubiKey/TOTP) | ❌ v0.2 | App access is currently open |
| Per-action signed intents | ❌ v0.2 | Control actions use static tokens |
| Message signing (channels) | ❌ v0.2 | WhatsApp/Matrix messages unsigned |
| Policy gates | ❌ v0.2 | No risk-level differentiation yet |

## Key Decisions

- **BSV stays as the signing mechanism** — not switching to YubiKey for signing, but YubiKey can gate access to BSV keys
- **External wallet interface** (BRC-100) — EdwinPAI is not a wallet, integrates with external BRC-100 wallet
- **Local keychain adapter** as temporary implementation — API-compatible for future wallet swap
- **Each messaging device gets its own BSV sub-identity** derived from owner's master key
- **Model sandbox is non-negotiable** — AI never touches keys or raw secrets

## References

- EdwinPAI SPEC.md / PLAN.md (in repo)
- BRC-42: Key derivation
- BRC-100: Wallet interface standard
- BSV SDK: `publicKey.toString()` (not `toHex()`)
