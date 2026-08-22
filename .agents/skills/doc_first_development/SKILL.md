---
name: doc_first_development
description: >
  Enforce a documentation-first workflow for significant feature and architecture work
  on the Security Management OSCAL website (Reposol).
  Before implementing new features, new OSCAL lifecycle steps, new editors, or architectural changes,
  the agent MUST first check and update the relevant user story AND review design decisions.
  Minor UI polish, cosmetic fixes, and small UX improvements skip the full workflow and are implemented directly.
  Triggers on: new feature, implement, add functionality, build, create page, new editor, new endpoint,
  architecture, design decision, technical decision.
---

# Documentation-First Development Skill

This skill enforces a **documentation-first workflow** for **significant** development work on the Security Management OSCAL website (Reposol). It uses a **two-tier system** to distinguish important feature work (which requires documentation) from minor polish work (which does not).

---

## Tier Classification — Does This Change Need Documentation?

Before starting any work, classify the request into one of two tiers:

### Tier 1 — Full Documentation Required 📋

The full 4-phase workflow (Documentation → Read-Back → Review → Implement) applies when the change:

- **Adds a new user-facing feature** (e.g., new editor, new page, new wizard, new workflow step)
- **Adds or modifies a backend API endpoint** or data model
- **Introduces a new OSCAL lifecycle capability** (e.g., building Step 5 Assessment Plan support)
- **Changes how existing features fundamentally work** (e.g., switching from local to server-side validation)
- **Introduces a new architectural pattern, library, or technology**
- **Establishes a significant UI/UX layout pattern** (e.g., sidebar + right-column control panel, how editors are structured, how navigation works across document types)
- **Adds cross-cutting infrastructure** that affects multiple components (e.g., new state management approach, new auth system)
- **Changes the data flow** between frontend and backend

> **Rule of thumb:** If a user would notice new functionality, or if the change establishes a pattern that future work will follow, it's Tier 1.

> **Keep it high-level.** Tier 1 documentation should capture the *what* and *why* at a strategic level — not spell out every CSS class or component prop. A user story needs clear acceptance criteria, but they should describe user-visible outcomes, not implementation details. Design decisions should capture the chosen approach and rationale, not exhaustive technical specs.

### Tier 2 — Implement Directly, No Documentation Overhead ⚡

Skip the documentation workflow entirely and implement directly when the change:

- **Polishes existing UI** (loading screens, spinners, animations, color tweaks, icon swaps, font changes)
- **Fixes cosmetic/visual bugs** (alignment, spacing, CSS corrections, responsive layout fixes)
- **Removes dead code** or non-functional UI elements (unused buttons, orphan components)
- **Refactors without changing behavior** (code cleanup, file reorganization, renaming internals)
- **Adds or updates tests** for already-implemented features
- **Fixes bugs** that don't change functionality (crash fixes, typos, null checks)
- **Updates dependencies** without API changes
- **Performance optimizations** that don't change the public API or user-facing behavior
- **Style/theme changes** across existing components
- **Adjusts text, labels, or tooltips** in the existing UI

> **Rule of thumb:** If the user would describe it as "make it look/feel better" or "fix that broken thing" rather than "add this new capability", it's Tier 2.

### Edge Cases

When uncertain, lean towards **Tier 2** (implement directly). The documentation exists to capture *important decisions and requirements*, not to slow down routine work. If a Tier 2 change unexpectedly grows into something significant during implementation, pause and escalate to Tier 1.

---

## Tier 1 Workflow (4 Phases)

### Phase 1 — Documentation Check 📋

Before touching any code, update or create the relevant documentation:

#### Step A: User Story

1. **Identify the correct file.** Check which existing user story file in `documentation/user_stories/` the feature belongs to:
   - [`step1_catalog_builder.md`](../../../documentation/user_stories/step1_catalog_builder.md) — Catalog / Rulebook features
   - [`step2_profile_tailoring.md`](../../../documentation/user_stories/step2_profile_tailoring.md) — Profile / Baseline features
   - [`step3_component_inventory.md`](../../../documentation/user_stories/step3_component_inventory.md) — Component Definition features
   - [`step4_ssp_builder.md`](../../../documentation/user_stories/step4_ssp_builder.md) — System Security Plan features
   - [`step5_assessment_plan.md`](../../../documentation/user_stories/step5_assessment_plan.md) — Assessment Plan features
   - [`step6_assessment_results.md`](../../../documentation/user_stories/step6_assessment_results.md) — Assessment Results features
   - [`step7_poam.md`](../../../documentation/user_stories/step7_poam.md) — POA&M / Action Plan features
   - [`step8_control_mapping.md`](../../../documentation/user_stories/step8_control_mapping.md) — Control Mapping / Framework Mapping features
   - [`step0_global_requirements.md`](../../../documentation/user_stories/step0_global_requirements.md) — Cross-cutting / system-wide requirements (US 0.x)
   - If the feature does not fit any existing file, create a **new file** following the same naming convention and format.

