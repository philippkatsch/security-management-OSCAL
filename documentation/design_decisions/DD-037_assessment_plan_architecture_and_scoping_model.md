# DD-037: Assessment Plan Architecture — 6-Tab Modular Builder, 3D Scoping Matrix, Target SSP Resolution, Task Dependency DAG, and Method Enums

## Status: Accepted
## Date: 2026-09-02
## Decision Makers: Development Team

> **Related Decisions:**
> - [DD-001](DD-001_architecture_and_code_organization.md): Architecture & Code Organization
> - [DD-002](DD-002_oscal_validation_strategy.md): OSCAL Validation Strategy (Levels L0–L3)
> - [DD-004](DD-004_editor_ux_patterns.md): Editor UX Patterns (Drafts, Mode Toggle, Undo/Redo)
> - [DD-007](DD-007_base64_embedded_attachments_strategy.md): Base64 Embedded Attachments & Back-Matter
> - [DD-008](DD-008_unified_control_detail_editor.md): Unified Control Detail Editor Pattern
> - [DD-009](DD-009_parameter_strategy.md): Parameter Strategy across Lifecycle Stages
> - [DD-011](DD-011_properties_vs_parameters_separation.md): Properties vs Parameters Separation
> - [DD-013](DD-013_universal_prose_with_params_integration.md): Universal ProseWithParams Integration
> - [DD-014](DD-014_live_ui_form_validation.md): Empty Array Purging Strategy
> - [DD-016](DD-016_cross_document_import_resolution.md): Cross-Document Import Resolution
> - [DD-017](DD-017_shared_assessment_entities.md): Shared Assessment Entities (Subjects, Assets & Activities)
> - [DD-021](DD-021_entity_list_detail_editor_pattern.md): Entity List-Detail Editor Pattern
> - [DD-028](DD-028_backend_resolution_engine.md): Backend Resolution Engine
> - [DD-029](DD-029_document_actions_pattern.md): Centralized Document Actions Layer
> - [DD-030](DD-030_unified_control_editor.md): Unified Control Editor & Stage Adapters
> - [DD-036](DD-036_ssp_security_inheritance_and_baseline_resolution.md): SSP Architecture — Baseline Resolution & Security Inheritance

---

## Context

In the NIST OSCAL compliance lifecycle, the **Security Assessment Plan (AP / SAP)** (Step 5) represents the authoritative audit orchestration document. It transitions compliance management from the declarative implementation state defined in System Security Plans (Step 4) into an active, scheduled, and scoped audit campaign whose execution results will be recorded in Assessment Results (Step 6) and remediated in POA&Ms (Step 7).

The official NIST OSCAL Assessment Plan v1.2.2 JSON Schema (`oscal_assessment-plan_schema.json`) enforces strict constraints (`additionalProperties: false`, `minItems: 1` on all arrays, exact required fields) and introduces intricate structural assemblies:
1. **Target System Linkage (`import-ssp`)**: A required (1..1) reference pointing to the target System Security Plan that provides the candidate universe of implemented controls, components, inventory items, locations, and users.
2. **Three-Dimensional Scoping Matrix**: Scoping requires bounding the assessment simultaneously across three intersecting planes:
   - **Reviewed Controls & Objectives**: Which controls and statement parts are being evaluated (`reviewed-controls`, `control-selections`, `control-objective-selections`).
   - **Assessment Subjects**: Which physical/logical instances (components, inventory, locations, parties, users) are under examination (`assessment-subjects`, `select-subject-by-id`, `assessment-subject-placeholder`).
   - **Assessment Assets & Platforms**: Which specialized tools and scanning environments are authorized for the assessment (`assessment-assets`, `assessment-platforms`, `uses-components`).
