# EdwinPAI Desktop

Cross-platform desktop application for the [EdwinPAI](https://edwinpai.com) AI assistant, built with Tauri v2, React 19, TypeScript, and shadcn/ui.

EdwinPAI Desktop connects to the EdwinPAI Gateway and provides a native desktop interface for managing your personal AI — conversations, memories, tasks, and automation across all your channels.

## Release notes

- See [RELEASE_NOTES.md](./RELEASE_NOTES.md) for release highlights, quality notes, and known limitations.

## Security

EdwinPAI Desktop participates in EdwinPAI's cryptographic security stack, built on BSV token standards:

- **BRC-92** (Mandala Token Protocol) — base token layer for data tokenization
- **BRC-107** (Enhanced Mandala) — cryptographic commitment chains for tamper-proof, SPV-verifiable tokens
- **BRC-108** (Identity-Linked Tokens) — identity certificates with selective field revelation
- **BRC-115** (Deterministic Verification Framework) — wallet verification without overlay networks

The desktop app authenticates via the **signed envelope** system — every message between client and gateway is cryptographically signed and verified against desktop identity certificates. This means security is enforced by math, not by trusting the AI model to behave correctly.

All conversations and data generated through EdwinPAI Desktop are tokenized on BSV with provable, timestamped ownership — you cryptographically own everything your AI creates.

Specs: [BRC-92](https://bsv.brc.dev/tokens/0092) · [BRC-107](https://bsv.brc.dev/tokens/0107) · [BRC-108](https://bsv.brc.dev/tokens/0108) · [BRC-115](https://bsv.brc.dev/tokens/0115)

## Knowledge documentation

Knowledge in Edwin Desktop is documented here:

- [User guide](./docs/knowledge/KNOWLEDGE_USER_GUIDE.md)
- [Technical reference](./docs/knowledge/KNOWLEDGE_TECHNICAL_REFERENCE.md)
- [Discipline architecture design](./docs/discipline-architecture-design.md)

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

See [PLAN.md](../PLAN.md) and [SPEC.md](../SPEC.md) for full project documentation.