2. **Read the existing file** to understand the current user stories and numbering.

3. **Write, adapt, or modify** the user story using the established format:
   ```markdown
   ### US X.Y: [Short Title]
   > **As a** [Persona, e.g. Alice (Compliance Officer) / Bob (Auditor)]  
   > **I want to** [what the user wants to do],  
   > **So that** [the business value / reason].
   *   **Acceptance Criteria:**
       *   [Criterion 1]
       *   [Criterion 2]
       *   [Criterion 3]
   ```
   - Use the next available number in the sequence (e.g., if `US 1.7` is the last, add `US 1.8`).
   - If modifying an existing user story, update it in-place and add a note about what changed.
   - Write all user stories exclusively in **English** to comply strictly with AGENTS.md Rule 5 (Repository Language Policy).

4. **Update `step0_global_requirements.md`** (the "User Stories Overview" section) if you added a new user story file, so the index stays current.

#### Step B: Design Decisions

1. **Scan existing Design Decision files** in `documentation/design_decisions/` for relevance to the planned change.
   - You do NOT need to read every DD in full for every change. Scan filenames and skim headers to identify relevant ones.
   - Read in full only the DDs that directly relate to the area being changed.

2. **Check for relevance:** Determine whether the planned change:
   - **Contradicts** an existing decision (if so, the DD must be updated BEFORE implementation)
   - **Requires a new DD** — only for **important** architectural or design decisions, such as:
     - New architectural patterns or significant refactors
     - New technology choices or library introductions
     - Fundamental UX pattern changes
     - Cross-cutting concerns affecting multiple components
   - Minor features that follow existing patterns do **NOT** need a new DD.

3. **If a DD needs updating**, modify it in-place and update the `Date` field.

4. **If a new DD is needed**, create it using the standardised format:
   ```markdown
   # DD-NNN: [Short Descriptive Title]

   ## Status: [Proposed | Accepted | Superseded]
   ## Date: YYYY-MM-DD
   ## Decision Makers: [who decided]

   ## Context
   [Why is this decision needed? What problem does it solve?]

   ## Decisions

   ### 1. [Decision Area]
   [Description of the decision, including rationale]

   ### 2. [Decision Area]
   [Additional decisions if applicable]

   ## Consequences
   - [Positive and negative consequences of this decision]
   ```
   - Use the next available DD number (e.g., if DD-007 is the last, use DD-008). Do not fill gaps.
   - Naming convention: `DD-NNN_short_description.md`

### Phase 2 — Read Back & Verify 📖

After writing or modifying documentation:

1. **Read back** the modified user story and any modified/new DD files using `view_file`.
2. **Verify** that:
   - The user story number is unique and sequential.
   - The acceptance criteria are concrete and testable.
   - No DD is contradicted by the planned implementation.

### Phase 3 — Pre-Implementation Review ✅

Present a structured summary to the user before writing any code:

1. **User Story Summary:** Which user story (US X.Y) is being implemented with key acceptance criteria.
2. **Design Decision Summary:** Which existing DDs are relevant; any DDs updated or created.
3. **Implementation Approach:** Brief outline of how the feature will be implemented.
4. **Request explicit user confirmation** before proceeding to code.

### Phase 4 — Implement 🚀

Only after Phases 1–3 are complete and the user has confirmed:

1. **Implement** the feature in the `reposol/` codebase as described by the user story.
2. **Respect** all relevant Design Decisions during implementation.
3. **Verify** the implementation satisfies all acceptance criteria.

---

## File Locations

| Purpose | Path |
|---|---|
| User Stories | `documentation/user_stories/` |
| Design Decisions | `documentation/design_decisions/` |
| Frontend Code | `reposol/frontend/` |
| Backend Code | `reposol/backend/` |
| OSCAL Reference | `oscal-reference/` |

---

## Quick Reference Checklist

### Tier 2 (Minor work) — just implement:
- [ ] Confirmed the change is Tier 2 (UI polish, bugfix, refactor, dead code removal, test addition)
- [ ] Implement directly — no documentation changes needed

### Tier 1 (Significant work) — full workflow:
- [ ] Identified the correct user story file
- [ ] Read the existing user stories in that file
- [ ] Wrote/updated the user story with proper format
- [ ] Scanned Design Decision files for relevance
- [ ] Read relevant DDs in full; updated or created new DD if needed
- [ ] Read back modified documentation to verify correctness
- [ ] Presented Pre-Implementation Review to the user
- [ ] Received explicit user confirmation
- [ ] Now proceeding to implementation
