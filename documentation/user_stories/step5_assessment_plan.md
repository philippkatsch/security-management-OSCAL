# Step 5: Detailed User Stories – Assessment Plan Builder

* **Persona:** Bob (Lead Assessor / Compliance Auditor / Independent Security Assessor)
* **Goal:** Create, configure, scope, schedule, and verify a comprehensive, schema-compliant NIST OSCAL Assessment Plan (AP / SAP) document (v1.2.2) that formally establishes the audit scope, assessment objectives, evaluation methodologies, test activities, assessment subjects and platforms, task schedules with dependency graphs, rules of engagement, and back-matter evidence attachments. The Assessment Plan imports and resolves the target System Security Plan (SSP) from Step 4 to establish an authoritative baseline for compliance evaluation in Step 6 (Assessment Results).

---

## 1. Architectural Overview & 6-Tab Structure

The Reposol Assessment Plan Builder is organized around a modular 6-tab builder architecture designed to guide assessors seamlessly through the end-to-end planning lifecycle:

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

---

## 2. Breakdown of User Stories by Tab & Capability

### Tab 1: Overview & Metadata

#### US 5.1: Minimal AP Document Creation & Initial Shell
> Implements [US 0.14](step0_global_requirements.md) with Assessment Plan specific initialization rules.  
> **As a** Lead Assessor (Bob)  
> **I want to** create a new Assessment Plan document by specifying a document title in a streamlined dialog and be redirected to the editor (`/assessment-plans/{uuid}?edit=true`),  
> **so that** I have an authoritative, schema-compliant workspace ready to configure the assessment strategy.

* **Acceptance Criteria:**
  * **Given** Bob is on the Assessment Plans overview page (`/assessment-plans`),
  * **When** Bob clicks "New Assessment Plan", a modal dialog appears requesting the document `title` (required, string) and an optional initial `import-ssp` target.
  * **When** Bob submits the dialog with a valid title:
    * The backend generates an authoritative document shell adhering strictly to the NIST OSCAL AP JSON Schema v1.2.2 (`oscal_assessment-plan_schema.json`).
    * The initial document payload contains:
      * `assessment-plan.uuid`: auto-generated RFC 4122 v4 UUID.
      * `metadata`: `title`, `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`, `roles: []`, `parties: []`.
      * `import-ssp`: `{ "href": "" }` (required 1..1 root element).
      * `reviewed-controls`: `{ "control-selections": [{ "include-all": {} }] }` (required 1..1 root element with valid initial selection satisfying `minItems: 1`).
      * Optional empty assemblies (`local-definitions`, `terms-and-conditions`, `assessment-subjects`, `assessment-assets`, `tasks`, `back-matter`) are omitted or purged prior to save per DD-014.
    * Bob is immediately redirected to `/assessment-plans/{uuid}?edit=true` with the document loaded in Edit mode on Tab 1 (Overview & Metadata).
  * **Then** the initialized document passes schema validation against `oscal_assessment-plan_schema.json` without errors.

---

