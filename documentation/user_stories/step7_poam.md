# Step 7: Detailed User Stories – Plan of Action and Milestones (POA&M)

* **Persona:** Alice (System Owner / Information System Security Officer (ISSO) / Security Project Manager)
* **Goal:** Create, track, and remediate non-compliant findings, factual observations, and security risks identified during system audits into an authoritative, schema-compliant NIST OSCAL Plan of Action and Milestones (`plan-of-action-and-milestones`) document (v1.2.2). The document binds directly to the target System Security Plan (SSP) via `import-ssp` or `system-id`, ingests unresolved findings from Assessment Results (AR) via automated bridging, structures actionable remediation milestones (`poam-items`), tracks the risk lifecycle from discovery to closure, and maintains an immutable audit trail.
* **Lifecycle Position:** Stage 7 in the NIST OSCAL Governance Lifecycle. Receives non-satisfied findings and open risks from Stage 6 (Assessment Results), scopes remediation actions against the System Security Plan (SSP) from Stage 4, establishes concrete remediation schedules and milestones, and monitors progress through system re-authorization and ongoing continuous monitoring.

---

## 1. Breakdown of User Stories

### US 7.1: POA&M Document Initialization & Workspace Inner View
> *Implements [US 0.14](step0_global_requirements.md), [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md), and [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** initialize a new `plan-of-action-and-milestones` document with required top-level metadata and an initialized default remediation item,  
> **so that** I can track remediation efforts systematically in an authoritative, schema-compliant workspace.

* **Acceptance Criteria:**
  * **Minimal Creation Window:** Clicking "New POA&M" in the document directory opens a dialog requiring document `title` (required, non-empty string) and an optional target SSP reference.
  * **Direct In-Place Navigation:** Upon submission, the document is initialized in the backend repository and the browser redirects immediately to `/poam/{uuid}?edit=true` with the Overview & Metadata tab active.
  * **Root Schema Initialization:** The generated document strictly conforms to `oscal_poam_schema.json` v1.2.2:
    * `plan-of-action-and-milestones.uuid`: Auto-generated RFC 4122 v4 UUID.
    * `plan-of-action-and-milestones.metadata`: Required metadata assembly containing `title`, `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`, `roles: []`, and `parties: []`.
    * `plan-of-action-and-milestones.poam-items`: Required array (`minItems: 1`) initialized with exactly one default `poam-item` containing auto-generated `uuid`, `title: "Initial Remediation Item"`, and `description`.
  * **CRITICAL ARCHITECTURAL DIFFERENCE — Root-Level Storage:** Unlike Stage 6 Assessment Results, the POA&M schema has NO `results[]` wrapper. Findings (`findings[]`), observations (`observations[]`), risks (`risks[]`), and remediation items (`poam-items[]`) MUST reside directly at the root level of `plan-of-action-and-milestones`. Placing them inside a `results` object triggers an immediate schema validation failure.
  * **Metadata Management in Edit Mode:** In Edit Mode (`✏️ Edit`), Alice can update `metadata.title`, increment semantic `metadata.version`, manage team parties (`metadata.parties[]`), assign responsible roles (`metadata.roles[]`), add properties (`metadata.props[]`), and capture document-level `metadata.remarks`.
  * **Read-Only View Mode Dynamics:** In View Mode (`👁️ View`), all form inputs, creation triggers, and deletion buttons are hidden; metadata displays as clean text, chips, and formatted timestamps.
  * **Empty-Array Pruning:** On save, empty optional root arrays (`observations`, `risks`, `findings`, `props`) are purged via `remove_empty_arrays()`, while mandatory `poam-items` (`minItems: 1`) is preserved.

---

### US 7.2: Target System Scoping via `import-ssp` or `system-id` (Dual Scoping)
> *Implements [DD-016](../design_decisions/DD-016_cross_document_import_resolution.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** bind the POA&M to its target operational system using either an `import-ssp` reference or a `system-id` identifier,  
> **so that** remediation items and findings are unequivocally scoped to the correct system boundary.

* **Acceptance Criteria:**
  * **Dual System Scoping Mechanism:** The Overview tab provides a segmented selector allowing Alice to scope the POA&M by either:
    1. **Direct SSP Import (`import-ssp`):** Standard OSCAL reference to a System Security Plan document.
    2. **System Identifier (`system-id`):** System identification token for external or federated systems where the full OSCAL SSP is maintained externally.
  * **Workspace SSP Browser Modal:** When choosing `import-ssp`, clicking "Browse System Security Plans..." opens a modal listing all available SSPs in the workspace (`GET /api/documents/ssps`) displaying system name, authorization status, security impact levels (Confidentiality, Integrity, Availability), and version.
  * **Reference Format:** Selecting an SSP sets `import-ssp.href` to relative path `../ssps/{ssp_uuid}.json`, document fragment `#{ssp_uuid}`, or a valid HTTPS URI.
  * **System Identifier Entry:** When choosing `system-id`, the UI renders inputs for:
    * `system-id.id`: Required system identification token (e.g., `SYS-FIN-CORE-01`).
    * `system-id.identifier-type`: Optional URI identifying the naming authority (e.g., `http://fedramp.gov/system-id`).
  * **Live Target System Summary Card:** When `import-ssp` resolves successfully, the UI renders a **Live Target System Summary Card** displaying System Name, Operational Status (e.g., `operational`), Authorization Boundary summary, and Leveraged Authorizations.
  * **Dual-State Presentation:** In Edit Mode, the scoping selector and text inputs are interactive. In View Mode, the target system displays as an authoritative system banner with status chips.

---

### US 7.3: Ingestion of Unsatisfied Findings from Assessment Results (Bridge Pipeline)
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** import non-satisfied findings from an Assessment Results document into the POA&M with a single click,  
> **so that** audit non-compliances automatically generate actionable remediation action items while preserving original entity UUIDs.

* **Acceptance Criteria:**
  * **Bridge Ingestion Action:** In Edit Mode, the Overview and Items tabs provide an action "📥 Ingest Findings from Assessment Results" opening an import modal.
  * **Assessment Results Document Selector:** The modal queries `GET /api/documents/assessment-results` and displays candidate AR documents with title, target AP/SSP link, and count of unsatisfied findings.
  * **Bridge Endpoint Execution:** Alice selects an AR document and clicks "Import Findings". The UI dispatches:
    `POST /api/documents/poams/{poam_id}/import-findings/{ar_id}`
    with optional payload `{ "finding_uuids": [...] }` to selectively import specific findings or all unsatisfied findings.
  * **Idempotent Ingestion Semantics (DD-017 § 5):**
    * The backend service scans the source AR for findings where `target.status.state == "not-satisfied"`.
    * Findings with `target.status.state == "satisfied"` are skipped by default.
    * For each ingested finding:
      1. The `finding` object is copied into `plan-of-action-and-milestones.findings[]` **preserving its original `uuid`** for cross-stage traceability.
      2. All observations referenced in `finding.related-observations[]` are copied into `plan-of-action-and-milestones.observations[]` **preserving their original UUIDs**.
      3. All risks referenced in `finding.related-risks[]` are copied into `plan-of-action-and-milestones.risks[]` **preserving their original UUIDs**.
      4. A corresponding `poam-item` is automatically synthesized:
         - `uuid`: Newly generated RFC 4122 v4 UUID.
         - `title`: Prefixed with `"Remediation: "` + finding title.
         - `description`: Copied from finding description.
         - `related-findings`: `[{ "finding-uuid": finding.uuid }]`.
         - `related-observations`: Preserves observation UUID references.
         - `related-risks`: Preserves risk UUID references.
  * **Duplicate Ingestion Safeguard:** If a finding already exists in the target POA&M, the ingestion service is idempotent—it updates existing records without creating duplicate UUID collisions.
  * **Success Notification & Burndown Update:** Upon completion, the UI displays a banner `"Successfully ingested X findings, Y observations, and Z risks from Assessment Results"`, and refreshes the POA&M Dashboard.

---

### US 7.4: Core POA&M Items Management & Remediation Milestones
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-020](../design_decisions/DD-020_status_badge_design_system.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** author and manage structured `poam-items` with remediation schedules, priorities, and milestone progress,  
> **so that** corrective action plans have clear operational owners and measurable deadlines.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored directly in `plan-of-action-and-milestones.poam-items[]` (`minItems: 1`).
  * **Mandatory Item Properties:**
    * `uuid`: Auto-generated RFC 4122 v4 UUID.
    * `title`: Required markup-line string summarizing the remediation action item.
    * `description`: Required markup-multiline string detailing execution steps.
  * **Action Item Scheduling & Progress Properties (`props[]`):**
    * `status`: Property tracking execution progress:
      * `open` (🔴 Red badge) — Not yet scheduled or action pending.
      * `ongoing` (🟡 Yellow badge) — Remediation actively in development/testing.
      * `completed` (🟢 Green badge) — Corrective action deployed and verified.
    * `priority`: Property tracking urgency (`high`, `medium`, `low`).
    * `scheduled-completion`: ISO 8601 date string tracking target resolution deadline.
    * `actual-completion`: ISO 8601 date string recording verified completion date.
  * **Item Creation & Deletion:**
    * In Edit Mode, Alice can click "➕ Add POA&M Item" to append a new item.
    * Deletion requires confirmation; if only 1 item remains in `poam-items[]`, deletion is blocked with a tooltip explaining schema `minItems: 1`.
  * **Dual-State Presentation:**
    * Edit Mode: Form inputs for title, description, priority dropdown, and date-pickers.
    * View Mode: Summary card with priority badge, status indicator, scheduled completion date, and linked entity chips.

---

### US 7.5: Root-Level Findings Management & Control Statement Mapping
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** view, inspect, and manage non-compliant findings directly in a dedicated Findings tab at the document root,  
> **so that** I can track which specific control statements or objectives remain unsatisfied without navigating away from the POA&M.

* **Acceptance Criteria:**
  * **Dedicated Findings Tab:** `POAMPage.tsx` features a dedicated top-level "Findings" tab (`POAMFindingsTab.tsx`), eliminating UI gaps where findings were previously invisible.
  * **Nesting Location:** Stored directly in `plan-of-action-and-milestones.findings[]`.
  * **Mandatory Finding Fields:**
    * `uuid`: Auto-generated or imported unique identifier.
    * `title`: Required markup-line summary of non-compliance.
    * `description`: Detailed technical description.
    * `target`: Required `finding-target` assembly.
  * **Finding Target Constraints:**
    * `target.type`: Restricted to enum `['statement-id', 'objective-id']`.
    * `target.target-id`: Control statement token (e.g., `ac-2_smt_a`) or objective token (e.g., `ac-2_obj_1`).
    * `target.status.state`: Restricted to enum `['satisfied', 'not-satisfied']`.
    * `target.status.reason`: Optional enum `['pass', 'fail', 'other']`.
  * **Associated Statement Reference:** `implementation-statement-uuid` provides direct reference to the target SSP statement.
  * **Dual-State Cards & Filtering:**
    * Filterable data table by control ID, target type, and satisfaction state.
    * In Edit Mode, Alice can edit finding titles and toggle satisfaction state. In View Mode, findings render with red `Not Satisfied - Fail` or green `Satisfied - Pass` badges.

---

### US 7.6: Root-Level Observations & Factual Evidence Logging
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** maintain factual audit observations with standardized assessment methods and evidence links at the document root,  
> **so that** the empirical foundation for remediation items is permanently preserved within the POA&M.

* **Acceptance Criteria:**
  * **Dedicated Observations Tab:** `POAMPage.tsx` features an "Observations" tab connected to a dedicated `ObservationEditorModal.tsx` (NOT reusing `POAMItemsEditor`).
  * **Nesting Location:** Stored directly in `plan-of-action-and-milestones.observations[]`.
  * **Mandatory Observation Fields:**
    * `uuid`: RFC 4122 v4 identifier.
    * `description`: Detailed factual observation notes.
    * `methods`: Required array (`minItems: 1`) of standardized methods: `EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN`.
    * `collected`: Required ISO 8601 UTC timestamp.
  * **Standard Observation Types:** Standard types include `ssp-statement-issue`, `control-objective`, `mitigation`, `finding`, `discovery`, `historic`.
  * **Relevant Evidence Links (`relevant-evidence[]`):** Supports evidence references with `description` and `href` pointing to embedded `#resource-uuid` in `back-matter` or external URLs.
  * **Dual-State Presentation:**
    * Edit Mode: Method checkboxes, date-picker, evidence uploader.
    * View Mode: Method badges (`EXAMINE`, `TEST`), collection timestamp badge, and evidence download chips.

---

### US 7.7: Root-Level Identified Risks & Threat Characterization
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-018](../design_decisions/DD-018_risk_scoring_characterization_ui.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** manage security risks with mandatory statements, threat identifiers (CVE), and mitigating factors at the document root,  
> **so that** risk exposure and potential organizational impacts are documented in compliance with NIST standards.

* **Acceptance Criteria:**
  * **Dedicated Risks Tab:** `POAMPage.tsx` features an "Identified Risks" tab connected to `RiskEditorModal.tsx` (NOT reusing `POAMItemsEditor`).
  * **Nesting Location:** Stored directly in `plan-of-action-and-milestones.risks[]`.
  * **Mandatory Risk Fields:**
    * `uuid`: RFC 4122 v4 identifier.
    * `title`: Required markup-line string.
    * `description`: Detailed technical description.
    * `statement`: Mandatory markup-multiline string defining threat actor capability, system vulnerability, and operational consequence. Omitting `statement` fails schema validation.
    * `status`: Required lifecycle status token.
  * **Threat Identifiers (`threat-ids[]`):** Supports standardized threat references with required `id` (e.g., `CVE-2024-3094`, `CWE-287`) and canonical `system` URI (e.g., `http://cve.mitre.org`).
  * **Mitigating Factors (`mitigating-factors[]`):** Allows recording existing compensating controls with `uuid`, `description`, and optional `implementation-uuid` linking to SSP components.

---

### US 7.8: Risk Lifecycle State Machine & Transition Governance
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-020](../design_decisions/DD-020_status_badge_design_system.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** advance risk statuses through a controlled state machine with authoritative badge styling,  
> **so that** the risk mitigation lifecycle is managed transparently and compliantly.

* **Acceptance Criteria:**
  * **Authoritative Status Enum & Badge Colors (DD-020):**
    * `open` (🔴 Red) — Active, unmitigated vulnerability.
    * `investigating` (🟠 Orange) — Under engineering review or reproduction.
    * `remediating` (🟡 Yellow) — Active remediation script or patch underway.
    * `deviation-requested` (🟣 Purple) — Risk acceptance or waiver submitted.
    * `deviation-approved` (🔵 Blue with ⚠️ alert) — Formally approved exception.
    * `closed` (🟢 Green) — Resolved, patched, or confirmed false-positive.
  * **State Machine Validation:** Transitions must follow logical progression. Transitioning directly from `open` to `deviation-approved` is prohibited without submitting a deviation request.
  * **Interactive Status Dropdown:** In Edit Mode, the risk editor provides a validated status transition menu. In View Mode, status displays as a prominent pill badge.

---

### US 7.9: Risk Deviations, Dispositions & False-Positive Handling
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** document formal dispositions such as false positives, risk acceptances, and deviations,  
> **so that** approved exceptions to baseline security controls are fully justified and auditable.

* **Acceptance Criteria:**
  * **False-Positive Workflow:**
    * When Alice marks a risk as a false positive in the risk editor:
      1. System sets `risk.props[name="false-positive", value="true"]`.
      2. Automatically transitions `risk.status` to `closed`.
      3. Appends an entry to `risk.risk-log` with type `closed` and Alice's justification.
  * **Risk Acceptance & Deviation Workflow:**
    * When an operational constraint prevents patching, Alice can select "Request Deviation / Risk Acceptance":
      1. Status transitions to `deviation-requested`.
      2. Alice enters the compensating control justification and risk acceptance expiration date in `remarks`.
      3. Upon authorizing official approval, status advances to `deviation-approved`, setting `props[name="accepted", value="true"]`.
  * **Visual Deviation Alert:** In View Mode, risks with approved deviations display a prominent warning banner: `⚠️ Deviation Approved: Risk Accepted until 2027-01-01`.

---

### US 7.10: Risk Characterization & Multi-System Scoring (CVSS v3.1)
> *Implements [DD-018](../design_decisions/DD-018_risk_scoring_characterization_ui.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** evaluate and visualize risk severity using CVSS v3.1 vector strings and quantitative facets,  
> **so that** remediation items can be prioritized according to standardized vulnerability metrics.

* **Acceptance Criteria:**
  * **Characterization Assembly:** Stored in `risk.characterizations[]`.
  * **Mandatory Characterization Properties:**
    * `origin.actors[]`: Identifies the scoring party or scanner tool (`type: "party" | "tool"`).
    * `facets[]`: Array (`minItems: 1`) where each facet requires `name`, `system`, and `value`.
  * **CVSS Metric Parser & Scoring Calculator:**
    * In the risk modal, Alice can enter a CVSS v3.1 vector string (e.g., `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`).
    * The system computes numeric Base Score (`9.8`) and assigns color-coded severity:
      * Critical (`9.0 - 10.0`): 🔴 Red
      * High (`7.0 - 8.9`): 🟠 Orange
      * Medium (`4.0 - 6.9`): 🟡 Amber
      * Low (`0.1 - 3.9`): 🟢 Soft Green
  * **Standardized Facet Serialization:** Stores facets for `base-score`, `vector-string`, and `qualitative-severity` with `system: "http://nvd.nist.gov/vuln-metrics/cvss/v3-1"`.

---

### US 7.11: Remediation Planning & Response Lifecycle
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** define structured remediation responses with lifecycle tracking from recommendation to completion,  
> **so that** corrective action plans advance through verified execution stages.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `risk.remediations[]` (OSCAL `response` assembly).
  * **Mandatory Remediation Properties:**
    * `uuid`: RFC 4122 v4 identifier.
    * `lifecycle`: Required enum token representing response status:
      * `recommendation` (🔵 Blue badge) — Proposed corrective approach.
      * `planned` (🟡 Yellow badge) — Budgeted and scheduled remediation.
      * `completed` (🟢 Green badge) — Deployed, verified, and operational.
    * `title`: Required markup-line string.
    * `description`: Required implementation details.
  * **Response Classification (`props`):** Alice can categorize the response type: `mitigate`, `avoid`, `transfer`, `accept`, `contingency`.
  * **Tracking Alignment:** Remediations can link directly to POA&M items, establishing a unified bridge between risk response strategy and project management execution.

---

### US 7.12: Multi-Entity Cross-Referencing & Triad Traceability
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** link `poam-items` to `related-findings`, `related-observations`, and `related-risks`,  
> **so that** every action item maintains full traceability to underlying audit facts and vulnerability assessments.

* **Acceptance Criteria:**
  * **Cross-Reference Assemblies on `poam-item`:**
    * `poam-item.related-findings[]`: Array of objects with required `finding-uuid`.
    * `poam-item.related-observations[]`: Array of objects with required `observation-uuid`.
    * `poam-item.related-risks[]`: Array of objects with required `risk-uuid`.
  * **Searchable Multi-Select UI:** In the POA&M Item editor drawer, searchable multi-select pickers allow linking to root-level findings, observations, and risks defined in the same document.
  * **Referential Integrity Enforcement:**
    * Every `finding-uuid` MUST match an existing `finding.uuid` at document root.
    * Every `observation-uuid` MUST match an existing `observation.uuid` at document root.
    * Every `risk-uuid` MUST match an existing `risk.uuid` at document root.
    * Backend validation rejects dangling UUIDs, preventing data corruption.
  * **View Mode Traceability Grid:** Expanding a POA&M item card displays connected findings (with satisfaction status), linked observations (with evidence links), and linked risks (with CVSS scores).

---

### US 7.13: Origin Attribution & Assessment Tool Tracking
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** record the origins and actor attribution for POA&M items,  
> **so that** action items clearly identify whether they originated from an automated scanner, an external auditor, or an internal compliance review.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `poam-item.origins[]`.
  * **Mandatory Origin Properties:**
    * `actors`: Required array (`minItems: 1`) of actor references.
    * `actor.type`: Required enum: `tool`, `assessment-platform`, `party`.
    * `actor.actor-uuid`: Required UUID resolving to metadata parties or local tools.
  * **Task Linkage (`related-tasks[]`):** Optional array of task UUID references linking the action item to planned audit tasks from upstream Assessment Plans.
  * **Dual-State Presentation:** In Edit Mode, actor type dropdown and party/tool picker. In View Mode, actor badge displaying actor type icon, name, and role.

---

### US 7.14: Local Definitions & Execution Inventory
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** declare local components, inventory items, and users within `local-definitions`,  
> **so that** remediation items can reference specific temporary servers, patching tools, or remediation engineers.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `plan-of-action-and-milestones.local-definitions`.
  * **Supported Local Assemblies:**
    * `components`: Local patching or remediation tools (e.g., Ansible Tower, Terraform Cloud).
    * `inventory-items`: Specific servers, VMs, or network appliances undergoing remediation.
    * `users`: Local remediation engineers or contractor accounts.
    * `assessment-assets`: Assessment platform configurations.
  * **Dedicated Local Definitions Panel:** In Edit Mode, Alice can add and configure local entities with unique UUIDs, titles, and descriptions.
  * **Autocomplete Integration:** In POA&M items and observation subjects, local components and inventory items appear in selection datalists.

---

### US 7.15: Dedicated Entity Editors Architecture (No Stubbed Re-use)
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-029](../design_decisions/DD-029_document_actions_pattern.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** edit findings, observations, and risks using specialized, dedicated modal and drawer editors,  
> **so that** I can configure mandatory risk statements, CVSS facets, and observation methods without being constrained by generic form components.

* **Acceptance Criteria:**
  * **Elimination of `POAMItemsEditor` Re-use:** Clicking an observation or risk in the POA&M interface opens its dedicated editor (`ObservationEditorModal.tsx` or `RiskEditorModal.tsx`), completely eliminating the improper re-use of `POAMItemsEditor.tsx`.
  * **Full Observation Fields Coverage:** The observation editor exposes `methods` checkboxes, `types` dropdown, `collected` timestamp picker, and `relevant-evidence` attachments.
  * **Full Risk Fields Coverage:** The risk editor exposes mandatory `statement` textarea, CVSS v3.1 vector calculator, threat IDs input, mitigating factors list, and `risk-log` timeline.
  * **Document Actions Suite (`poam-actions.ts`):** All entity mutations are executed via pure, typed document actions adhering to DD-029 with full undo/redo and draft tracking support.

---

### US 7.16: POA&M Remediation Dashboard & Burndown Metrics
> *Implements [DD-020](../design_decisions/DD-020_status_badge_design_system.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** view a comprehensive dashboard summarizing remediation progress, open risks, and milestone deadlines,  
> **so that** I can assess the organization's remediation velocity and identify overdue corrective actions.

* **Acceptance Criteria:**
  * **Dashboard Layout (`POAMDashboard.tsx`):** Rendered as the default landing view of the POA&M workspace.
  * **Key Posture Metrics Cards:**
    * Total POA&M Items Count (broken down into Open, Ongoing, Completed).
    * Open Risks by Severity (Critical 🔴, High 🟠, Medium 🟡, Low 🟢).
    * Unsatisfied Findings vs. Satisfied Findings ratio.
    * Overdue Milestones Count (items where `scheduled-completion < current_date` and `status != completed`).
  * **SLA Countdown & Overdue Alerts:** Items approaching SLA deadlines (< 14 days) display an amber warning chip; overdue items display a flashing red alert badge.
  * **Quick Filter Action Links:** Clicking any metric card (e.g., "Critical Risks: 3") automatically switches to the relevant tab with that filter pre-applied.

---

### US 7.17: Dual-Mode View (`👁️ View`) vs Edit (`✏️ Edit`) & In-Card Authoring
> *Implements [US 0.17](step0_global_requirements.md) and [DD-004](../design_decisions/DD-004_editor_ux_patterns.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** toggle smoothly between View and Edit modes with URL query persistence and in-card editing,  
> **so that** I can review remediation statuses in a clean read-only mode and switch to authoring mode on demand.

* **Acceptance Criteria:**
  * **Segmented Mode Toggle (`[ 👁️ View | ✏️ Edit ]`):** Located in the top bar; updates URL search param `?edit=true` instantly.
  * **View Mode (`👁️ View`):** All input controls, deletion trashcans, and add buttons are hidden. Items render as readable status cards with priority badges, SLA indicators, and expandable entity drawers.
  * **Edit Mode (`✏️ Edit`):** Exposes inline inputs, modal edit triggers, status dropdowns, and batch actions.
  * **In-Card Authoring:** Core fields can be edited directly within expanding cards without full-page reloads.

---

### US 7.18: Draft Persistence, Change Buffering & Dirty State Tracking
> *Implements [DD-004](../design_decisions/DD-004_editor_ux_patterns.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** have local drafts saved automatically in the backend (`<uuid>_draft.json`) while editing complex remediations,  
> **so that** work in progress is protected against browser crashes or network disconnections.

* **Acceptance Criteria:**
  * **Auto-Save Draft Pipeline (`useDraft`):** While in Edit Mode with uncommitted changes, local edits buffer to `<uuid>_draft.json` in the background every 30 seconds.
  * **Visual Dirty Indicator:** An amber "Unsaved Draft" badge appears in the top navigation bar when changes are pending.
  * **Navigation Interception:** Navigating away with unsaved changes triggers a confirmation modal (`Discard changes or save draft?`).
  * **Draft Recovery:** Upon opening a document with an existing draft, the system prompts: `"An unsaved draft exists for this POA&M. Restore draft or load saved version?"`.

---

### US 7.19: Integrated Backend Versioning & Schema Validation
> *Implements [US 0.15](step0_global_requirements.md) and [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** save formal versions of the POA&M to the repository with automated schema validation and revision history tracking,  
> **so that** historical remediation states are immutably preserved for compliance auditors.

* **Acceptance Criteria:**
  * **Save Version Action:** Clicking "Save Version" prompts for a semantic version string (e.g., `1.1.0`) and revision remarks.
  * **Schema Validation Gate:** Before saving, the document is validated against `oscal_poam_schema.json` v1.2.2. If validation errors occur, save is blocked and errors display in a modal with JSON path and line numbers.
  * **Revision History Synchronization:** Upon successful save, the system appends a new revision entry to `metadata.revisions[]` with version number, timestamp, and remarks.
  * **Version Drawer History:** Users can open the Versions Drawer to view all past versions in read-only mode or rollback to a previous state.

---

### US 7.20: Back-Matter Evidence Attachments & Resource Linking
> *Implements [US 0.16](step0_global_requirements.md) and [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** attach patch verification logs, configuration diffs, and change tickets into `back-matter.resources[]` as Base64 strings,  
> **so that** remediation verification evidence is self-contained and auditable offline.

* **Acceptance Criteria:**
  * **Back-Matter Drop-Zone:** Attachments section provides a file drop-zone accepting patch verification artifacts (`.txt`, `.pdf`, `.json`, `.png`).
  * **Client-Side Base64 Encoding:** Uploaded files are converted to Base64 resources with unique UUIDs, MIME types, and filenames stored in `back-matter.resources[]`.
  * **Evidence Referencing:** In observations and POA&M items, selecting an attachment links `href: "#" + resource_uuid`.
  * **One-Click Download & Preview:** In View Mode, clicking an evidence link opens an in-browser preview or triggers an instant file download of the decoded Base64 content.

---

### US 7.21: Clean Format Serialization & Multi-Format Export
> *Implements [US 0.15](step0_global_requirements.md).*  
> **As a** System Owner / ISSO (Alice)  
> **I want to** export the complete POA&M in NIST OSCAL JSON, XML, or YAML format with all empty arrays stripped,  
> **so that** external GRC platforms and regulatory bodies can ingest the remediation action plan.

* **Acceptance Criteria:**
  * **Export Trigger (`📥 Export`):** Top bar provides an export dropdown with options for JSON, XML, and YAML.
  * **Clean Schema Serialization:** Before serialization, `remove_empty_arrays()` strips empty optional arrays, ensuring the payload strictly satisfies `minItems: 1` schema constraints.
  * **Complete Document Attribution:** The exported file contains complete metadata, target system references (`import-ssp` or `system-id`), all `poam-items`, root `findings`, `observations`, `risks`, remediations, and `back-matter` attachments.
  * **Direct Download Delivery:** Initiates immediate browser download named `{title_slug}_poam_v{version}.json` with MIME type `application/json`.

---

## 2. Alice's Detailed Workflow & User Journey

1. **Document Initialization & System Scoping (US 7.1, US 7.2):** Alice opens Reposol and clicks "New POA&M". She enters the title *"Cloud Banking Core Platform — Quarterly Remediation Action Plan"*. Upon creation, she is redirected to `/poam/{uuid}?edit=true`. In the Overview tab, she chooses `import-ssp`, clicks "Browse System Security Plans...", and selects *"Cloud Banking Core SSP v2.4"* (`../ssps/ssp-cloud-banking-v2.json`). A green Live Target System Summary card confirms the target system is operational and scoped.
2. **Ingest Unsatisfied Findings from Assessment Results (US 7.3):** Alice clicks "📥 Ingest Findings from Assessment Results". She selects *"FedRAMP High Annual Assessment Results 2026"* (`ar-cloud-banking-2026.json`). The backend bridge endpoint (`POST /api/documents/poams/{poam_id}/import-findings/{ar_id}`) executes:
   * It identifies 3 unsatisfied findings (`ac-2_smt_a`, `ia-2_smt_1`, `sc-7_smt_c`).
   * It idempotently copies the 3 findings, their 4 referenced observations, and their 3 associated risks into the POA&M document root, preserving their exact original UUIDs per DD-017.
   * It synthesizes 3 corresponding `poam-items` with linked finding, observation, and risk UUIDs.
3. **Review Ingested Findings & Observations (US 7.5, US 7.6):** Alice opens the Findings tab. She reviews finding `find-ac2-01` (*"Inactive Privileged Service Accounts Not Terminated within 90 Days"*, target `ac-2_smt_a`, status `not-satisfied`). She clicks on the linked observation to inspect the Nessus scan evidence and confirms the observation method was `TEST`.
4. **Inspect Risks & Evaluate Threat Metrics (US 7.7, US 7.10):** Alice switches to the Identified Risks tab. She reviews risk `risk-priv-esc-01` (*"Credential Exposure via Orphaned Service Accounts"*):
   * Inspects mandatory risk statement and threat ID `CVE-2024-21413`.
   * Reviews CVSS v3.1 vector string `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` with Base Score `9.1` (Critical).
5. **Configure Remediation Action Item & Schedule Milestones (US 7.4, US 7.11):** Alice opens the POA&M Items tab and selects item `poam-item-01` (*"Remediation: Automate Service Account Deprovisioning"*):
   * Sets priority to `high`.
   * Sets status property to `ongoing` (🟡 Yellow).
   * Sets `scheduled-completion` to `2026-09-30`.
   * Adds origin actor pointing to party `"Platform-Security-Lead"`.
   * Under Remediations, sets lifecycle from `recommendation` to `planned` (🟡 Yellow).
6. **Handle Risk Deviation / False-Positive (US 7.8, US 7.9):** Alice reviews a second finding regarding legacy public API endpoints. After architectural review, the security committee determines the endpoint is protected by an upstream WAF with mTLS. Alice opens the risk modal, sets disposition to `false-positive`, inputs the justification remarks, and marks the risk as `closed` (🟢 Green). The system updates `props[name="false-positive", value="true"]` and appends an entry to `risk-log`.
7. **Attach Patch Verification Evidence (US 7.20):** In late September, the engineering team deploys the Vault dynamic secrets engine. Alice runs a verification script and drops `vault_deprovisioning_audit.log` into the Back-Matter Attachments zone. The system encodes it as Base64. Alice links the attachment `#resource-vault-log` to the remediation item and marks `status` as `completed` (🟢 Green) with `actual-completion: "2026-09-28"`.
8. **Inspect Dashboard & Burndown Velocity (US 7.16):** Alice reviews the POA&M Dashboard: Critical risks count dropped from 3 to 1, Overdue milestones shows 0, and Remediation progress indicates 67% completed.
9. **Save Formal Version & Export (US 7.17, US 7.19, US 7.21):** Alice clicks "Save Version", enters version `1.1.0` with remarks *"Q3 Remediation Milestones Verified"*. The backend validates the payload against `oscal_poam_schema.json`, records the revision history, and persists the clean JSON. Alice toggles to `👁️ View` mode to verify the clean read-only summary, then clicks `📥 Export JSON` to download the official POA&M document for the Authorizing Official (AO).

---

## 3. Functional Requirements for the System

- **Root-Level Entity Architecture:** The backend schema and persistence layer strictly enforce that `poam-items`, `findings`, `observations`, and `risks` are stored directly at the root of `plan-of-action-and-milestones` with NO `results` container (US 7.1, US 7.4).
- **Dual System Scoping Support:** The system supports scoping via either `import-ssp` (validating that the referenced SSP resolves in workspace storage) or `system-id` (validating non-empty string identifier) (US 7.2).
- **Automated Findings Bridge Endpoint (`import-findings`):** The backend provides `POST /api/documents/poams/{poam_id}/import-findings/{ar_id}` to scan source ARs, filter unsatisfied findings (`target.status.state == 'not-satisfied'`), copy findings/observations/risks with identical UUIDs (preserving cross-stage traceability per DD-017), and auto-generate corresponding `poam-items` (US 7.3).
- **Dedicated Modular Editor Architecture:** Dedicated tab components and editor modals for Findings, Observations, and Risks eliminate the improper re-use of `POAMItemsEditor`, ensuring all mandatory schema fields (risk statements, CVSS facets, observation methods) are operational (US 7.5, US 7.6, US 7.7, US 7.15).
- **Referential Integrity Validation:** The system verifies that all cross-references (`poam-item.related-findings`, `related-observations`, `related-risks`) resolve to valid UUIDs within the document root, rejecting dangling references (US 7.12).
- **Risk State Machine & Automated Risk Log:** Enforces valid risk status transitions (`open` ➔ `investigating` ➔ `remediating` ➔ `deviation-requested` ➔ `deviation-approved` ➔ `closed`) and automatically logs status changes, timestamps, and actor UUIDs in `risk-log.entries[]` (US 7.8, US 7.9).
- **CVSS v3.1 Calculation & Facet Serialization:** Parses vector strings, computes base scores, and serializes qualitative and quantitative facets into standardized OSCAL metrics (US 7.10).
- **Client-Side Base64 Attachment Pipeline:** Encodes evidence files into `back-matter.resources[].base64` and supports offline preview and download (US 7.20).
- **Draft Persistence & Empty-Array Purging:** Employs `useDraft` for local and backend draft caching (`<uuid>_draft.json`) and runs `remove_empty_arrays()` on save to maintain schema compliance while preserving `poam-items` `minItems: 1` (US 7.18, US 7.21).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] **US 7.1:** POA&M initialization dialog creates document with valid metadata and default `poam-item` at document root without `results` wrapper.
- [x] **US 7.2:** Dual system scoping supports `import-ssp` (with workspace browser and live summary card) or `system-id`.
- [x] **US 7.3:** Bridge endpoint (`import-findings`) ingests unsatisfied AR findings, observations, and risks while preserving exact UUIDs per DD-017.
- [x] **US 7.4:** `poam-items` management supports title, description, priority, execution status (`open`, `ongoing`, `completed`), and scheduled completion dates.
- [x] **US 7.5:** Dedicated Findings tab manages root-level findings with target semantics (`statement-id`/`objective-id`) and satisfaction states.
- [x] **US 7.6:** Dedicated Observations tab logs factual evidence with standardized methods enum (`EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN`) and timestamps.
- [x] **US 7.7:** Dedicated Risks tab manages root-level risks with mandatory `statement`, threat IDs (CVE/CWE), and mitigating factors.
- [x] **US 7.8:** Risk lifecycle state machine enforces valid status transitions and authoritatively styles badges per DD-020.
- [x] **US 7.9:** Dispositions and deviations support `false-positive` marking, risk acceptance waivers, and justification remarks.
- [x] **US 7.10:** CVSS v3.1 calculator parses vector strings, computes base scores, and serializes standardized characterization facets.
- [x] **US 7.11:** Remediation responses support lifecycle states (`recommendation`, `planned`, `completed`) and response type classifications.
- [x] **US 7.12:** POA&M items maintain referential integrity links to `related-findings`, `related-observations`, and `related-risks`.
- [x] **US 7.13:** Origin attribution tracks actors (`tool`, `assessment-platform`, `party`) and upstream audit task links.
- [x] **US 7.14:** Local definitions support defining patching components, inventory items, and remediation users at the document root.
- [x] **US 7.15:** Specialized modal editors for findings, observations, and risks eliminate improper `POAMItemsEditor` re-use.
- [x] **US 7.16:** POA&M Dashboard visualizes open risks, finding ratios, overdue milestones, and remediation burndown metrics.
- [x] **US 7.17:** Segmented mode toggle (`[ 👁️ View | ✏️ Edit ]`) synchronizes URL state, suppresses edit triggers in view mode, and enables in-card editing.
- [x] **US 7.18:** Draft management auto-saves changes to `<uuid>_draft.json` and prevents accidental navigation loss.
- [x] **US 7.19:** Integrated versioning validates against `oscal_poam_schema.json` and records revision history in `metadata.revisions[]`.
- [x] **US 7.20:** Back-matter supports Base64 evidence file attachments with offline preview and download capabilities.
- [x] **US 7.21:** Standalone export delivers 100% schema-valid JSON, XML, and YAML files with empty optional arrays purged.
