# Step 5: Detailed User Stories – Assessment Plan Builder

* **Persona:** Bob (Lead Assessor / Compliance Auditor)
* **Goal:** Create a comprehensive `assessment-plan` document that defines the scope, timeline, tasks, and methodologies for evaluating an information system's security controls, referencing an imported System Security Plan (SSP).

## 1. Breakdown of User Stories

### US 5.1: AP Document Creation & Inner View (US 0.14)
> **As a** Lead Assessor
> **I want to** create and view an `assessment-plan` document (US 0.14)
> **so that** I have a foundational workspace to outline the assessment strategy.

### US 5.2: SSP Import & System Context Resolution
> **As a** Lead Assessor
> **I want to** define an `import-ssp` linkage
> **so that** my assessment plan clearly references the target system documentation and scope.

### US 5.3: Local Definitions — Components, Inventory & Users
> **As a** Lead Assessor
> **I want to** define assessment-specific `components`, `inventory-items`, and `users` within `local-definitions`
> **so that** I can track temporary tools or specific individuals uniquely involved in the assessment but not in the SSP.

### US 5.4: Assessment Objectives & Methods
> **As a** Lead Assessor
> **I want to** define `objectives-and-methods` within `local-definitions`
> **so that** I can outline how specific controls will be evaluated using standard assessment methods (INTERVIEW, EXAMINE, TEST).

### US 5.5: Assessment Activities & Procedural Steps
> **As a** Lead Assessor
> **I want to** define assessment `activities` and their procedural `steps` within `local-definitions`
> **so that** I can provide exact instructions on what actions assessors must perform.

### US 5.6: Reviewed Controls & Control Selections
> **As a** Lead Assessor
> **I want to** define `reviewed-controls` and `control-selections`
> **so that** I explicitly declare the boundaries of the assessment by including or excluding specific controls and control statements.

### US 5.7: Control Objective Selections
> **As a** Lead Assessor
> **I want to** specify `control-objective-selections`
> **so that** I can narrow down or comprehensively select the control objectives being evaluated.

### US 5.8: Assessment Subjects & Scope Definition
> **As a** Lead Assessor
> **I want to** manage `assessment-subjects`
> **so that** I can detail exactly which components, locations, inventory items, parties, or users are in scope for the assessment.

### US 5.9: Assessment Assets & Platforms
> **As a** Lead Assessor
> **I want to** configure `assessment-assets` and `assessment-platforms`
> **so that** the specialized tools or environments the assessment team uses are officially documented and authorized.

### US 5.10: Task Scheduling & Dependencies
> **As a** Lead Assessor
> **I want to** schedule `tasks` with defined timing, dependencies, and assigned roles
> **so that** the entire assessment team knows what milestones or actions occur and in what sequence.

### US 5.11: Terms & Conditions
> **As a** Lead Assessor
> **I want to** define `terms-and-conditions` using standardized part types
> **so that** rules of engagement, disclosures, and assessment methodology are clearly communicated and agreed upon.

### US 5.12: Assessment Plan Completeness Validation
> **As a** Lead Assessor (Bob)
> **I want to** run a pre-flight completeness check on the Assessment Plan before starting assessment execution
> **so that** I can verify all reviewed controls have corresponding assessment objectives, all tasks have assigned activities, and all assessment subjects are resolvable.

### US 5.12b: Assessment Task Timeline Visualization
> **As a** Lead Assessor (Bob)
> **I want to** see a visual timeline of all assessment tasks showing scheduling, dependencies, and milestones
> **so that** I can plan the assessment execution efficiently and identify scheduling conflicts.

### US 5.13: AP Table & Navigation (US 0.18)
> **As a** Lead Assessor
> **I want to** navigate the complex Assessment Plan via a structured table (US 0.18)
> **so that** I can easily jump between tasks, local definitions, and control scopes without losing context.

