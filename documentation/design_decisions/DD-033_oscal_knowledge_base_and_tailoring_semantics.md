# DD-033: OSCAL Master-Detail Knowledge Base & Tailoring Semantics Architecture

## Status: Accepted
## Date: 2026-08-27
## Decision Makers: Development Team & Architecture Council

---

## Context

NIST OSCAL (Open Security Controls Assessment Language) establishes a multi-layered, machine-readable architecture covering the complete security compliance lifecycle across 8 standardized stages:
1. **Catalogs (`catalog`)**: Authoritative control definitions and baseline pools.
2. **Profiles (`profile`)**: Tailored baselines created via non-destructive selection and modification overlays.
3. **Component Definitions (`component-definition`)**: Reusable technical and non-technical component inventory specifications.
4. **System Security Plans (`system-security-plan` / SSP)**: Concrete system implementations linking components and controls.
5. **Assessment Plans (`assessment-plan` / AP)**: Audit blueprints, assessment scopes, and testing schedules.
6. **Assessment Results (`assessment-results` / AR)**: Assessment findings, observations, and risk characterizations.
7. **Plans of Action and Milestones (`plan-of-action-and-milestones` / POA&M)**: Remediation tracking and corrective action lifecycles.
8. **Control Mappings (`mapping-collection`)**: Inter-framework crosswalks, relationship semantics, and equivalence scoring.

### Problem Statement
In practical compliance operations, users frequently conflate distinct OSCAL architectural layers and mutation semantics:
1. **Catalog vs. Profile Mutation Confusion**: Users assume modifying or deleting a control in a Profile alters the source Catalog JSON directly, failing to realize that Profiles operate as resolution-time overlay directives (`modify.alters` and `modify.set-parameters`).
2. **Profile vs. Component vs. SSP Allocation Confusion**: Users struggle to understand where component capabilities belong (Component Definitions) versus where concrete system implementations and parameter finalizations occur (SSPs).
3. **Audit Lifecycle Segregation**: Users often conflate audit planning (Assessment Plans), audit findings recording (Assessment Results), and remediation governance (POA&Ms).
4. **Crosswalk Mechanics**: Users lack visibility into formal OSCAL 1.1.0/1.2.2 relationship tokens (`equivalent-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`) and mapping provenance.
5. **Fragmented Documentation & Lack of Deep Linking**: Previously, `/knowledge-base` was a static single-page view primarily covering Catalog vs. Profile tailoring without deep-dive guidance, operational phases, or URL synchronization for the remaining 6 OSCAL stages.

---

## Decisions

### 1. Master-Detail Knowledge Base Portal Architecture (`/knowledge-base`)

A centralized, interactive Master-Detail Knowledge Base Portal is established at route `/knowledge-base` (with `/guide` as an alias), integrated into the main sidebar navigation under "Help & Resources" with icon 📚.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: Portal Title, Search Input, Quick Category Filters, Active View Badges         │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│ Master Navigation Rail        │ Dynamic Active Detail Container                        │
│ ┌───────────────────────────┐ │ ┌────────────────────────────────────────────────────┐ │
│ │ 🌐 Global Overview        │ │ │ [Global Overview View]                             │ │
│ │ 📊 Action Matrix          │ │ │ - Cross-Stage Mental Model Comparison              │ │
│ │ 🔄 Profile Lifecycle Flow │ │ │ - 8-Step Lifecycle Roadmap & Architecture Flow      │ │
│ │                           │ │ │ - Core Governance & Mutation Principles            │ │
│ │ ─── 8 OSCAL STAGES ───    │ │ └────────────────────────────────────────────────────┘ │
│ │ 📖 1. Catalogs            │ │ OR                                                   │ │
│ │ ⚙️ 2. Profiles            │ │ ┌────────────────────────────────────────────────────┐ │
│ │ 🧱 3. Component Defs      │ │ │ [Stage Detail View: e.g. Step 2 Profiles]          │ │
│ │ 📋 4. SSPs                │ │ │ - Purpose, Scope & Mutation Model (Overlay)        │ │
│ │ 📅 5. Assessment Plans    │ │ │ - Sequential Operational Phases (1.Import 2.Merge) │ │
│ │ ✅ 6. Assessment Results  │ │ │ - NIST OSCAL 1.1.0 Directives & JSON Schemas       │ │
│ │ ⚠️ 7. POA&Ms              │ │ │ - Reposol Web Features & UI Capabilities Matrix    │ │
│ │ 🔗 8. Control Mappings    │ │ └────────────────────────────────────────────────────┘ │
│ └───────────────────────────┘ │                                                        │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

