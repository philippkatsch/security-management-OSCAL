---
name: doc_first_development
description: >
  Enforce a documentation-first workflow for the Security Management OSCAL website (Reposol).
  Before implementing any new feature, UI change, or functional addition on the website,
  the agent MUST first check and update BOTH the relevant user story in documentation/user_stories/
  AND review all design decisions in documentation/design_decisions/ for relevance and consistency.
  User Stories and Design Decisions are equal — both must be satisfied before code is written.
  Triggers on: new feature, implement, add functionality, build, create page, UI change, website change,
  frontend change, backend change, architecture, design decision, technical decision.
---

# Documentation-First Development Skill

This skill enforces a **mandatory documentation-first workflow** for all development work on the Security Management OSCAL website (Reposol). It integrates **User Stories** and **Design Decisions** as equal, complementary documentation sources.

> **Core Rule:** You MUST NOT write or modify any code in `reposol/` until:
> 1. The corresponding **User Story** in `documentation/user_stories/` has been written or updated.
> 2. All relevant **Design Decisions** in `documentation/design_decisions/` have been reviewed, and any new important architectural decisions have been documented.
> 3. You have read both back in full and presented a **Pre-Implementation Review** to the user.

---

## When This Skill Applies

This skill applies whenever you are asked to:
- Implement a **new feature** or functionality
- **Add, change, or remove** UI elements, pages, or components
- **Modify backend** endpoints, logic, or data models to support new behaviour
- **Build** a new step, wizard, editor, or workflow in the application
- Make any **functional change** to the Reposol website
- Make **architectural or technical design decisions** that affect the codebase

This skill does **NOT** apply to:
- Pure bug fixes that don't change functionality (typos, crash fixes, CSS alignment)
- Refactoring that preserves existing behaviour
- Documentation-only changes
- Test-only additions for already-implemented features
- Questions, research, or investigation tasks

---

## Documentation Ecosystem

The workflow manages two document types as **equal partners**:

| Document Type | Location | Purpose |
|---|---|---|
| **User Stories** | `documentation/user_stories/` | Define WHAT to build and WHY (user value) |
| **Design Decisions** | `documentation/design_decisions/` | Define HOW to build it (architectural constraints & patterns) |

> **Note:** `GOAL.md` and `oscal_gap_analysis.md` are static context documents and are NOT part of this workflow.

---

## Mandatory Workflow (4 Phases)

### Phase 1 — Documentation Check 📋

Before touching any code, you must update or create the relevant documentation:

#### Step A: User Story

1. **Identify the correct file.** Check which existing user story file in `documentation/user_stories/` the feature belongs to:
   - `step1_catalog_builder.md` — Catalog / Regelwerk features
   - `step2_profile_tailoring.md` — Profile / Baseline features
   - `step3_component_inventory.md` — Component Definition features
   - `step4_ssp_builder.md` — System Security Plan features
   - `step5_assessment_plan.md` — Assessment Plan features
   - `step6_assessment_results.md` — Assessment Results features
   - `step7_poam.md` — POA&M / Maßnahmenplan features
   - `step8_control_mapping.md` — Control Mapping / Framework-Zuordnung features
   - `step0_global_requirements.md` — Cross-cutting / system-wide requirements (US 0.x)
   - If the feature does not fit any existing file, create a **new file** following the same naming convention and format.

2. **Read the existing file** to understand the current user stories and numbering.

3. **Write, adapt, or modify** the user story using the established format:
   ```markdown
   ### US X.Y: [Short Title]
   > **Als** [Persona, e.g. Alice (Compliance Officer) / Bob (Auditor)]  
   > **möchte ich** [what the user wants to do],  
   > **damit** [the business value / reason].
   *   **Akzeptanzkriterien:**
       *   [Criterion 1]
       *   [Criterion 2]
       *   [Criterion 3]
   ```
   - Use the next available number in the sequence (e.g., if `US 1.7` is the last, add `US 1.8`).
   - If modifying an existing user story, update it in-place and add a note about what changed.
   - Write user stories in **German** to match the existing convention.

4. **Update `step0_global_requirements.md`** (the "User Stories im Überblick" section) if you added a new user story file, so the index stays current.

#### Step B: Design Decisions

1. **Read ALL existing Design Decision files** in `documentation/design_decisions/` to understand the current architectural landscape.

2. **Check for relevance:** For each DD, determine whether the planned change:
   - **Touches** an area governed by an existing DD (e.g., component structure → DD-001, editor UX → DD-004, validation → DD-002)
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

1. **Read the complete user story file** back using `view_file` to ensure it is correct, complete, and consistent.
2. **Read back any modified or newly created DD files** using `view_file`.
3. **Verify** that:
   - The user story number is unique and sequential.
   - The acceptance criteria are concrete and testable.
   - The format matches the existing stories in the same file.
   - No DD is contradicted by the planned implementation.
   - Any new DD follows the standardised format.

### Phase 3 — Pre-Implementation Review ✅

Present a structured summary to the user before writing any code:

1. **User Story Summary:**
   - Which user story (US X.Y) is being implemented
   - The acceptance criteria in brief

2. **Design Decision Summary:**
   - Which existing DDs are relevant and will guide implementation
   - Any DDs that were updated (what changed and why)
   - Any new DDs that were created (summary of the decision)

3. **Implementation Approach:**
   - Brief outline of how the feature will be implemented, respecting both the user story and the design decisions

4. **Request explicit user confirmation** before proceeding to code.

### Phase 4 — Implement 🚀

Only after Phases 1–3 are complete and the user has confirmed:

1. **Implement** the feature in the `reposol/` codebase (frontend, backend, or both) as described by the user story and its acceptance criteria.
2. **Respect** all relevant Design Decisions during implementation (architectural patterns, naming conventions, UX patterns, etc.).
3. **Verify** the implementation satisfies:
   - All acceptance criteria listed in the user story.
   - All architectural constraints from relevant Design Decisions.

---

## File Locations

| Purpose | Path |
|---|---|
| User Stories | `c:\Users\phili\Desktop\Projects\Security-Management-OSCAL\documentation\user_stories\` |
| Design Decisions | `c:\Users\phili\Desktop\Projects\Security-Management-OSCAL\documentation\design_decisions\` |
| Frontend Code | `c:\Users\phili\Desktop\Projects\Security-Management-OSCAL\reposol\frontend\` |
| Backend Code | `c:\Users\phili\Desktop\Projects\Security-Management-OSCAL\reposol\backend\` |
| OSCAL Reference | `c:\Users\phili\Desktop\Projects\Security-Management-OSCAL\oscal-reference\` |

---

## Checklist (for self-verification)

Before writing any code, confirm all boxes are checked:

- [ ] I identified the correct user story file
- [ ] I read the existing user stories in that file
- [ ] I wrote/updated the user story with proper format (Als/möchte ich/damit + Akzeptanzkriterien)
- [ ] I read ALL existing Design Decision files
- [ ] I checked whether any existing DD is affected by the planned change
- [ ] I updated affected DDs or created a new DD if needed (only for important decisions)
- [ ] I read back the full user story file to verify correctness
- [ ] I read back any modified/new DD files to verify correctness
- [ ] I verified no contradictions between user story and design decisions
- [ ] I presented the Pre-Implementation Review (User Story + DDs + Approach) to the user
- [ ] I received explicit user confirmation
- [ ] Now I may proceed to implementation
