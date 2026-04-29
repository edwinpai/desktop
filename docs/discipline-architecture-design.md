# Discipline Architecture Design

**Status:** Draft
**Date:** 2026-04-15
**Author:** Edwin + Jake

## Executive Summary

This design proposes replacing much of the current vocabulary and architecture around **agents**, **skills**, and static prompt-packaging with a cleaner model built around:

- **Shad Sources** for ingestion
- **Disciplines** for knowledge and methods
- **Shad Processes** for background synthesis and maintenance
- **Tasks** for explicit objectives and success criteria
- **Permissions** for authority and tool access
- **Execution Shells** for bounded recursive work

The core insight is that many current abstractions were shaped by context-window scarcity. With strong retrieval and memory via Shad, the system no longer needs to rely as heavily on pre-baked agent personas or tiny static skills. Instead, it can assemble the right behavior dynamically at runtime from the task, relevant disciplines, available tools, and constraints.

This does **not** eliminate all execution structure. It separates concerns cleanly:
- raw knowledge is not the same thing as a task
- a task is not the same thing as permissions
- permissions are not the same thing as a domain methodology
- methodology is not the same thing as a running execution process

The result is a more composable, adaptive, and scalable system.

---

## Problem Statement

Current systems often blur together several distinct concerns under labels like "agent" or "skill":

- domain knowledge
- task instructions
- role framing
- permissions
- tools
- memory scope
- execution loop behavior
- formatting/output defaults

This bundling creates several problems:

1. **Prompt bloat**
   - too much capability is embedded in static prompts
   - prompts become hard to maintain and reason about

2. **Redundant agent definitions**
   - many agents differ only slightly
   - specialized variants proliferate unnecessarily

3. **Poor composability**
   - knowledge, permissions, and execution policy are tied together
   - difficult to recombine capabilities in new ways

4. **Context-window-driven design**
   - many abstractions exist mainly to pre-pack context into a finite window
   - retrieval-rich architectures reduce the need for this

5. **Weak task-specific adaptation**
   - static agents often poorly fit the exact task at hand
   - real domains like QA or coding vary dramatically by context

The proposed model addresses these by shifting from static packaged roles to dynamic task-time composition.

---

## Design Goals

### Primary Goals

1. **Separate concerns clearly**
2. **Make runtime behavior task-driven**
3. **Move domain knowledge out of agent definitions**
4. **Make permissions explicit and task-attached**
5. **Support large-scale source ingestion and continuous refinement**
6. **Enable recursive execution without bloated persona prompts**
7. **Preserve traceability to source material**

### Secondary Goals

1. Improve naming consistency
2. Reduce ontology confusion
3. Increase reuse of ingested corpora
4. Enable background knowledge synthesis
5. Support dynamic specialization without creating a new agent type for every niche

---

## Core Concepts

## 1. Shad Sources

**Definition:** Raw ingested material normalized into retrievable form.

Examples:
- code repositories
- blog posts
- documentation
- folders of markdown, PDFs, text, etc.
- chat transcripts
- tickets
- emails
- notes
- manuals
- operational logs

### Responsibilities
- ingest material from one or more origins
- normalize into markdown/chunks/metadata
- index into QMD collections or equivalent retrieval structures
- maintain provenance and freshness metadata

### Key Property
A source is **data**, not behavior.

---

## 2. Disciplines

**Definition:** Activatable domains of knowledge, methods, standards, examples, and heuristics built from one or more Shad Sources.

Examples:
- QA
- distributed systems
- accounting
- product strategy
- airport travel
- family medical receipts
- a specific codebase's architecture and conventions

### What a Discipline Contains
A discipline may include:
- source collections
- synthesized summaries
- methodologies
- terminology maps
- best practices
- anti-patterns
- exemplars
- evaluation criteria
- known pitfalls
- unresolved contradictions
- update policies

### Key Property
A discipline is **curated capability**, not just a corpus.

### Important Note
A discipline should have clear boundaries:
- what it is for
- what sources feed it
- what it is not for
- how fresh it is
- what uncertainty or disagreement exists inside it

Without this, disciplines devolve into junk drawers.

---

## 3. Shad Processes

**Definition:** Long-running or background processes that continuously refine, synthesize, and maintain disciplines.

This is the key mechanism that prevents disciplines from being merely raw search spaces.

### Responsibilities
Shad Processes may:
- summarize large corpora
- extract key concepts
- identify recurring patterns
- derive procedures
- map terminology
- surface anti-patterns
- detect contradictions
- create exemplars
- maintain distilled understanding over time
- re-run synthesis when sources change
- flag stale syntheses

### Why They Matter
Without Shad Processes, task-time retrieval must do too much work:
- search raw material
- infer what matters
- reconcile duplication
- derive structure on the fly
- compress everything live

That is expensive, inconsistent, and noisy.

