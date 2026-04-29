# Crypto Coverage Map Plan (Production Proof)

## Objective
Publish a concrete map of where EdwinPAI's crypto/BRC stack is enforced in production flows.

## Required Output
A matrix with columns:
- Surface (endpoint/channel/tool)
- Protection mechanism (BRC-107, signing, key isolation, etc.)
- Enforcement status (Enforced / Partial / Not yet)
- Evidence (code path + test + runtime proof)
- Risk if bypassed

## Scope
1. Gateway endpoints
2. Channel ingress/egress flows
3. Node invoke paths
4. Internal signing/auth flows
5. Any fallback paths that bypass crypto enforcement

## Publication format
- `CRYPTO_COVERAGE_MAP.md` (public-safe)
- `CRYPTO_GAPS_INTERNAL.md` (internal remediation details)

## Acceptance Criteria
- Every claim has code reference + test evidence
- "Not yet covered" explicitly listed (no ambiguity)
- Remediation owner + ETA for each uncovered path