### US 5.14: Document Overview & Tags (US 0.16)
> **As a** Lead Assessor
> **I want to** view a Document Overview and assign tags (US 0.16)
> **so that** metadata, statuses, and high-level assessment parameters are easily identifiable.

### US 5.15: In-Card Editing & Draft Persistence (US 0.17)
> **As a** Lead Assessor
> **I want to** use In-Card Editing with Draft Persistence (US 0.17)
> **so that** I can iteratively flesh out complex tasks or assessment procedures without risking data loss.

### US 5.16: Integrated Backend Versioning (US 0.15)
> **As a** Lead Assessor
> **I want to** rely on Integrated Backend Versioning (US 0.15)
> **so that** changes to the assessment scope or methodology can be tracked and rolled back if negotiations change.

### US 5.17: Back-Matter & Resource Attachments
> **As a** Lead Assessor
> **I want to** attach supporting documentation in `back-matter`
> **so that** external references, methodology PDFs, or approval artifacts are preserved within the assessment plan itself.

## 2. Workflow & User Journey

1. **Initialization:** Bob logs into the platform, initiates a new `assessment-plan` document, and sets the base `metadata` (US 5.1).
2. **System Context Import:** Bob immediately uses the `import-ssp` section to link the target System Security Plan via an `href` URI reference (US 5.2).
3. **Local Definitions Generation:** Knowing the assessment requires specific penetration testing tools not in the SSP, Bob adds these under `local-definitions` as `components` and `inventory-items` (US 5.3).
4. **Methodology Configuration:** Bob defines `objectives-and-methods` for the controls in scope, strictly categorizing them by method types like `INTERVIEW` or `TEST` (US 5.4).
5. **Activity Mapping:** He details the actual `activities` and sequential `steps` assessors will follow during the engagement (US 5.5).
6. **Control Scoping:** Bob configures the `reviewed-controls` (a required element), specifying `include-controls` to detail exactly which `control-id` and `statement-ids` are being assessed (US 5.6).
7. **Objective Scoping:** He further refines the scope by applying `control-objective-selections` (US 5.7).
8. **Subject Identification:** Using `assessment-subjects`, Bob flags specific subject types (`component`, `location`, `party`, `user`, `inventory-item`) to be audited (US 5.8).
9. **Asset & Platform Definition:** Bob establishes the `assessment-assets`, defining the `assessment-platforms` and the `uses-components` associations mapping to his testing laptops (US 5.9).
10. **Task Scheduling:** He creates `tasks` marked as `milestone` and `action`, setting their `timing` parameters (e.g., `within-date-range`), mapping them to `associated-activities`, and defining `dependencies` (US 5.10).
11. **Terms Formalization:** Bob fills out `terms-and-conditions`, explicitly detailing the `rules-of-engagement` and mandated `assessment-inclusions` (US 5.11).
12. **Completeness Validation:** Bob runs the pre-flight completeness check to ensure all references are valid and scope is fully mapped (US 5.12).
13. **Timeline Visualization:** Bob checks the assessment task timeline to review milestones and scheduling dependencies (US 5.12b).
14. **Navigation & Verification:** Using the Assessment Plan table, Bob navigates through tasks and scoped items to verify completeness (US 5.13).
15. **Metadata & Overview:** He reviews the Document Overview, assigning relevant tags and confirming core metadata elements (US 5.14).
16. **Iterative Drafting:** While finalizing the rules of engagement, Bob utilizes In-Card Editing to save drafts before publishing the final methodology (US 5.15).
17. **Versioning:** The backend tracks all commits, allowing Bob to maintain an audit trail of scope adjustments (US 5.16).
18. **Finalizing Attachments:** Bob embeds signed authorization memos into the `back-matter` (US 5.17), concluding the Assessment Plan creation.

## 3. Functional Requirements