### Guardrails
Synthesized material must not become fake certainty.

Shad Processes should preserve:
- source traceability
- freshness timestamps
- uncertainty markers
- contradiction markers
- ability to drill down into raw evidence

### Key Property
A Shad Process creates a **working synthesis layer**, not ground truth.

---

## 4. Tasks

**Definition:** Explicit requests for work.

A task defines:
- objective
- constraints
- expected output
- urgency
- success criteria
- failure or stop conditions

Examples:
- "Find the airport parking receipt for the upcoming Mexico trip"
- "Test this PR for regressions in auth flow"
- "Summarize these receipts into accountant-ready metadata"

### Key Property
A task should define **what must be done**, not encode an entire role architecture.

---

## 5. Permissions

**Definition:** Explicit authority attached to a task or execution instance.

Examples:
- read-only filesystem
- repo-limited edit access
- browser access
- no messaging
- can message owner only
- deployment disabled
- can create calendar events
- can modify Google Drive files

### Why This Matters
Permissions should not be smuggled in through agent identity.
They should be explicit, inspectable, and task-scoped where possible.

### Key Property
Permissions define **authority**, not expertise.

---

## 6. Execution Shells

**Definition:** Thin recursive execution instances that perform work on a task using selected disciplines and permissions.

An execution shell is the minimal remaining form of what many systems currently call an "agent."

### Responsibilities
- accept a task
- operate within permissions
- activate selected disciplines
- retrieve relevant synthesized and raw material
- use tools as allowed
- loop until done, blocked, or stopping criteria are met
- report result

### What It Should Not Contain
The execution shell should not be bloated with:
- giant domain personas
- massive embedded expertise prompts
- large static methodology dumps
- redundant examples already available in disciplines

### Minimal Internal Instruction
An execution shell still likely needs a thin runtime policy, such as:
- prefer evidence over guesswork
- use allowed tools when helpful
- stop when success criteria are met
- ask for clarification if blocked
- report clearly and concisely

### Key Property
An execution shell is **bounded execution**, not a handcrafted expert identity.

---

## Why This Replaces Much of the Traditional Agent Model

Traditional agents often bundle:
- role
- knowledge
- methods
- permissions
- memory
- tools
- autonomy settings

This proposal decomposes that bundle:

- role-like behavior emerges from **task + disciplines**
- authority comes from **permissions**
- iterative work comes from **execution shell**
- knowledge comes from **disciplines**
- refinement comes from **Shad Processes**

This makes the system more adaptive and easier to reason about.

---

## Why Disciplines Are Better Than Skills Here

"Skill" usually implies a small, narrow, packaged capability. That model made sense when the main problem was stuffing the right mini-prompt into a limited context window.

"Discipline" is better because it implies:
- a body of knowledge
- methods and standards
- examples and practice
- internal structure
- refinement over time

A discipline can incorporate much more than a static skill prompt:
- repos
- docs
- standards
- exemplars
- heuristics
- procedures
- summaries
- contradictions

This makes it a more natural abstraction for retrieval-rich systems.

---

## Runtime Model

At runtime, the system should work roughly like this:

1. A **task** is received.
2. The system determines or is given the relevant **disciplines**.
3. The task carries explicit **permissions**.
4. An **execution shell** is spawned.
5. The execution shell consults the discipline's synthesis layer first.
6. It drills into raw source material when needed.
7. It uses tools within permission bounds.
8. It loops until complete, blocked, or stopped.
9. It returns a result.

### Important Principle
The execution instance should form itself primarily from the **task at hand** and relevant disciplines, rather than from a heavy predefined role prompt.

This allows dynamic specialization:
- QA for CLI is different from QA for mobile
- coding in one repo is different from coding in another
- accounting for medical receipts is different from accounting for SaaS invoices

Static role prompts flatten those distinctions.
Disciplines + task composition preserve them.

---

## Three-Layer Discipline Model

Each discipline should have three layers:

### 1. Source Layer
Raw ingested content.

### 2. Synthesis Layer
Distilled output maintained by Shad Processes.

Examples:
- key concepts
- canonical procedures
- best practices
- anti-patterns
- unresolved questions
- important examples
- confidence notes

### 3. Runtime Retrieval Layer
Task-time retrieval across both synthesis and raw sources.

### Retrieval Strategy
Default behavior should usually be:
1. consult synthesis first
2. validate or deepen via raw sources when needed
3. answer or act

This gives speed and consistency without losing grounding.

---

## Comparison to Recursive Language Model Framing

This design aligns with the idea that the main executor can recursively invoke bounded subprocesses of itself.

In that framing:
- the main executor remains generic
- sub-executions are task-scoped
- disciplines supply knowledge/methods dynamically
- permissions are task-attached
- the subprocess becomes what the task requires, rather than being predefined as a static persona

