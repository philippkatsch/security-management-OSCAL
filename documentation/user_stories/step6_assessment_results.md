# Step 6: Detailed User Stories – Assessment Results Reporter

* **Persona:** Bob (Lead Assessor) & automated testing tools
* **Goal:** Document the findings, observations, and risks identified during an assessment into an OSCAL Assessment Results (`assessment-results`) document, linking back to the `import-ap` and providing actionable insights.

## 1. Breakdown of User Stories

### US 6.1: AR Document Creation & Inner View (US 0.14) (DD-002)
> **As a** Lead Assessor
> **I want to** create a new Assessment Results (`assessment-results`) document and view its metadata
> **so that** I can begin compiling the results of my assessment execution.

### US 6.2: Assessment Plan Import & Scope Resolution (DD-016)
> **As a** Lead Assessor
> **I want to** link the Assessment Results to a governing Assessment Plan via `import-ap`
> **so that** the findings are evaluated against the correct scope, plan, and control objectives.

### US 6.3: Result Set Declaration
> **As a** Lead Assessor
> **I want to** define a specific `result` set within the Assessment Results, including `uuid`, `title`, `description`, `start`, and `end` timestamps
> **so that** I can group findings from a specific timeframe or testing phase.

### US 6.4: Result-Level Local Definitions
> **As a** Lead Assessor
> **I want to** define `local-definitions` at the `result` level, including `components`, `inventory-items`, `users`, `assessment-assets`, and `tasks`
> **so that** I can specify system elements or actors that were uniquely relevant to this result set.

### US 6.5: Assessment Log
> **As a** Lead Assessor
> **I want to** maintain an `assessment-log` containing `entries` with timestamps, `logged-by` references, and `related-tasks`
> **so that** there is a clear timeline of assessment activities and who performed them.

### US 6.6: Observations & Evidence Collection (DD-017)
> **As a** Lead Assessor
> **I want to** record `observations` capturing evidence, methods, types, subjects, and timestamps
> **so that** all objective evidence gathered during testing is systematically documented.

### US 6.7: Risk Identification & Characterization (DD-017, DD-018)
> **As a** Lead Assessor
> **I want to** log identified `risks` with status, characterization facets (like CVSS), mitigating factors, and deadlines
> **so that** the system owner understands the security posture implications of the findings.

### US 6.8: Risk Remediation Planning (DD-018)
> **As a** Lead Assessor
> **I want to** define `remediations` (responses) for risks, detailing their lifecycle and response strategy types
> **so that** actionable steps are documented to address the identified risks.

### US 6.9: Risk Log & Status Tracking (DD-018)
> **As a** Lead Assessor
> **I want to** update the `risk-log` with `entries` tracking status changes over time
> **so that** the risk history and resolution progression are auditable.

### US 6.10: Findings & Objective Status
> **As a** Lead Assessor
> **I want to** document `findings` targeting specific statement-ids or objective-ids and declaring their evaluation status (satisfied/not-satisfied)
> **so that** the final compliance posture of the system is clear.

### US 6.11: Attestation Statements
> **As a** Lead Assessor
> **I want to** provide `attestations` that declare the responsible parties and the assessment parts they are signing off on
> **so that** there is formal accountability for the assessment results.

### US 6.12: Multi-Result Comparison & Trend Analysis
> **As a** Lead Assessor
> **I want to** compare findings and risk statuses across multiple `result` sets within the same AR document
> **so that** I can track assessment trends over time and identify improvement or regression.

### US 6.13: AR Table & Navigation (US 0.18)
> **As a** Lead Assessor
> **I want to** use a table layout to navigate my multiple `assessment-results` documents
> **so that** I can easily find, sort, and filter through past and current assessment runs.

### US 6.14: Document Overview & Tags (US 0.16)
> **As a** Lead Assessor
> **I want to** view and manage metadata, including props, links, and remarks, in an overview panel
> **so that** the context and high-level tagging of the Assessment Results are accurate.

### US 6.15: In-Card Editing & Draft Persistence (US 0.17)
> **As a** Lead Assessor
> **I want to** edit assessment findings and risks incrementally and save them as drafts
> **so that** I do not lose progress during lengthy reporting sessions.

### US 6.16: Integrated Backend Versioning (US 0.15)
> **As a** Lead Assessor
> **I want to** rely on automatic backend versioning of my Assessment Results
> **so that** I can track changes and revert if necessary without manual version control.

