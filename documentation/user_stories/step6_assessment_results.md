# Step 6: Detailed User Stories – Assessment Results Reporter

* **Persona:** Bob (Lead Assessor / Security Auditor / Compliance Officer) & Automated Testing Engines
* **Goal:** Record, evaluate, and report the empirical findings, objective observations, collected evidence, and security risks identified during an assessment into an authoritative, schema-compliant NIST OSCAL Assessment Results (`assessment-results`) document (v1.2.2). The document establishes referential linkage back to the governing Assessment Plan via `import-ap`, maintains absolute evidence traceability across the Observation-Finding-Risk Triad, tracks remediation lifecycles, and provides formal assessor attestations for audit sign-off.
* **Lifecycle Position:** Stage 6 in the NIST OSCAL Governance Lifecycle. Ingests the authoritative Assessment Plan (`assessment-plan`) from Stage 5, evaluates system security posture against the System Security Plan (SSP) baseline from Stage 4, and publishes unsatisfied findings and identified risks downstream into the Plan of Action and Milestones (POA&M) in Stage 7.

---

## 1. Breakdown of User Stories

### US 6.1: Document Metadata & AR Document Initialization
> *Implements [US 0.14](step0_global_requirements.md), [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md), and [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** create a new Assessment Results document with required top-level metadata and an initialized default result set,  
> **so that** I have an authoritative, schema-compliant workspace ready to capture assessment determinations.

* **Acceptance Criteria:**
  * **Minimal Creation Dialog:** Clicking "New Assessment Results" opens a creation modal requiring document `title` (required, non-empty string) and an optional initial `import-ap` target.
  * **Direct In-Place Navigation:** Upon submission, the document is initialized in the backend repository and the browser redirects immediately to `/assessment-results/{uuid}?edit=true` with the Overview & Metadata tab active.
  * **Root Schema Initialization:** The generated document strictly conforms to `oscal_assessment-results_schema.json` v1.2.2:
    * `assessment-results.uuid`: Valid RFC 4122 v4 UUID generated automatically.
    * `assessment-results.metadata`: Required metadata block containing `title`, `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`, `roles: []`, and `parties: []`.
    * `assessment-results.import-ap`: Required assembly initialized with `{ "href": "" }`.
    * `assessment-results.results`: Required array (`minItems: 1`) initialized with exactly one default `result` object containing auto-generated `uuid`, default `title: "Initial Assessment Result"`, `description`, `start` timestamp, and default `reviewed-controls` assembly populated with `{ "control-selections": [{ "include-all": {} }] }`.
  * **Metadata Management in Edit Mode:** In Edit Mode (`✏️ Edit`), Bob can modify `metadata.title`, increment semantic `metadata.version`, manage team parties (`metadata.parties[]`), define assessment roles (`metadata.roles[]`), assign responsible parties (`metadata.responsible-parties[]`), add contextual properties (`metadata.props[]`), and capture document-level `metadata.remarks`.
  * **Read-Only View Mode Dynamics:** In View Mode (`👁️ View`), metadata fields render as formatted display text and chips; all edit inputs, add buttons, and deletion triggers are hidden.
  * **Empty-Array Pruning:** When saving, empty arrays on optional metadata fields (`roles`, `parties`, `props`) are stripped via `remove_empty_arrays()` to prevent schema warnings, while mandatory arrays (`results`) are strictly preserved.

---

### US 6.2: Assessment Plan Import & Context Resolution
> *Implements [DD-016](../design_decisions/DD-016_cross_document_import_resolution.md) and [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** bind the Assessment Results document to a governing Assessment Plan via `import-ap.href` and inspect its live resolved context,  
> **so that** my assessment findings are evaluated strictly against the authorized audit scope, activities, and control objectives.

* **Acceptance Criteria:**
  * **Import AP Picker & Workspace Modal:** In Edit Mode, the Overview tab provides a "Governing Assessment Plan" card with a "Browse Assessment Plans..." action opening a modal of all workspace APs (`GET /api/documents/assessment-plans`).
  * **Reference Syntax Support:** The `href` field accepts relative workspace file paths (e.g., `../assessment-plans/{ap_uuid}.json`), local document fragments (`#{ap_uuid}`), or external HTTPS URIs. An optional `import-ap.remarks` field records authorization mandates.
  * **Live Context Resolution Summary Card:** When a valid AP is selected, the UI dispatches a resolution check and renders a **Live Target AP Summary Card** detailing:
    * Assessment Plan Title, Version, and Publication Timestamp.
    * Target System Security Plan (SSP) name and categorization referenced by the AP.
    * Planned controls count declared in the AP's `reviewed-controls`.
    * Total assessment subjects and authorized assessment platforms/assets.
    * Green `Resolved` badge on success or red `Unresolved Reference` alert on failure.
  * **Backend Semantic Integrity Validation:** Backend validation (`_validate_ar_integrity`) verifies that the referenced Assessment Plan exists in workspace storage or resolves to a valid URI. Dangling or unresolvable AP references trigger validation error `custom/ar-missing-ap`.
  * **View vs. Edit Dynamics:** In View Mode, `import-ap.href` displays as an external link chip with target AP metadata summary; file browser triggers and input controls are suppressed.

---

### US 6.3: Result Sets Scoping, Multi-Phase Audits & Timeframes
> *Implements [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** create, title, and manage multiple result sets with start and end timestamps,  
> **so that** I can record findings across distinct audit phases, physical sites, or re-assessment cycles within a single unified AR document.

* **Acceptance Criteria:**
  * **Strict Nesting Requirement:** All observations, findings, risks, and assessment logs MUST reside strictly within elements of the root `assessment-results.results[]` array. Declaring findings or risks at the root level of `assessment-results` is prohibited by schema and rejected by backend validation.
  * **Result Set Selector & Scope Switching:** The UI top bar and Result Sets tab feature an "Active Result Set" switcher. Selecting a result set dynamically filters all child tabs (Findings, Observations, Risks, Assessment Log) to display and mutate data belonging exclusively to that active result set.
  * **Adding Result Sets:** Bob can click "➕ Add Result Set" to append a new `result` object:
    * `uuid`: Auto-generated RFC 4122 v4 UUID.
    * `title`: Required markup-line string (e.g., `"Phase 2 Penetration Testing & Vulnerability Assessment"`).
    * `description`: Required markup-multiline string summarizing testing objectives.
    * `start`: Required ISO 8601 UTC timestamp with timezone.
    * `end`: Optional ISO 8601 UTC timestamp. The UI validates that `end >= start`.
    * `reviewed-controls`: Initialized with `{ "control-selections": [{ "include-all": {} }] }` to satisfy schema `minItems: 1`.
  * **Result Set Deletion Boundaries:** If `results[]` contains only one item, the delete action is disabled with an explanatory tooltip (`NIST OSCAL Assessment Results requires at least 1 result set`). If multiple result sets exist, deletion requires confirmation and cleans up local references.
  * **Dual-State Presentation:** In Edit Mode, result set headers, start/end date-pickers, and descriptions are interactive input fields. In View Mode, they render as clean title cards with duration badges (e.g., `Start: 2026-08-01 09:00 UTC | End: 2026-08-15 17:00 UTC`).

---

### US 6.4: Reviewed Controls Scoping & Statement Part Tailoring
> *Implements [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** tailor the reviewed controls and objectives evaluated within each result set,  
> **so that** the result set explicitly declares which controls were examined, tested, or excluded during that audit window.

* **Acceptance Criteria:**
  * **Reviewed Controls Assembly Structure:** Within each `result`, `reviewed-controls` is mandatory and contains `control-selections` (`minItems: 1`).
  * **Populate from Target AP Scope:** A one-click action "Sync Scope from Assessment Plan" automatically copies the `reviewed-controls` configuration from the imported AP into the active result set.
  * **Inclusion Directives:** Bob can configure `control-selections[]` using either:
    * `include-all`: Global wildcard `{}` including all controls from the baseline.
    * `include-controls`: Array of specific control IDs via `with-ids[]` (e.g., `["ac-2", "ia-2", "si-4"]`) with optional regex patterns via `matching[]`.
  * **Exclusion Directives (`exclude-controls`):** Bob can declare specific control exclusions via `with-ids[]` or `matching[]`. Per NIST OSCAL precedence rules, exclusions strictly override inclusions.
  * **Statement Part Inclusion (`with-child-controls`):** Toggling child controls specifies whether sub-controls and statement enhancements (`ac-2.1`, `ac-2.2`) are included by default (`yes` / `no`).
  * **Objective Selections (`control-objective-selections`):** Bob can optionally refine control objective scoping via `include-all` or `include-objectives.with-ids[]` referencing specific objective tokens (e.g., `["ac-2_obj_1", "ia-2_obj_a"]`).
  * **Live Scoped Control Counter:** A header metric displays "X Controls Reviewed in this Result Set", updating live as inclusion/exclusion rules are adjusted.

---

### US 6.5: Observations & Empirical Evidence Collection
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** document granular audit observations with standardized assessment methods, collection timestamps, and evidence references,  
> **so that** findings are supported by verifiable, immutable audit facts.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `assessment-results.results[active_index].observations[]`.
  * **Mandatory Observation Fields:**
    * `uuid`: Auto-generated unique RFC 4122 v4 identifier.
    * `description`: Required markup-multiline text describing the factual observation.
    * `methods`: Required array (`minItems: 1`) of standardized assessment methods.
    * `collected`: Required ISO 8601 UTC timestamp indicating when evidence was gathered.
  * **Observation Methods Enum:** The UI enforces selection of methods exclusively from the official OSCAL enum:
    * `EXAMINE` (Documentation, configuration, or architectural review)
    * `INTERVIEW` (Personnel interviews and discussions)
    * `TEST` (Technical verification, automated scripts, or penetration testing)
    * `UNKNOWN` (Unspecified or legacy method)
    Selecting multiple methods (e.g., `EXAMINE` and `TEST`) is fully supported.
  * **Observation Types Enum:** Bob can assign standardized observation types: `ssp-statement-issue`, `control-objective`, `mitigation`, `finding`, `discovery`, `historic`.
  * **Evidence Linking (`relevant-evidence[]`):** Each observation supports attaching evidence references with required `description` and optional `href` pointing to embedded `#resource-uuid` in `back-matter.resources[]` or external URLs.
  * **Origin & Subjects Tracking:** Bob can document `origins.actors[]` (`tool`, `assessment-platform`, `party`) and link `subjects[]` (`component`, `inventory-item`, `user`, `location`).
  * **Dual-State Cards & Badges:**
    * Edit Mode: Multi-select pill checkboxes for methods, date-time picker for `collected`, and editable markdown description.
    * View Mode: Compact observation card with blue method chips (`EXAMINE`, `TEST`), timestamp badge (`Collected: 2026-08-10 14:30 UTC`), and clickable evidence attachment chips.

---

### US 6.6: Finding Determination & Target Semantics
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** declare formal assessment findings against specific control statements or objectives with definitive satisfaction states,  
> **so that** non-compliant areas are clearly distinguished from satisfied requirements.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `assessment-results.results[active_index].findings[]`.
  * **Mandatory Finding Fields:**
    * `uuid`: Auto-generated unique identifier.
    * `title`: Required markup-line summary (e.g., `"Inactive Service Accounts Not Terminated within 90 Days"`).
    * `description`: Required detailed explanation of the compliance determination.
    * `target`: Required `finding-target` assembly.
  * **Finding Target Semantics:** The `target` assembly strictly enforces:
    * `target.type`: Enum restricted to `statement-id` or `objective-id`. Arbitrary strings like `control-id` are strictly rejected by schema and UI.
    * `target.target-id`: Valid statement ID (e.g., `ac-2_smt_a`) or objective ID (e.g., `ac-2_obj_1`) selected via autocomplete dropdown of scoped controls.
    * `target.status.state`: Enum restricted to `satisfied` or `not-satisfied`.
    * `target.status.reason`: Optional enum restricted to `pass`, `fail`, `other`.
  * **Implementation Statement Reference:** Bob can optionally specify `implementation-statement-uuid` linking the finding directly to the corresponding statement in the imported SSP.
  * **Status Badge Styling:**
    * `satisfied`: 🟢 Green badge with checkmark (`Satisfied - Pass`).
    * `not-satisfied`: 🔴 Red badge with warning alert (`Not Satisfied - Fail`).
  * **Edit vs. View Interaction:** In Edit Mode, status toggles via a segmented control `[ 🟢 Satisfied | 🔴 Not Satisfied ]`. In View Mode, the determination is highlighted prominently with target statement breadcrumbs.

---

### US 6.7: Observation-Finding-Risk Triad Referential Linking
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** interlink findings with their underlying observations and resultant risks using validated UUID references,  
> **so that** every audit finding provides end-to-end evidence and risk traceability.

* **Acceptance Criteria:**
  * **Triad Relationship Model:**
    * A finding references supporting observations via `finding.related-observations[].observation-uuid`.
    * A finding references resulting risks via `finding.related-risks[].risk-uuid`.
    * A risk can reciprocally reference root observations via `risk.related-observations[].observation-uuid`.
  * **Multi-Select Relationship Pickers:** In the Finding Editor modal/drawer, the UI provides searchable multi-select pickers listing all observations and risks defined in the active result set:
    * Observation selector displays observation title, method badges, and collection date.
    * Risk selector displays risk title, status badge, and CVSS score.
  * **Strict Referential Integrity Enforcement:**
    * Every `observation-uuid` in `related-observations[]` MUST resolve to an existing `observation.uuid` within the same result set.
    * Every `risk-uuid` in `related-risks[]` MUST resolve to an existing `risk.uuid` within the same result set.
    * Backend semantic integrity validation (`_validate_ar_integrity`) inspects all cross-references and rejects payloads with dangling or mismatched UUIDs.
  * **Visual Traceability Grid:** In View Mode, expanding a finding card displays a split-pane "Evidence & Impact" panel: left side lists linked observations with quick-view preview drawers; right side lists linked risks with severity bars.

---

### US 6.8: Identified Risks Inventory & Mandatory Statement
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-018](../design_decisions/DD-018_risk_scoring_characterization_ui.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** document identified security risks with mandatory risk statements and threat identifiers,  
> **so that** system vulnerabilities and potential attack impacts are clearly characterized for governance stakeholders.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `assessment-results.results[active_index].risks[]`.
  * **Mandatory Risk Fields:**
    * `uuid`: Auto-generated unique RFC 4122 v4 identifier.
    * `title`: Required markup-line string (e.g., `"Privilege Escalation via Legacy Service Account"`).
    * `description`: Required detailed explanation of the vulnerability context.
    * `statement`: Mandatory markup-multiline string explicitly describing the risk condition, threat actor capability, and potential business consequence. Omitting `statement` fails schema validation.
    * `status`: Required lifecycle status token.
  * **Threat Identifiers (`threat-ids[]`):** Bob can add standardized threat references:
    * `id`: Threat identifier token (e.g., `CVE-2024-3094`, `CWE-287`, `CAPEC-115`).
    * `system`: Canonical URI identifying the naming system (e.g., `http://cve.mitre.org`, `http://cwe.mitre.org`).
    * `type`: Threat taxonomy type (e.g., `"cve"`, `"cwe"`, `"threat-actor"`).
  * **Mitigating Factors (`mitigating-factors[]`):** Bob can declare existing compensating controls or mitigating safeguards with `uuid`, `description`, and optional `implementation-uuid` pointing to SSP components.

---

### US 6.9: Risk Lifecycle State Machine & Risk Log Audit Trail
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md) and [DD-020](../design_decisions/DD-020_badge_and_status_colors.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** advance risk statuses through a controlled lifecycle state machine and automatically record changes in the risk log,  
> **so that** risk progression and deviation approvals are immutably audited over time.

* **Acceptance Criteria:**
  * **Standardized Risk Status Enum:** Risk `status` is strictly restricted to official OSCAL tokens:
    * `open` (🔴 Red) — Newly identified, unmitigated risk.
    * `investigating` (🟠 Orange) — Under technical analysis or reproduction.
    * `remediating` (🟡 Yellow) — Corrective action plan in progress.
    * `deviation-requested` (🟣 Purple) — Risk acceptance or false-positive requested.
    * `deviation-approved` (🔵 Blue with ⚠️ alert) — Formally approved deviation/waiver.
    * `closed` (🟢 Green) — Verified remediated or confirmed false-positive.
  * **State Machine Transition Rules:** The UI validates permissible transitions (e.g., transitioning directly from `open` to `deviation-approved` is prohibited; it must pass through `deviation-requested` or require formal justification).
  * **Automated Risk Log Entry Generation:** Whenever Bob transitions a risk status in Edit Mode:
    * The system automatically generates and appends an entry to `risk.risk-log.entries[]`.
    * `uuid`: Auto-generated unique identifier.
    * `start`: Current ISO 8601 UTC timestamp.
    * `status-change`: Set to the new status token.
    * `logged-by`: Array of role/party UUIDs identifying the acting assessor.
    * `remarks`: Optional user-entered justification (mandatory when selecting `deviation-approved`).
  * **Deviation Property Handling:**
    * Marking a risk as `false-positive` sets `props[name="false-positive", value="true"]` and transitions status to `closed`.
    * Marking a risk as `accepted` sets `props[name="accepted", value="true"]` after deviation approval.
  * **Audit Timeline Visualization:** The Risk Drawer renders a vertical chronological timeline of all `risk-log.entries[]` displaying date, status pill change (e.g., `open ➔ remediating`), actor name, and remarks.

---

### US 6.10: Risk Characterization & Multi-System Scoring (CVSS v3.1)
> *Implements [DD-018](../design_decisions/DD-018_risk_scoring_characterization_ui.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** score and characterize risks using CVSS v3.1 vector strings and qualitative facets,  
> **so that** risk severity is mathematically quantifiable and comparable across enterprise assets.

* **Acceptance Criteria:**
  * **Characterization Assembly:** Stored in `risk.characterizations[]`.
  * **Mandatory Characterization Properties:**
    * `origin.actors[]`: Identifies the scoring engine or assessor (`type: "party" | "tool"`).
    * `facets[]`: Array (`minItems: 1`) of scoring metrics. Each facet requires `name`, `system`, and `value`.
  * **CVSS v3.1 Vector Input & Calculation:**
    * Bob can input or paste a raw CVSS v3.1 vector string (e.g., `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`).
    * The system parses the vector, computes Base Score (e.g., `9.8`), Temporal Score, and Environmental Score, and visualizes qualitative severity badges:
      * Critical (`9.0 - 10.0`): 🔴 Red
      * High (`7.0 - 8.9`): 🟠 Dark Orange
      * Medium (`4.0 - 6.9`): 🟡 Amber
      * Low (`0.1 - 3.9`): 🟢 Soft Green
      * None (`0.0`): ⚪ Neutral Gray
  * **Facet Serialization:** Stored standard-compliantly in `characterizations[].facets[]`:
    * `{ "name": "base-score", "system": "http://nvd.nist.gov/vuln-metrics/cvss/v3-1", "value": "9.8" }`
    * `{ "name": "vector-string", "system": "http://nvd.nist.gov/vuln-metrics/cvss/v3-1", "value": "CVSS:3.1/..." }`
    * `{ "name": "qualitative-severity", "system": "http://nvd.nist.gov/vuln-metrics/cvss/v3-1", "value": "CRITICAL" }`
  * **Interactive Metric Sliders:** In Edit Mode, Bob can interact with visual slider buttons for Attack Vector (AV), Attack Complexity (AC), Privileges Required (PR), User Interaction (UI), Scope (S), and Impact (C/I/A), instantly recalculating the CVSS score.

---

### US 6.11: Risk Remediation Responses & Action Planning
> *Implements [DD-017](../design_decisions/DD-017_shared_assessment_entities.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** propose concrete remediation responses and track their initial lifecycle intent,  
> **so that** system owners receive actionable guidance to mitigate identified risks in the downstream POA&M.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `risk.remediations[]` (OSCAL `response` assembly).
  * **Mandatory Remediation Fields:**
    * `uuid`: Auto-generated unique RFC 4122 v4 identifier.
    * `lifecycle`: Required enum token representing remediation stage:
      * `recommendation` (🔵 Blue) — Assessor recommendation, not yet scheduled.
      * `planned` (🟡 Yellow) — Scheduled for implementation with target dates.
      * `completed` (🟢 Green) — Implemented and verified effective.
    * `title`: Required markup-line string summarizing the corrective action.
    * `description`: Required detailed explanation of implementation steps.
  * **Remediation Classification (`props`):** Bob can classify the response type via `props[name="type"]` using standard risk responses: `mitigate`, `avoid`, `transfer`, `accept`, `contingency`.
  * **Scheduling & Responsible Roles:** Remediations support optional target implementation dates and `responsible-roles[]` designating owner groups (e.g., `"DevOps-Lead"`, `"Security-Engineering"`).
  * **Downstream Handshake:** Remediations authored in Assessment Results serve as initial templates directly ingested into `poam-items` and risk remediations during Stage 7 POA&M generation.

---

### US 6.12: Assessment Log Timeline & Operational Event Tracking
> *Implements [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** log assessment execution events, testing milestones, and operational hurdles chronologically,  
> **so that** the assessment execution history is fully transparent and defensible.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `assessment-results.results[active_index].assessment-log.entries[]`.
  * **Mandatory Entry Fields:**
    * `uuid`: Auto-generated unique RFC 4122 v4 identifier.
    * `title`: Optional descriptive event summary.
    * `description`: Optional markup-multiline details of the activity.
    * `start`: Required ISO 8601 UTC timestamp when the event occurred.
    * `end`: Optional ISO 8601 UTC timestamp.
    * `logged-by`: Optional array of party UUIDs recording who created the entry.
  * **Task Association (`related-tasks[]`):** Log entries can reference planned task UUIDs from the governing Assessment Plan via `related-tasks[].task-uuid`.
  * **Fully Functional Detail Drawers (No Stubbed Handlers):** Clicking any row or event node in the assessment log table opens a fully operational slide-over drawer displaying complete event metadata, actor attribution, and related tasks without console errors or empty `() => {}` stubs.
  * **Chronological Timeline View:** The UI renders an interactive chronological timeline with date markers, event category icons (scan, interview, testing, milestone), and expandable details.

---

### US 6.13: Formal Assessor Attestations & Sign-Off Parts
> *Implements [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** record formal assessment attestations, auditor independence statements, and executive sign-offs,  
> **so that** the report satisfies official compliance body certification requirements.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `assessment-results.results[active_index].attestations[]`.
  * **Mandatory Attestation Fields:**
    * `uuid`: Auto-generated unique identifier.
    * `parts`: Array (`minItems: 1`) of structured statement parts (`assessment-part`).
  * **Attestation Parts Schema:** Each part requires:
    * `name`: Standardized token, default `"assessment-attestation"` or `"independence-declaration"`.
    * `prose`: Required markup-multiline attestation statement (e.g., `"The assessment team affirms that testing was conducted in strict accordance with the authorized rules of engagement without undue influence."`).
  * **Responsible Parties Attribution:** Bob can attach `responsible-parties[]` linking specific auditor parties (`party-uuid`) and assigned roles (`role-id: "lead-assessor"`).
  * **Digital Sign-Off Badge:** In View Mode, verified attestations display as an authoritative green "Certified & Attested" banner displaying signer name, role, organization, and timestamp.

---

### US 6.14: Two-Tier Local Definitions Architecture
> *Implements [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** define procedural evaluation methods at the root level and execution assets at the result-set level,  
> **so that** definitions strictly conform to the two-tier local definitions architecture of the NIST OSCAL schema.

* **Acceptance Criteria:**
  * **Two-Tier Architecture Distinction:** The UI cleanly segregates local definitions into two separate management views:
    1. **Root-Level Definitions (`assessment-results.local-definitions`):** Procedural methodology definitions.
    2. **Result-Level Definitions (`results[].local-definitions`):** Execution runtime assets and inventory.
  * **Root-Level Assemblies (`assessment-results.local-definitions`):**
    * `objectives-and-methods`: Reusable local assessment objectives (`local-objective[]`) specifying `control-id` and parts.
    * `activities`: Reusable procedural activities (`activity[]`) specifying `uuid`, `description`, and sequential `steps[]`.
    * *Schema Constraint:* Root-level definitions MUST NOT declare components, inventory items, or users. The UI strictly hides these options at the root level to prevent `additionalProperties: false` schema errors.
  * **Result-Level Assemblies (`results[].local-definitions`):**
    * `components`: Local testing components (e.g., vulnerability scanners, custom test harnesses).
    * `inventory-items`: Specific hardware or virtual inventory evaluated during that result set.
    * `users`: Ephemeral test user accounts utilized during execution.
    * `assessment-assets`: Local assessment platform declarations.
    * `tasks`: Execution tasks specific to that audit run.
  * **Autocomplete & Reusability:** When authoring observations and findings, components and activities defined in local definitions appear in search suggestions.

---

### US 6.15: Back-Matter Embedded Evidence Attachments (Base64)
> *Implements [US 0.16](step0_global_requirements.md), [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md), and [DD-038](../design_decisions/DD-038_assessment_results_scoping_and_correlation.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** attach raw vulnerability scan outputs, configuration exports, and screenshots as Base64-encoded resources in `back-matter.resources[]`,  
> **so that** the Assessment Results document is fully self-contained and auditable offline without external dependencies.

* **Acceptance Criteria:**
  * **Drag-and-Drop File Upload:** In the Attachments section, a drop zone accepts evidence files (e.g., `.xml`, `.json`, `.csv`, `.pdf`, `.png`).
  * **Client-Side Base64 Encoding:** The browser reads selected files via `FileReader.readAsDataURL()`, strips MIME prefixes, and constructs an OSCAL `resource` object:
    * `uuid`: Auto-generated unique RFC 4122 v4 identifier.
    * `title`: File name string.
    * `description`: Optional user description of the evidence artifact.
    * `rlinks`: Array containing `{ "href": "#" + uuid, "media-type": mime_type }`.
    * `base64`: Embedded object `{ "filename": filename, "media-type": mime_type, "value": base64_payload }`.
  * **Referencing in Observations:** In the observation evidence editor, selecting an embedded attachment inserts a reference `href: "#" + resource_uuid`.
  * **Instant In-Browser Evidence Preview & Download:** Clicking an evidence link in View Mode triggers an instant download or in-browser preview modal of the decoded Base64 content.
  * **Storage Safeguards:** Warning triggers if single files exceed 10MB to prevent browser memory degradation.

---

### US 6.16: In-Card Editing, Segmented Mode Toggle & Draft Protection
> *Implements [US 0.17](step0_global_requirements.md) and [DD-004](../design_decisions/DD-004_draft_state_management.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** toggle seamlessly between View and Edit modes with URL synchronization and local draft auto-saving,  
> **so that** I can author complex assessment data iteratively without risk of accidental data loss.

* **Acceptance Criteria:**
  * **Segmented Mode Toggle (`[ 👁️ View | ✏️ Edit ]`):** Located prominently in the top navigation bar. Switching modes updates the URL search param (`?edit=true`) without triggering a page reload.
  * **View Mode (`👁️ View`):** Form controls, textareas, deletion buttons, and add buttons are completely hidden. Data is presented in high-density, readable cards, badges, and read-only tables.
  * **Edit Mode (`✏️ Edit`):** Activates inline inputs, markdown editors, multi-select pickers, deletion triggers, and dirty state tracking.
  * **Draft Buffer Persistence (`useDraft`):** Edits update local component state and buffer to `<uuid>_draft.json` in the background. Unsaved changes display an "Unsaved Changes" indicator.
  * **Navigation Protection:** Navigating away from an edited document with uncommitted changes triggers a confirmation modal (`You have unsaved changes. Discard or continue editing?`).
  * **Clean Schema Saving:** Clicking "Save" validates against `oscal_assessment-results_schema.json`, purges empty optional arrays via `remove_empty_arrays()`, increments revision history in `metadata.revisions[]`, and clears draft caches.

---

### US 6.17: Standalone Multi-Format Export & Audit Readiness
> *Implements [US 0.15](step0_global_requirements.md) and [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** Lead Assessor (Bob)  
> **I want to** export the completed Assessment Results document in NIST OSCAL JSON, XML, or YAML,  
> **so that** the results can be ingested by automated GRC platforms or handed to external certification authorities.

* **Acceptance Criteria:**
  * **Export Trigger (`📥 Export`):** Located in the top bar with a format selection dropdown (JSON, XML, YAML).
  * **100% Schema Validation Guarantee:** Before export serialization, the backend validates the payload against `oscal_assessment-results_schema.json` and runs semantic integrity checks (`_validate_ar_integrity`). Export is aborted with actionable errors if schema violations exist.
  * **Complete Document Attribution:** Exported documents preserve all metadata, import references, result sets, findings, observations, risks, remediations, attestations, and embedded Base64 resources.
  * **Direct Browser Download:** Generates and initiates a direct file download named `{title_slug}_ar_v{version}.json` with accurate MIME type `application/json`.

---

## 2. Bob's Detailed Workflow & User Journey

1. **Document Initialization (US 6.1):** Bob logs into Reposol and navigates to the Assessment Results catalog. He clicks "New Assessment Results", enters the title *"FedRAMP High Cloud Infrastructure Annual Assessment Results"*, and is redirected immediately to `/assessment-results/{uuid}?edit=true`. In the Overview tab, he sets `metadata.version` to `1.0.0` and adds his team parties and roles.
2. **Link Governing Assessment Plan (US 6.2):** Under the Governing Assessment Plan section, Bob clicks "Browse Assessment Plans...", locates the authorized audit plan *"FedRAMP High Enclave Assessment Plan v1.2"*, and selects it. The system resolves `import-ap.href` to `../assessment-plans/ap-fedramp-high-2026.json`. A green Live Target AP Summary card appears, confirming that 124 controls and 3 authorized scanning platforms are in scope.
3. **Configure Active Result Set & Scoping (US 6.3, US 6.4):** Bob navigates to the Result Sets tab. He renames the initial result set to *"Core Network & Identity Subsystem Audit"*, sets `start` to `2026-08-01T08:00:00Z`, and clicks "Sync Scope from Assessment Plan". The system automatically populates `reviewed-controls.control-selections` with the target controls, including `ac-2` (Account Management), `ia-2` (Identification and Authentication), and `si-4` (Information System Monitoring).
4. **Gather Evidence & Upload Scan Logs (US 6.5, US 6.15):** Bob switches to the Observations & Evidence tab. He uploads a raw vulnerability scan file `nessus_core_cluster_scan.xml` (5.2 MB) into the drop zone. The system encodes it into `back-matter.resources[]` as Base64. Bob creates observation `obs-ac2-01`:
   * Description: *"Automated scan and LDAP query revealed 14 privileged service accounts inactive for >120 days without termination or re-authorization."*
   * Methods: Selects `TEST` and `EXAMINE`.
   * Collected: Sets timestamp `2026-08-03T11:15:00Z`.
   * Evidence: Links `#resource-nessus-xml`.
5. **Formulate Non-Compliance Finding (US 6.6, US 6.7):** Bob opens the Findings tab and clicks "➕ Add Finding":
   * Title: *"Inactive Privileged Service Accounts Not Terminated within 90 Days"*
   * Target Type: Selects `statement-id`.
   * Target ID: Autocompletes and selects `ac-2_smt_a`.
   * Status State: Sets to `not-satisfied` (🔴 Red badge).
   * Status Reason: Sets to `fail`.
   * Related Observations: Selects observation `obs-ac2-01`.
6. **Characterize Risk & Model CVSS v3.1 (US 6.8, US 6.9, US 6.10):** From the finding drawer, Bob clicks "➕ Create Associated Risk". The Identified Risks editor opens:
   * Title: *"Credential Exposure & Unauthorized Access via Orphaned Service Accounts"*
   * Statement: *"Orphaned privileged service accounts retain domain administrator privileges without password rotation, enabling lateral movement and unauthorized persistence if credentials are leaked."*
   * Threat ID: Adds `CVE-2024-21413` and `CWE-287`.
   * CVSS Scoring: Pastes vector `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`. The system calculates Base Score `9.1` with a Critical badge.
   * Status: Set to `open` (🔴 Red). A risk log entry is automatically created.
7. **Propose Remediation Response (US 6.11):** Under the risk's Remediations panel, Bob clicks "➕ Add Remediation":
   * Title: *"Automate Service Account Deprovisioning & Enforce PAM Vaulting"*
   * Lifecycle: Sets to `recommendation` (🔵 Blue).
   * Description: *"Configure HashiCorp Vault dynamic secrets with 24-hour TTL for all Kubernetes service accounts and integrate automated HR deprovisioning webhooks."*
8. **Record Assessment Log & Assessor Sign-Off (US 6.12, US 6.13):** Bob records a testing milestone in the Assessment Log for technical audit completion. In the Attestations tab, Bob enters the independence statement, signs off as Lead Assessor, and attaches his party UUID.
9. **Integrity Validation, Versioning & Export (US 6.16, US 6.17):** Bob clicks "Save Changes". The backend validator runs Level 1 JSON schema checks and Level 2 semantic integrity (`_validate_ar_integrity`), confirming that all observation and risk UUIDs resolve without dangling links. Bob toggles to `👁️ View` mode to inspect the clean, read-only report, then clicks `📥 Export JSON` to download the audit-ready OSCAL file for the system owner's Stage 7 POA&M team.

---

## 3. Functional Requirements for the System

- **Strict Root-Level Results Encapsulation:** The backend schema and persistence layer strictly mandate that all findings, observations, risks, and assessment logs are encapsulated within elements of `results[]` (US 6.1, US 6.3).
- **Referential Integrity Validation (`_validate_ar_integrity`):** The backend integrity engine strictly validates that:
  1. The referenced Assessment Plan (`import-ap.href`) exists and resolves in workspace storage (US 6.2).
  2. Every UUID in `finding.related-observations[]` resolves to an existing observation within the same result set (US 6.7).
  3. Every UUID in `finding.related-risks[]` resolves to an existing risk within the same result set (US 6.7).
  4. Every UUID in `risk.related-observations[]` resolves to an existing observation (US 6.7).
- **Target Semantic Enum Enforcement:** Target types are strictly restricted to `statement-id` or `objective-id`, and target states are restricted to `satisfied` or `not-satisfied` (US 6.6).
- **Observation Method Enum Validation:** Methods are restricted to `EXAMINE`, `INTERVIEW`, `TEST`, and `UNKNOWN` with `minItems: 1` (US 6.5).
- **Mandatory Risk Statements & Lifecycle Transitions:** Risk entities require non-empty `statement` fields and advance through controlled state machine transitions, automatically logging changes to `risk-log.entries[]` (US 6.8, US 6.9).
- **Mathematical CVSS v3.1 Engine:** Real-time parser and calculation engine supporting vector strings, numeric base scores (0.0–10.0), and standard qualitative severity ratings (US 6.10).
- **Operational UI Drawers Without Stubs:** Detail drawers for components, users, tasks, and log events provide operational inspection interfaces with zero non-functional event stubs (US 6.12).
- **Two-Tier Local Definitions Partitioning:** Procedural definitions (`objectives-and-methods`, `activities`) are allowed at the root, while execution assets (`components`, `inventory-items`, `users`) are restricted to the result set level (US 6.14).
- **Client-Side Base64 Attachment Pipeline:** Files uploaded to back-matter are encoded client-side into self-contained `base64` resources and referenced via `#resource-uuid` fragments (US 6.15).
- **Draft Persistence & Empty Array Purging:** Local and backend draft caching via `useDraft`, paired with automatic pruning of empty optional arrays on save (`minItems: 1` protection) (US 6.16, US 6.17).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] **US 6.1:** Document creation dialog redirects to in-place editor with auto-generated UUID, valid metadata, and initialized default result set.
- [x] **US 6.2:** Governing Assessment Plan selector links `import-ap.href` with workspace modal and displays live resolved AP summary card.
- [x] **US 6.3:** Result sets manager enforces strict nesting in `results[]`, allows creating/editing multiple result sets, and enforces `minItems: 1`.
- [x] **US 6.4:** Reviewed controls scoping supports `include-all`, `include-controls.with-ids`, exclusions, and AP scope synchronization.
- [x] **US 6.5:** Observations require `uuid`, `description`, `collected` timestamp, and standardized methods enum (`EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN`).
- [x] **US 6.6:** Findings enforce target semantics (`statement-id` / `objective-id`), status states (`satisfied` / `not-satisfied`), and pass/fail reasons.
- [x] **US 6.7:** Finding-Observation-Risk triad relationships are maintained with bi-directional linking and backend referential integrity verification.
- [x] **US 6.8:** Risks require mandatory `statement`, support threat IDs (CVE/CWE), and allow documenting mitigating factors.
- [x] **US 6.9:** Risk lifecycle state machine enforces valid status transitions and automatically appends chronological audit entries to `risk-log`.
- [x] **US 6.10:** Risk characterization calculates CVSS v3.1 base scores from vector strings and serializes facets into standardized OSCAL metrics.
- [x] **US 6.11:** Remediation responses capture initial corrective action plans with lifecycle stages (`recommendation`, `planned`, `completed`).
- [x] **US 6.12:** Assessment log records execution events with timestamps, logged-by roles, and functional slide-over inspection drawers.
- [x] **US 6.13:** Attestations capture formal assessor sign-off parts and render certification badges with responsible party attribution.
- [x] **US 6.14:** Two-tier local definitions cleanly partition root-level procedural methods from result-level execution runtime assets.
- [x] **US 6.15:** Back-matter resources support client-side Base64 file encoding, `#resource-uuid` linking, and instant offline preview/download.
- [x] **US 6.16:** Segmented mode toggle (`[ 👁️ View | ✏️ Edit ]`) switches URL state, activates in-card authoring, and auto-saves local drafts.
- [x] **US 6.17:** Standalone export generates 100% NIST OSCAL schema-compliant JSON, XML, and YAML files with complete attribute preservation.