- **Strict Schema Compliance**: The resulting Assessment Plan strictly adheres to the OSCAL `assessment-plan` metaschema (v1.2.2).
- **Enforced Required Fields**: Critical fields like `uuid`, `import-ssp`, `reviewed-controls`, and `metadata` cannot be bypassed.
- **Accurate Enum Validation**: Fields such as assessment `method` (INTERVIEW, EXAMINE, TEST), task `type` (milestone, action), and task `timing` units are heavily restricted to allowed values.
- **Complex Scoping Mechanics**: Deep inclusion/exclusion logic (`include-all` vs explicit identifiers) is fully supported for controls, objectives, and subjects.
- **Methodology & Rules Integrity**: Assessment procedures, parts logic, and Terms & Conditions precisely map to the 7 allowed naming conventions dictated by OSCAL.

## 4. Functional Acceptance Criteria

- [ ] **US 5.1: AP Document Creation & Inner View (US 0.14)**
  - [ ] **Root Initialization**: The system MUST generate a valid `assessment-plan` root object with a globally unique, auto-generated `uuid` (required).
  - [ ] **Metadata Constraint**: The system MUST enforce the creation of exactly one `metadata` object (required 1..1) compliant with OSCAL standards.
  - [ ] **Validation Layer**: The document MUST be validated against the OSCAL metaschema for `assessment-plan` upon save (DD-002).

- [ ] **US 5.2: SSP Import & System Context Resolution**
  - [ ] **Mandatory Linkage**: The UI MUST enforce the presence of exactly one `import-ssp` object (required 1..1).
  - [ ] **Reference Capture**: The `import-ssp` MUST capture an `href` (required, `uri-reference`) pointing to the target SSP (DD-016).
  - [ ] **Remarks Support**: The editor MUST allow an optional `remarks` field for the `import-ssp` linkage.

- [ ] **US 5.3: Local Definitions — Components, Inventory & Users**
  - [ ] **Optional Section**: The system MUST support an optional `local-definitions` block (0..1).
  - [ ] **Component Definition**: Within `local-definitions`, users MUST be able to define `components` (0..*, `system-component` format).
  - [ ] **Inventory & User Definition**: The system MUST support defining `inventory-items` (0..*) and `users` (0..*).
  - [ ] **Uniqueness Constraint**: Every component, inventory-item, and user defined locally MUST have a unique `uuid`.

- [ ] **US 5.4: Assessment Objectives & Methods**
  - [ ] **Objective Blocks**: Within `local-definitions`, the UI MUST allow creating `objectives-and-methods` (0..*, `local-objective`) using the Unified Control Detail Editor (DD-008) and ProseWithParams (DD-013).
  - [ ] **Control ID Mapping**: Each `local-objective` MUST include a `control-id` (required, token).
  - [ ] **Part Constraints**: The `local-objective` MUST have `parts` (required 1..*, `assessment-part`).
  - [ ] **Allowed Part Names**: The UI MUST restrict part names to `assessment-objective` (maximum 1) and `assessment-method`.
  - [ ] **Method Enforcement**: An `assessment-method` part MUST contain exactly 1 property named `method`, restricted to the values: `INTERVIEW`, `EXAMINE`, `TEST`.
  - [ ] **Objects Enforcement**: An `assessment-method` part MUST contain exactly 1 child part named `assessment-objects`.
  - [ ] **Objective Enforcement**: An `assessment-objective` part MUST contain at least 1 property named `method-id`.

- [ ] **US 5.5: Assessment Activities & Procedural Steps**
  - [ ] **Activity Generation**: The system MUST support defining `activities` (0..*) within `local-definitions` utilizing the Unified Control Detail Editor (DD-008) and ProseWithParams (DD-013).
  - [ ] **Activity Requirements**: Each activity MUST have a `uuid` (required) and a `description` (required), along with an optional `title`.
  - [ ] **Step Sequencing**: Activities MUST support nested `steps` (0..*), each requiring a `uuid`, and `description`, and allowing optional `title`, `reviewed-controls`, and `responsible-roles`.
  - [ ] **Method Prop**: Each activity MUST have at least 1 property named `method` with allowed values: `INTERVIEW`, `EXAMINE`, `TEST`.
  - [ ] **Control Relation**: The UI MUST allow linking an activity to `related-controls` (0..1, `reviewed-controls`).

