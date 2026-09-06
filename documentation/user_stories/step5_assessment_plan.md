# Step 5: Detailed User Stories – Assessment Plan Builder

* **Persona:** Bob (Lead Assessor / Independent Security Assessor / Compliance Auditor)
* **Goal:** Create, configure, scope, schedule, and verify a comprehensive, schema-compliant NIST OSCAL Assessment Plan (AP / SAP) document (v1.2.2). The Assessment Plan formally establishes the assessment boundary, evaluation objectives, standardized assessment methods (`INTERVIEW`, `EXAMINE`, `TEST`), procedural test activities with step sequences, assessment subjects and platforms, task execution schedules with dependency directed acyclic graphs (DAGs), rules of engagement across 7 canonical terms parts, and back-matter resource attachments. The Assessment Plan imports and resolves the target System Security Plan (SSP) from Step 4 to establish an authoritative compliance evaluation baseline for Step 6 (Assessment Results).
* **Lifecycle Position:** Stage 5 in the NIST OSCAL lifecycle (`Catalog` / `Profile` → `Component Definition` → `System Security Plan (SSP)` → **`Assessment Plan (AP / SAP)`** → `Assessment Results (AR)` → `POA&M` → `Control Mapping`). Binds directly to the target SSP to define audit perimeter and testing procedures before audit execution.

---

## 1. Architectural Overview & 6-Tab Structure

The Reposol Assessment Plan Builder is organized around an ergonomic, modular 6-tab builder architecture designed to guide assessors seamlessly through the end-to-end planning lifecycle:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: Title, Target SSP Import Selector, [👁️ View | ✏️ Edit] Mode Toggle, Save/Validate│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Navigation Tabs (6 Modular Tabs):                                                     │
│ 1. Overview & Metadata: Title, Version, Parties, Roles, Target SSP Live Context Summary│
│ 2. Reviewed Controls & Scope: SSP Control Tree Picker, Include/Exclude Tailoring,      │
│    Statement Parts, Control Objective Selections, Coverage Metrics                     │
│ 3. Assessment Subjects & Assets: Target Components, Inventory, Locations, Parties,     │
│    Users, Assessment Platforms & Tools (`assessment-platforms`, `uses-components`)     │
│ 4. Local Definitions & Methods: Local Components, Users, Objectives, Activities &      │
│    Procedural Steps with Method Enums (INTERVIEW, EXAMINE, TEST)                       │
│ 5. Tasks & Timeline: Task Scheduler with Timing (`on-date`, `within-date-range`,       │
│    `at-frequency`), Dependencies (`depends-on` DAG), Role Assignments, Activity Links  │
│ 6. Terms & Conditions & Attachments: 7 Terms Parts (`rules-of-engagement`,             │
│    `methodology`, etc.) & Back-Matter Resource Attachments (Base64 Payloads)           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Breakdown of User Stories by Tab & Capability

### Tab 1: Overview & Metadata

#### US 5.1: Minimal AP Document Creation & Initial Root Scaffold
> *Implements [US 0.14](step0_global_requirements.md) with Assessment Plan specific initialization rules.*  
> *References DD-002, DD-014, DD-029, DD-037*  
> **As a** Lead Assessor (Bob)  
> **I want to** create a new Assessment Plan document by specifying a document title in a streamlined dialog and be immediately redirected to the in-place editor (`/assessment-plans/{uuid}?edit=true`),  
> **so that** the backend provisions all mandatory OSCAL root assemblies and I have an authoritative workspace ready for audit scoping.

* **Acceptance Criteria:**
  * **Minimal Creation Modal:** Clicking "New Assessment Plan" on `/assessment-plans` opens a focused dialog requesting only `metadata.title` (required string, non-empty) and optional initial `import-ssp.href`.
  * **Authoritative Root Assembly Provisioning:** The backend generates an authoritative document shell strictly conforming to `oscal_assessment-plan_schema.json` (NIST OSCAL v1.2.2). The four mandatory root elements are scaffolded:
    1. `assessment-plan.uuid`: Newly minted RFC 4122 v4 UUID.
    2. `metadata`: Contains `title`, `published` (omitted until first publish), `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`, `roles: []`, `parties: []`.
    3. `import-ssp`: `{ "href": "" }` (mandatory 1..1 root element linking the target system).
    4. `reviewed-controls`: `{ "control-selections": [{ "include-all": {} }] }` (mandatory 1..1 root element satisfying `minItems: 1`).
    * Optional assemblies (`local-definitions`, `terms-and-conditions`, `assessment-subjects`, `assessment-assets`, `tasks`, `back-matter`) are omitted or pruned prior to save to prevent empty array schema violations per DD-014.
  * **Direct Redirection & Mode Synchronization:** Bob is immediately redirected to `/assessment-plans/{uuid}?edit=true`. The Segmented Mode Toggle defaults to `[ ✏️ Edit ]`, activating authoring controls across Tab 1 (Overview & Metadata).
  * **View vs. Edit Mode Dynamics:**
    * In **Edit Mode** (`✏️ Edit`, `?edit=true`): Alice and Bob can modify metadata, select target SSPs, configure assessor roles, and add parties.
    * In **View Mode** (`👁️ View`): All inputs render as formatted, read-only audit cards with badge summaries.
  * **Schema Validation Baseline:** The initialized document passes schema validation against `oscal_assessment-plan_schema.json` with zero errors.

---