3. **Local Definitions Boundary (`local-definitions`)**: Modeling temporary test environments, assessor accounts, custom evaluation objectives, and procedural activities with sequential steps not defined in the target SSP.
4. **Strict Method Taxonomy**: Evaluation methods must strictly adhere to NIST SP 800-53A methodologies (`INTERVIEW`, `EXAMINE`, `TEST`) with mandated part hierarchies (`assessment-objective` with `method-id`, `assessment-method` with `assessment-objects`).
5. **Task Scheduling & Dependency DAG (`tasks`)**: Scheduled tasks support 3 distinct timing representations (`on-date`, `within-date-range`, `at-frequency`), task-activity linkages (`associated-activities`), role assignments, and prerequisite dependency graphs (`dependencies[].task-uuid`) that require topological sort and cycle detection.
6. **Governance Rules of Engagement (`terms-and-conditions`)**: Restricting part names to the 7 canonical OSCAL AP part types.
7. **Client-Side Embedded Back-Matter**: Embedding signed Rules of Engagement PDFs and test scripts as Base64 resources linked via fragment URIs (`#resource-uuid`).

---

## Decisions

### 1. 6-Tab Modular AP Builder Architecture

To manage the multifaceted assemblies of an Assessment Plan while maintaining high usability and zero cognitive overload, the AP Editor is structured into a 6-tab modular layout:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: Title, Target SSP Import Selector, [👁️ View | ✏️ Edit] Mode Toggle, Save/Validate│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Navigation Tabs (6 Modular Tabs):                                                     │
│ 1. Overview & Metadata: Title, Version, Parties, Roles, Target SSP Metadata Summary    │
│ 2. Reviewed Controls & Scope: SSP Control Tree Picker, Include/Exclude Tailoring,      │
│    Statement Parts, Control Objective Selections                                       │
│ 3. Assessment Subjects & Assets: Target Components, Inventory, Locations, Users,       │
│    Assessment Tools & Platforms (`assessment-platforms`, `uses-components`)           │
│ 4. Local Definitions & Methods: Local Components, Users, Objectives, Activities &      │
│    Procedural Steps with Method Enums (INTERVIEW, EXAMINE, TEST)                       │
│ 5. Tasks & Timeline: Task Scheduler with Timing (`on-date`, `within-date-range`,       │
│    `at-frequency`), Dependencies (`depends-on` DAG), Role Assignments, Activity Links  │
│ 6. Terms & Conditions & Attachments: 7 Terms Parts (`rules-of-engagement`,             │
│    `methodology`, etc.) & Back-Matter Resource Attachments (Base64 Payloads)           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Tab Breakdown & Responsibilities:
1. **Overview & Metadata (`OverviewMetadataTab.tsx`)**: Document identification (`uuid`, `metadata.title`, `version`, `oscal-version: "1.2.2"`), assessor parties (`metadata.parties[]`), roles (`metadata.roles[]`, `responsible-parties[]`), target SSP selection (`import-ssp`), and live SSP metadata summary card.
2. **Reviewed Controls & Scope (`ReviewedControlsTab.tsx`)**: Hierarchical control tree with include/exclude toggles, statement part selection (`statement-ids[]`), control objective selections (`control-objective-selections[]`), and real-time gap analysis comparing target SSP controls vs scoped AP controls.
3. **Assessment Subjects & Assets (`AssessmentSubjectsAssetsTab.tsx`)**: Target subject definition categorized by `type` (`component`, `inventory-item`, `location`, `party`, `user`) with entity pickers from the SSP, placeholder definitions, and assessment toolset/platform configuration (`assessment-assets`, `assessment-platforms`, `uses-components`).
4. **Local Definitions & Methods (`LocalDefinitionsMethodsTab.tsx`)**: Assessment-specific local components, inventory items, users, local objectives with evaluation methods (`INTERVIEW`, `EXAMINE`, `TEST`), and procedural activities with step sequences.
5. **Tasks & Timeline (`TasksTimelineTab.tsx`)**: Interactive task editor supporting task types (`milestone`, `action`), 3 timing variants (`on-date`, `within-date-range`, `at-frequency`), dependency DAG configuration with cycle detection, role assignments, linked activities, and an interactive Gantt chart.
6. **Terms & Conditions & Attachments (`TermsConditionsTab.tsx`)**: 7 canonical terms parts (`rules-of-engagement`, `disclosures`, `assessment-inclusions`, `assessment-exclusions`, `results-delivery`, `assumptions`, `methodology`) and client-side Base64 resource attachments in `back-matter.resources[]`.