### US 6.17: Back-Matter & Resource Attachments
> **As a** Lead Assessor
> **I want to** attach raw evidence, scans, or other files to the `back-matter` as Base64 strings
> **so that** the document is self-contained and includes all necessary supporting artifacts.


## 2. Workflow & User Journey

1. **Initialization:** The Assessor opens the Assessment Results module, creating a new `assessment-results` document.
2. **Context Setup:** The Assessor imports the relevant Assessment Plan using `import-ap` (`href` to the governing plan).
3. **Execution Phase Documentation:** A new `result` is created to encapsulate a testing session, setting the `start` time.
4. **Logging & Observations:** During testing, the Assessor uses the `assessment-log` to track actions, and records `observations` with their specific `methods` and collected evidence.
5. **Findings Generation:** The Assessor evaluates observations to determine `findings`. The target of the finding is defined (`statement-id` or `objective-id`), and a `status` (`satisfied` or `not-satisfied`) is assigned.
6. **Risk Analysis:** For `not-satisfied` findings, `risks` are created. The Assessor logs the `status`, assigns `characterizations` (e.g., CVSS vectors), and outlines `remediations`.
7. **Finalization:** The Assessor updates `risk-log` as needed, finalizes the `end` timestamp of the `result`, adds `attestations`, and attaches raw reports in the `back-matter`.


## 3. Functional Requirements

* **Core Requirement 1:** The system must implement the complete `assessment-results` model, ensuring a required 1..1 `metadata`, 1..1 `import-ap`, and 1..* `results` array.
* **Core Requirement 2:** The system must enforce OSCAL enums for observation `methods` and `types`, finding `status` and `reason`, and risk `status`, lifecycle phases, and response types.
* **Core Requirement 3:** The system must uniquely manage uuids for internal elements such as `components`, `users`, `observations`, `risks`, and `findings`.
* **Core Requirement 4:** Form fields must properly handle dates (`date-time-with-timezone`) for all `start`, `end`, `collected`, `expires`, and `deadline` properties.


## 4. Functional Acceptance Criteria (Summary)

- [ ] **US 6.1: AR Document Creation & Inner View (US 0.14) (DD-002)**
  - [ ] **Document Creation:** The system creates a new `assessment-results` document with a required `uuid`.
  - [ ] **Metadata Enforcement:** The system requires exactly one (`1..1`) `metadata` assembly.
  - [ ] **Base Assembly Structure:** The root document supports optional (`0..1`) `local-definitions` and optional (`0..1`) `back-matter`.
  - [ ] **Root-Level Local Definitions:** The root `assessment-results` document supports an optional (`0..1`) `local-definitions` assembly containing `objectives-and-methods` (`0..*`, local-objective with `control-id`, `assessment-part` parts) and `activities` (`0..*`, activity with `uuid`, `description`, `steps`, `related-controls`). These define assessment methodology reusable across all result sets.
  - [ ] **Validation:** The system validates the `assessment-results` structure against DD-002 upon creation.

- [ ] **US 6.2: Assessment Plan Import & Scope Resolution (DD-016)**
  - [ ] **Plan Linkage:** The user must define an `import-ap` assembly (required `1..1`).
  - [ ] **HREF Requirement:** The `import-ap` must contain an `href` (type: uri-reference) pointing to the governing Assessment Plan.
  - [ ] **Remarks:** The user can optionally add `remarks` to the `import-ap`.
  - [ ] **AP Context Injection (DD-016):** Upon resolving the imported AP, the system SHOULD extract the AP's `reviewed-controls`, `assessment-subjects`, `local-definitions.activities`, and `tasks` to pre-populate the first `result` set's `reviewed-controls` and provide activity/subject context for findings and observations.

- [ ] **US 6.3: Result Set Declaration**
  - [ ] **Result Array:** The system supports an array of `results` (required `1..*`).
  - [ ] **Result Identifiers:** Each `result` must have a required `uuid`, required `title` (markup-line), and required `description` (markup-multiline).
  - [ ] **Timestamps:** Each `result` must include a required `start` (`date-time-with-timezone`) and an optional `end` (`date-time-with-timezone`).
  - [ ] **Reviewed Controls:** Each `result` must contain a required (`1..1`) `reviewed-controls` assembly.

