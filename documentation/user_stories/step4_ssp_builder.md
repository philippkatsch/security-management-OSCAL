# Step 4: Detailed User Stories – System Security Plan (SSP) Builder

* **Persona:** Alice (Compliance Officer / System Owner / Authorizing Official POC)
* **Goal:** Creation, configuration, parameterization, and verification of an authoritative NIST OSCAL System Security Plan (SSP) (v1.2.2). The SSP formally establishes the system authorization boundary, categorizes data sensitivity and security impact per NIST SP 800-60 and FIPS-199, imports and resolves the control baseline (Profile or Catalog), inventories all operational components and user privileges, details control satisfaction through concrete technical/procedural components and fine-grained statements, resolves multi-tier cascading parameter overrides, and models security inheritance with common control providers. The SSP unites Catalogs (Stage 1), Profiles (Stage 2), and Component Definitions (Stage 3) into an auditable compliance deliverable.
* **Lifecycle Position:** Stage 4 in the NIST OSCAL lifecycle (`Catalog` / `Profile` → `Component Definition` → **`System Security Plan (SSP)`** → `Assessment Plan (AP)` → `Assessment Results (AR)` → `POA&M` → `Control Mapping`). Serves as the authoritative system authorization baseline that feeds assessment scoping in Stage 5.

---

## 1. Breakdown of User Stories

### US 4.1: Minimal SSP Document Creation & Mandatory 6-Assembly Root Scaffold
> *Implements [US 0.14](step0_global_requirements.md) with SSP-specific initialization rules.*  
> *References DD-002, DD-004, DD-014, DD-029*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** create a new System Security Plan by entering only a document title and system name in a streamlined dialog and be immediately redirected to the in-place editor (`/ssp/{uuid}?edit=true`),  
> **so that** the backend automatically provisions all six mandatory OSCAL SSP root assemblies without cumbersome preliminary setup wizards.

* **Acceptance Criteria:**
  * **Minimal Creation Dialog:** Clicking "New SSP" on `/ssp` opens a modal requesting `metadata.title` (required string, non-empty) and initial `system-characteristics.system-name` (required string).
  * **Mandatory 6-Assembly Scaffold:** The backend generates an authoritative document shell adhering strictly to the NIST OSCAL SSP JSON Schema v1.2.2 (`oscal_ssp_schema.json`). ALL SIX root assemblies are strictly mandatory:
    1. `system-security-plan.uuid`: Newly generated RFC 4122 v4 UUID.
    2. `metadata`: Contains `title`, `published` (omitted until first publish), `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`, `roles: []`, `parties: []`.
    3. `import-profile`: `{ "href": "" }` (required 1..1 root assembly pointing to a baseline profile or catalog).
    4. `system-characteristics`: Contains:
       * `system-ids`: `[{ "id": "SYS-TEMP-001" }]` (satisfying `minItems: 1`).
       * `system-name`: Initialized from user input.
       * `description`: Initialized narrative.
       * `system-information`: `{ "information-types": [] }`.
       * `status`: `{ "state": "under-development" }`.
       * `authorization-boundary`: `{ "description": "Authorization boundary definition in development." }`.
    5. `system-implementation`: Contains:
       * `components`: `[{ "uuid": <auto-uuid>, "type": "this-system", "title": <system-name>, "description": "The system as a whole representing organizational, administrative, and system-wide controls.", "status": { "state": "operational" } }]` (satisfying `minItems: 1` and the root component requirement).
       * `users`: `[]`.
    6. `control-implementation`: Contains:
       * `description`: `"System security control implementation details."` (required 1..1 string).
       * `implemented-requirements`: `[]`.
  * **Direct Redirection & Mode Synchronization:** Alice is immediately redirected to `/ssp/{uuid}?edit=true`. The Segmented Mode Toggle defaults to `[ ✏️ Edit ]`, activating authoring controls across all tabs.
  * **View vs. Edit Mode:**
    * In **Edit Mode** (`✏️ Edit`, `?edit=true`): Interactive form controls, add/remove buttons, drawer triggers, and dirty-state tracking (`useDraft`) are active.
    * In **View Mode** (`👁️ View`): All controls render as clean, read-only audit typography with badge summaries.
  * **Schema Conformity:** The generated document validates against `oscal_ssp_schema.json` with zero errors.

---

### US 4.2: Baseline Profile & Catalog Import Resolution
> *References DD-016, [DD-028](../design_decisions/DD-028_backend_resolution_engine.md)*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** select and import a baseline Profile or direct Catalog from the Reposol workspace (or via URI reference),  
> **so that** the active control baseline, control statements, parameters with baseline defaults, and profile modifications are resolved into the SSP authoring workspace.

* **Acceptance Criteria:**
  * **Workspace Baseline Browser:** In the "Overview & Baseline" tab, Alice configures `import-profile.href` (required, `uri-reference`) using a dedicated browser modal listing:
    * Workspace Profiles (`/api/documents/profiles`) with title, version, and control counts (e.g., `../profiles/fedramp-moderate-rev5.json`).
    * Direct Workspace Catalogs (`/api/documents/catalogs`) with title and family count (e.g., `../catalogs/nist-sp-800-53-r5.json`).
    * External HTTPS URIs or internal `#resource-uuid` references.
    * Optional `remarks` for capturing the regulatory mandate or scoping justification.
  * **Real-Time Baseline Resolution Engine:** Upon selecting a baseline source:
    * The backend resolution pipeline (`GET /api/resolve/ssp/{id}` or `POST /api/resolve/ssp/preview`) resolves the complete baseline:
      * For Profiles: Resolves imports, includes/excludes, parameter `set-parameters`, and profile modifications (`modify.alters`).
      * For Catalogs: Loads the full catalog group and control hierarchy directly.
  * **Baseline Summary Card:** Displays:
    * Total active baseline controls.
    * Breakdown by Control Families (e.g., `AC: 25`, `AU: 16`, `IA: 12`, `SC: 34`).
    * Total parameter placeholders and default values.
  * **Out-of-Sync Banner:** If the referenced profile or catalog is modified in the workspace, the SSP editor displays an amber notification: *"Baseline modified in workspace — click to re-resolve candidate controls"*.

---