---

### 2. Target SSP Resolution & Cross-Document Referencing Engine (`import-ssp.href`)

The AP Builder integrates deeply with the target System Security Plan:

```
[ Target SSP in Workspace ] ──(import-ssp.href)──► [ Resolution Service ]
       │                                                    │
       ├── Implemented Controls (`implemented-requirements`) ──► Candidate Reviewed Controls
       ├── System Components & Inventory Items ─────────────► Candidate Assessment Subjects
       ├── System Users & Operational Roles ───────────────► Candidate Subject Users
       └── System Locations & Physical Facilities ─────────► Candidate Subject Locations
```

#### Resolution Architecture:
- **`import-ssp.href` Handling**:
  - Resolves workspace-relative URIs (e.g. `../system-security-plans/{uuid}.json` or `/api/documents/ssps/{uuid}`).
  - Resolves internal fragment URIs (`#resource-uuid`) pointing to embedded SSPs in `back-matter`.
  - Supports external HTTPS URIs with graceful fallback if offline.
- **Backend Resolution Endpoint**:
  - `POST /api/resolve/assessment-plan/preview`: Accepts in-memory AP document payload along with workspace context, resolving the target SSP to return:
    - Target System Name, FIPS-199 Categorization, Baseline Profile reference.
    - Flat list of implemented controls (`control-id`, title, component counts).
    - Resolved list of components, inventory items, locations, and users.
    - Computed scoping coverage metrics (in-scope count, excluded count, percentage).
- **Auto-Population Action (`populateControlsFromSSP`)**:
  - Automatically initializes `reviewed-controls.control-selections` with `include-controls` containing all `implemented-requirements[].control-id` from the target SSP.

---

### 3. Three-Dimensional Assessment Scoping Matrix Architecture

Assessment scoping is modeled across three orthogonal dimensions that triangulate in scheduled tasks:

```
                      ▲ Dimension 1: Reviewed Controls & Objectives
                      │ (`reviewed-controls`, `control-selections`, statement tailoring)
                      │
                      │
                      │
                      │          [ Task Execution Intersect ]
                      │          • Task: "Vulnerability Scan & Code Review"
                      │          • Activity: "Static Analysis" (Method: TEST)
                      │          • Scoped Controls: [SC-7, SI-2]
                      │          • Scoped Subjects: [App Server 01, DB Server]
                      │          • Scoped Asset: [SonarQube Platform]
                      │
                      └────────────────────────────────────────►
                     ╱ Dimension 2: Assessment Subjects
                    ╱  (`assessment-subjects`, components, inventory, users, locations)
                   ╱
                  ▼ Dimension 3: Assessment Assets & Platforms
                    (`assessment-assets`, `assessment-platforms`, `uses-components`)
```

#### Scoping Matrix Rules:
1. **Dimension 1 (Controls & Statements)**:
   - `include-all` vs `include-controls`: Evaluates all baseline controls or an explicit list.
   - `statement-ids[]`: Tailors assessment to specific statement sub-parts (e.g., `ac-2_smt_a`).
   - `control-objective-selections[]`: Tailors evaluation objectives independently.
2. **Dimension 2 (Assessment Subjects)**:
   - Categorized by `type`: `component`, `inventory-item`, `location`, `party`, `user`.
   - Populated from target SSP entities or local definitions.
   - `assessment-subject-placeholder`: Represents subjects dynamically identified during execution tasks.
3. **Dimension 3 (Assessment Assets & Platforms)**:
   - `assessment-assets.components[]`: Tools utilized by the audit team (scanners, analyzers).
   - `assessment-platforms[].uses-components[]`: Authorized platforms combining tools with responsible audit operators.
4. **Triangulation in Tasks**:
   - `tasks[].associated-activities[].subjects[]` explicitly binds an activity (and its evaluation method) to specific scoped subject instances.

---

### 4. Local Definitions, Evaluation Method Enums, and Procedural Activities

To satisfy NIST OSCAL AP v1.2.2 and NIST SP 800-53A assessment methodologies:

