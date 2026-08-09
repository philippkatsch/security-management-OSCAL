# Step 7: Detailed User Stories – POA&M Tracker

* **Persona:** Alice (System Owner / ISSO)
* **Goal:** Create, manage, and track a Plan of Action and Milestones (POA&M) document that addresses risks and findings from assessments, mapping them to remediation plans and tracking their lifecycle statuses.

---

## 1. Breakdown of User Stories

### US 7.1: POA&M Document Creation & Inner View
> **As a** System Owner / ISSO  
> **I want to** create a new `plan-of-action-and-milestones` document and view its structured sections  
> **so that** I can track remediation efforts systematically according to the OSCAL standard.

### US 7.2: SSP Import or System Identification (See DD-016)
> **As a** System Owner / ISSO  
> **I want to** link the POA&M to a target system using either an `import-ssp` reference or a `system-id`  
> **so that** the POA&M is properly scoped to the correct system context.

### US 7.3: Local Definitions
> **As a** System Owner / ISSO  
> **I want to** define `local-definitions` including `components`, `inventory-items`, and `assessment-assets`  
> **so that** I can reference specific local entities when detailing findings and remediations.

### US 7.4: POA&M Items Declaration
> **As a** System Owner / ISSO  
> **I want to** create and manage `poam-items` with a `title`, `description`, `origins`, and properties (`props`)  
> **so that** I can document specific action items required for remediation.

### US 7.5: Risk Import from Assessment Results (See DD-017)
> **As a** System Owner / ISSO  
> **I want to** import or reference `risks` from Assessment Results into the POA&M  
> **so that** I have a single pane of glass for all identified risks that require tracking and remediation.

### US 7.6: Finding Import from Assessment Results (See DD-017)
> **As a** System Owner (Alice)
> **I want to** import findings with `not-satisfied` status from an Assessment Results document and auto-generate corresponding POA&M items
> **so that** every unresolved assessment finding is tracked as an actionable remediation item.

### US 7.7: POA&M Item Cross-References
> **As a** System Owner / ISSO  
> **I want to** link `poam-items` to `related-findings`, `related-observations`, and `related-risks`  
> **so that** I can trace the origin of an action item back to specific vulnerabilities or non-compliant controls.

### US 7.8: Observations in POA&M Context (See DD-017, DD-018)
> **As a** System Owner / ISSO  
> **I want to** record or review `observations` with details like `methods`, `types`, and `collected` dates  
> **so that** the factual basis for findings and risks is preserved within the POA&M.

### US 7.9: Risk Management & Characterization (See DD-017, DD-018)
> **As a** System Owner / ISSO  
> **I want to** manage `risks` including their `status`, `threat-ids`, `characterizations` (e.g., CVSS), and `mitigating-factors`  
> **so that** I can accurately assess and track the severity and lifecycle of each risk.

### US 7.10: Remediation Planning & Response Lifecycle (See DD-017)
> **As a** System Owner / ISSO  
> **I want to** define `remediations` with specific lifecycle statuses and response types  
> **so that** I can plan, track, and execute mitigation strategies for identified risks.

### US 7.11: Risk Deviations & Dispositions
> **As a** System Owner / ISSO  
> **I want to** record dispositions such as `false-positive` or `accepted` risk, and track deviation requests  
> **so that** exceptions to policy or accepted risks are formally documented and justified.

### US 7.12: Risk Log & Status Change Tracking
> **As a** System Owner / ISSO  
> **I want to** maintain a `risk-log`  
> **so that** I have a chronological history of status changes and updates for each risk.

### US 7.13: Findings in POA&M Context
> **As a** System Owner / ISSO  
> **I want to** manage `findings` related to control objectives or statements  
> **so that** I can track which specific compliance requirements are not satisfied.

### US 7.14: POA&M Progress Dashboard
> **As a** System Owner (Alice)
> **I want to** see a visual dashboard summarizing POA&M item status, remediation progress, and overdue deadlines
> **so that** I can quickly assess my organization's remediation posture.

### US 7.15: POA&M Table & Navigation
> **As a** System Owner / ISSO  
> **I want to** view and navigate all POA&M data through an organized table and outline view  
> **so that** I can quickly find and review specific items, risks, or findings.