- [ ] **US 5.6: Reviewed Controls & Control Selections**
  - [ ] **Mandatory Block**: The system MUST require exactly one `reviewed-controls` block (required 1..1) at the root level.
  - [ ] **Selection Strategy**: The UI MUST require 1..* `control-selections`.
  - [ ] **Inclusion Choice**: The system MUST enforce a choice between `include-all` (boolean/empty) OR `include-controls` (1..*, `select-control-by-id`).
  - [ ] **Granular Inclusion**: When using `include-controls`, the UI MUST capture the `control-id` and optional `statement-ids`.
  - [ ] **Exclusion Support**: The system MUST allow optional `exclude-controls` (0..*, `select-control-by-id`).
  - [ ] **SSP Auto-Population (DD-016):** Upon resolving the imported SSP, the system SHOULD offer to auto-populate `control-selections` from the SSP's `control-implementation.implemented-requirements[].control-id` list, pre-selecting all implemented controls as reviewed candidates.

- [ ] **US 5.7: Control Objective Selections**
  - [ ] **Objective Scoping**: The system MUST support optional `control-objective-selections` (0..*) within `reviewed-controls`.
  - [ ] **Objective Inclusion Choice**: The UI MUST enforce a choice between `include-all` OR `include-objectives` (1..*, `select-objective-by-id` requiring `objective-id`).
  - [ ] **Objective Exclusion**: The system MUST allow optional `exclude-objectives` (0..*, `select-objective-by-id`).

- [ ] **US 5.8: Assessment Subjects & Scope Definition**
  - [ ] **Subject Blocks**: The UI MUST support adding `assessment-subjects` (0..*).
  - [ ] **Subject Types**: Each subject MUST define a `type` (required, token) restricted to: `component`, `inventory-item`, `location`, `party`, `user` (or `allow-other` custom values).
  - [ ] **Subject Inclusion Choice**: The system MUST enforce a choice between `include-all` OR `include-subjects` (1..*, `select-subject-by-id` requiring `subject-uuid` and `type`).
  - [ ] **Subject Exclusion**: The system MUST allow `exclude-subjects` (0..*, `select-subject-by-id`).

- [ ] **US 5.9: Assessment Assets & Platforms**
  - [ ] **Assets Block**: The system MUST support an optional `assessment-assets` (0..1) block.
  - [ ] **Asset Components**: The UI MUST allow defining `components` (0..*) directly under assets.
  - [ ] **Platform Definition**: The system MUST support `assessment-platforms` (required 1..* if assets are defined), requiring a `uuid` and allowing an optional `title`.
  - [ ] **Component Usage**: Each platform MUST support `uses-components` (0..*), mapping to a `component-uuid` and detailing `responsible-parties`.

- [ ] **US 5.10: Task Scheduling & Dependencies**
  - [ ] **Task Creation**: The UI MUST allow creating `tasks` (0..*) with a `uuid` (required) and `title` (required).
  - [ ] **Task Types**: The `type` MUST be defined (required) and restricted to: `milestone` or `action`.
  - [ ] **Timing Choice**: The system MUST allow an optional `timing` block (0..1) presenting a choice of: `on-date` (requires date), `within-date-range` (requires start and end dates), or `at-frequency`.
  - [ ] **Frequency Validation**: If `at-frequency` is chosen, the UI MUST enforce a `period` (positive-integer) and a `unit` restricted to: `seconds`, `minutes`, `hours`, `days`, `months`, `years`.
  - [ ] **Dependencies & Nesting**: Tasks MUST support `dependencies` (0..*, requiring `task-uuid`) and nested sub-`tasks` (0..*).
  - [ ] **Activity Association**: Tasks MUST support `associated-activities` (0..*), requiring an `activity-uuid` and at least one `subjects` mapping (required 1..*).