#### Layout & Navigation Components:
1. **Master Navigation Rail (`KnowledgeBaseSidebar.tsx`)**:
   - Fixed left sidebar rail displaying global views (`overview`, `matrix`, `flow`) and all 8 individual OSCAL stages with stage step numbers (Steps 1–8), intuitive stage icons, and color-coded mutation badges.
   - Categorized groupings:
     - **Global Reference**: Overview, Action Comparison Matrix, Profile Resolution Flow.
     - **Design & Baseline**: Step 1 Catalogs, Step 2 Profiles.
     - **Implementation**: Step 3 Component Definitions, Step 4 System Security Plans.
     - **Assessment & Audit**: Step 5 Assessment Plans, Step 6 Assessment Results, Step 7 Plans of Action & Milestones.
     - **Cross-Framework**: Step 8 Control Mappings.
2. **Active Detail Container (`KnowledgeBasePage.tsx`)**:
   - Dynamically renders one of four specialized view components:
     - `GlobalOverviewView`: High-level mental model comparison cards, 8-step lifecycle flow diagram, and architectural principles.
     - `ActionMatrixView`: Comprehensive cross-stage technical action matrix.
     - `ProfileLifecycleView`: Dedicated 3-phase profile resolution algorithm explorer.
     - `StageDetailView`: Rich deep-dive view for any selected OSCAL stage.

---

### 2. URL State Synchronization & Deep-Linking Protocol

The Knowledge Base portal utilizes React Router `useSearchParams` to ensure bi-directional URL synchronization for seamless sharing, bookmarking, and browser history (back/forward) navigation:

| Parameter | Type / Enum | Default | Description |
|-----------|-------------|---------|-------------|
| `view`    | `'overview' \| 'stage' \| 'matrix' \| 'flow'` | `'overview'` | Active top-level view container |
| `stage`   | `'catalogs' \| 'profiles' \| 'component-definitions' \| 'ssps' \| 'assessment-plans' \| 'assessment-results' \| 'poams' \| 'control-mappings'` | `'catalogs'` | Active stage when `view='stage'` |
| `q`       | `string` | `''` | Real-time search query across portal content |

#### URL Examples:
- `/knowledge-base` ➔ Renders Global Overview.
- `/knowledge-base?view=stage&stage=profiles` ➔ Opens Step 2 Profiles deep-dive guide.
- `/knowledge-base?view=stage&stage=ssps&q=by-components` ➔ Opens Step 4 SSP guide filtered to `by-components`.
- `/knowledge-base?view=matrix` ➔ Opens the Cross-Stage Action Comparison Matrix.
- `/knowledge-base?view=flow` ➔ Opens the Profile 3-Phase Resolution visualizer.

---

### 3. The 8-Stage Domain Model & Mutation Semantics