### US 7.16: Document Overview & Tags
> **As a** System Owner / ISSO  
> **I want to** manage document-level `metadata` and apply contextual tags  
> **so that** the document is properly identified, categorized, and searchable.

### US 7.17: In-Card Editing & Draft Persistence
> **As a** System Owner / ISSO  
> **I want to** edit POA&M components inline with automatic draft saving  
> **so that** I can work on complex remediations without losing progress.

### US 7.18: Integrated Backend Versioning
> **As a** System Owner / ISSO  
> **I want to** save discrete versions of the POA&M to the backend repository  
> **so that** I maintain a reliable audit trail of the document's evolution.

### US 7.19: Back-Matter & Resource Attachments
> **As a** System Owner / ISSO  
> **I want to** attach supporting evidence and reference material in the `back-matter`  
> **so that** all documentation required to validate a remediation is centrally available.

---

## 2. Workflow & User Journey

1. **Initialization:** Alice creates a new `plan-of-action-and-milestones` document. She associates it with an existing SSP using `import-ssp` or provides a standalone `system-id`.
2. **Contextualizing Data:** Alice optionally adds `local-definitions` (`components`, `inventory-items`, `assessment-assets`) if new local entities need to be tracked that were not in the SSP or AR.
3. **Consolidation:** Alice imports or manually creates `risks`, `findings`, and `observations` that need to be addressed.
4. **Action Planning:** For the identified risks and findings, Alice creates `poam-items` (1..* required). She assigns a `title` and `description` to each, and links them back to the source issues using `related-findings`, `related-observations`, and `related-risks`.
5. **Remediation Execution:** Within the `risks`, Alice details `remediations`, moving them through lifecycle stages (`recommendation`, `planned`, `completed`) and setting the response type (`mitigate`, `accept`, etc.).
6. **Tracking Updates:** As work progresses, Alice updates the `status` of `risks` and logs these changes in the `risk-log`. If a risk is accepted, she documents the `deviation-requested` or `deviation-approved` status and sets the appropriate properties.
7. **Review & Finalization:** Alice uses the table views to ensure all `poam-items` have actionable remediations and tracks the document metadata, eventually saving a new version to the backend.

---

## 3. Functional Requirements

* **Core Assembly Support:** The system must fully support the `plan-of-action-and-milestones` root assembly and its children as defined in OSCAL v1.2.2.
* **Constraints Enforced:**
  * The root must have a `uuid` and `metadata` (1..1).
  * Either `import-ssp` (0..1) or `system-id` (0..1) MUST be present. Both are permitted.
  * `local-definitions` components (0..*) must have unique `uuid`s.
  * The document must contain at least one `poam-item` (1..* in `poam-items`).
  * `poam-item` requires `title` and `description`. A `uuid` is optional but strongly recommended (WARNING if missing).
  * `poam-item` requires at least one origin actor (`origins` -> `actors`, 1..*).
  * `related-findings`, `related-observations`, and `related-risks` must require their respective target UUIDs (`finding-uuid`, `observation-uuid`, `risk-uuid`).
* **Shared Assemblies (AR/POA&M):**
  * `observation` fields: `uuid`, `title`, `description`, `methods` (`EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN`), `types` (`ssp-statement-issue`, `control-objective`, `mitigation`, `discovery`, `historic`), `origins`, `subjects`, `relevant-evidence`, `collected`, `expires`.
  * `risk` fields: `uuid`, `title`, `description`, `statement`, `status` (`open`, `investigating`, `remediating`, `deviation-requested`, `deviation-approved`, `closed`), `props` (`false-positive`, `accepted`, `risk-adjusted`, `priority`), `threat-ids`, `characterizations` (facets with CVSS), `mitigating-factors`, `deadline`, `remediations`, `risk-log`, `related-observations`.
  * `remediations` sub-fields: `lifecycle` (`recommendation`, `planned`, `completed`), `type` (`avoid`, `mitigate`, `transfer`, `accept`, `share`, `contingency`, `none`), `required-assets`, `tasks`.
  * `finding` fields: `uuid`, `title`, `description`, `target` (`type`: `statement-id` or `objective-id`, `target-id`, `status`: `satisfied` or `not-satisfied`), `implementation-statement-uuid`, `related-observations`, `related-risks`.