#### A. Evaluation Methods & Objectives (`local-definitions.objectives-and-methods`):
- Each `local-objective` binds to a `control-id` (required).
- `parts[]` must contain:
  1. `name: "assessment-objective"` part containing evaluation criteria prose and a property `name: "method-id"`.
  2. `name: "assessment-method"` part containing:
     - Exactly 1 property `name: "method"` with enum restricted to:
       - `INTERVIEW`: Involves discussions with system personnel.
       - `EXAMINE`: Involves reviewing policies, configurations, logs, or documentation.
       - `TEST`: Involves active exercise of technical security mechanisms (scans, pen tests).
     - Exactly 1 child part `name: "assessment-objects"` detailing the evidence artifacts or targets examined.

#### B. Procedural Activities & Sequential Steps (`local-definitions.activities`):
- Each activity has a `uuid` (required), `description` (required), optional `title`.
- Contains optional property `name: "method"` (`INTERVIEW` | `EXAMINE` | `TEST`).
- Contains `steps[]` (ordered step sequence, each requiring `uuid` and `description`, optional `title`, `reviewed-controls`, and `responsible-roles`).
- Activities are decoupled from tasks, enabling reusable assessment procedures across multiple audit phases.

---

### 5. Task Scheduling, Timing Variants, and Dependency DAG Validation

#### A. Task Timing Union:
The `timing` object in OSCAL `task` requires choosing **exactly one** of three mutually exclusive timing modes:

$$\text{Timing} = \begin{cases}
\text{on-date}: \{ \text{date}: \text{ISO-8601 DateTimeWithTimezone} \} \\
\text{within-date-range}: \{ \text{start}: \text{ISO-8601}, \text{end}: \text{ISO-8601} \} \\
\text{at-frequency}: \{ \text{period}: \text{positiveInteger}, \text{unit}: \text{TimeUnitEnum} \}
\end{cases}$$

Where `TimeUnitEnum` $\in \{\text{seconds}, \text{minutes}, \text{hours}, \text{days}, \text{months}, \text{years}\}$.

#### B. Directed Acyclic Graph (DAG) Cycle Detection:
- Tasks may declare dependencies via `dependencies: [{ "task-uuid": "<target-uuid>" }]`.
- Both frontend action layer and backend `_validate_ap_integrity` execute cycle detection using Kahn's algorithm / DFS:
  - If an in-degree topological sort cannot resolve all nodes, a cycle exists.
  - The UI immediately rejects circular dependency addition with an explanatory error message (`"Circular dependency detected: Task A -> Task B -> Task A"`).
  - The backend returns HTTP 422 Unprocessable Entity if an invalid DAG payload is submitted.

#### C. Interactive Gantt Timeline:
- Tasks with `type="milestone"` render as diamond markers.
- Tasks with `type="action"` render as horizontal bars spanning start to end date.
- Dependency edges render as visual connecting arrows.

---

### 6. Governance Rules of Engagement (7 Canonical Part Types)

The `terms-and-conditions` assembly establishes the legal and operational boundaries of the assessment. The schema enforces that `parts[].name` strictly belongs to the 7 canonical OSCAL AP part types:

| Canonical Part Name | Semantic Purpose | Nested Children Supported |
|---|---|---|
| `rules-of-engagement` | Operational rules, testing hours, escalation contacts | `assessment-part` |
| `disclosures` | Vulnerability disclosure policy and embargo timelines | `item` parts |
| `assessment-inclusions` | Mandatory testing depths and required scopes | `assessment-part` |
| `assessment-exclusions` | Prohibited testing actions (DoS, social engineering) | `assessment-part` |
| `results-delivery` | Report delivery format, encryption, recipients | `assessment-part` |
| `assumptions` | Operational assumptions, system availability guarantees | `item` parts |
| `methodology` | Standard audit framework citations (NIST SP 800-53A) | `assessment-part` |

---

### 7. Client-Side Embedded Back-Matter Attachments (DD-007 Integration)

