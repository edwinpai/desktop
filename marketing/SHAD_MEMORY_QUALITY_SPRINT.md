# Shad Memory Quality Sprint (1 Week)

## Objective
Close the quality gap vs provider-native memory while preserving Shad advantages (control, portability, cost efficiency).

## Success Criteria (hard gates)
- **Quality:** +20% improvement in recall precision@5 on test set
- **Context efficiency:** -30% average injected context chars per turn
- **Latency:** p95 memory retrieval+injection under 1200ms
- **Continuity:** +25% improvement on multi-session continuity rubric

---

## Day 1 — Baseline & Eval Harness
1. Freeze current config and commit hash
2. Build eval corpus:
   - preferences
   - decisions
   - long-tail details
   - stale/outdated facts
3. Define scoring:
   - precision@k
   - continuity score
   - token/char overhead
   - latency p50/p95
4. Run baseline and store raw results

Deliverables:
- `memory-evals/baseline-results.json`
- `memory-evals/corpus.md`

---

## Day 2 — Capture Policy Tuning
Focus: reduce junk memories.

Actions:
- tighten auto-capture filters
- add category confidence threshold
- dedupe near-duplicates more aggressively
- add freshness metadata and confidence tags

Expected outcome:
- fewer low-value captures
- cleaner retrieval set

---

## Day 3 — Retrieval Quality Tuning
Focus: improve relevant recall.

Actions:
- compare `bm25` vs `vector` vs hybrid by query class
- add rerank stage for top-N candidates
- boost recent + high-importance entries
- penalize stale/conflicting entries

Expected outcome:
- higher precision@5
- fewer irrelevant injections

---

## Day 4 — Context Compression
Focus: keep quality while shrinking tokens.

Actions:
- compress memory injection format
- cap per-memory snippet length
- merge semantically redundant memories
- prioritize actionable facts over narrative logs

Expected outcome:
- lower context footprint
- fewer overflow events

---

## Day 5 — Continuity Stress Tests
Focus: cross-session continuity under real workload.

Scenarios:
- restart/reconnect continuity
- long conversation compaction
- multi-channel continuity
- contradiction updates (old vs new preferences)

Expected outcome:
- continuity gains without drift/hallucinated memory

---

## Day 6 — Regression + Failure Testing
Test against known failure modes:
- empty index paths
- slow retrieval backend
- stale cache
- malformed captures

Pass criteria:
- graceful degradation
- no catastrophic context injection

---

## Day 7 — Report + Rollout
Publish:
1. `SHAD_MEMORY_RESULTS_V1.md`
2. before/after metric table
3. recommended default config
4. rollback plan

Rollout policy:
- canary to one environment
- monitor 24h
- full rollout if no P0/P1 regressions

---

## Required Artifacts
- `memory-evals/corpus.md`
- `memory-evals/rubric.md`
- `memory-evals/baseline-results.json`
- `memory-evals/final-results.json`
- `SHAD_MEMORY_RESULTS_V1.md`

## Owner Checklist
- [ ] Baseline complete
- [ ] Capture tuning complete
- [ ] Retrieval tuning complete
- [ ] Compression tuning complete
- [ ] Continuity stress tests complete
- [ ] Final report published