- [ ] **US 5.11: Terms & Conditions**
  - [ ] **Terms Block**: The system MUST support an optional `terms-and-conditions` block (0..1).
  - [ ] **Terms Parts**: The UI MUST require `parts` (required 1..*, `assessment-part`) if terms are defined.
  - [ ] **Allowed Part Names Enforcement**: The system MUST restrict part names to exactly these 7 types: `rules-of-engagement`, `disclosures`, `assessment-inclusions`, `assessment-exclusions`, `results-delivery`, `assumptions`, `methodology`.
  - [ ] **Child Part Constraints**: If `disclosures` or `assumptions` are used, the UI MUST support child parts named `item`.

- [ ] **US 5.12: Assessment Plan Completeness Validation**
  - [ ] **Objective Coverage Check:** The system MUST verify that every `control-id` in `reviewed-controls.control-selections` has a corresponding `objectives-and-methods` entry in `local-definitions`. Missing objectives MUST be flagged as warnings (DD-002).
  - [ ] **Task-Activity Linkage Check:** The system MUST verify that every task with `associated-activities` references a valid `activity.uuid` in `local-definitions.activities` (DD-002).
  - [ ] **Subject Resolution Check:** The system MUST verify that every `include-subjects` entry references a valid component, inventory-item, location, party, or user in the imported SSP or local-definitions (DD-002).
  - [ ] **Completeness Report:** The system MUST display a structured report listing all validation results (pass/warn/fail) with actionable navigation links to the relevant sections.

- [ ] **US 5.12b: Assessment Task Timeline Visualization**
  - [ ] **Timeline Rendering:** The system SHOULD render tasks on a horizontal timeline based on their `timing` configuration (`on-date`, `within-date-range`, `at-frequency`).
  - [ ] **Dependency Arrows:** Tasks with `dependencies[].task-uuid` SHOULD be connected with visual arrows showing execution order.
  - [ ] **Milestone Markers:** Tasks with `type="milestone"` SHOULD be rendered as diamond markers on the timeline.
  - [ ] **Action Bars:** Tasks with `type="action"` SHOULD be rendered as horizontal bars spanning their date range.

- [ ] **US 5.13: AP Table & Navigation (US 0.18)**
  - [ ] **Structural Navigation**: The UI MUST render a persistent navigation table allowing quick access to `local-definitions`, `reviewed-controls`, `tasks`, and `terms-and-conditions`.
  - [ ] **Deep Linking**: Clicking an item in the navigation MUST scroll to and expand the relevant Assessment Plan section.

- [ ] **US 5.14: Document Overview & Tags (US 0.16)**
  - [ ] **Metadata Display**: The system MUST display a Document Overview summarizing the AP `metadata` and current `tasks` schedule.
  - [ ] **Tagging System**: The UI MUST allow adding standard tags via `props` on the root `assessment-plan`.

- [ ] **US 5.15: In-Card Editing & Draft Persistence (US 0.17)**
  - [ ] **Unified Editor**: The platform MUST utilize the Unified Control Detail Editor (DD-008) for managing `local-objective` and `activity` data.
  - [ ] **Auto-save**: The system MUST save incomplete drafts of `tasks` or `steps` locally to prevent data loss (DD-004).

- [ ] **US 5.16: Integrated Backend Versioning (US 0.15)**
  - [ ] **Commit Tracking**: Every modification to the `assessment-plan` MUST be logged in the backend Git repository (DD-002).
  - [ ] **Diff Viewing**: The UI MUST provide a mechanism to view changes (e.g., modified task dates or scope inclusions) between document versions.

- [ ] **US 5.17: Back-Matter & Resource Attachments**
  - [ ] **Resource Integration**: The system MUST support an optional `back-matter` (0..1) block.
  - [ ] **Base64 Embeds**: Artifacts (like signed Rules of Engagement PDFs) MUST be stored as Base64 encoded strings within `back-matter` resources (DD-007).