#### US 5.2: Target SSP Import & Live System Context Resolution
> Implements [DD-016](../design_decisions/DD-016_cross_document_import_resolution.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** select and link the target System Security Plan (SSP) via `import-ssp.href`,  
> **so that** the assessment plan binds to the system's implemented controls, components, inventory items, locations, and users.

* **Acceptance Criteria:**
  * **Given** Bob is on the Overview & Metadata tab of the Assessment Plan editor,
  * **When** Bob interacts with the "Target System Security Plan (SSP)" selector:
    * The UI provides a **Workspace Document Browser Modal** listing all available SSPs in the workspace (`/api/documents/ssps`) with title, version, system name, and implemented control count.
    * Bob can select an SSP from the list (setting `href: "../system-security-plans/{ssp_uuid}.json"`), specify an external HTTPS URI, or reference a `#resource-uuid` fragment.
    * An optional `remarks` textarea allows capturing the audit mandate or context for this SSP linkage.
  * **When** a valid target SSP is selected:
    * The backend resolution service (`POST /api/resolve/assessment-plan/preview` or `GET /api/resolve/ssp/{id}`) resolves the SSP context in real time.
    * The UI renders a **Live Target SSP Summary Card** displaying:
      * Target System Name (`system-characteristics.system-name`).
      * Security Categorization / FIPS-199 Impact Level (`security-impact-level`).
      * Baseline Profile / Catalog source reference (`import-profile.href`).
      * Total Implemented Controls count (`control-implementation.implemented-requirements.length`).
      * Total System Components count (`system-implementation.components.length`).
      * System Authorization Status (`system-characteristics.status.state`).
  * **When** the referenced SSP is updated in the workspace, the AP editor displays a "Target SSP Updated — Re-sync Candidate Scope" banner.
  * **Then** `import-ssp` is persisted with required `href` (URI reference) and passes validation.

---

#### US 5.14: Document Metadata, Parties, Roles, and Tagging
> Implements [US 0.16](step0_global_requirements.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** configure document metadata, assess lead roles, assessment team parties, document revision history, and custom tags (`props`),  
> **so that** administrative ownership, assessment personnel, and document provenance are fully recorded.

* **Acceptance Criteria:**
  * **Given** Bob is in the Overview & Metadata tab,
  * **When** Bob edits metadata:
    * **Document Title & Version:** Can edit `metadata.title` and semantic `metadata.version` (e.g., `1.0.0`).
    * **OSCAL Version:** Displays `metadata.oscal-version: "1.2.2"` (read-only or selectable).
    * **Roles (`metadata.roles[]`):** Can add/edit roles (e.g., `lead-assessor`, `security-auditor`, `technical-evaluator`, `system-owner-poc`), each requiring `id` and `title`.
    * **Parties (`metadata.parties[]`):** Can add/edit individual auditors or assessment organizations with `uuid`, `type: "person" | "organization"`, `name`, `email-addresses`, and `telephone-numbers`.
    * **Responsible Parties (`metadata.responsible-parties[]`):** Can associate parties to defined roles (e.g., linking Bob's party UUID to role `lead-assessor`).
    * **Custom Properties / Tags (`metadata.props[]`):** Can assign key-value pairs (e.g., `name: "assessment-type", value: "annual-reauthorization"`, `name: "classification", value: "CUI"`).
    * **Revision History (`metadata.revisions[]`):** Can track previous versions with timestamps and change summaries.
  * **Then** all metadata entries conform to OSCAL metadata assembly standards.

---

### Tab 2: Reviewed Controls & Scope

#### US 5.3: Reviewed Controls & Control Selections Tailoring
> Implements [DD-030](../design_decisions/DD-030_unified_control_editor.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** define `reviewed-controls` using inclusion/exclusion rules and statement-level granularity,  
> **so that** the exact perimeter of security controls evaluated in the assessment is explicitly bounded.

* **Acceptance Criteria:**
  * **Given** Bob is in the "Reviewed Controls & Scope" tab,
  * **When** Bob views the control scoping interface:
    * The UI displays a hierarchical tree of candidate controls derived from the imported SSP's resolved baseline.
    * Bob can configure `reviewed-controls.control-selections[]` (required 1..*):
      * **All Controls Option:** Toggle `include-all` (evaluates every control in the baseline).
      * **Explicit Selection Option:** Toggle `include-controls[]` (list of `select-control-by-id` items with `control-id`).
      * **Exclusion Option:** Add `exclude-controls[]` (list of `select-control-by-id` items with `control-id` to subtract specific controls from `include-all`).
    * **Statement-Level Scoping (`statement-ids[]`):** For any included control (e.g., `ac-2`), Bob can expand the control and select specific statement parts (e.g., `ac-2_smt_a`, `ac-2_smt_c`) to tailor the assessment scope to individual control sub-parts.
    * **Control Search & Family Filtering:** Bob can filter the candidate tree by control family (e.g., AC, AU, IA, SC) or text search (ID or title).
  * **When** Bob clicks "Auto-Populate from SSP":
    * The system populates `include-controls` with all control IDs present in the target SSP's `implemented-requirements`.
  * **Then** `reviewed-controls` is saved with valid `control-selections` satisfying `minItems: 1` and passes schema validation.

---

#### US 5.4: Control Objective Selections
> **As a** Lead Assessor (Bob)  
> **I want to** configure `control-objective-selections` within `reviewed-controls`,  
> **so that** I can tailor assessment objectives independently or select all objectives for the in-scope controls.

* **Acceptance Criteria:**
  * **Given** Bob is in the Reviewed Controls & Scope tab under the Objectives sub-section,
  * **When** Bob configures `control-objective-selections[]`:
    * Bob can choose between:
      * `include-all`: Enforces evaluation of all standard control objectives associated with the in-scope controls.
      * `include-objectives[]`: Explicitly selects objective IDs (e.g., `ac-2_obj_1`, `ac-2_obj_2`) using `select-objective-by-id` (`objective-id` required).
      * `exclude-objectives[]`: Explicitly excludes objective IDs from assessment.
    * An optional `description` and `props` can be attached to the objective selection collection.
  * **Then** the objective selections are serialized into `reviewed-controls.control-objective-selections` conforming to the OSCAL AP schema.

---

#### US 5.5: Assessment Scoping Gap Analysis & Coverage Summary
> **As a** Lead Assessor (Bob)  
> **I want to** view a real-time scoping coverage summary comparing imported SSP controls against the scoped AP controls,  
> **so that** I can detect any unaddressed controls, orphaned objectives, or out-of-scope elements before finalizing the plan.

* **Acceptance Criteria:**
  * **Given** Bob has configured `reviewed-controls`,
  * **When** Bob reviews the Scoping Summary widget on Tab 2:
    * The UI displays:
      * **Total Target SSP Controls**: Count of implemented requirements in the target SSP.
      * **In-Scope Controls**: Count and percentage of controls included in `reviewed-controls`.
      * **Excluded Controls**: Count of controls excluded or omitted.
      * **Statement Coverage**: Total statement parts in-scope vs total available.
      * **Family Breakdown Matrix**: Visual bar chart / chips showing coverage per control family (e.g., Access Control: 100%, Audit: 80%).
    * Any control in `include-controls` that does not exist in the imported SSP is flagged with an informational badge (`[External/Custom Control]`).
  * **Then** the summary updates reactively as control inclusions/exclusions are toggled.

---

### Tab 3: Assessment Subjects & Assets

#### US 5.6: Assessment Subjects (Components, Inventory, Locations, Users, Parties)
> Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** configure `assessment-subjects` mapping target components, inventory items, physical locations, parties, and system users into the assessment scope,  
> **so that** auditors know precisely which physical and logical entities are undergoing examination.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 3 (Assessment Subjects & Assets),
  * **When** Bob manages `assessment-subjects[]`:
    * Bob can create subject groupings categorized by `type` (required token, enum: `component`, `inventory-item`, `location`, `party`, `user`).
    * For each subject grouping:
      * Bob can select `include-all` (includes all instances of that type from the imported SSP).
      * Or Bob can select `include-subjects[]` (list of `select-subject-by-id` requiring `subject-uuid` and `type`).
      * Bob can add `exclude-subjects[]` to omit specific items.
      * An optional `description` explains the sampling methodology or scope boundary for that subject group.
    * **SSP Entity Picker:** Clicking "Add Subject" opens a selector populated with live components, inventory items, locations, and users resolved from the target SSP (or defined locally in Tab 4).
    * **Assessment Subject Placeholders (`assessment-subject-placeholder`):** Bob can declare placeholders for subjects that will be dynamically identified during testing tasks (requiring `uuid`, `description`, and `sources: [{ "task-uuid": ... }]`).
  * **Then** all `assessment-subjects` entries pass schema validation and properly link `subject-uuid` references.

---

#### US 5.7: Assessment Assets & Platforms (`assessment-platforms`, `uses-components`)
> Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** declare `assessment-assets` including specialized scanning tools, assessor workstations, and `assessment-platforms`,  
> **so that** authorized audit tooling and environment configurations are formally documented and approved.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 3 in the Assessment Assets section,
  * **When** Bob enables `assessment-assets` (0..1):
    * **Asset Components (`assessment-assets.components[]`):** Bob can add assessment tools as `system-component` objects (e.g., `type: "software"`, `title: "Nessus Vulnerability Scanner v10.5"`, `title: "Burp Suite Professional"`, with purpose and version).
    * **Assessment Platforms (`assessment-assets.assessment-platforms[]`, required 1..* if assets defined):**
      * Bob can add platforms (requiring `uuid`, optional `title`).
      * **Component Usage (`uses-components[]`):** Each platform can link to declared asset components via `component-uuid` (required).
      * **Responsible Parties (`responsible-parties[]`):** Each linked component can designate who is authorized to operate the tool (linking `role-id` and `party-uuids`).
      * Optional `props`, `links`, and `remarks` can be attached to platforms and component usages.
  * **Then** the serialized `assessment-assets` structure strictly satisfies `minItems: 1` on `assessment-platforms` and passes schema validation.

---

### Tab 4: Local Definitions & Methods

#### US 5.8: Local Definitions — Components, Inventory Items, and Users
> **As a** Lead Assessor (Bob)  
> **I want to** define assessment-specific components, inventory items, and users within `local-definitions`,  
> **so that** temporary assessment environments, test accounts, or external auditor identities not present in the target SSP can be modeled.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 4 (Local Definitions & Methods),
  * **When** Bob manages `local-definitions` (0..1):
    * **Local Components (`local-definitions.components[]`):** Can add `system-component` items (with `uuid`, `type`, `title`, `description`, `status: { state }`).
    * **Local Inventory Items (`local-definitions.inventory-items[]`):** Can add `inventory-item` items (with `uuid`, `description`, `implemented-components[]`).
    * **Local Users (`local-definitions.users[]`):** Can add `system-user` items (with `uuid`, `title`, `short-name`, `role-ids[]`).
    * Every locally defined entity receives a distinct RFC 4122 v4 UUID and is immediately made available for selection in Assessment Subjects (Tab 3), Activities (Tab 4), and Tasks (Tab 5).
  * **Then** `local-definitions` entities conform to the standard OSCAL component and user metaschemas.

---

#### US 5.9: Assessment Objectives & Evaluation Methods (`INTERVIEW`, `EXAMINE`, `TEST`)
> Implements [DD-008](../design_decisions/DD-008_unified_control_detail_editor.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** define `objectives-and-methods` within `local-definitions` using standard NIST SP 800-53A method enums (`INTERVIEW`, `EXAMINE`, `TEST`),  
> **so that** specific assessment procedures and evaluation criteria are defined for each reviewed control.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 4 in the Objectives & Methods section,
  * **When** Bob adds a `local-objective` to `local-definitions.objectives-and-methods[]`:
    * Bob selects a `control-id` (required token, referencing an in-scope control e.g. `ac-2`).
    * An optional `description` can be entered.
    * Bob configures `parts[]` (required 1..*, `assessment-part`):
      * **Assessment Objective Part (`name: "assessment-objective"`):** Contains evaluation prose and requires at least one property `name: "method-id"` pointing to the corresponding assessment method.
      * **Assessment Method Part (`name: "assessment-method"`):**
        * Must contain exactly 1 property named `method` with allowed enum values: `INTERVIEW`, `EXAMINE`, `TEST`.
        * Must contain exactly 1 child part named `assessment-objects` detailing the evidence items or subjects examined.
        * Optional child parts or prose detailing the test procedure.
  * **Then** `local-objective` structures strictly enforce part naming and property enum constraints.

---

#### US 5.10: Procedural Activities & Sequential Steps
> Implements [DD-008](../design_decisions/DD-008_unified_control_detail_editor.md) and [DD-013](../design_decisions/DD-013_universal_prose_with_params_integration.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** define reusable assessment `activities` with sequential `steps`, related controls, and responsible roles,  
> **so that** execution instructions can be mapped to scheduled assessment tasks.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 4 in the Activities section,
  * **When** Bob creates an activity in `local-definitions.activities[]`:
    * Each activity requires `uuid` and `description`, with optional `title`.
    * **Activity Method Property:** Each activity can include a property `name: "method"` with value `INTERVIEW`, `EXAMINE`, or `TEST`.
    * **Related Controls (`related-controls`):** Bob can link the activity to specific reviewed controls via `control-selections`.
    * **Responsible Roles (`responsible-roles[]`):** Bob can designate which assessor roles execute this activity.
    * **Sequential Steps (`steps[]`):**
      * Bob can add ordered steps, each requiring `uuid` and `description`, with optional `title`, `reviewed-controls`, and `responsible-roles`.
      * Steps can be reordered via drag-and-drop or move buttons.
  * **Then** defined activities are ready for linking to tasks in Tab 5.

---

### Tab 5: Tasks & Timeline

#### US 5.11: Task Scheduling, Types, and Timing Variants
> Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** create assessment `tasks` with explicit types (`milestone`, `action`) and flexible timing conditions (`on-date`, `within-date-range`, `at-frequency`),  
> **so that** the entire assessment workflow is scheduled with precise execution windows.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 5 (Tasks & Timeline),
  * **When** Bob adds or edits a task in `tasks[]`:
    * Each task requires `uuid` (auto-generated), `title` (required string), and `type` (required enum: `milestone` | `action`).
    * An optional `description` can be provided.
    * **Timing Configuration (`timing`):** Bob can choose exactly one of three timing modes:
      1. **On Date (`on-date`):** Requires a single ISO 8601 date-time string (`date`, e.g., `2026-10-15T09:00:00Z`).
      2. **Date Range (`within-date-range`):** Requires `start` and `end` ISO 8601 date-time strings (validating that `start <= end`).
      3. **Recurring Frequency (`at-frequency`):** Requires `period` (positive integer) and `unit` (enum: `seconds`, `minutes`, `hours`, `days`, `months`, `years`).
    * **Responsible Roles (`responsible-roles[]`):** Bob can assign responsible assessor roles (e.g., `lead-assessor`, `pen-tester`).
    * **Task Nesting (`tasks[]`):** Tasks can contain sub-tasks to model sub-phases of an assessment.
  * **Then** the task timing is serialized into the exact corresponding schema object and validated.

---

#### US 5.12: Task Dependency Graph (`depends-on`) & Cycle Detection
> Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** define task dependencies (`dependencies[].task-uuid`) and have the system validate the Directed Acyclic Graph (DAG) for cycles,  
> **so that** prerequisite milestones and execution ordering are strictly enforced without deadlock.

* **Acceptance Criteria:**
  * **Given** Bob is configuring task dependencies on Tab 5,
  * **When** Bob adds a dependency to `tasks[i].dependencies[]`:
    * The UI dropdown lists all other declared tasks by title and UUID.
    * A task cannot declare a dependency on itself.
    * **Cycle Detection Engine (Kahn's Algorithm / DFS):** If Bob attempts to create a circular dependency (e.g., Task A → Task B → Task C → Task A), the UI immediately displays a validation error: `"Circular dependency detected: Task A -> Task B -> Task C -> Task A"` and prevents saving the invalid dependency.
    * The backend semantic validator (`_validate_ap_integrity` in `validation.py`) independently verifies the task DAG and rejects circular dependencies with HTTP 422.
  * **Then** only valid, acyclic dependency graphs are persisted.

---

#### US 5.12b: Interactive Task Timeline / Gantt & Milestone Visualization
> Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** view an interactive horizontal timeline / Gantt chart of all assessment tasks and milestones,  
> **so that** I can easily inspect the execution sequence, identify critical paths, and spot scheduling bottlenecks.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 5,
  * **When** Bob switches to the "Timeline View":
    * The UI renders an interactive Gantt chart:
      * **Milestones (`type: "milestone"`):** Rendered as distinct diamond markers positioned at their `on-date` or range end date.
      * **Actions (`type: "action"`):** Rendered as horizontal bars spanning from `start` to `end` date.
      * **Dependencies:** Rendered as visual connector lines/arrows connecting prerequisite tasks to dependent tasks.
      * **Frequency Badges:** Tasks with `at-frequency` display a recurring indicator icon with period details.
    * Hovering over any task bar or milestone reveals a tooltip with task title, assigned roles, linked activities, and timing details.
    * Clicking any task in the timeline highlights the task in the editor list.
  * **Then** the timeline updates in real time as task dates and dependencies are adjusted.

---

#### US 5.19: Task-Activity-Subject Triangulation (`associated-activities`, `subjects`)
> Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** link activities and specific target subjects to scheduled tasks via `associated-activities` and `subjects`,  
> **so that** every task defines exactly what procedure is executed against which system element.

* **Acceptance Criteria:**
  * **Given** Bob is editing a task on Tab 5,
  * **When** Bob configures `associated-activities[]`:
    * Bob selects an `activity-uuid` (required, referencing an activity in `local-definitions.activities`).
    * Bob specifies `subjects[]` (required 1..*, `assessment-subject` items with `type` and `include-subjects` / `include-all`) indicating which components, servers, or users this activity is executed against during this task.
    * Optional `responsible-roles` can override or specify activity executors for this task execution.
  * **When** Bob configures task-level `subjects[]`:
    * Bob specifies target subjects directly bound to the overall task.
  * **Then** the task-activity-subject associations satisfy OSCAL AP referential integrity requirements.

---

### Tab 6: Terms & Conditions & Attachments

#### US 5.13: Terms & Conditions with 7 Canonical Part Types
> Implements [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** define `terms-and-conditions` using the 7 standardized OSCAL part types and structured items,  
> **so that** rules of engagement, testing boundaries, disclosures, and methodologies are formally established and agreed upon.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 6 (Terms & Conditions & Attachments),
  * **When** Bob manages `terms-and-conditions.parts[]` (required 1..* if terms are enabled):
    * The UI provides a structured selector restricted to the **7 canonical OSCAL AP part types**:
      1. `rules-of-engagement`: Testing authorization, escalation contacts, operational restrictions.
      2. `disclosures`: Responsible vulnerability disclosure rules and reporting timelines (supports child `item` parts).
      3. `assessment-inclusions`: Mandatory inclusion parameters and required test depths.
      4. `assessment-exclusions`: Prohibited actions (e.g., DoS attacks, physical penetration, production disruption).
      5. `results-delivery`: Report formatting, delivery mechanisms, and encryption requirements.
      6. `assumptions`: Key technical or administrative assumptions (supports child `item` parts).
      7. `methodology`: Overall assessment methodology references (e.g., FedRAMP SAP Guidelines, NIST SP 800-53A).
    * For each part: Bob can provide `prose` (Markdown supported), optional `title`, `props`, and child `parts[]` (e.g., individual `item` clauses).
  * **Then** all parts strictly use the allowed 7 part names and pass schema validation.

---

#### US 5.17: Back-Matter Resource Attachments & Base64 Payloads
> Implements [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** upload and embed supporting documents (signed Rules of Engagement PDFs, scan configuration files, authorization memos) into `back-matter.resources[]`,  
> **so that** all audit artifacts are self-contained within the Assessment Plan file.

* **Acceptance Criteria:**
  * **Given** Bob is on Tab 6 in the Back-Matter Attachments section,
  * **When** Bob uploads a file (PDF, YAML, JSON, TXT, PNG):
    * The client-side `FileReader` encodes the binary file into a Base64 string.
    * A new resource is created in `back-matter.resources[]` with:
      * `uuid`: auto-generated RFC 4122 v4 UUID.
      * `title`: user-supplied or file name.
      * `description`: optional remarks.
      * `rlinks`: `[{ "href": "#" + uuid, "media-type": file.type }]`.
      * `base64`: `{ "filename": file.name, "media-type": file.type, "value": "<base64-encoded-string>" }`.
    * Bob can download, preview (for supported formats), or delete attached resources.
    * Internal references across the AP (e.g. in links or terms) can target `#resource-uuid`.
  * **Then** the attachment is embedded directly into the OSCAL JSON payload without requiring external storage.

---

### Cross-Cutting & Global Capabilities

#### US 5.12c: AP Completeness & Referential Integrity Pre-flight Validation
> Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md) and [DD-037](../design_decisions/DD-037_assessment_plan_architecture_and_scoping_model.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** execute a pre-flight validation check on the Assessment Plan,  
> **so that** schema compliance, referential integrity, and scoping coverage issues are flagged with actionable links before export.

* **Acceptance Criteria:**
  * **Given** Bob clicks the "Validate AP" button in the top bar,
  * **When** the validation engine evaluates the document:
    * **L1 Schema Validation:** Validates against `oscal_assessment-plan_schema.json` (checking required fields `uuid`, `metadata`, `import-ssp`, `reviewed-controls`, minItems, additionalProperties).
    * **L2 Referential Integrity Validation (`_validate_ap_integrity`):**
      * Verifies `import-ssp.href` is non-empty.
      * Verifies every `associated-activities[].activity-uuid` points to a valid activity in `local-definitions.activities`.
      * Verifies every `dependencies[].task-uuid` points to an existing task and no DAG cycles exist.
      * Verifies every `uses-components[].component-uuid` in platforms references a valid component in `assessment-assets` or `local-definitions`.
      * Verifies every `select-subject-by-id` references a resolvable entity.
    * **L3 Audit Completeness Warnings:**
      * Flags any in-scope control that lacks an entry in `local-definitions.objectives-and-methods`.
      * Flags any task without scheduled timing or assigned roles.
    * The UI displays a structured **Pre-Flight Validation Drawer** listing Errors, Warnings, and Info badges with direct deep-links to the offending tab and field.
  * **Then** Bob can resolve all validation findings directly within the editor.

---

#### US 5.15: In-Place Editing, Tab Switching & Draft Persistence
> Implements [US 0.17](step0_global_requirements.md), [DD-004](../design_decisions/DD-004_editor_ux_patterns.md), and [DD-029](../design_decisions/DD-029_document_actions_pattern.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** seamlessly switch between the 6 tabs, toggle between View and Edit modes, and benefit from client-side draft persistence and undo/redo,  
> **so that** I can draft complex assessment plans without risking data loss.

* **Acceptance Criteria:**
  * **Given** Bob is editing an Assessment Plan,
  * **When** Bob switches between the 6 tabs:
    * Document state is preserved across tab transitions in the centralized React state.
    * In-memory changes are tracked in the undo/redo history stack (`Ctrl+Z` / `Ctrl+Y`).
    * Unsaved changes are persisted via backend draft auto-save (`<uuid>_draft.json`, 30s interval when dirty) in accordance with DD-004 to prevent accidental data loss on refresh.
    * Bob can toggle between "View Mode" (clean, formatted audit report layout) and "Edit Mode" (interactive form builders) at any time.
  * **Then** state transitions remain responsive and preserve all nested assemblies.

---

#### US 5.16: Immutable Backend Document Actions & Versioning
> Implements [US 0.15](step0_global_requirements.md), [DD-028](../design_decisions/DD-028_backend_resolution_engine.md), and [DD-029](../design_decisions/DD-029_document_actions_pattern.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** save the Assessment Plan to the backend with optimistic locking and automatic version history tracking without UUID regeneration,  
> **so that** all scope negotiations and audit plan revisions maintain an auditable provenance trail.

* **Acceptance Criteria:**
  * **Given** Bob saves an Assessment Plan via the Save button or `Ctrl+S`,
  * **When** the frontend sends `PUT /api/documents/assessment-plans/{id}`:
    * All mutations are executed via pure Immer action reducers in `assessment-plan-actions.ts`.
    * The backend validates the document, purges empty optional arrays (DD-014), updates `metadata.last-modified`, and creates a Git commit in the workspace version store.
    * The document `uuid` remains strictly stable across all saves.
    * Bob can view previous document revisions and diffs via the Document History drawer.
  * **Then** the saved Assessment Plan is reliably stored and verifiable.

---

#### US 5.18: Multi-Format Export (JSON, YAML, XML) & Schema Validation
> Implements [US 0.4](step0_global_requirements.md) and [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).  
> **As a** Lead Assessor (Bob)  
> **I want to** export the completed Assessment Plan in JSON, YAML, or XML format via the Export dialog,  
> **so that** I can distribute the official assessment plan to authorizing officials, testing teams, and automated compliance runners.

* **Acceptance Criteria:**
  * **Given** Bob is on the Assessment Plan editor or overview page,
  * **When** Bob clicks "Export":
    * An Export modal opens allowing format selection: OSCAL JSON, OSCAL YAML, or OSCAL XML.
    * The system validates the document prior to serialization.
    * The exported file strictly adheres to official NIST OSCAL schema definitions and downloads cleanly.
  * **Then** external OSCAL tools can ingest the exported assessment plan without syntax or schema errors.

---

## 3. Traceability Matrix (User Stories ↔ 6-Tab Architecture ↔ Design Decisions)

| User Story | Title | Builder Tab | Key OSCAL AP Elements | Design Decision |
|---|---|---|---|---|
| **US 5.1** | AP Document Creation & Initial Shell | Tab 1: Overview & Metadata | `assessment-plan` (`uuid`, `metadata`, `import-ssp`, `reviewed-controls`) | DD-001, DD-037 |
| **US 5.2** | Target SSP Import & Context Resolution | Tab 1: Overview & Metadata | `import-ssp` (`href`, `remarks`) | DD-016, DD-037 |
| **US 5.14** | Document Metadata, Parties & Tagging | Tab 1: Overview & Metadata | `metadata` (`roles`, `parties`, `responsible-parties`, `props`, `revisions`) | DD-001, DD-037 |
| **US 5.3** | Reviewed Controls & Control Selections | Tab 2: Reviewed Controls & Scope | `reviewed-controls.control-selections` (`include-all`, `include-controls`, `exclude-controls`, `statement-ids`) | DD-030, DD-037 |
| **US 5.4** | Control Objective Selections | Tab 2: Reviewed Controls & Scope | `reviewed-controls.control-objective-selections` (`include-objectives`, `exclude-objectives`) | DD-030, DD-037 |
| **US 5.5** | Scoping Gap Analysis & Summary | Tab 2: Reviewed Controls & Scope | Live resolution comparison widget | DD-028, DD-037 |
| **US 5.6** | Assessment Subjects & Scope Definition | Tab 3: Assessment Subjects & Assets | `assessment-subjects` (`type`, `include-subjects`, `assessment-subject-placeholder`) | DD-017, DD-037 |
| **US 5.7** | Assessment Assets & Platforms | Tab 3: Assessment Subjects & Assets | `assessment-assets` (`components`, `assessment-platforms`, `uses-components`) | DD-037 |
| **US 5.8** | Local Components, Inventory & Users | Tab 4: Local Definitions & Methods | `local-definitions` (`components`, `inventory-items`, `users`) | DD-037 |
| **US 5.9** | Objectives & Evaluation Methods | Tab 4: Local Definitions & Methods | `local-definitions.objectives-and-methods` (`method: INTERVIEW\|EXAMINE\|TEST`) | DD-008, DD-037 |
| **US 5.10** | Procedural Activities & Steps | Tab 4: Local Definitions & Methods | `local-definitions.activities` (`steps`, `related-controls`, `responsible-roles`) | DD-008, DD-037 |
| **US 5.11** | Task Scheduling, Types & Timing | Tab 5: Tasks & Timeline | `tasks` (`type: milestone\|action`, `timing: on-date\|within-date-range\|at-frequency`) | DD-037 |
| **US 5.12** | Task Dependency DAG & Cycle Detection | Tab 5: Tasks & Timeline | `tasks.dependencies` (`task-uuid`, topological sort, acyclic validation) | DD-002, DD-037 |
| **US 5.12b**| Interactive Task Timeline / Gantt | Tab 5: Tasks & Timeline | Visual Gantt chart rendering milestones and dependency links | DD-037 |
| **US 5.19** | Task-Activity-Subject Triangulation | Tab 5: Tasks & Timeline | `tasks.associated-activities` (`activity-uuid`, `subjects`) | DD-037 |
| **US 5.13** | Terms & Conditions (7 Canonical Parts) | Tab 6: Terms & Conditions & Attachments | `terms-and-conditions.parts` (`rules-of-engagement`, `methodology`, etc.) | DD-037 |
| **US 5.17** | Back-Matter Base64 Resource Attachments | Tab 6: Terms & Conditions & Attachments | `back-matter.resources` (`base64: { value, media-type, filename }`) | DD-007, DD-037 |
| **US 5.12c**| AP Pre-Flight Completeness Validation | Global / Header | L1 Schema + L2 Referential Integrity + L3 Completeness Checks | DD-002, DD-037 |
| **US 5.15** | In-Place Editing, Tabs & Persistence | Global / Editor Shell | Centralized React state, `useDocumentActions`, undo/redo, draft cache | DD-004, DD-029 |
| **US 5.16** | Immutable Backend Actions & Versioning | Global / Persistence | Immer action reducers, optimistic locking, Git workspace commits | DD-015, DD-029 |
| **US 5.18** | Multi-Format Export (JSON, YAML, XML) | Global / Header | Export modal, format serializers, schema verification | DD-002 |