* **UX Patterns:** Must integrate US 0.14 (Inner View), US 0.15 (Versioning), US 0.16 (Overview & Tags), US 0.17 (In-Card Editing), and US 0.18 (Table & Navigation).
* **Design Decisions:** Follow DD-002 (OSCAL Validation), DD-004 (Editor UX), DD-007 (Base64 Attachments for back-matter), DD-008 (Unified Editor where applicable), DD-012 (Parameter Override Strategy).

---

## 4. Functional Acceptance Criteria (Summary)

- [ ] **US 7.1: POA&M Document Creation & Inner View**
  - [ ] **Create Document:** User can create a new `plan-of-action-and-milestones` with a generated `uuid` and required `metadata`.

- [ ] **US 7.2: SSP Import or System Identification (See DD-016)**
  - [ ] **System Association:** The UI enforces that either `import-ssp` or `system-id` (or both) are provided.

- [ ] **US 7.3: Local Definitions**
  - [ ] **Local Definitions Support:** User can add `components`, `inventory-items`, and `assessment-assets` under `local-definitions`.
  - [ ] **Unique Constraint:** System validates that all `local-definitions` components have unique UUIDs.

- [ ] **US 7.4: POA&M Items Declaration**
  - [ ] **Required Cardinality:** System enforces at least one `poam-item` exists before final validation.
  - [ ] **Item Required Fields:** User must provide `title` and `description` for each `poam-item`.
  - [ ] **Item UUID Warning:** System warns the user if a `poam-item` lacks a `uuid`.
  - [ ] **Origin Actor Detail:** Each `origin` within a `poam-item` MUST contain `actors` (required `1..*`). Each actor specifies `type` (required, token: `tool`, `assessment-platform`, `party`), `actor-uuid` (required, uuid referencing the responsible entity), and optional `role-id` (token, e.g., `assessor`, `tool-operator`).

- [ ] **US 7.5: Risk Import from Assessment Results (See DD-017)**
  - [ ] **Risk Import:** The system MUST allow the user to import or reference risks from an Assessment Results document.

- [ ] **US 7.6: Finding Import from Assessment Results (See DD-017)**
  - [ ] **Finding Selection:** The system MUST allow the user to select an AR document from the workspace and filter to findings where `target.status.state` = `not-satisfied`.
  - [ ] **Automated POA&M Item Generation:** For each selected finding, the system MUST auto-generate a `poam-item` with `title` derived from the finding title, `description` from finding description, and `related-findings[].finding-uuid` linking back to the source finding.
  - [ ] **Cascading Import:** If the selected finding has `related-observations` or `related-risks`, the system SHOULD also import those referenced observations and risks into the POA&M's top-level `observations[]` and `risks[]` arrays (preserving original UUIDs per DD-017).
  - [ ] **Review Before Save:** The system MUST present all auto-generated items for user review and modification before persisting.

- [ ] **US 7.7: POA&M Item Cross-References**
  - [ ] **Cross-Referencing:** User can link a `poam-item` to `related-findings` (`finding-uuid`), `related-observations` (`observation-uuid`), and `related-risks` (`risk-uuid`).

- [ ] **US 7.8: Observations in POA&M Context (See DD-017, DD-018)**
  - [ ] **Observation Fields:** User can define `observation` details including `uuid`, `title`, and `description`.
  - [ ] **Observation Methods:** User can select `methods` from allowed values: `EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN`.
  - [ ] **Observation Types:** User can select `types` from allowed values: `ssp-statement-issue`, `control-objective`, `mitigation`, `discovery`, `historic`.
  - [ ] **Observation Temporal Data:** User can specify `collected` and `expires` dates.
  - [ ] **Origin Actors (Observation):** Each `origin` (`0..*`) MUST contain `actors` (required `1..*`), where each actor defines `type` (required, token: `tool`, `assessment-platform`, `party`), `actor-uuid` (required, uuid referencing a component, assessment-platform, or party), and optional `role-id` (token).