Each OSCAL stage is governed by a distinct data mutation model and compliance responsibility:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       NIST OSCAL 8-STAGE LIFECYCLE                                      │
├───────────────────┬──────────────────────────────────┬──────────────────────────────────────────────────┤
│ Stage             │ Mutation Model                   │ Compliance Role & Responsibility                 │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 1. Catalogs       │ Direct Data Mutation             │ Authoritative security control definitions,      │
│                   │ (`catalog`)                      │ prose statements, parameters & baseline pools.   │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 2. Profiles       │ Non-Destructive Overlay          │ Tailors catalogs via inclusions, exclusions,     │
│                   │ (`profile`)                      │ parameter overrides, and alters directives.      │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 3. Component Defs │ Architecture Inventory           │ Reusable technical/non-technical components,     │
│                   │ (`component-definition`)         │ capability statements, protocols & port ranges.  │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 4. SSPs           │ System Implementation            │ Concrete system boundary instantiation, FIPS-199 │
│                   │ (`system-security-plan`)         │ impact, component allocation & parameter values. │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 5. Assess. Plans  │ Audit Blueprint & Scope          │ Defines assessment scope, reviewed controls,     │
│                   │ (`assessment-plan`)              │ subjects, testing assets, and schedule tasks.    │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 6. Assess. Results│ Findings Ledger & Evidence       │ Records audit observations, risk scoring (CVSS), │
│                   │ (`assessment-results`)           │ finding satisfaction states, and attestations.   │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 7. POA&Ms         │ Remediation Lifecycle            │ Tracks corrective actions, milestones, scheduled │
│                   │ (`plan-of-action-and-milestones`)│ completion dates, and deviation dispositions.    │
├───────────────────┼──────────────────────────────────┼──────────────────────────────────────────────────┤
│ 8. Control Mapping│ Cross-Framework Crosswalk        │ Crosswalks controls between frameworks with 6    │
│                   │ (`mapping-collection`)           │ relationship tokens and confidence ratings.      │
└───────────────────┴──────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

### 4. Sequential Operational Phases per Stage

Every stage guide provides structured, multi-phase operational lifecycles reflecting how Reposol and NIST OSCAL process documents:

#### Stage 1: Catalogs (`catalog`)
1. **Phase 1: Metadata & Document Provenance** — Establish catalog title, version, OSCAL metaschema version, responsible parties, and document links.
2. **Phase 2: Domain Hierarchy & Group Structuring** — Organize controls into domains and hierarchical families (`groups[]`).
3. **Phase 3: Control Statement & Part Authoring** — Draft control prose, objectives, statements (`parts[]` with `name="statement"`, `name="guidance"`).
4. **Phase 4: Parameter Definition & Constraint Modeling** — Define configurable parameter placeholders (`params[]`) with label, constraints, and defaults.
5. **Phase 5: Status Governance & Control Withdrawal** — Manage lifecycle statuses (`status: "withdrawn"`), deprecation notices, and successor control pointers (`props` with `name="withdrawn"`).

#### Stage 2: Profiles (`profile`)
1. **Phase 1: Source Catalog Import & Control Selection** — Import source catalogs/profiles via `imports[]`, selecting controls via `include-all`, `include-controls`, or `exclude-controls`.
2. **Phase 3: Structural Group Merge & Organization** — Resolve control ordering and hierarchy via `merge` modes: `as-is` (source catalog structure), `flat` (alphabetical list), or `custom` (custom groups).
3. **Phase 3: Tailoring Directives (Alters & Parameter Overrides)** — Apply non-destructive alterations via `modify.alters[]` (`adds`, `removes`) and parameter values via `modify.set-parameters[]`.

#### Stage 3: Component Definitions (`component-definition`)
1. **Phase 1: Component Cataloging & Categorization** — Register reusable components across 11 OSCAL types (`software`, `hardware`, `service`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `interconnection`).
2. **Phase 2: Capability & Feature Definition** — Define reusable security capabilities (`capabilities[]`) bundling multiple technical functions.
3. **Phase 3: Control Implementation Specification** — Define how components satisfy security controls via `control-implementations[]` and `implemented-requirements[]`.
4. **Phase 4: Network, Protocol & Service Modeling** — Document network endpoints, port ranges, and communication protocols (`protocols[]`).

#### Stage 4: System Security Plans (`system-security-plan`)
1. **Phase 1: System Characteristics & FIPS-199 Categorization** — Define authorization boundary, deployment model, and security impact categorization (`security-sensitivity-level`, `information-types`).
2. **Phase 2: Baseline Profile Attachment** — Link authoritative tailored profile via `import-profile.href`.
3. **Phase 3: Component Inventory & Architecture Allocation** — Allocate inventory components to the system (`by-components[]`).
4. **Phase 4: Control Implementation & Parameter Cascades** — Finalize parameter values and write implementation statements per component (`implemented-requirements[].by-components[]`).