#### US 5.2: Target SSP Import & Live System Context Resolution
> *Implements [DD-016](../design_decisions/DD-016_cross_document_import_resolution.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** select and link the target System Security Plan (SSP) via `import-ssp.href` and inspect its live system context,  
> **so that** the assessment plan binds to the system's implemented controls, components, inventory items, locations, and users.

* **Acceptance Criteria:**
  * **Workspace SSP Browser Modal:** In Tab 1, interacting with the "Target System Security Plan" selector opens a workspace browser querying `GET /api/documents/ssps`, listing available SSPs with title, version, system name, and implemented control count.
  * **Target URI Binding:** Bob selects a workspace SSP (setting `href: "../system-security-plans/{ssp_uuid}.json"`), specifies an external HTTPS URI, or references a `#resource-uuid` back-matter fragment. Optional `remarks` capture the audit mandate.
  * **Real-Time System Context Resolution:** Selecting an SSP triggers the backend resolution service (`POST /api/resolve/assessment-plan/preview` or `GET /api/resolve/ssp/{id}`), extracting:
    * Target System Name (`system-characteristics.system-name`).
    * System Authorization Status (`system-characteristics.status.state`).
    * FIPS-199 Security Categorization & Impact Objectives (`security-impact-level`).
    * Total Implemented Controls count (`control-implementation.implemented-requirements.length`).
    * Total System Components count (`system-implementation.components.length`).
    * Candidate Physical Locations (`metadata.locations[]`) and Parties (`metadata.parties[]`).
  * **Live Target SSP Summary Card:** Renders a cohesive overview card in Tab 1 displaying these metrics alongside a direct link to inspect the target SSP.
  * **Re-Sync Banner:** If the referenced SSP is updated in the workspace, an alert banner notifies: *"Target SSP updated in workspace — click to re-sync candidate scope"*.

---

#### US 5.14: Assessment Metadata, Assessor Roles, Parties, and Tagging
> *Implements [US 0.16](step0_global_requirements.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** configure assessment metadata, audit lead roles, testing team parties, and classification tags (`props[]`),  
> **so that** audit ownership, accredited inspection bodies, and evaluation parameters are officially recorded.

* **Acceptance Criteria:**
  * **Document Title & Version:** Full control over `metadata.title` and semantic `metadata.version` (e.g., `"1.0.0"`).
  * **Assessor Roles (`metadata.roles[]`):** Supports standard OSCAL audit roles:
    * `lead-assessor` — Primary lead auditor accountable for assessment execution.
    * `security-auditor` — Evaluation team member conducting testing.
    * `technical-evaluator` — Specialist performing penetration testing or code review.
    * `system-owner-poc` — Target system liaison.
    * Custom role entry supported.
  * **Assessment Parties (`metadata.parties[]`):** Managing individuals or accredited assessment organizations (3PAO) with `uuid`, `type: "person" | "organization"`, `name`, `email-addresses[]`, and `telephone-numbers[]`.
  * **Responsible Parties (`metadata.responsible-parties[]`):** Binding parties to defined roles (e.g., linking Bob's party UUID to role `lead-assessor`).
  * **Classification Properties / Tags (`metadata.props[]`):** Key-value pairs for assessment governance:
    * `name: "assessment-type", value: "annual-reauthorization" | "initial-ato" | "continuous-monitoring"`.
    * `name: "assessment-methodology", value: "NIST SP 800-53A Rev 5"`.
    * `name: "data-sensitivity", value: "CUI / FedRAMP Moderate"`.

---

### Tab 2: Reviewed Controls & Scope

#### US 5.3: Reviewed Controls & Control Selections Tailoring (DISC-05 Resolution)
> *Implements [DD-030](../design_decisions/DD-030_unified_control_editor.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** define `reviewed-controls` using inclusion/exclusion rules and statement-level granularity with real statement IDs,  
> **so that** the exact perimeter of controls evaluated during the assessment is bounded without relying on synthetic stubs.

* **Acceptance Criteria:**
  * **Hierarchical Scope Tree:** Displays the full control tree resolved from the imported SSP's baseline. Controls are grouped by family (e.g., AC, AU, IA, SC) with search filtering by ID and title.
  * **Control Selections Tailoring (`reviewed-controls.control-selections[]`, required `minItems: 1`):**
    * **Include All Option:** Toggle `include-all: {}` (evaluates all controls present in the baseline).
    * **Include Controls Option:** Toggle `include-controls[]` (list of `select-control-by-id` items with `control-id`).
    * **Exclude Controls Option:** Add `exclude-controls[]` (list of `select-control-by-id` items to subtract specific controls from scope).
  * **Real Statement IDs Resolution (DISC-05 Resolution):** When tailoring statement parts for an included control (e.g., `ac-2`):
    * The editor reads **actual statement IDs** from the resolved SSP/catalog (e.g., `ac-2_smt_a`, `ac-2_smt_b`, `ac-2_smt_c`).
    * The hardcoded synthetic stubs (`${cid}_smt_a..d`) are completely eradicated.
    * Bob can selectively check or uncheck individual statement parts to define sub-control audit scope.
  * **Auto-Populate from SSP:** Clicking "Auto-Populate from SSP" queries the target SSP and populates `include-controls` with all controls present in the SSP's `implemented-requirements`.
  * **Schema Conformity:** Validates that `reviewed-controls` contains valid `control-selections` satisfying `minItems: 1`.

---

#### US 5.4: Control Objective Selections
> *References DD-037*  
> **As a** Lead Assessor (Bob)  
> **I want to** configure `control-objective-selections` within `reviewed-controls`,  
> **so that** I can tailor assessment objectives independently or evaluate all objectives for the in-scope controls.

* **Acceptance Criteria:**
  * **Objective Scoping Mode:** In Tab 2, Bob can configure `control-objective-selections[]`:
    * `include-all: {}`: Automatically evaluates all NIST SP 800-53A assessment objectives associated with in-scope controls.
    * `include-objectives[]`: Explicitly selects objective IDs (e.g., `ac-2_obj_1`, `ac-2_obj_2`) using `select-objective-by-id` (`objective-id` required).
    * `exclude-objectives[]`: Explicitly excludes specific objective IDs from assessment.
  * **Objective Browser:** When using `include-objectives`, an objective picker displays the text and determination statements for each candidate objective.
  * **Empty Array Stripping:** If objective tailoring is not customized, the optional assembly is omitted before save.

---

#### US 5.5: Scoping Gap Analysis & Coverage Metrics
> *References DD-028, DD-037*  
> **As a** Lead Assessor (Bob)  
> **I want to** view real-time scoping metrics comparing candidate controls against in-scope controls,  
> **so that** audit coverage percentages, excluded control rationales, and unreviewed requirements are immediately apparent.

* **Acceptance Criteria:**
  * **Coverage Metrics Widget:** Renders in Tab 2 showing:
    * Total Baseline Controls (e.g., `156`).
    * In-Scope Controls (e.g., `42`).
    * Excluded Controls count (e.g., `114`).
    * Percentage of baseline covered (e.g., `26.9%`).
  * **Exclusion Justification Flag:** If a control is placed in `exclude-controls[]`, the UI prompts Bob to provide an optional `remarks` justification (e.g., `"Physical controls excluded; evaluated under separate facility assessment"`).

---

### Tab 3: Assessment Subjects & Assets

#### US 5.6: Assessment Subjects & Scope Boundaries (DISC-06 Resolution)
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** select and scope assessment subjects across all 5 standard OSCAL subject types including locations and parties,  
> **so that** physical facilities, operational teams, and software components under audit are formally bounded.

* **Acceptance Criteria:**
  * **Five Standard Subject Types (DISC-06 Resolution):** In Tab 3, the candidate entity extractor populates candidate subjects across ALL 5 official OSCAL subject types from the target SSP:
    1. `component` — Software applications, databases, cloud services, and the `this-system` root.
    2. `inventory-item` — Production server instances, virtual machines, appliances.
    3. `location` — Data centers, cloud regions, corporate headquarters, server rooms.
    4. `party` — Cloud service providers, operations teams, development organizations.
    5. `user` — User classes, administrators, operational personas.
  * **Assessment Subject Configuration (`assessment-subjects[]`):** For each subject type, Bob can choose between:
    * `include-all: {}` — All candidate entities of this type in the SSP are in-scope.
    * `include-subjects[]` — Array of `select-subject-by-id` items with `subject-uuid` referencing specific target entities.
    * `exclude-subjects[]` — Array of excluded entity UUIDs.
  * **Schema `anyOf` Enforcement:** The schema strictly enforces `anyOf`: an `assessment-subject` MUST have either `include-all` OR `include-subjects`. Defining neither, or defining empty arrays, triggers immediate live validation rejection.

---

#### US 5.7: Assessment Assets & Platform Declarations
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** declare assessment assets and platforms (`assessment-assets.assessment-platforms[]`),  
> **so that** authorized vulnerability scanners, compliance testing tools, and test environments are formally accredited.

* **Acceptance Criteria:**
  * **Assessment Platforms (`assessment-platforms[]`, required in assets):**
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `title` (required, `markup-line`, e.g., `"Automated Vulnerability Scanning Platform"`).
    * `uses-components[]` (optional, array): Links to local test components defined in `local-definitions.components[]` or `assessment-assets.components[]`.
  * **Assessment Tool Components (`assessment-assets.components[]`):**
    * Bob can define specialized evaluation tools (e.g., `"Tenable Nessus Scanner"`, `"OWASP ZAP"`, `"OpenSCAP"`) with `uuid`, `type: "software"`, `title`, `description`, and version.
  * **Referential Integrity Validation:** The validator verifies that `uses-components[].component-uuid` resolves to an existing asset component.

---

### Tab 4: Local Definitions & Methods

#### US 5.8: Local Components, Inventory Items & Test Accounts
> *References DD-037*  
> **As a** Lead Assessor (Bob)  
> **I want to** declare assessment-specific local components, inventory items, and test user accounts in `local-definitions`,  
> **so that** temporary testing accounts, audit bastions, and assessment fixtures are documented without modifying the target system's SSP.

* **Acceptance Criteria:**
  * **Local Components (`local-definitions.components[]`):** Declare assessment-only software, harnesses, or test simulators with `uuid`, `type`, `title`, and `description`.
  * **Local Test Accounts (`local-definitions.users[]`):** Declare dedicated evaluation accounts (e.g., `"test-auditor-read-only"`, `"pen-test-account-01"`) with privileges and contact details.
  * **Local Inventory Items (`local-definitions.inventory-items[]`):** Declare assessor laptops, scan appliances, or dedicated test runner instances.

---

#### US 5.9: Local Assessment Objectives & Standard Evaluation Methods
> *Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** define assessment objectives and bind them to standardized NIST SP 800-53A evaluation methods (`INTERVIEW`, `EXAMINE`, `TEST`),  
> **so that** testing criteria and evidence examination procedures are explicitly instructed.

* **Acceptance Criteria:**
  * **Local Objectives Entry (`local-definitions.objectives-and-methods[]`):**
    * `control-id` (required, `token`): Target control (e.g., `"ac-2"`).
    * `description` (optional, `markup-multiline`): Objective narrative.
    * `parts[]` (required array, `minItems: 1`): Objective assessment parts.
  * **Evaluation Methods Binding:** Within each objective part, Bob assigns evaluation methods using property `name="method"` with values strictly restricted to the official NIST SP 800-53A triad:
    * `EXAMINE` — Reviewing policy documents, system logs, architectural diagrams, and configuration files.
    * `INTERVIEW` — Conducting structured interviews with system administrators, ISSOs, or developers.
    * `TEST` — Executing technical verification tests, vulnerability scans, or penetration tests.
  * **Validation Enforcement:** Backend `_validate_ap_integrity` verifies that all props named `method` strictly match `INTERVIEW`, `EXAMINE`, or `TEST`. Non-standard values are rejected.

---

#### US 5.10: Procedural Assessment Activities & Step Sequences
> *Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** author structured procedural activities (`local-definitions.activities[]`) with step-by-step test sequences,  
> **so that** audit procedures are repeatable, verifiable, and linked to evaluated controls.

* **Acceptance Criteria:**
  * **Activity Definition:** Each activity requires:
    * `uuid` (required, auto-generated UUID).
    * `title` (required, `markup-line`, e.g., `"Authentication & Session Lockout Examination"`).
    * `description` (required, `markup-multiline`): High-level testing procedure narrative.
    * `related-controls`: Links to in-scope control IDs (e.g., `["ac-2", "ac-7", "ia-5"]`).
    * `responsible-roles[]`: Assessor roles assigned to perform the activity.
  * **Step Sequences (`steps[]`):** Each activity can contain an ordered sequence of procedural test steps:
    * `uuid` (required, auto-generated UUID).
    * `title` (optional, `markup-line`, e.g., `"Step 1: Attempt 3 Invalid Logins"`).
    * `description` (required, `markup-multiline`): Concrete test instruction.
    * `compare-to`: Expected system response or compliance criteria.
  * **Drag-and-Drop Step Reordering:** In Edit Mode, steps can be reordered via drag-and-drop handles.

---

### Tab 5: Tasks & Timeline

#### US 5.11: Task Scheduling, Types & Timing Variants (`anyOf` Branches)
> *Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** schedule assessment tasks with explicit types and timing representations adhering to OSCAL's three `anyOf` timing branches,  
> **so that** audit actions, milestones, and testing windows are machine-readably scheduled without schema errors.

* **Acceptance Criteria:**
  * **Task Types (`tasks[].type`, required):**
    * `milestone` — Fixed governance checkpoint (e.g., "Assessment Kickoff", "Testing Complete", "Draft Report Delivery").
    * `action` — Operational testing task (e.g., "Penetration Testing Window", "IAM Interview Session").
  * **The Three Mutually Exclusive Timing Branches (`anyOf` Enforcement):** Each task `timing` object MUST contain exactly ONE of the three valid OSCAL branches:
    1. **Branch 1: `on-date`**  
       * Requires `date` (`DateTimeWithTimezoneDatatype`, ISO 8601 string, e.g., `"2026-10-15T09:00:00Z"`). Used for milestone checkpoints.
    2. **Branch 2: `within-date-range`**  
       * Requires `start` and `end` (`DateTimeWithTimezoneDatatype`, e.g., start: `"2026-10-15T09:00:00Z"`, end: `"2026-10-22T17:00:00Z"`). Enforces `start <= end`.
    3. **Branch 3: `at-frequency`**  
       * Requires `period` (positive integer, e.g., `1`) and `unit` (enum strictly restricted to: `['seconds', 'minutes', 'hours', 'days', 'months', 'years']`).
  * **Strict Single-Branch Enforcement:** Attempting to define multiple timing structures (e.g., both `on-date` and `within-date-range`) triggers an immediate UI validation error and is rejected by the schema `anyOf` constraint.
  * **Task Metadata:** `uuid` (required), `title` (required), `description`, `responsible-roles[]`.

---

#### US 5.12: Task Dependency Directed Acyclic Graph (DAG) & Cycle Detection
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** establish dependencies between tasks (`dependencies[].task-uuid`) and have the system perform DFS cycle detection,  
> **so that** impossible circular dependency loops are prevented and a topologically sorted execution order is guaranteed.

* **Acceptance Criteria:**
  * **Task Dependency Declaration:** In the task editor, Bob can add predecessor task dependencies (`dependencies[]` with `task-uuid`).
  * **Target Existence Verification:** Backend `_validate_ap_integrity` verifies that every `task-uuid` in `dependencies[]` resolves to an existing task in the document.
  * **Topological Sort & Recursive DFS Cycle Detection:**
    * When saving or validating, the backend executes a Depth-First Search (DFS) cycle detector across the task dependency graph.
    * If a circular dependency is detected (e.g., Task A -> Task B -> Task A):
      * The validator immediately flags error `custom/task-dag-cycle`: *"Circular task dependency detected in execution graph: [Task A -> Task B -> Task A]"*.
      * Saving is blocked until the cycle is broken.
  * **Cycle Prevention in UI:** In Edit Mode, the predecessor selector dynamically disables tasks that would introduce an immediate or transitive cycle.

---

#### US 5.12b: Interactive Task Timeline & Visual Gantt Chart
> *References DD-037*  
> **As a** Lead Assessor (Bob)  
> **I want to** inspect scheduled tasks and milestones on an interactive visual Gantt timeline,  
> **so that** assessment testing windows, concurrent activities, and milestone critical paths are visually intuitive.

* **Acceptance Criteria:**
  * **Interactive Gantt Timeline:** Tab 5 renders a visual timeline view mapping tasks across the calendar:
    * Milestones display as diamond markers on their `on-date`.
    * Actions display as horizontal duration bars spanning `within-date-range.start` to `within-date-range.end`.
    * Dependency arrows link predecessor tasks to successor tasks.
  * **View vs. Edit Mode Dynamics:**
    * In **Edit Mode**: Tasks can be clicked to open their editor drawer.
    * In **View Mode**: Provides zoom controls (Day / Week / Month) and export to PNG/PDF.

---

#### US 5.19: Task-Activity-Subject Triangulation
> *References DD-037*  
> **As a** Lead Assessor (Bob)  
> **I want to** link tasks directly to procedural activities and target assessment subjects (`associated-activities[]`),  
> **so that** each scheduled audit session explicitly identifies what test procedure is executed against which system components.

* **Acceptance Criteria:**
  * **Associated Activities Linkage:** Tasks support `associated-activities[]` containing:
    * `activity-uuid` (required, UUID): Reference to an activity defined in `local-definitions.activities[]`.
    * `subjects[]` (optional): Array of `select-subject-by-id` items restricting the activity execution to specific scoped subjects.
  * **Referential Integrity Validation:** The system verifies that `activity-uuid` resolves to an existing activity in `local-definitions.activities[]`.

---

### Tab 6: Terms & Conditions & Attachments

#### US 5.13: Terms & Conditions (7 Canonical Parts Enforcement)
> *Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** configure assessment terms and conditions (`terms-and-conditions.parts[]`) strictly using the 7 official OSCAL canonical part names,  
> **so that** Rules of Engagement, testing constraints, and confidentiality disclosures are standardized and machine-verifiable.

* **Acceptance Criteria:**
  * **The 7 Canonical Terms Parts:** The Terms & Conditions editor strictly enforces that `terms-and-conditions.parts[].name` belongs to the 7 official OSCAL canonical part names:
    1. `rules-of-engagement` — Authorized scanning windows, non-disruption agreements, notification protocols.
    2. `disclosures` — Confidentiality agreements, NDA citations, privileged access handling.
    3. `assessment-inclusions` — Explicit operational areas, subnets, and components included in testing.
    4. `assessment-exclusions` — Explicitly excluded third-party systems, production databases, or off-limits networks.
    5. `results-delivery` — Target reporting deadlines, briefing schedules, finding classification formats.
    6. `assumptions` — Presumed system states, assessor access prerequisites, network availability assumptions.
    7. `methodology` — Testing framework standards (e.g., NIST SP 800-53A, FedRAMP Testing Guidance, OWASP ASVS).
  * **Structured Part Editor:** Each part entry contains:
    * `name` (required, enum strictly matching the 7 canonical names above).
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `prose` (required, `markup-multiline`): Free-text narrative using markdown.
    * `title` (optional, `markup-line`).
  * **Integrity Validation:** Backend `_validate_ap_integrity` verifies that every part name in `terms-and-conditions.parts[]` is one of the 7 canonical tokens. Non-canonical part names trigger an integrity validation rejection.

---

#### US 5.17: Back-Matter Base64 Resource Attachments & Scanners
> *Implements [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** attach supporting audit evidence, signed rules of engagement, and automated scan scripts in `back-matter.resources[]`,  
> **so that** all audit mandate documentation is bundled directly within the portable OSCAL document.

* **Acceptance Criteria:**
  * **Embedded Base64 Attachments (≤ 2MB):** Client-side encoding of signed RoE PDFs, test scripts, and credential authorization letters.
  * **External `rlinks` (> 2MB):** External links with mandatory SHA-256 cryptographic hashes.
  * **Cross-Referencing:** Links inside terms parts or tasks can reference `#<resource-uuid>` with preview modals.

---

### Global / Lifecycle Integration

#### US 5.12c: AP Pre-Flight Completeness & Referential Integrity Validation
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** execute a pre-flight completeness validation across schema rules, referential links, and DAG execution flows,  
> **so that** audit plans are 100% verified before submitting them for authorization or executing tests in Step 6.

* **Acceptance Criteria:**
  * **Validation Engine Pipeline:**
    * **L1 Schema Validation:** Validates against `oscal_assessment-plan_schema.json` via `POST /api/validate/assessment-plans`. Checks root mandatory assemblies (`uuid`, `metadata`, `import-ssp`, `reviewed-controls`), date formats, and enums.
    * **L2 Referential Integrity Validation (`_validate_ap_integrity`):**
      * Verifies `import-ssp.href` is non-empty and resolves.
      * Verifies every `associated-activities[].activity-uuid` points to a valid activity.
      * Verifies every `dependencies[].task-uuid` points to an existing task without DAG cycles.
      * Verifies every `uses-components[].component-uuid` references a valid asset component.
      * Verifies every method prop is one of `INTERVIEW`, `EXAMINE`, `TEST`.
      * Verifies all terms parts match the 7 canonical part names.
    * **L3 Audit Completeness Warnings:** Flags in-scope controls missing objective bindings or tasks without scheduled timing.
  * **Interactive Validation Drawer:** Lists all findings with deep-links to the offending tab and field.

---

#### US 5.15: In-Place Editing, Tab Switching & Draft Persistence
> *Implements [DD-004](../design_decisions/DD-004_editor_ux_patterns.md), [DD-029](../design_decisions/DD-029_document_actions_pattern.md), and [US 0.17](step0_global_requirements.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** switch between the 6 tabs seamlessly, toggle View/Edit modes, and have drafts auto-saved every 30 seconds,  
> **so that** authoring complex assessment plans is protected against accidental data loss.

* **Acceptance Criteria:**
  * **Segmented Mode Toggle (`[ 👁️ View | ✏️ Edit ]`):** Located in top bar, synchronized with URL query (`?edit=true`).
  * **Backend Draft Auto-Save (`useDraft`):** While dirty, automatically saves snapshot `<uuid>_draft.json` every 30 seconds to the backend draft store.
  * **Undo/Redo History:** Tracks in-memory state mutations (`Ctrl+Z` / `Ctrl+Y`).

---

#### US 5.16: Immutable Backend Document Actions & Versioning
> *Implements [US 0.15](step0_global_requirements.md) and [DD-029](../design_decisions/DD-029_document_actions_pattern.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** publish immutable Assessment Plan versions with revision history tracking without UUID regeneration,  
> **so that** finalized audit plans maintain an auditable provenance trail for authorizing officials.

* **Acceptance Criteria:**
  * **Immer Action Reducers:** All mutations execute via pure action creators in `assessment-plan-actions.ts`.
  * **Publishing Snapshot:** Saves `{uuid}_v{version}.json`, creates `metadata.revisions[]` entry, deletes working draft, and switches to View Mode.
  * **Stable UUID:** The document UUID remains strictly stable across all saves and versions.

---

#### US 5.18: Multi-Format Export (JSON, YAML, XML) & Stage 6 Handoff
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md) and [DD-029](../design_decisions/DD-029_document_actions_pattern.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** export the completed Assessment Plan in JSON, YAML, or XML format and hand it off to Step 6 (Assessment Results),  
> **so that** testing execution runners and assessors in Step 6 import the approved scope and procedural activities.

* **Acceptance Criteria:**
  * **Multi-Format Export Modal:** Exports 100% schema-compliant OSCAL JSON, XML, and YAML.
  * **Step 6 Handoff:** In Step 6 Assessment Results Builder, this Assessment Plan is selectable via `import-ap.href`, automatically providing candidate reviewed controls, assessment objectives, subjects, and activities for finding evaluation.

---

## 2. Practitioner's Detailed Workflow & User Journey

### Persona
**Bob (Lead Assessor / 3PAO Independent Security Auditor)**, preparing the formal Assessment Plan for the "Enterprise Cloud Security Management Platform (ECSMP)" annual FedRAMP reauthorization audit.

### Chronological Step-by-Step Narrative

1. **Document Initialization & Shell Provisioning (US 5.1):**
   * Bob navigates to `/assessment-plans` and clicks `➕ New Assessment Plan`.
   * He enters Title: `"ECSMP Annual FedRAMP Reauthorization Assessment Plan (FY2026)"`.
   * The backend provisions document `uuid: "ap-7711-2233-4455-66778899aabb"` with mandatory root elements (`uuid`, `metadata`, `import-ssp`, `reviewed-controls`).
   * Bob is redirected to `/assessment-plans/ap-7711-2233-4455-66778899aabb?edit=true` with the editor opened on Tab 1 (Overview & Metadata).

2. **Binding the Target SSP & Context Resolution (US 5.2):**
   * In **Tab 1**, Bob clicks "Select Target SSP" and selects the ECSMP production SSP authored in Step 4: `../system-security-plans/ssp-9900-1122-3344-5566778899aa.json`.
   * The backend resolution engine extracts the system context and renders the **Live Target SSP Summary Card**:
     * System: `"ECSMP Production Platform"` (Status: `operational`).
     * Sensitivity Level: `High` (FIPS-199: C: High, I: High, A: Moderate).
     * Implemented Controls: `156`.
     * System Components: `4` (`this-system`, `Keycloak IAM`, `PostgreSQL DB`, `AWS GovCloud IaaS`).

3. **Configuring Assessor Roles & Team Parties (US 5.14):**
   * Bob registers his assessment organization in `metadata.parties[]`: `"Apex Cyber Assurance 3PAO"`.
   * He creates party Bob (`"Bob Mitchell"`, `email: "bob@apexcyber.com"`).
   * In `responsible-parties`, he binds Bob to role `lead-assessor`.
   * In `metadata.props`, he assigns `assessment-type = "annual-reauthorization"` and `methodology = "NIST SP 800-53A Rev 5"`.

4. **Scoping Controls & Statement Parts with Real IDs (US 5.3, US 5.4, US 5.5):**
   * Bob switches to **Tab 2: Reviewed Controls & Scope**.
   * He clicks "Auto-Populate from SSP" to load all 156 implemented controls.
   * For the high-risk Access Control family, Bob drills down into control `ac-2` (*Account Management*):
     * The editor resolves **real statement IDs** from the target SSP: `ac-2_smt_a`, `ac-2_smt_b`, `ac-2_smt_c`, `ac-2_smt_d`.
     * Bob checks `ac-2_smt_a` (Approval) and `ac-2_smt_b` (Automated Provisioning) for dedicated testing.
   * In **Control Objective Selections**, he sets `include-all: {}` to evaluate all NIST SP 800-53A objectives for the in-scope controls.
   * The **Coverage Metrics Widget** indicates: 42 in-scope controls selected for detailed technical testing (26.9% of baseline).

5. **Scoping Assessment Subjects & Accrediting Tools (US 5.6, US 5.7):**
   * Bob switches to **Tab 3: Assessment Subjects & Assets**.
   * Under **Assessment Subjects**, Bob includes all 5 entity categories (DISC-06 Resolution):
     * Components: Selects `Keycloak IAM`, `PostgreSQL DB`, and `this-system`.
     * Locations: Scopes the primary data center facility `Corporate HQ - Ashburn DC`.
     * Parties: Scopes `Cloud Operations Team` and `AWS GovCloud CSP`.
   * Under **Assessment Assets & Platforms**:
     * Declares platform: `uuid: <plat-uuid>`, `title: "Apex Automated Vulnerability Scanner"`.
     * Declares tool: `Tenable Nessus Professional v10.6` (`type="software"`).

6. **Defining Test Accounts & Procedural Activities (US 5.8, US 5.9, US 5.10):**
   * In **Tab 4: Local Definitions & Methods**:
     * In `local-definitions.users[]`, Bob declares temporary audit account: `"test-auditor-read-only"`.
     * In `objectives-and-methods[]`, he links control `ac-2` to evaluation methods: `EXAMINE` (review IAM SOPs) and `TEST` (execute live account lockout verification).
     * In `activities[]`, Bob authors activity `ACT-AC7-01` (*Account Lockout Verification*):
       * `title`: `"Brute-Force Lockout Threshold Test"`.
       * `steps`:
         1. `"Attempt 3 consecutive invalid password submissions via Keycloak API."`
         2. `"Verify account enters locked state and emits SecurityEvent 401."`
         3. `"Verify account remains locked for 15 minutes."`

7. **Scheduling Tasks & DAG Dependency Graph (US 5.11, US 5.12, US 5.12b):**
   * In **Tab 5: Tasks & Timeline**, Bob configures the execution DAG:
     * **Task 1 (Milestone):** `title: "Assessment Kickoff Meeting"`, `type: "milestone"`, timing `on-date: "2026-10-15T09:00:00Z"`.
     * **Task 2 (Action):** `title: "IAM Policy & Log Examination"`, `type: "action"`, timing `within-date-range: { start: "2026-10-16T09:00:00Z", end: "2026-10-18T17:00:00Z" }`, depends on `Task 1`.
     * **Task 3 (Action):** `title: "Automated Vulnerability Scanning"`, `type: "action"`, timing `within-date-range: { start: "2026-10-19T09:00:00Z", end: "2026-10-21T17:00:00Z" }`, depends on `Task 2`.
     * **Task 4 (Milestone):** `title: "Preliminary Findings Debrief"`, `type: "milestone"`, timing `on-date: "2026-10-22T15:00:00Z"`, depends on `Task 3`.
   * The backend validates the task DAG with Depth-First Search: **No cycles detected**.
   * Bob views the interactive Gantt chart displaying milestone diamonds and action duration bars linked by dependency arrows.

8. **Configuring Rules of Engagement (7 Canonical Parts) (US 5.13, US 5.17):**
   * In **Tab 6: Terms & Conditions & Attachments**, Bob fills out the canonical parts:
     * `rules-of-engagement`: `"Testing authorized only during off-peak window 22:00-06:00 UTC."`.
     * `disclosures`: `"All scan data treated as CUI under mutual NDA."`.
     * `assessment-inclusions`: `"Production VPC subnets 10.0.1.0/24 and 10.0.2.0/24."`.
     * `assessment-exclusions`: `"Production payment gateway API endpoints strictly excluded."`.
     * `results-delivery`: `"Draft Assessment Results delivered within 5 business days."`.
     * `assumptions`: `"Target system administrators available on standby."`.
     * `methodology`: `"NIST SP 800-53A Rev 5 assessment cases."`.
   * He uploads the signed Rules of Engagement PDF into `back-matter.resources[0].base64`.

9. **Pre-Flight Completeness Check & Publishing (US 5.12c, US 5.16, US 5.18):**
   * Bob opens the **Pre-Flight Validation Drawer**:
     * L1 Schema Check: **0 errors**.
     * L2 Referential Integrity Check: **0 errors** (DAG acyclic, method enums valid, terms canonical).
   * Bob clicks **"Publish Version"**, entering Version: `"1.0.0"`, Remarks: `"Approved FedRAMP Assessment Plan for FY2026 reauthorization."`.
   * The backend saves immutable snapshot `ap-7711-2233-4455-66778899aabb_v1.0.0.json`, appends to `metadata.revisions[]`, and deletes the working draft.
   * Bob exports the Assessment Plan in OSCAL JSON. The audit plan is formally locked and ready to guide Step 6 (Assessment Results)!

---

## 3. Functional Requirements for the System

- **Modular 6-Tab Architecture:** The system UI strictly organizes Assessment Plan authoring across the 6 standardized functional tabs plus JSON Source view (US 5.1).
- **Target SSP Context Resolution Engine:** Resolving the target SSP from workspace or URL, extracting candidate controls, components, users, locations, and impact metrics (US 5.2).
- **Reviewed Controls & Scope Tailoring:** Support for `control-selections` with `include-all`, `include-controls`, `exclude-controls`, and real statement ID tailoring resolving DISC-05 (US 5.3).
- **Control Objective Selections:** Independent objective tailoring with `include-all`, `include-objectives`, and `exclude-objectives` (US 5.4).
- **Scoping Coverage Analytics:** Real-time calculation of baseline control coverage percentages and exclusion rationales (US 5.5).
- **Comprehensive Subject Scoping:** Five-dimensional subject selection (`component`, `inventory-item`, `location`, `party`, `user`) with schema `anyOf` enforcement resolving DISC-06 (US 5.6).
- **Assessment Assets & Platform Accreditation:** Managing authorized evaluation platforms and testing tools with component referential integrity (US 5.7).
- **Local Assessment Definitions:** Declaring assessment-specific components, inventory items, and test accounts isolated from the target SSP (US 5.8).
- **Standardized Evaluation Methods:** Enforcing the NIST SP 800-53A method triad (`INTERVIEW`, `EXAMINE`, `TEST`) on objective props via backend validation (US 5.9).
- **Procedural Test Activities & Steps:** Authoring sequential test instructions with expected outcomes and drag-and-drop reordering (US 5.10).
- **Task Timing `anyOf` Branches:** Strict single-branch enforcement across `on-date`, `within-date-range` (`start <= end`), and `at-frequency` with valid time units (US 5.11).
- **Task Dependency DAG & Cycle Detector:** Recursive DFS cycle detection catching loops (`custom/task-dag-cycle`) and enforcing predecessor existence (US 5.12).
- **Interactive Visual Gantt Timeline:** Visualizing milestones, action durations, and dependency arrows (US 5.12b).
- **Activity-Subject Triangulation:** Binding procedural activities to target assessment subjects (US 5.19).
- **Enforcement of 7 Canonical Terms Parts:** Backend validation rejecting terms-and-conditions parts outside the 7 official OSCAL canonical names (US 5.13).
- **Client-Side Base64 Evidence Embedding:** Encoding attachments ≤2MB in `back-matter.resources[]` and external `rlinks` with SHA-256 hashes (US 5.17).
- **Pre-Flight Validation Engine:** Three-tier validation checking L1 schema, L2 referential integrity, and L3 audit completeness warnings (US 5.12c).
- **Dual-State Mode & 30-Second Draft Auto-Save:** Synchronized View/Edit modes with background draft persistence `<uuid>_draft.json` (US 5.15).
- **Immutable Document Actions & Version Snapshots:** Pure Immer reducers in `assessment-plan-actions.ts` and version snapshots `{uuid}_v{version}.json` without UUID regeneration (US 5.16).
- **Multi-Format Export & Step 6 Handoff:** Exporting to JSON, XML, and YAML, seamlessly providing the input baseline for Step 6 Assessment Results Builder (US 5.18).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] **US 5.1:** An Assessment Plan document can be created with minimal input (title only), auto-provisioning the 4 mandatory root assemblies (`uuid`, `metadata`, `import-ssp`, `reviewed-controls`) and redirecting to `/assessment-plans/{uuid}?edit=true`.
- [x] **US 5.2:** Target SSP can be selected and resolved via `import-ssp.href`, displaying live system context, components, and candidate controls.
- [x] **US 5.3:** Reviewed controls can be tailored via `control-selections` (`include-all`, `include-controls`, `exclude-controls`) with real statement ID tailoring resolving DISC-05.
- [x] **US 5.4:** Control objectives can be scoped via `control-objective-selections` (`include-all`, `include-objectives`, `exclude-objectives`).
- [x] **US 5.5:** Real-time scoping gap analysis displays baseline coverage percentages and prompts for exclusion rationales.
- [x] **US 5.6:** Candidate assessment subjects cover all 5 OSCAL types (`component`, `inventory-item`, `location`, `party`, `user`) with schema `anyOf` enforcement resolving DISC-06.
- [x] **US 5.7:** Assessment platforms and authorized evaluation tools can be declared and linked via `uses-components[]`.
- [x] **US 5.8:** Local assessment-specific components, inventory items, and test accounts can be declared in `local-definitions`.
- [x] **US 5.9:** Evaluation methods on assessment objectives are validated to strictly enforce the official triad: `INTERVIEW`, `EXAMINE`, `TEST`.
- [x] **US 5.10:** Procedural activities with step sequences, expected results, and drag-and-drop reordering are authorable in `local-definitions.activities[]`.
- [x] **US 5.11:** Task timing strictly enforces the 3 mutually exclusive `anyOf` branches: `on-date`, `within-date-range` (`start <= end`), and `at-frequency` with valid time units.
- [x] **US 5.12:** Task dependency graph executes topological DFS cycle detection, rejecting circular dependencies (`custom/task-dag-cycle`).
- [x] **US 5.12b:** Scheduled tasks and milestones render on an interactive visual Gantt timeline with dependency links.
- [x] **US 5.12c:** Pre-flight completeness validation evaluates L1 schema rules, L2 referential integrity, and L3 audit completeness warnings in a structured drawer.
- [x] **US 5.13:** Terms and conditions strictly enforce the 7 official OSCAL canonical part names (`rules-of-engagement`, `disclosures`, `assessment-inclusions`, `assessment-exclusions`, `results-delivery`, `assumptions`, `methodology`).
- [x] **US 5.14:** Document metadata manages assessor roles, accredited parties, and classification tags (`props[]`).
- [x] **US 5.15:** Segmented Mode Toggle `[ 👁️ View | ✏️ Edit ]` synchronizes URL params, manages undo/redo, and executes 30-second draft auto-saves (`<uuid>_draft.json`).
- [x] **US 5.16:** Mutations dispatch typed Immer actions in `assessment-plan-actions.ts` and formal versions save immutable snapshots `{uuid}_v{version}.json` without UUID bumping.
- [x] **US 5.17:** Back-matter resources support client-side Base64 embedded attachments (≤2MB) or external `rlinks` with SHA-256 hashes.
- [x] **US 5.18:** Completed Assessment Plans export to 100% schema-compliant JSON, XML, and YAML, cleanly providing the audit baseline for Step 6 Assessment Results.
- [x] **US 5.19:** Scheduled tasks link procedural activities and target assessment subjects via `associated-activities[]`.