This is a better model than maintaining a zoo of canned agent identities.

---

## What Still Needs Internal Instruction

This design does **not** imply zero internal instruction.

Some minimal execution policy is still needed, including things like:
- how to stop
- when to ask for clarification
- what level of initiative to take
- how to report
- whether to optimize for speed or depth

However, this should be **thin** and generic.

The system should avoid embedding large amounts of domain expertise or role-specific methodology in the execution shell itself.
That belongs in disciplines.

---

## Optional Execution Profiles

If needed, reusable runtime behavior presets can exist as lightweight execution profiles.

Examples:
- fast
- careful
- autonomous
- review-heavy
- read-only
- verification-first

These are preferable to giant persona-agents because they define execution style rather than pretending to define domain expertise.

---

## Benefits of the Proposed Architecture

### 1. Better composability
Knowledge, permissions, tasks, and execution are separable.

### 2. Better scalability
No need to define countless specialized agents for every variation.

### 3. Better adaptation
Behavior forms around the actual task and relevant disciplines.

### 4. Better retrieval leverage
Large corpora become usable through ongoing synthesis.

### 5. Better maintainability
Updates to domain knowledge happen in sources and disciplines, not across many duplicated agent prompts.

### 6. Better reasoning clarity
The ontology is cleaner and easier to explain.

---

## Risks and Failure Modes

### 1. Discipline Sprawl
If disciplines are loosely defined, they become catch-all junk drawers.

**Mitigation:**
- explicit purpose
- explicit source boundaries
- anti-goals
- freshness metadata

### 2. Synthesis Drift
Shad Processes may over-compress or distort source truth.

**Mitigation:**
- traceability
- contradiction markers
- confidence markers
- source links
- periodic re-synthesis

### 3. Over-Dynamic Runtime Behavior
If execution shells are too unconstrained, outputs become inconsistent.

**Mitigation:**
- thin generic runtime policy
- optional execution profiles
- task-level success criteria

### 4. Retrieval Noise
Cheap retrieval can still lead to noisy, low-signal behavior.

**Mitigation:**
- synthesis-first retrieval
- disciplined source curation
- ranking heuristics
- stale content control

### 5. Ontology Confusion
If names are unclear, users may not know whether something is a source, discipline, or task preset.

**Mitigation:**
- strict object definitions
- consistent UI/CLI terms
- explicit relationships between entities

---

## Proposed Ontology

| Object | Purpose | Contains | Does Not Contain |
|---|---|---|---|
| Shad Source | Raw ingest | documents, repos, notes, transcripts, metadata | task objectives, permissions |
| Discipline | Curated domain capability | methods, standards, examples, syntheses, linked sources | direct authority, task objective |
| Shad Process | Background refinement | synthesis jobs, distillation, updates, conflict detection | final task execution |
| Task | Work request | objective, constraints, success criteria | entire domain knowledge stack |
| Permissions | Authority boundary | tool rights, scope, access limits | domain expertise |
| Execution Shell | Bounded recursive worker | loop policy, reporting behavior, task execution | giant persona knowledge bundle |

---

## Recommended Design Principle

> **Agents should evolve from heavyweight predefined identities into thin execution shells that use task-selected disciplines under explicit permissions.**

Or more bluntly:

> **Stop storing expertise inside agents. Store it in disciplines. Let tasks compose the rest at runtime.**

---

## Open Questions

1. How are disciplines selected?
   - explicit by user?
   - inferred from task?
   - hybrid?

2. How are Shad Processes scheduled and prioritized?
   - periodic?
   - event-triggered?
   - source-change-triggered?

3. How are syntheses evaluated?
   - human review?
   - automated evals?
   - confidence scoring?

4. Should execution profiles be first-class objects?

5. How much of current skills/workflows should map into disciplines vs execution profiles vs tasks?

6. What is the CLI/UI model for activation?
   - `use discipline qa`
   - `run task ... with disciplines qa,repo-x`
   - automatic selection?

---

## Suggested Next Step

Translate this design into three follow-on docs:

1. **Product Model**
   - user-facing concepts
   - naming
   - activation model
   - mental model

2. **Architecture Model**
   - ingestion pipeline
   - indexing
   - synthesis jobs
   - runtime retrieval
   - task execution flow

3. **CLI / UX Model**
   - commands
   - object lifecycle
   - defaults
   - explicit vs inferred activation

---

## Closing Position

The main thesis is not that execution structure disappears.
It is that current agent abstractions are carrying too much conceptual weight.

A cleaner system is:
- **sources** ingest raw material
- **disciplines** organize and refine capability
- **Shad Processes** maintain synthesized understanding
- **tasks** define what needs doing
- **permissions** define authority
- **execution shells** do the work

This architecture is more modular, less prompt-fragile, and better suited to a retrieval-rich world than static agent/skill packaging.