#### Stage 5: Assessment Plans (`assessment-plan`)
1. **Phase 1: Scope Definition & SSP Reference** — Import target SSP via `import-ssp.href` and define audit objectives.
2. **Phase 2: Reviewed Control Selection** — Select specific controls to assess via `reviewed-controls[]`.
3. **Phase 3: Assessment Subjects & Assets Allocation** — Designate audited servers, personnel, configurations, and test tools (`assessment-subjects[]`, `assessment-assets[]`).
4. **Phase 4: Task Scheduling & Audit Milestone Planning** — Formulate audit tasks, timeline schedules, milestones, and assessment methods (`tasks[]`).

#### Stage 6: Assessment Results (`assessment-results`)
1. **Phase 1: Result Set Initialization & AP Import** — Reference originating assessment plan via `import-ap.href`.
2. **Phase 2: Observation & Evidence Collection** — Record test observations, evidence artifacts, and reviewer notes (`observations[]`).
3. **Phase 3: Finding Determination & Compliance Status** — Log control findings with target identifiers and status (`status: "satisfied"` or `status: "not-satisfied"`).
4. **Phase 4: Risk Characterization & Scoring** — Characterize identified risks with CVSS scores, impact ratings, and risk mitigation facets (`risks[]`).

#### Stage 7: Plans of Action and Milestones (`plan-of-action-and-milestones`)
1. **Phase 1: POA&M Document Initialization & System Binding** — Bind to target system via `system-id` or SSP reference.
2. **Phase 2: Finding Import & POAM Item Creation** — Ingest unresolved findings from Assessment Results into tracked `poam-items[]`.
3. **Phase 3: Remediation Milestone Scheduling** — Assign milestone targets, due dates, owners, and risk mitigation strategies (`milestones[]`).
4. **Phase 4: Tracking, Resolution & Disposition** — Monitor progress, update completion statuses, and record deviation/waiver approvals.

#### Stage 8: Control Mappings (`mapping-collection`)
1. **Phase 1: Crosswalk Provenance & Catalog Registration** — Register source catalog and target catalog references (`source-resource-id`, `target-resource-id`).
2. **Phase 2: Mapping Pair & Relationship Assignment** — Define mapping links with formal relationship tokens (`equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`).
3. **Phase 3: Confidence Scoring & Qualification** — Assign confidence levels (0.00–1.00) and rationale notes.
4. **Phase 4: Gap Analysis & Visualization** — Conduct visual gap analysis using Matrix and Sankey diagrams.

---

### 5. NIST OSCAL 1.1.0/1.2.2 Directives & JSON Schemas

The Knowledge Base portal includes validated, copyable JSON code blocks illustrating exact OSCAL syntax:

```json
// Example: Step 2 Profile - Tailoring Directives
{
  "profile": {
    "uuid": "8e364e7c-87d8-4f74-8b65-bfd32152e90c",
    "metadata": { "title": "Enterprise Tailored Baseline", "version": "1.0.0", "oscal-version": "1.1.2" },
    "imports": [{
      "href": "catalogs/nist_sp800-53_rev5.json",
      "include-controls": [{ "with-ids": ["ac-1", "ac-2", "ia-2"] }],
      "exclude-controls": [{ "with-ids": ["ac-2.1"] }]
    }],
    "merge": { "as-is": true },
    "modify": {
      "set-parameters": [{ "param-id": "ac-1_prm_1", "values": ["30 days"] }],
      "alters": [{
        "control-id": "ac-2",
        "adds": [{ "position": "after", "parts": [{ "name": "guidance", "prose": "MFA is mandatory." }] }]
      }]
    }
  }
}
```

---

### 6. Reposol UI Capabilities Matrix & Editor Integrations