- Supporting artifacts (signed Rules of Engagement PDFs, scan configurations, authorization letters) are encoded client-side via `FileReader.readAsDataURL()`.
- The binary payload is stored directly in `back-matter.resources[]`:
  ```json
  {
    "uuid": "4e7a68e8-912f-488b-a5d2-094cf5e2671a",
    "title": "Signed Rules of Engagement.pdf",
    "rlinks": [{ "href": "#4e7a68e8-912f-488b-a5d2-094cf5e2671a", "media-type": "application/pdf" }],
    "base64": {
      "filename": "Signed Rules of Engagement.pdf",
      "media-type": "application/pdf",
      "value": "JVBERi0xLjQKJeLjz9MK..."
    }
  }
  ```
- Any section in the AP (e.g. links in terms or activities) can reference `#resource-uuid` for immediate client-side preview or download.

---

### 8. Centralized Document Actions Layer (`assessment-plan-actions.ts` per DD-029)

All Assessment Plan document mutations are dispatched through pure, typed action functions in `reposol/frontend/src/lib/document-actions/assessment-plan-actions.ts`:

- **Overview & Metadata Actions**: `setAPTitle`, `setAPVersion`, `setImportSSP`, `addAPRole`, `removeAPRole`, `addAPParty`, `removeAPParty`, `setAPProp`.
- **Reviewed Controls Actions**: `setReviewedControlsDescription`, `setControlSelections`, `toggleIncludeAllControls`, `addIncludeControl`, `removeIncludeControl`, `setStatementIDs`, `addExcludeControl`, `removeExcludeControl`, `setControlObjectiveSelections`, `populateControlsFromSSP`.
- **Assessment Subjects & Assets Actions**: `addAssessmentSubject`, `updateAssessmentSubject`, `removeAssessmentSubject`, `addAssessmentSubjectPlaceholder`, `addAssetComponent`, `removeAssetComponent`, `addAssessmentPlatform`, `updateAssessmentPlatform`, `removeAssessmentPlatform`, `addUsesComponentToPlatform`.
- **Local Definitions Actions**: `addLocalComponent`, `removeLocalComponent`, `addLocalInventoryItem`, `removeLocalInventoryItem`, `addLocalUser`, `removeLocalUser`, `addLocalObjective`, `updateLocalObjective`, `removeLocalObjective`, `addActivity`, `updateActivity`, `removeActivity`, `addActivityStep`, `removeActivityStep`, `reorderActivitySteps`.
- **Tasks & Timeline Actions**: `addTask`, `updateTask`, `removeTask`, `setTaskTiming`, `addTaskDependency`, `removeTaskDependency`, `addAssociatedActivityToTask`, `removeAssociatedActivityFromTask`.
- **Terms & Attachments Actions**: `addTermsPart`, `updateTermsPart`, `removeTermsPart`, `addBackMatterResource`, `removeBackMatterResource`.

All actions execute via Immer `produce()`, guaranteeing immutability, complete type safety, and seamless undo/redo support via `useDocumentActions()`.

---

### 9. Pre-Serialization Empty Array Purging (DD-014 Integration)

- The NIST OSCAL AP v1.2.2 schema mandates `minItems: 1` on all arrays (`control-selections`, `include-controls`, `exclude-controls`, `statement-ids`, `assessment-subjects`, `tasks`, `dependencies`, `activities`, `steps`, `parts`, `props`, `links`).
- Prior to saving or validating, the document is cleaned via `remove_empty_arrays` (on frontend dispatch and backend validation entry points), stripping empty optional arrays to ensure 100% schema validation success.

---

## Consequences

- **100% Schema Conformity**: Created and edited Assessment Plans strictly validate against the official NIST OSCAL AP Schema v1.2.2 (`oscal_assessment-plan_schema.json` with `additionalProperties: false`).
- **Complete Lifecycle Traceability**: Connects target SSPs into an auditable assessment plan that directly powers Step 6 Assessment Results.
- **Robust DAG Task Scheduling**: Eliminates circular task dependencies and provides clear visual timeline execution planning.
- **Exhaustive Scoping Precision**: Enables assessors to define complex audits across controls, statements, components, users, and specialized testing platforms.
- **High Testability & Maintainability**: Pure Immer reducers and modular UI tabs allow isolated unit and E2E testing with high reliability.