### US 4.3: System Identification, Naming & Authorization Dates
> *References DD-014, DD-031*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare official system identifiers, full and short names, system descriptions, and authorization dates,  
> **so that** the system is uniquely identifiable across organizational governance registries and regulatory bodies.

* **Acceptance Criteria:**
  * **System Identifiers (`system-characteristics.system-ids[]`, required, `minItems: 1`):**
    * Alice can add, edit, and remove multiple system IDs.
    * Each entry requires `id` (string, e.g., `"SYS-2026-PROD-01"`).
    * Supports optional `identifier-type` (URI) with standard selectable presets:
      * `http://fedramp.gov/ns/oscal` (FedRAMP System Identifier).
      * `http://datatracker.ietf.org/doc/html/rfc4122` (UUID).
      * Custom enterprise URI.
  * **System Names & Descriptions:**
    * `system-name` (required, string): Official full name (e.g., `"Enterprise Cloud Security Management Platform"`).
    * `system-name-short` (optional, string): System acronym or abbreviation (e.g., `"ECSMP"`).
    * `description` (required, `markup-multiline`): Detailed architectural overview, operational scope, and business purpose.
  * **Authorization Date (`date-authorized`, optional, date):** Interactive date picker validating `YYYY-MM-DD` ISO regex format (`oscal-ssp-date-authorized-value-datatype`).
  * **Live Validation Feedback:** Prevents saving if `system-ids` is empty or if `system-name` or `description` is blank.

---

### US 4.4: Information Types & NIST SP 800-60 Categorization
> *References DD-014, DD-031*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare all information types processed, stored, or transmitted by the system and categorize them according to NIST SP 800-60,  
> **so that** data sensitivity and baseline Confidentiality, Integrity, and Availability (CIA) impact baselines are rigorously established.

* **Acceptance Criteria:**
  * **Information Types Entry (`system-information.information-types[]`, required, `minItems: 1`):**
    * Alice can add information types using the **NIST SP 800-60 Template Dropdown**:
      * *Customer Account / PII* (`C.2.4.1`)
      * *Financial Management* (`C.3.5.1`)
      * *Personnel Management* (`C.3.5.8`)
      * *IT Infrastructure Maintenance & Monitoring* (`C.3.5.7`)
      * *Public Web Information* (`C.2.8.2`)
      * *Custom Information Type...*
    * Selecting a template auto-fills `title`, `description`, `categorization.system: "http://doi.org/10.6028/NIST.SP.800-60v2r1"`, `information-type-ids[]`, and recommended baseline impact scores.
  * **Triad CIA Impact Assessment:**
    * For each dimension (`confidentiality-impact`, `integrity-impact`, `availability-impact`):
      * `base` (required, string): `fips-199-low`, `fips-199-moderate`, `fips-199-high`.
      * `selected` (optional, string): Adjusted impact level if organizational tailoring applies.
      * `adjustment-justification` (optional, `markup-multiline`): Mandatory if `selected` differs from `base`.
  * **Privacy Designation:** Toggling "Processes Personally Identifiable Information (PII)" sets property `{ "name": "privacy-designation", "value": "yes" }` and enables an optional Privacy Impact Assessment link (`rel="privacy-impact-assessment"`).
  * **Empty Array Pruning:** Validates that information types have unique auto-generated UUIDs and non-empty impact blocks before saving.

---

### US 4.5: Security Impact Level & FIPS-199 High-Water Mark Auto-Calculation
> *References DD-020, DD-022*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** establish system-wide security impact objectives (CIA) with automated FIPS-199 high-water mark calculation derived from information types,  
> **so that** the overall system categorization and sensitivity level are mathematically consistent with its data assets.

* **Acceptance Criteria:**
  * **Algorithmic High-Water Mark (HWM) Engine:**
    * When one or more information types are defined in US 4.4, the system executes the FIPS-199 High-Water Mark algorithm:
      * `Confidentiality_HWM = max( active_impact(info_type.confidentiality) for all info_types )`
      * `Integrity_HWM = max( active_impact(info_type.integrity) for all info_types )`
      * `Availability_HWM = max( active_impact(info_type.availability) for all info_types )`
      * Ordering rule: `fips-199-high` > `fips-199-moderate` > `fips-199-low`.
      * `Overall_Sensitivity_Level = max(Confidentiality_HWM, Integrity_HWM, Availability_HWM)`.
  * **Interactive Suggestion Banner:**
    * The UI renders an alert banner: *"Calculated FIPS-199 High-Water Mark: C: Moderate, I: High, A: Moderate -> Overall: High"*.
    * If manual values in `security-impact-level` are lower than the calculated HWM, a red warning banner alerts the user to the compliance inconsistency.
    * An **"Apply High-Water Mark Suggestion"** button updates:
      * `security-impact-level.security-objective-confidentiality` = `Confidentiality_HWM`
      * `security-impact-level.security-objective-integrity` = `Integrity_HWM`
      * `security-impact-level.security-objective-availability` = `Availability_HWM`
      * `system-characteristics.security-sensitivity-level` = `"high"` (or corresponding level).
  * **Color-Coded CIA Triad Cards:** Green chip for `fips-199-low`, amber chip for `fips-199-moderate`, red chip for `fips-199-high`.

---

### US 4.6: System Operational Status & Lifecycle State Machine
> *References DD-020*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare the system's operational lifecycle state,  
> **so that** authorizing officials and auditors understand whether the system is live, under construction, undergoing major changes, or decommissioned.

* **Acceptance Criteria:**
  * **Operational State Enum (`system-characteristics.status.state`, required):**
    * Dropdown strictly enforcing the 5 allowed OSCAL states:
      * `operational` — Live in production under active authorization.
      * `under-development` — Pre-production, undergoing initial build or testing.
      * `under-major-modification` — Operational but undergoing significant architectural overhaul.
      * `disposition` — Decommissioning, data migration, or system retirement phase.
      * `other` — Exceptional lifecycle condition.
  * **Mandatory Remarks for "Other":** If `state === "other"`, the `remarks` textarea becomes mandatory and is highlighted in red if empty.
  * **Global Status Badge:** The selected status renders prominently in the document header in both View and Edit modes with distinct status styling.

---