- [ ] **US 7.9: Risk Management & Characterization (See DD-017, DD-018)**
  - [ ] **Risk Details:** User can detail `risks` with `uuid`, `title`, `description`, `statement`, and `deadline`.
  - [ ] **Risk Status:** User can select `status` from allowed values: `open`, `investigating`, `remediating`, `deviation-requested`, `deviation-approved`, `closed`.
  - [ ] **Risk Props:** User can assign disposition props including `false-positive`, `accepted`, `risk-adjusted`, and `priority`.
  - [ ] **Risk Characterization:** User can document `threat-ids`, `characterizations` (including CVSS facets), and `mitigating-factors`.
  - [ ] **Batch Status Updates:** The system SHOULD support multi-select of risks or POA&M items for bulk status changes (e.g., mark multiple low-priority items as `closed`).

- [ ] **US 7.10: Remediation Planning & Response Lifecycle (See DD-017)**
  - [ ] **Remediation Lifecycle:** User can define `remediations` and set the `lifecycle` to `recommendation`, `planned`, or `completed`.
  - [ ] **Remediation Type:** User can classify the remediation `type` as `avoid`, `mitigate`, `transfer`, `accept`, `share`, `contingency`, or `none`.
  - [ ] **Required Assets:** Each remediation MAY define `required-assets` (`0..*`) with `uuid` (required), `description` (required, markup-multiline), optional `subjects` (`0..*`, subject-reference), and `remarks`.
  - [ ] **Remediation Tasks:** Each remediation MAY contain `tasks` (`0..*`) using the full OSCAL task assembly (`uuid`, `type`: `milestone`/`action`, `title`, `description`, `timing`, `dependencies`, `associated-activities`, `responsible-roles`).

- [ ] **US 7.11: Risk Deviations & Dispositions**
  - [ ] **Dispositions:** User can record dispositions and track deviation requests appropriately (handled via Risk Props and Risk Status).

- [ ] **US 7.12: Risk Log & Status Change Tracking**
  - [ ] **Risk Log:** User can append entries to the `risk-log` to track status changes over time.

- [ ] **US 7.13: Findings in POA&M Context**
  - [ ] **Finding Details:** User can define `findings` with `uuid`, `title`, and `description`.
  - [ ] **Finding Target:** User can specify `target` details, selecting `type` (`statement-id` or `objective-id`), entering the `target-id`, and setting `status` (`satisfied` or `not-satisfied`).
  - [ ] **Finding Links:** User can link a finding to an `implementation-statement-uuid`, `related-observations`, and `related-risks`.

- [ ] **US 7.14: POA&M Progress Dashboard**
  - [ ] **Summary Metrics:** Display total POA&M items, open risks, closed risks, and items by status (`open`, `investigating`, `remediating`, `closed`).
  - [ ] **Overdue Highlighting:** Items with `risk.deadline` in the past and `status` ≠ `closed` MUST be visually flagged with a red overdue indicator.
  - [ ] **Remediation Progress:** For each risk with `remediations[]`, show lifecycle progress bar (`recommendation` → `planned` → `completed`).
  - [ ] **Risk Heat Map:** Optional visualization showing risks plotted by severity (CVSS score or priority) vs status, enabling quick triage.

- [ ] **US 7.15: POA&M Table & Navigation**
  - [ ] **Table View (US 0.18):** User can view POA&M items, risks, and findings in an organized, navigable table structure.

- [ ] **US 7.16: Document Overview & Tags**
  - [ ] **Document Overview (US 0.16):** User can manage root `metadata` and contextual tags.

- [ ] **US 7.17: In-Card Editing & Draft Persistence**
  - [ ] **In-Card Editing (US 0.17):** User can edit details inline with automatic draft saving.

- [ ] **US 7.18: Integrated Backend Versioning**
  - [ ] **Versioning (US 0.15):** User can commit the POA&M document as a discrete version in the backend.

- [ ] **US 7.19: Back-Matter & Resource Attachments**
  - [ ] **Back-Matter Support (DD-007):** User can attach Base64 encoded files or external references in the `back-matter`.