- [ ] **US 6.4: Result-Level Local Definitions**
  - [ ] **Result Local Definitions:** A `result` can have an optional (`0..1`) `local-definitions` assembly.
  - [ ] **Entity Arrays:** Users can define `components` (`0..*`), `inventory-items` (`0..*`), `users` (`0..*`), `assessment-assets` (`0..1`), and `tasks` (`0..*`).
  - [ ] **Uniqueness Constraint:** The system must enforce unique `uuid`s across all `components` and `users` defined in the local-definitions.

- [ ] **US 6.5: Assessment Log**
  - [ ] **Log Assembly:** A `result` can contain an optional (`0..1`) `assessment-log`.
  - [ ] **Log Entries:** The `assessment-log` must contain `entries` (required `1..*`).
  - [ ] **Entry Fields:** Each entry requires a `uuid`, `start` (`date-time-with-timezone`), and allows optional `title`, `description`, and `end`.
  - [ ] **Logged-By Detail:** Each log entry MAY reference `logged-by` (`0..*`) assemblies, each requiring `party-uuid` (required, uuid referencing a party in metadata) and optional `role-id` (token identifying the actor's role during the logged action).
  - [ ] **Linkages:** Entries can optionally reference `related-tasks` (`0..*`).

- [ ] **US 6.6: Observations & Evidence Collection (DD-017)**
  - [ ] **Observation Array:** A `result` can contain `observations` (`0..*`).
  - [ ] **Core Attributes:** Each observation requires a `uuid`, `description`, and allows an optional `title`.
  - [ ] **Method Enum:** Users must select `methods` (`1..*`) strictly from allowed values: `EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN` (allow-other).
  - [ ] **Type Enum:** Users can select `types` (`0..*`) from allowed values: `ssp-statement-issue`, `control-objective`, `mitigation`, `discovery`, `historic` (allow-other).
  - [ ] **Origin Actors:** Each `origin` (`0..*`) MUST contain `actors` (required `1..*`), where each actor defines `type` (required, token: `tool`, `assessment-platform`, `party`), `actor-uuid` (required, uuid referencing a component, platform, or party), and optional `role-id` (token).
  - [ ] **Associations:** Observations can link `subjects` (`0..*` with `subject-uuid` and `type`), and `relevant-evidence` (`0..*` with optional `href` and required `description`).
  - [ ] **Timestamps:** Observations must have a required `collected` date and an optional `expires` date (`date-time-with-timezone`).
  - [ ] **Batch Import:** The system SHOULD support bulk creation of observations from structured scan tool output (CSV/JSON import).

- [ ] **US 6.7: Risk Identification & Characterization (DD-017, DD-018)**
  - [ ] **Risk Array:** A `result` can contain `risks` (`0..*`) requiring a `uuid`, `title`, `description`, and `statement`.
  - [ ] **Status Enum:** Risk `status` is required and must be one of: `open`, `investigating`, `remediating`, `deviation-requested`, `deviation-approved`, `closed` (allow-other).
  - [ ] **Threat Definitions:** Users can provide `threat-ids` (`0..*`) requiring a system uri and id value, and optional href.
  - [ ] **Risk Characterization:** Users can define `characterizations` (`0..*`) requiring `origin` and `facets` (`1..*` with name, system URIs like CVSS/FedRAMP/CVE, and value).
  - [ ] **Mitigating Factors:** `mitigating-factors` (`0..*`) can be added with a `uuid`, required `description`, optional `implementation-uuid`, and subjects.
  - [ ] **Risk Props:** The system supports specific props: `false-positive`, `accepted`, `risk-adjusted`, and `priority` (integer).
  - [ ] **Deadline:** An optional `deadline` (`date-time-with-timezone`) can be set.
  - [ ] **Batch Operations:** The system SHOULD support multi-select of risks for bulk status updates (e.g., close all false-positives) and bulk assignment of `priority` values.

- [ ] **US 6.8: Risk Remediation Planning (DD-018)**
  - [ ] **Remediations Array:** Risks can contain `remediations` (represented as `response` objects, `0..*`) with a required `uuid`.
  - [ ] **Response Core Fields:** Each remediation requires a `title`, `description`, and `lifecycle`.
  - [ ] **Lifecycle Enum:** `lifecycle` must be one of: `recommendation`, `planned`, `completed`.
  - [ ] **Response Type Enum:** The system must enforce response type properties from: `avoid`, `mitigate`, `transfer`, `accept`, `share`, `contingency`, `none`.
  - [ ] **Required Assets:** Each remediation MAY define `required-assets` (`0..*`) with `uuid` (required), `description` (required, markup-multiline), optional `subjects` (`0..*`, subject-reference), and `remarks`.
  - [ ] **Remediation Tasks:** Each remediation MAY contain `tasks` (`0..*`) using the full OSCAL task assembly (`uuid`, `type`: `milestone`/`action`, `title`, `description`, `timing`, `dependencies`, `associated-activities`, `responsible-roles`).

- [ ] **US 6.9: Risk Log & Status Tracking (DD-018)**
  - [ ] **Risk Log Assembly:** Risks can contain a `risk-log` (`0..1`) with `entries` (`1..*`).
  - [ ] **Risk Log Fields:** Entries require a `uuid` and `start` date, with optional `end`, `status-change` (matching risk-status), and `related-responses`.
  - [ ] **Log Type Enum:** Log entry types should allow standard values: `vendor-check-in`, `status-update`, `milestone-complete`, `mitigation`, `remediated`, `closed`, `dr-submission`, `dr-updated`, `dr-approved`, `dr-rejected`.

- [ ] **US 6.10: Findings & Objective Status**
  - [ ] **Findings Array:** A `result` can contain `findings` (`0..*`) with required `uuid`, `title`, and `description`.
  - [ ] **Target Assembly:** Each finding must have exactly one (`1..1`) `target` assembly (type `finding-target`).
  - [ ] **Target Type:** The target `type` must be either `statement-id` or `objective-id`.
  - [ ] **Target Status Enum:** Target `status` requires a `state` (`satisfied` | `not-satisfied`) and `reason` (`pass`, `fail`, `other`; allow-other).
  - [ ] **Implementation Status:** The `target` assembly MUST support an optional `implementation-status` with `state` values: `implemented`, `partial`, `planned`, `alternative`, `not-applicable` (allow-other). This mirrors the SSP `by-component.implementation-status` states and captures HOW the control is implemented, separate from whether it satisfies the objective.
  - [ ] **Implementation Links:** Findings can reference an `implementation-statement-uuid` (optional) mapping to the SSP.
  - [ ] **Cross-references:** Findings can contain `related-observations` (`0..*`) and `related-risks` (`0..*`) arrays referencing respective UUIDs.

- [ ] **US 6.11: Attestation Statements**
  - [ ] **Attestations Assembly:** A `result` can contain `attestations` (`0..*`).
  - [ ] **Responsible Parties:** Attestations define `responsible-parties` (`0..*`) enforcing unique `role-id`.
  - [ ] **Assessment Parts:** Attestations must define `parts` (required `1..*`, of type `assessment-part`).

- [ ] **US 6.12: Multi-Result Comparison & Trend Analysis**
  - [ ] **Result Set Comparison:** The system MUST support side-by-side comparison of two or more `result` sets, highlighting changes in finding `target.status` (satisfied → not-satisfied or vice versa).
  - [ ] **Trend Metrics:** The system SHOULD display summary metrics: total findings, satisfied vs not-satisfied counts, new risks, closed risks, and delta from previous result set.
  - [ ] **Timeline View:** The system SHOULD render a timeline showing assessment result sets chronologically with key metrics per period.

- [ ] **US 6.13: AR Table & Navigation (US 0.18)**
  - [ ] **Data Table:** The system displays a table listing `assessment-results` documents.
  - [ ] **Navigation & Sorting:** Users can paginate, sort, and filter the table by title, creation date, and result start/end times.

- [ ] **US 6.14: Document Overview & Tags (US 0.16)**
  - [ ] **Metadata Overview:** The system provides an overview panel for `assessment-results` metadata.
  - [ ] **Tags & Remarks:** Users can edit properties, links, and remarks at the document root level.

- [ ] **US 6.15: In-Card Editing & Draft Persistence (US 0.17)**
  - [ ] **In-Card Edits:** Findings, risks, and observations are editable within expandable cards.
  - [ ] **Draft States:** Changes to `results` sub-assemblies are auto-saved as drafts locally before backend submission.

- [ ] **US 6.16: Integrated Backend Versioning (US 0.15)**
  - [ ] **Version Tracking:** `assessment-results` documents receive automatic backend version increments.
  - [ ] **History View:** Users can view the history of updates made to the assessment results.

- [ ] **US 6.17: Back-Matter & Resource Attachments**
  - [ ] **Back-Matter Assembly:** The system supports optional (`0..1`) `back-matter` on the root.
  - [ ] **Base64 Attachments:** The system supports attaching files as Base64 strings per DD-007, enabling raw scan reports to be embedded in the OSCAL JSON.

