# EdwinPAI Desktop Release Notes

## v0.1.0-beta.1 (Draft)

Release date: 2026-04-03

## Summary

Initial beta release of EdwinPAI Desktop: a native desktop interface for connecting to the EdwinPAI Gateway and managing conversations, memory workflows, and assistant operations.

## Highlights

- Tauri v2 + React 19 + TypeScript desktop client
- Gateway connectivity and session-driven chat UX
- Onboarding and channel setup surfaces
- Cryptographically signed envelope integration with EdwinPAI identity flow
- Foundation for memory/task-oriented assistant workflows

## Security Notes

- Desktop participates in EdwinPAI’s signed-envelope identity model.
- Security posture still depends on gateway configuration and operator deployment choices.
- Recommended with each release:
  - validate desktop ↔ gateway auth flow
  - verify secure defaults and permission prompts

## Quality Notes (Current)

- Type/test debt may exist in current branch state.
- For strict production release gates, require green typecheck/tests before final tag.

## Build & Run

```bash
npm install
npm run tauri dev
npm run tauri build
```

## Known Limitations (Beta)

- Some tests/type checks may fail in active development branches.
- Platform-specific permission and signing behavior can vary by environment.

## Open Source Boundary (Recommended)

Public:
- App architecture, UI flows, onboarding patterns
- Non-sensitive integration examples

Private / managed:
- Sensitive security heuristics and anti-abuse internals
- Operational hardening details that meaningfully reduce attacker cost
- Secrets, private signing/enforcement details

---

If used for formal releases, replace placeholder version/date and append future entries in reverse chronological order.