### US 4.7: Authorization Boundary Definition & Base64 Diagram Embedding
> *Implements [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md) and [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** describe the authorization boundary narrative and attach architecture diagrams embedded directly as Base64 back-matter resources,  
> **so that** the compliance boundary is 100% self-contained, portable, and machine-readable without external web dependencies.

* **Acceptance Criteria:**
  * **Boundary Narrative (`authorization-boundary.description`, required, `markup-multiline`):** Comprehensive narrative detailing what components, services, subnets, and physical locations are inside versus outside the boundary.
  * **Diagram Upload & Base64 Embedding:**
    * In Edit Mode, Alice can upload image files (PNG, SVG, JPEG ≤ 2MB).
    * Client-side `FileReader.readAsDataURL()` encodes the image directly into `back-matter.resources[]`:
      * `uuid`: auto-generated RFC 4122 v4 UUID.
      * `title`: `"Authorization Boundary Diagram - <filename>"`.
      * `base64`: `{ "value": "<base64-string>", "media-type": "image/png", "filename": "boundary.png" }`.
    * An entry is appended to `authorization-boundary.diagrams[]`:
      * `uuid`: auto-generated UUID.
      * `caption`: optional diagram caption.
      * `description`: 508 accessibility description / alt-text.
      * `links`: `[{ "rel": "diagram", "href": "#" + resource_uuid }]`.
  * **Inline Image Preview:** In both View and Edit modes, the diagram card resolves `#<resource_uuid>` against `back-matter.resources[]` and displays the image preview with zoom capabilities.
  * **Resource Pruning:** Deleting a diagram removes the diagram entry and purges unreferenced orphaned resources from `back-matter.resources[]`.

---

### US 4.8: Network Architecture & Data Flow Documentation
> *Implements [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** document network architecture and data flow topologies with narratives and embedded diagrams,  
> **so that** network perimeters, cryptographic boundaries, and ingress/egress data paths are documented in full detail.

* **Acceptance Criteria:**
  * **Network Architecture (`system-characteristics.network-architecture`, optional assembly):**
    * `description` (required if assembly present, `markup-multiline`): Narrative of physical and virtual network topology, subnets, DMZs, and security groups.
    * `diagrams[]`: Array of network diagrams embedded in `back-matter.resources[]` and linked via `#<resource-uuid>`.
  * **Data Flow (`system-characteristics.data-flow`, optional assembly):**
    * `description` (required if assembly present, `markup-multiline`): Narrative of data movement across boundaries, protocol security, and encryption in transit.
    * `diagrams[]`: Data flow diagrams embedded in `back-matter.resources[]`.
  * **Empty Assembly Purging:** If neither narrative nor diagrams are provided, the optional assemblies `network-architecture` and `data-flow` are completely omitted from JSON serialization to satisfy schema rules.

---

### US 4.9: Standardized System Properties & Responsible Parties
> *References DD-011, DD-014*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** configure standardized cloud deployment models, assurance levels, and bind responsible parties to standard OSCAL SSP roles,  
> **so that** operational governance and regulatory points of contact are formally established.

* **Acceptance Criteria:**
  * **Cloud & Assurance Property Palettes:**
    * `cloud-deployment-model`: Dropdown offering `public-cloud`, `private-cloud`, `community-cloud`, `government-only-cloud`, `hybrid-cloud`, `other`.
    * `cloud-service-model`: Dropdown offering `saas`, `paas`, `iaas`, `other`.
    * `identity-assurance-level` (IAL): `1`, `2`, `3` (NIST SP 800-63-3).
    * `authenticator-assurance-level` (AAL): `1`, `2`, `3`.
    * `federation-assurance-level` (FAL): `1`, `2`, `3`.
  * **Responsible Parties Binding (`system-characteristics.responsible-parties[]`):**
    * Alice assigns parties from `metadata.parties[]` to official OSCAL SSP roles:
      * `authorizing-official`, `authorizing-official-poc`, `system-owner`, `system-poc-management`, `system-poc-technical`, `system-poc-other`, `information-system-security-officer`, `privacy-poc`, `security-operations`, `maintainer`.
    * **Metaschema Uniqueness Constraint:** Metaschema rule `oscal-unique-ssp-system-characteristics-responsible-party` requires that each `role-id` appears at most once in `system-characteristics.responsible-parties[]`. Multiple individuals are stored in the single entry's `party-uuids[]` array.

---

### US 4.10: System Components Inventory & Component Definition Import (DISC-01 & DISC-02 Resolution)
> *Implements [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md), [DD-031](../design_decisions/DD-031_schema_form_and_entity_editor.md), and [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** manage system components, enforce the root `this-system` component, and import component templates from Stage 3 Component Definitions with full preservation of control implementations,  
> **so that** all technical assets are documented and pre-configured compliance capabilities transfer seamlessly into the SSP.

* **Acceptance Criteria:**
  * **Root `this-system` Component Mandatory:** The `system-implementation.components[]` array must always contain a component of `type="this-system"` representing the system as a whole. The UI displays this component with a distinctive system crown badge; it cannot be deleted.
  * **System Component Schema Requirements:** Each component requires:
    * `uuid` (RFC 4122 v4 UUID).
    * `type` (required): `this-system`, `system` (leveraged external), `software`, `hardware`, `service`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `network`, `interconnection`, or custom.
    * `title` (required, `markup-line`).
    * `description` (required, `markup-multiline`).
    * `status` (required assembly): `{ "state": "operational" | "under-development" | ... }`.
    * Optional: `purpose`, `props[]`, `protocols[]` with port ranges, `links[]`.
  * **Component Definition Import Modal (DISC-01 & DISC-02 Resolution):**
    * Clicking "Import from Component Definition" opens a workspace browser querying `GET /api/documents/component-definitions`.
    * Selecting components copies component metadata, properties, protocols, and **crucially preserves all `control-implementations[]`**.
    * The import engine automatically copies requirement narratives and statement breakdowns into the SSP's `control-implementation.implemented-requirements[].by-components[]` entries.
    * Injects required operational status `{ "status": { "state": "operational" } }`.
    * Creates a traceable provenance link on the component: `{ "rel": "imported-from", "href": "../component-definitions/{cdef_uuid}.json#component-{cdef_comp_uuid}" }`.

---

### US 4.11: System Users & Authorized Privileges Matrix
> *References DD-021, DD-031*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** define user types, access privileges, and authorized administrative functions in `system-implementation.users[]`,  
> **so that** logical access boundaries, separation of duties, and least-privilege enforcement are formally established.

* **Acceptance Criteria:**
  * **User Class Definition (`system-implementation.users[]`):** Each entry contains:
    * `uuid` (required, auto-generated UUID).
    * `title` (optional/recommended, `markup-line`, e.g., `"Cloud Infrastructure Administrator"`).
    * `short-name` (optional, string, e.g., `"CloudAdmin"`).
    * `description` (optional, `markup-multiline`).
    * `role-ids[]` (optional): Roles held by this user class.
    * `props[]`: E.g., `type: "internal" | "external" | "general-public"`.
  * **Authorized Privileges Matrix (`authorized-privileges[]`):**
    * `title` (required, `markup-line`): Privilege group title (e.g., `"Root IAM & KMS Administration"`).
    * `description` (optional, `markup-multiline`): Detailed permissions narrative.
    * `functions-performed[]` (required array, `minItems: 1`): Explicit list of operations permitted (e.g., `["Create IAM Roles", "Rotate KMS Master Keys", "Approve Security Group Modifications"]`).
  * **Empty Array Stripping:** If `users[]` has no authorized privileges, the key is pruned before saving.

---

### US 4.12: Leveraged Authorizations & Common Control Providers
> *Implements [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare leveraged authorizations (`system-implementation.leveraged-authorizations[]`) for external cloud service providers,  
> **so that** inherited security controls (e.g., AWS or Azure FedRAMP packages) can be formally referenced and legally bound to our system plan.

* **Acceptance Criteria:**
  * **Leveraged Authorization Entry:**
    * `uuid` (required, auto-generated UUID).
    * `title` (required, `markup-line`, e.g., `"AWS FedRAMP High JAB Authorization"`).
    * `party-uuid` (required, UUID): Reference to the Cloud Service Provider party defined in `metadata.parties[]`.
    * `date-authorized` (required, date): ISO date of the external ATO (`YYYY-MM-DD`).
    * `links[]`: Direct link to FedRAMP Marketplace package or CRM agreement.
  * **Referential Integrity Validation:** Validates that `party-uuid` exists in `metadata.parties[]`.

---

### US 4.13: Inventory Items & Asset Instance Tracking
> *References DD-021, DD-031*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** document physical or virtual instances in `system-implementation.inventory-items[]` linked to system components,  
> **so that** production hostnames, IP addresses, MAC addresses, and asset tags are tracked under their parent component definitions.

* **Acceptance Criteria:**
  * **Inventory Item Entry:**
    * `uuid` (required, auto-generated UUID).
    * `description` (required, `markup-multiline`): Narrative description of the asset instance.
    * `implemented-components[]` (optional, array): References to component UUIDs defined in `system-implementation.components[]`.
    * `props[]`: Specific instance properties: `hostname`, `ip-address`, `mac-address`, `serial-number`, `asset-tag`.
  * **Referential Integrity Validation:** The system verifies that every `implemented-components[].component-uuid` exists in `system-implementation.components[]`.

---

### US 4.14: Control Implementation Global Strategy & Global Parameters
> *Implements [DD-009](../design_decisions/DD-009_parameter_strategy.md) and [DD-012](../design_decisions/DD-012_parameter_value_assignment_and_override_strategy.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** configure the global control implementation narrative and declare system-wide parameter defaults,  
> **so that** our overarching security strategy and baseline parameter defaults (Tier 3) are established.

* **Acceptance Criteria:**
  * **Global Strategy (`control-implementation.description`, required, `markup-multiline`):** Comprehensive narrative describing the defense-in-depth architecture, shared responsibility model, and organizational implementation principles.
  * **Global Parameter Defaults (`control-implementation.set-parameters[]`):**
    * Establishes **Tier 3 (SSP Global Defaults)** in the 4-tier parameter cascade.
    * Alice can declare default values for parameters across the entire system (e.g., setting global password minimum length to `14` for all controls that reference password length).
    * Parameter values serialize as non-empty arrays of strings (`values: ["14"]`).

---

### US 4.15: Implemented Requirements & By-Components Architecture
> *Implements [DD-030](../design_decisions/DD-030_unified_control_editor.md) and [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** map control satisfaction to concrete system components using the `by-components[]` architecture,  
> **so that** implementation narratives are strictly located within component blocks as required by the NIST OSCAL SSP schema.

* **Acceptance Criteria:**
  * **Strict Schema Architecture Discipline:** In NIST OSCAL v1.2.2 SSP (`oscal_ssp_schema.json`), **`implemented-requirements[]` has NO description property**. All implementation narratives MUST reside in `by-components[].description`. The Reposol UI enforces this rule strictly:
    * `implemented-requirements[]` holds: `uuid`, `control-id`, `set-parameters[]`, `responsible-roles[]`, `statements[]`, `by-components[]`.
    * `by-components[]` holds: `component-uuid` (required), `uuid` (required), `description` (required implementation prose), `implementation-status`, `export`, `inherited`, `satisfied`.
  * **Multi-Component Satisfaction:** A single control (e.g., `ac-2`) can be satisfied by multiple components:
    * `this-system`: Administrative policy and account approval workflows.
    * `Keycloak IAM`: Automated user provisioning, OAuth2 sessions, and MFA.
    * `PostgreSQL DB`: Database service account management and connection limits.
  * **Baseline Membership Validation (DISC-04 Resolution):** The backend integrity validator (`_validate_ssp_integrity`) verifies that every `implemented-requirements[].control-id` belongs to the imported baseline profile/catalog. Controls not in the baseline are flagged with an error.
  * **Component Existence Validation:** The backend validates that `by-components[].component-uuid` resolves to an existing component in `system-implementation.components[]` or is `"this-system"`.

---

### US 4.16: Statement-Level Implementation Granularity
> *Implements [DD-030](../design_decisions/DD-030_unified_control_editor.md) and [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** document implementation narratives at the individual control statement level (`statements[].by-components[]`),  
> **so that** multi-part security controls (e.g., `ac-2` parts a through j) are documented with granular sub-requirement precision.

* **Acceptance Criteria:**
  * **Statement Breakdown (`statements[]`):** Under an implemented requirement, Alice can tailor specific statements:
    * `statement-id` (required, token, e.g., `"ac-2_smt_a"`, `"ac-2_smt_b"`). Validated against actual statement tokens from the resolved baseline (resolving synthetic stubs).
    * `uuid` (required, auto-generated UUID).
    * `by-components[]` (required, `minItems: 1`): Array mapping specific components to this statement part, each containing its own `description` narrative using `ProseWithParams`.
  * **Visual Statement Tree:** In both View and Edit modes, statements render nested under the control card with clear letter badges (`a.`, `b.`, `c.`) and component attribution tags.

---

### US 4.17: Implementation Status Tracking & Metrics
> *References DD-020, DD-022, DD-036*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** assign implementation statuses to components and controls and view aggregate compliance metrics,  
> **so that** implementation progress and audit-readiness are visible in real time.

* **Acceptance Criteria:**
  * **Implementation Status Enum (`implementation-status.state`, required on `by-components[]`):**
    * `implemented` — Control fully satisfied and verified operational.
    * `partial` — Partially implemented; remediation actions or milestones planned.
    * `planned` — Implementation scheduled but not yet operational.
    * `alternative` — Compensating control or alternative implementation approach.
    * `not-applicable` — Control not applicable to this component or system boundary.
  * **Status Remarks (`remarks`, optional):** Explains deviations, compensating controls, or target delivery dates.
  * **Progress Rollup:** The UI computes overall control implementation status:
    * If all components are `implemented` -> Control is `Implemented` (Green).
    * If any component is `partial` or `planned` -> Control is `Partially Implemented` (Amber).
    * If all are `not-applicable` -> Control is `Not Applicable` (Gray).

---

### US 4.18: Control Origination & Multi-Source Attribution
> *Implements [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** tag control origination using standardized OSCAL properties,  
> **so that** auditors immediately see whether a control is organization-mandated, system-specific, inherited, or customer-configured.

* **Acceptance Criteria:**
  * **Origination Property Palette:** Alice can assign `prop name="control-origination"` on implemented requirements with values:
    * `sp800-53-organization` — Mandated and provided by the parent enterprise.
    * `sp800-53-system-specific` — Implemented solely within the system boundary.
    * `sp800-53-hybrid` — Shared responsibility between hosting provider and system.
    * `sp800-53-inherited` — Fully inherited from an external common control provider.
    * `sp800-53-customer-configured` — Configurable by downstream SaaS customers.
  * **Origination Badges:** Displayed as distinctive badges on control cards in both View and Edit modes.

---

### US 4.19: 4-Tier Parameter Cascade Resolution & Visualizer
> *Implements [DD-012](../design_decisions/DD-012_parameter_value_assignment_and_override_strategy.md) and [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** configure parameter overrides at the component or control level and view the effective resolved value via an interactive 4-tier cascade visualizer,  
> **so that** parameter precedence is transparent and parameter placeholders in prose are accurately substituted.

* **Acceptance Criteria:**
  * **The 4-Tier Parameter Cascade Precedence Hierarchy:**
    1. **Tier 1 (Highest Precedence): Component-Level Override**  
       `implemented-requirements[].by-components[].set-parameters[]` (overrides parameter specifically when evaluated against that component).
    2. **Tier 2: Control-Level Override**  
       `implemented-requirements[].set-parameters[]` (overrides parameter across all components for that control).
    3. **Tier 3: SSP Global Default**  
       `control-implementation.set-parameters[]` (system-wide fallback for that parameter across all controls).
    4. **Tier 4 (Lowest Precedence): Baseline Default**  
       Resolved from the imported Profile (`modify.set-parameters`) or source Catalog (`params[]`).
  * **Interactive Cascade Visualizer:** In the control editor, expanding a parameter displays an interactive ladder showing all 4 tiers with the active winning tier highlighted in glowing green and overridden lower tiers marked with strikethrough text.
  * **Prose Parameter Substitution:** In View Mode and read-only views, all `{{ insert: param, id }}` placeholders in requirement prose render with their effective cascading value.

---

### US 4.20: Security Inheritance (Inherited, Satisfied & Export Providers)
> *Implements [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** model security inheritance by configuring `inherited`, `satisfied`, and `export` assemblies on component implementations,  
> **so that** our system can act as both an inheritance consumer (inheriting controls from IaaS) and an inheritance provider (exporting controls to downstream tenants).

* **Acceptance Criteria:**
  * **Inheritance Consumer (`by-components[].inherited[]`):**
    * For controls inherited from a leveraged cloud provider (e.g., physical data center controls `pe-2`, `pe-3` from AWS), Alice configures:
      * `provided-uuid` (required, UUID): Reference to the leveraged authorization in `system-implementation.leveraged-authorizations[]`.
      * `description` (required, `markup-multiline`): Narrative detailing how the provider satisfies the requirement.
  * **Customer Responsibilities (`by-components[].satisfied[]`):**
    * Declares specific responsibilities that downstream customers must perform to achieve full compliance under shared responsibility.
  * **Inheritance Provider (`by-components[].export`):**
    * When this system acts as a common control provider to other internal systems, Alice documents export responsibilities and inherited capability descriptions.

---

### US 4.21: Multi-Level OSCAL Schema Validation & Referential Integrity
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md) and [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** validate the entire SSP against official NIST JSON schemas and semantic referential integrity rules,  
> **so that** invalid references, dangling UUIDs, or schema discrepancies are detected and resolved immediately.

* **Acceptance Criteria:**
  * **Level 1 — Structural Schema Validation:** Validates against `oscal_ssp_schema.json` via `POST /api/validate/ssps`. Checks all 6 mandatory root assemblies, required fields, date formats, and enums.
  * **Level 2 — Referential Integrity Validation (`_validate_ssp_integrity`):**
    * Verifies `import-profile.href` resolves to an existing workspace document.
    * Verifies all `by-components[].component-uuid` resolve to components in `system-implementation.components[]` or `"this-system"`.
    * Verifies `implemented-requirements[].control-id` exist in the imported baseline (DISC-04).
    * Verifies `inventory-items[].implemented-components` resolve to valid components.
  * **Validation Drawer:** Renders errors with direct deep-links to the offending tab and field.

---

### US 4.22: Document Overview, Metadata & Revision History
> *Implements [US 0.16](step0_global_requirements.md) and [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** manage document metadata, roles, parties, and review revision history,  
> **so that** document ownership and change logs are completely tracked.

* **Acceptance Criteria:**
  * **Document Overview Tab:** Renders metadata fields (`title`, `version`, `last-modified`), roles and parties management, and baseline summary cards.
  * **Revision History Tracking:** Displays previous versions with publication dates, change summaries, and author attributions.

---

### US 4.23: Dual-Mode Editor UX & 30-Second Draft Auto-Save
> *Implements [DD-004](../design_decisions/DD-004_editor_ux_patterns.md) and [DD-029](../design_decisions/DD-029_document_actions_pattern.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** author the SSP with automatic 30-second draft saves and toggle between View and Edit modes,  
> **so that** large-scale authoring sessions are protected from accidental data loss.

* **Acceptance Criteria:**
  * **Mode Toggle (`[ 👁️ View | ✏️ Edit ]`):** Seamless switching with URL synchronization (`/ssp/{uuid}?edit=true`).
  * **Backend Draft Persistence (`useDraft`):** While dirty, saves `<uuid>_draft.json` every 30 seconds to the backend draft store.
  * **Centralized Document Actions:** All state mutations dispatch typed actions defined in `ssp-actions.ts` per DD-029.

---

### US 4.24: In-Place Version Snapshots & Revisions
> *Implements [US 0.15](step0_global_requirements.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** publish formal SSP versions and create immutable snapshots without altering the document UUID,  
> **so that** regulatory submissions (e.g., v1.0.0, v1.1.0) are permanently archived.

* **Acceptance Criteria:**
  * **Publish Dialog:** Prompts for version number (e.g., `"1.0.0"`) and release remarks.
  * **Snapshot Storage:** Validates schema, writes immutable snapshot `{uuid}_v{version}.json`, appends entry to `metadata.revisions[]`, and clears draft.
  * **Version History Browser:** Allows reviewing prior snapshots in read-only mode.

---

### US 4.25: Back-Matter Resource Attachments & Evidence Linking
> *Implements [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** attach supporting audit evidence, policies, and architecture diagrams in `back-matter.resources[]`,  
> **so that** external proof artifacts are securely linked or embedded into the OSCAL document.

* **Acceptance Criteria:**
  * **Embedded Base64 Attachments (≤ 2MB):** Client-side encoding of PDFs, images, and text artifacts.
  * **External `rlinks` (> 2MB):** External URLs with mandatory SHA-256 cryptographic hashes.
  * **Cross-Referencing:** Any link inside the SSP can target `#<resource-uuid>` with preview modals.

---

### US 4.26: Multi-Stage Workflow & Multi-Format Export
> *Implements [DD-029](../design_decisions/DD-029_document_actions_pattern.md).*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** export the complete SSP in JSON, XML, and YAML formats and transition seamlessly to Step 5 (Assessment Plan),  
> **so that** the authorized plan is submitted to regulators or utilized as the authoritative target system for security audits.

* **Acceptance Criteria:**
  * **Multi-Format Export:** Generates 100% schema-compliant OSCAL JSON, XML, and YAML.
  * **Handoff to Stage 5:** In Step 5 Assessment Plan Builder, this SSP is selectable via `import-ssp.href`, automatically providing candidate controls, components, users, and locations for audit scoping.

---

## 2. Practitioner's Detailed Workflow & User Journey

### Persona
**Alice (Compliance Officer & System Owner POC)**, building the authoritative System Security Plan for the "Enterprise Cloud Security Management Platform (ECSMP)" to achieve FedRAMP Moderate authorization.

### Chronological Step-by-Step Narrative

1. **Document Initialization & Root Provisioning (US 4.1):**
   * Alice navigates to `/ssp` and clicks `➕ New SSP`.
   * She enters Title: `"Enterprise Cloud Security Management Platform (ECSMP) System Security Plan"`, System Name: `"ECSMP Production Platform"`.
   * The backend creates `uuid: "ssp-9900-1122-3344-5566778899aa"` and scaffolds all 6 mandatory root assemblies.
   * Alice is redirected to `/ssp/ssp-9900-1122-3344-5566778899aa?edit=true` with the editor initialized in Edit Mode.

2. **Importing the FedRAMP Moderate Baseline (US 4.2):**
   * In the **Baseline** tab, Alice clicks "Select Baseline".
   * She selects the FedRAMP Moderate Rev 5 profile: `../profiles/fedramp-moderate-rev5.json`.
   * The backend resolution engine executes, resolving **156 baseline controls** and **312 parameters** with default values. The UI renders the Baseline Summary Card showing active controls across families (AC: 25, AU: 16, IA: 12, SC: 34).

3. **Declaring System Identity & Status (US 4.3, US 4.6):**
   * In **System Characteristics -> System Identity**:
     * `system-ids`: Adds `id: "SYS-2026-ECSMP-01"`, `identifier-type: "http://fedramp.gov/ns/oscal"`.
     * `system-name-short`: `"ECSMP"`.
     * `description`: `"Multi-tenant cloud platform providing automated security assessment and compliance management services."`.
     * `date-authorized`: Sets target date `"2026-10-01"`.
   * In **System Status**: Sets `state: "under-development"` with remarks: `"Initial FedRAMP authorization preparation."`.

4. **Classifying Information Types & Deriving FIPS-199 HWM (US 4.4, US 4.5):**
   * In **Information Types**, Alice uses the SP 800-60 template picker to add three data types:
     1. *Customer Account / PII* (`C.2.4.1`): `confidentiality: fips-199-high`, `integrity: fips-199-moderate`, `availability: fips-199-low`.
     2. *Financial Records* (`C.3.5.1`): `confidentiality: fips-199-moderate`, `integrity: fips-199-high`, `availability: fips-199-low`.
     3. *System Monitoring & Logs* (`C.3.5.7`): `confidentiality: fips-199-low`, `integrity: fips-199-high`, `availability: fips-199-moderate`.
   * The **FIPS-199 High-Water Mark Engine** calculates:
     * Confidentiality HWM: `fips-199-high` (from Customer PII).
     * Integrity HWM: `fips-199-high` (from Financial Records & Logs).
     * Availability HWM: `fips-199-moderate` (from System Logs).
     * Overall Sensitivity Level: `High`.
   * Alice clicks **"Apply High-Water Mark Suggestion"**, updating the system characteristics and security impact level.

5. **Documenting Boundary & Embedding Diagrams (US 4.7, US 4.8):**
   * In **Authorization Boundary**, Alice authors the boundary narrative describing the AWS VPC boundary, public load balancers, private subnets, and database clusters.
   * She uploads the architecture diagram `ecsmp-boundary.png` (320 KB). The client encodes it to Base64 in `back-matter.resources[0]` and links it to `authorization-boundary.diagrams[0]`.

6. **Importing Component Templates from Stage 3 (US 4.10, US 4.12):**
   * In **System Implementation -> Components**:
     * The root component `type="this-system"` is automatically present with its crown badge.
     * Alice clicks **"Import from Component Definition"** and selects the Stage 3 library authored in US 3.1–3.20.
     * She imports *Keycloak IAM Service* and *PostgreSQL Database Server*.
     * **DISC-01 & DISC-02 Resolution:** The system copies components, assigns operational status, preserves links, and **imports all control implementations (`ac-2`, `ac-7`, `ia-5`) directly into the SSP's `by-components[]` records**!
   * She creates a leveraged authorization for AWS:
     * `title`: `"AWS GovCloud FedRAMP High Authorization"`, `date-authorized`: `"2025-06-15"`, linking CSP party UUID.

7. **Configuring Users & Access Privileges (US 4.11):**
   * Alice registers two user classes:
     * *Cloud Admin*: Authorized for KMS key rotation, firewall administration, and container deployment.
     * *Tenant Auditor*: Authorized for read-only compliance report generation.

8. **Authoring Control Implementations & By-Components (US 4.14, US 4.15, US 4.16):**
   * In **Control Implementation**, Alice sets the global strategy narrative (US 4.14).
   * For control `ac-2` (*Account Management*):
     * Implemented Requirement metadata: `control-id: "ac-2"`.
     * She maps three components in `by-components[]`:
       1. `this-system`: `"Organizational Access Control Policy OP-01 mandates formal manager approval before account creation."` (Status: `implemented`).
       2. `Keycloak IAM`: `"Keycloak enforces automated role-based access control and token-based session management."` (Status: `implemented`).
       3. `PostgreSQL DB`: `"PostgreSQL uses dedicated least-privilege service accounts with rotating vault credentials."` (Status: `implemented`).
     * Statement breakdown: Alice tailors `ac-2_smt_a` (Approval) and `ac-2_smt_b` (Automated Provisioning).

9. **Parameter Cascade Overrides & Visualizer (US 4.19):**
   * For control `ac-7` (*Unsuccessful Logon Attempts*):
     * Parameter `ac-7_prm_1` baseline default is `"5 attempts"`.
     * Alice enters a Control-Level Override (Tier 2): `values: ["3 attempts"]`.
     * She opens the **Cascade Visualizer** and inspects the 4 tiers:
       * Tier 1 (Component): Not set.
       * **Tier 2 (Control): `"3 attempts"` [Active Winner]**
       * Tier 3 (Global SSP): `"5 attempts"` [Overridden]
       * Tier 4 (Baseline): `"5 attempts"` [Overridden]
     * In the control preview, requirement prose automatically updates to: `"The system locks the account after 3 attempts of invalid credentials."`.

10. **Documenting Security Inheritance (US 4.20):**
    * For physical access control `pe-2` (*Physical Access Authorizations*):
      * Component: `AWS GovCloud IaaS` (`type="system"`).
      * She marks `inherited`: `{ "provided-uuid": <aws-leveraged-auth-uuid>, "description": "Physical data center perimeter security, biometric entry turnstiles, and 24/7 armed guards are fully inherited from AWS GovCloud FedRAMP High package." }`.
      * Status: `implemented`, Origination: `sp800-53-inherited`.

11. **Verification & Draft Auto-Save (US 4.21, US 4.23):**
    * Over the 45-minute authoring session, drafts were saved every 30 seconds to `ssps/ssp-9900-1122-3344-5566778899aa_draft.json`.
    * Alice clicks **"Run Pre-Flight Validation"**. The validator checks all 6 root assemblies, baseline control membership, and component UUIDs: **0 errors, 0 warnings**.

12. **Publishing Immutable Version Snapshot & Stage 5 Handoff (US 4.24, US 4.26):**
    * Alice clicks **"Publish Version"**, entering Version: `"1.0.0"`, Remarks: `"Formal baseline System Security Plan for FedRAMP Moderate certification."`.
    * The backend creates immutable snapshot `ssp-9900-1122-3344-5566778899aa_v1.0.0.json` and updates `metadata.revisions[]`.
    * Alice exports the plan in OSCAL JSON and XML.
    * The SSP is now formally published and ready to be imported into Stage 5 (Assessment Plan Builder)!

---

## 3. Functional Requirements for the System

- **Mandatory 6-Assembly Root Enforcement:** The backend and schema validator strictly enforce the presence of all 6 root assemblies: `uuid`, `metadata`, `import-profile`, `system-characteristics`, `system-implementation`, and `control-implementation` (US 4.1).
- **Baseline Resolution Engine:** Full resolution of upstream Profiles and Catalogs with parameter placeholders, modification alterations, and family summaries (US 4.2).
- **System Identity & Boundaries:** Machine-readable identifiers (`system-ids[]`), full/short names, and narrative authorization boundaries (US 4.3, US 4.7).
- **NIST SP 800-60 & FIPS-199 High-Water Mark Engine:** Algorithmic calculation of system sensitivity level based on CIA impact triad ratings across all information types (US 4.4, US 4.5).
- **Operational Lifecycle State Machine:** Enforcing the 5 official status states (`operational`, `under-development`, etc.) with mandatory remarks for `other` (US 4.6).
- **Client-Side Base64 Attachment Embedding:** Seamless encoding and inline preview of boundary, network, and data flow diagrams in `back-matter.resources[]` per DD-007 (US 4.7, US 4.8).
- **Comprehensive Component Inventory:** Mandatory `type="this-system"` root component, complete schema properties, protocols with port ranges, and responsible roles (US 4.9, US 4.10).
- **Lossless Component Definition Import Handshake:** Preserving component metadata, control implementations, statement narratives, and parameter defaults into `by-components[]` with source provenance links resolving DISC-01 and DISC-02 (US 4.10).
- **User Roles & Privilege Matrix:** Tracking user classes and authorized functions performed (US 4.11).
- **Common Control Provider Inheritance:** Modeling leveraged authorizations and customer/provider responsibilities (US 4.12, US 4.20).
- **Strict Separation of Implemented Requirements vs. By-Components:** `implemented-requirements[]` contains control metadata only; all implementation prose resides strictly in `by-components[].description` (US 4.15).
- **Baseline Control Membership Integrity:** Backend validation verifying that all implemented controls exist in the resolved baseline, resolving DISC-04 (US 4.15).
- **Statement-Level Granularity:** Multi-component satisfaction at the sub-statement level using real baseline statement IDs (US 4.16).
- **4-Tier Parameter Cascade Engine:** Hierarchical resolution across Component (Tier 1) > Control (Tier 2) > Global SSP (Tier 3) > Baseline (Tier 4) with interactive visualizer and prose substitution (US 4.14, US 4.19).
- **Referential Integrity & Schema Validation:** Two-tier validation engine verifying JSON schema compliance and workspace cross-references (US 4.21).
- **Centralized Document Actions & Draft Persistence:** 30-second draft auto-save (`<uuid>_draft.json`), mode toggling `[ 👁️ View | ✏️ Edit ]`, and DD-029 action reducers (US 4.23).
- **Immutable Version Snapshots:** Snapshot persistence `{uuid}_v{version}.json` with revision logs without UUID bumping (US 4.24).
- **Multi-Format Export & Stage 5 Handoff:** Exporting to JSON/XML/YAML and direct import into Step 5 Assessment Plan Builder (US 4.26).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] **US 4.1:** An SSP document can be initialized with minimal inputs, auto-provisioning all 6 mandatory root assemblies (`uuid`, `metadata`, `import-profile`, `system-characteristics`, `system-implementation`, `control-implementation`) and redirecting to `/ssp/{uuid}?edit=true`.
- [x] **US 4.2:** Baseline Profiles and Catalogs can be imported and resolved into candidate controls, parameter defaults, and family summaries with out-of-sync notifications.
- [x] **US 4.3:** System identification (`system-ids[]` with standard URI types), names, descriptions, and authorization dates are configurable with required-field validation.
- [x] **US 4.4:** Information types can be categorized per NIST SP 800-60 with CIA impact assessment (`base`, `selected`, `adjustment-justification`) and privacy designations.
- [x] **US 4.5:** The FIPS-199 High-Water Mark is mathematically derived across all information types and can be applied with one-click to system security impact objectives.
- [x] **US 4.6:** Operational lifecycle status is enforced via standard enums (`operational`, `under-development`, etc.) with mandatory remarks for `other`.
- [x] **US 4.7:** Authorization boundaries are documented with narrative and diagrams embedded directly as Base64 in `back-matter.resources[]` per DD-007.
- [x] **US 4.8:** Network architecture and data flow assemblies support topology narratives and embedded diagram attachments with empty assembly pruning.
- [x] **US 4.9:** Standardized cloud deployment models, assurance levels (IAL/AAL/FAL), and responsible parties with role uniqueness constraints are maintained.
- [x] **US 4.10:** System components inventory enforces the root `this-system` component and supports importing Stage 3 Component Definitions with 100% preservation of control implementations and provenance links (DISC-01, DISC-02).
- [x] **US 4.11:** System users, privilege matrices, and authorized functions performed are documented in `system-implementation.users[]`.
- [x] **US 4.12:** Leveraged authorizations for external cloud service providers are bound to `metadata.parties[]` with authorization dates.
- [x] **US 4.13:** Inventory item instances track production hostnames, IP addresses, and asset tags linked to parent components.
- [x] **US 4.14:** Global control implementation strategy is recorded alongside Tier 3 system-wide parameter defaults in `control-implementation.set-parameters[]`.
- [x] **US 4.15:** Control implementations strictly place implementation narratives in `by-components[].description`, and backend validation verifies that control IDs exist in the imported baseline (DISC-04).
- [x] **US 4.16:** Statement-level implementation narratives are tailored using real baseline statement IDs and component mappings.
- [x] **US 4.17:** Implementation status (`implemented`, `partial`, `planned`, `alternative`, `not-applicable`) is tracked per component with progress rollups.
- [x] **US 4.18:** Control origination properties (`organization`, `system-specific`, `inherited`, `hybrid`, `customer-configured`) are assigned with distinct badges.
- [x] **US 4.19:** The 4-tier parameter cascade (Component > Control > Global > Baseline) resolves effective parameter values with interactive visualizer and prose substitution.
- [x] **US 4.20:** Security inheritance is modeled with `inherited` leveraged authorizations, customer responsibilities (`satisfied`), and provider exports (`export`).
- [x] **US 4.21:** Multi-level validation validates schema conformance against `oscal_ssp_schema.json` and enforces referential integrity across components and profiles.
- [x] **US 4.22:** Document overview manages metadata, parties, roles, and displays baseline coverage metrics.
- [x] **US 4.23:** Mode toggle `[ 👁️ View | ✏️ Edit ]` synchronizes URL params, executes 30-second draft auto-saves (`<uuid>_draft.json`), and integrates DD-029 action reducers.
- [x] **US 4.24:** Immutable versions are published with revision history tracking in `metadata.revisions[]` without UUID bumping.
- [x] **US 4.25:** Back-matter resources support Base64 embedded files (≤2MB) or external `rlinks` with cryptographic hashes.
- [x] **US 4.26:** Completed SSPs export cleanly to OSCAL JSON, XML, and YAML, seamlessly providing the target system baseline for Stage 5 Assessment Plan Builder.