| Feature Category | Catalog Editor (Step 1) | Profile Editor (Step 2) | SSP Editor (Step 4) | Assessment Editors (Steps 5–7) |
|------------------|-------------------------|-------------------------|---------------------|--------------------------------|
| **Tree Mutation** | Add/Remove Controls, Sub-groups | Include/Exclude Controls only | View Allocated Controls | View Reviewed Controls |
| **Modification** | Direct text edits (`parts.prose`) | Non-destructive `modify.alters` | Implementation descriptions | Observations & Findings |
| **Parameters** | Define `param-id`, constraints | Set baseline `modify.set-parameters` | Concrete system values (`by-components`) | Assess parameter compliance |
| **Visual Badges** | `[Withdrawn]`, `[Parameter]` | `[Altered]`, `[Param Override]`, `[Excluded]` | `[Implemented]`, `[Partial]` | `[Satisfied]`, `[Not Satisfied]` |
| **Context Menus** | Withdraw, Restore, Delete | Include, Exclude (No delete) | Assign Component, Edit Impl | Add Finding, Ingest Observation |
| **Export Formats**| JSON, YAML, XML, PDF | JSON, Resolved Catalog, PDF | JSON, System Package | JSON, SAR Summary Report |

---

### 7. Direct Mutation vs. Non-Destructive Tailoring & Cascading Semantics

#### Core Tailoring Principles:
1. **Catalog Mode (Direct Mutation)**:
   - Modifications directly change the canonical control JSON.
   - Header badge: `📖 Catalog Source (Direct Mutation)`.
   - Control removal permanently deletes the control from the document.
   - Control deprecation uses formal `status: "withdrawn"` without removing historical text.
2. **Profile Mode (Non-Destructive Overlay)**:
   - Modifications produce `modify.alters` (adds, removes) and `modify.set-parameters` without mutating the underlying imported catalog.
   - Header badge: `⚙️ Profile Baseline (Non-Destructive)`.
   - Control removal produces `exclude-controls` directives; destructive deletion is disabled.
   - Excluded controls remain visible in Edit Mode with dimmed strikethrough styling and one-click "Include in Profile" restore capability, while remaining hidden in View Mode.
3. **Sleeping Alters Preservation**:
   - If a control with existing `modify.alters` or `modify.set-parameters` is excluded from a profile, the modification directives are retained in the JSON ("sleeping alters").
   - When the control is re-included, all previously configured alterations and parameter values immediately reactivate without data loss.
4. **Cascading Parameter Resolution**:
   - Parameter resolution follows strict precedence:
     `Catalog Default Value ➔ Profile modify.set-parameters ➔ SSP implemented-requirements parameter override`.

---

### 8. Search, Filtering, Accessibility & Visual Badging

1. **Real-Time Cross-Portal Search**:
   - Live query input instantly filters across stage names, operational phase titles, NIST OSCAL directive tokens, and action comparison items.
2. **Accessibility & Responsive Grid**:
   - Fully accessible navigation rail with ARIA tab semantics, keyboard navigation support, and responsive CSS grid collapsing cleanly for tablet and mobile viewports.
3. **Visual Badging System**:
   - Standardized badges (`[Altered]`, `[Parameter Override]`, `[Withdrawn]`, `[Excluded]`, `[Satisfied]`, `[Not Satisfied]`) aligned with DD-020.

---

## Consequences

### Positive
- **Architectural Clarity**: Clear conceptual segregation of all 8 OSCAL stages prevents user errors and data loss.
- **Enhanced Learning Curve**: Interactive operational phases and real-time action matrices accelerate onboarding for compliance officers and auditors.
- **Deep-Linking Capability**: Direct URL sharing for specific stages and filtered views streamlines collaboration.
- **Strict NIST Compliance**: All examples and directives faithfully represent official NIST OSCAL 1.1.0/1.2.2 JSON specifications.

### Negative / Trade-offs
- Documentation and data structures must be maintained in sync when new OSCAL metaschema revisions are introduced.
