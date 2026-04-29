# Stability Sprint Plan (Pre-Aggressive Security Marketing)

## Objective
Stabilize critical reliability paths before strong external safety/usability claims.

## Priority Defect Classes
1. Gateway lifecycle conflicts (double process, restart behavior)
2. Auth/model fallback failures (revoked tokens, invalid fallback configs)
3. Matrix media ingestion regressions
4. Context overflow handling in long sessions

## Sprint Structure (2 weeks)
### Week 1
- Repro matrix for each defect class
- Add regression tests for known failures
- Patch + verify on dev/staging

### Week 2
- Harden observability + alerting
- Run soak tests (24h/72h)
- Publish stability changelog + known issues

## Exit Criteria
- Zero P0 regressions in target defect classes
- Pass regression suite on release candidate
- Clear rollback and incident playbook ready
