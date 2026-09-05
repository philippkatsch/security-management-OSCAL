# Step 4: Detailed User Stories – System Security Plan (SSP) Builder

* **Persona:** Alice (Compliance Officer / System Owner / Authorizing Official POC)
* **Goal:** Creation, configuration, and verification of an authoritative NIST OSCAL System Security Plan (SSP) (v1.2.2) that formally defines system characteristics and boundaries, categorizes security impact per NIST SP 800-60 and FIPS-199, imports and resolves control baselines (Profiles or Catalogs), inventories system components and user privileges, maps control satisfaction to concrete technical/procedural components and fine-grained statements, resolves multi-tier cascading parameter overrides, and models security inheritance with leveraged common control providers. The SSP unites Catalogs (Stage 1), Profiles (Stage 2), and Component Definitions (Stage 3) into an auditable compliance deliverable.

---

## 1. Breakdown of User Stories

### US 4.1: Minimal SSP Document Creation & Redirection
> Implements [US 0.14](step0_global_requirements.md) with SSP-specific initialization rules.
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** create a new System Security Plan by entering only a document title in a streamlined dialog and be immediately redirected to the in-place editor (`/ssp/{uuid}?edit=true`),  
> **so that** I can begin configuring system characteristics and control implementations without cumbersome preliminary setup wizards.

* **Acceptance Criteria:**
  * **Given** Alice is on the System Security Plans overview page (`/ssp`),
  * **When** Alice clicks "New SSP", a modal dialog appears requesting only the document `title` (required, string) and optional initial `system-name`.
  * **When** Alice submits the dialog with a valid title:
    * The backend generates an authoritative document shell adhering strictly to the NIST OSCAL SSP JSON Schema v1.2.2 (`oscal_ssp_schema.json`).
    * The initial document payload contains:
      * `system-security-plan.uuid`: auto-generated RFC 4122 v4 UUID.
      * `metadata`: `title`, `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`.
      * `import-profile`: `{ "href": "" }`.
      * `system-characteristics`:
        * `system-ids`: `[{ "id": "SYS-TEMP-001" }]` (satisfying `minItems: 1`).
        * `system-name`: initialized from the user's title or input.
        * `description`: `"System Security Plan for " + title`.
        * `system-information`: `{ "information-types": [] }`.
        * `status`: `{ "state": "under-development" }`.
        * `authorization-boundary`: `{ "description": "Authorization boundary definition in development." }`.
      * `system-implementation`:
        * `users`: `[]`.
        * `components`: `[{ "uuid": <new-uuid>, "type": "this-system", "title": <title>, "description": "The system as a whole representing organizational, administrative, and system-wide controls.", "status": { "state": "operational" } }]` (satisfying `minItems: 1` and root component requirement).
      * `control-implementation`:
        * `description`: `"System control implementation details."`.
        * `implemented-requirements`: `[]`.
    * Alice is immediately redirected to `/ssp/{uuid}?edit=true` with the document loaded in Edit mode.
  * **Then** the initialized document passes schema validation against `oscal_ssp_schema.json` without errors.

---

### US 4.2: Baseline Profile & Catalog Import Resolution
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** select and import a baseline Profile or direct Catalog from the Reposol workspace (or via URI reference),  
> **so that** the active control tree, control statements, parameters with baseline defaults, and profile modifications are resolved into the SSP workspace.

* **Acceptance Criteria:**
  * **Given** Alice is editing an SSP in the Document Overview or Imported Baseline tab,
  * **When** Alice configures `import-profile.href` (required, `uri-reference`):
    * The UI provides a **Workspace Document Browser** listing all available Profiles (`/api/documents/profiles`) and Catalogs (`/api/documents/catalogs`) with title, version, and control count.
    * Alice can select a workspace Profile (e.g., `../profiles/fedramp-moderate.json`), a workspace Catalog (e.g., `../catalogs/nist-sp-800-53-r5.json`), an external HTTPS URI, or an internal `#resource-uuid` referencing back-matter.
    * An optional `remarks` textarea allows documenting the baseline rationale.
  * **When** a valid baseline source is selected:
    * The backend resolution engine (`GET /api/resolve/ssp/{id}`, `GET /api/resolve/tree/ssps/{id}`, or `POST /api/resolve/ssp/preview`) resolves the complete baseline control tree:
      * For Profile imports: Resolves imports, includes/excludes, custom/as-is merges, parameter `set-parameters`, and alterations.
      * For direct Catalog imports: Loads the full catalog group and control hierarchy directly.
    * The UI displays a **Baseline Summary Card** showing:
      * Total active controls in baseline.
      * Breakdown by Control Families (e.g., AC: 25, AU: 16, IA: 12).
      * Total parameter placeholders and default values.
  * **When** the underlying workspace profile or catalog is modified externally, the SSP editor displays a "Baseline Updated — Re-resolve" notification allowing one-click synchronization.

---

### US 4.3: System Identification, Naming & Authorization Date
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** declare human- and machine-oriented system identifiers, full and short names, comprehensive descriptions, and authorization dates,  
> **so that** the system is uniquely identifiable across organizational registers and regulatory frameworks.

* **Acceptance Criteria:**
  * **Given** Alice is in the "System Characteristics" tab under the "System Identity" section,
  * **When** Alice edits system identification:
    * **System IDs (`system-ids[]`, required, minItems: 1):**
      * Alice can add, edit, and remove multiple system identifiers.
      * Each entry requires `id` (string, e.g., `SYS-2026-PROD-01`).
      * Each entry supports optional `identifier-type` (URI) with standard selectable presets:
        * `http://fedramp.gov/ns/oscal` (FedRAMP System Identifier)
        * `http://datatracker.ietf.org/doc/html/rfc4122` (UUID)
        * Custom URI entry option.
    * **System Name (`system-name`, required, string):** Full official system title (e.g., "Enterprise Cloud Security Management Platform").
    * **System Short Name (`system-name-short`, optional, string):** Acronym or short moniker (e.g., "ECSMP").
    * **Description (`description`, required, markup-multiline):** Comprehensive narrative describing system architecture, operational scope, and business purpose.
    * **Date Authorized (`date-authorized`, optional, date):** ISO 8601 date picker format (`YYYY-MM-DD`). Validated by regex to prevent malformed dates.
  * **Then** the editor prevents empty `system-ids` arrays and highlights missing required fields.

---

### US 4.4: Information Types & NIST SP 800-60 Categorization
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** declare all information types stored, processed, or transmitted by the system and categorize them according to NIST SP 800-60,  
> **so that** data sensitivity and CIA (Confidentiality, Integrity, Availability) impact baselines are rigorously established.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Information Types" section of System Characteristics,
  * **When** Alice adds an information type to `system-information.information-types[]` (required, minItems: 1):
    * The editor provides a **Preset Template Dropdown** for NIST SP 800-60 categories:
      * *Personnel Management* (`C.3.5.8`)
      * *Financial Management* (`C.3.5.1`)
      * *Public Information* (`C.2.8.2`)
      * *IT Infrastructure Maintenance* (`C.3.5.7`)
      * *Customer Account / PII* (`C.2.4.1`)
      * *Custom Information Type...*
    * Selecting a template auto-populates `title`, `description`, `categorization.system: "http://doi.org/10.6028/NIST.SP.800-60v2r1"`, `information-type-ids`, and recommended baseline impact scores.
  * **When** Alice configures the CIA impact assessment for an information type:
    * Each dimension (`confidentiality-impact`, `integrity-impact`, `availability-impact`) requires:
      * `base` (required, string): `fips-199-low`, `fips-199-moderate`, `fips-199-high` (or custom string).
      * `selected` (optional, string): adjusted impact level.
      * `adjustment-justification` (optional, markup-multiline): required by compliance policy if `selected` differs from `base`.
  * **When** Alice enables the Privacy Designation checkbox, `system-information.props` receives `{ "name": "privacy-designation", "value": "yes" }` and an optional Privacy Impact Assessment link (`rel="privacy-impact-assessment"`) can be added.
  * **Then** all information types serialize with unique auto-generated UUIDs, valid categorization systems, and non-empty impact blocks.

---

### US 4.5: Security Impact Level & FIPS-199 High-Water Mark Auto-Calculation
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** establish system-wide security impact objectives (CIA) with automated FIPS-199 high-water mark calculation derived from information types,  
> **so that** the overall system categorization and sensitivity level are mathematically consistent with its data assets.

* **Acceptance Criteria:**
  * **Given** Alice has defined one or more information types in US 4.4,
  * **When** Alice views the "Security Impact Level (FIPS-199)" section:
    * The system executes the **FIPS-199 High-Water Mark Algorithm**:
      * `Confidentiality_HWM = max( active_impact(info_type.confidentiality) for all info_types )`
      * `Integrity_HWM = max( active_impact(info_type.integrity) for all info_types )`
      * `Availability_HWM = max( active_impact(info_type.availability) for all info_types )`
      * Where ordering is: `fips-199-high` > `fips-199-moderate` > `fips-199-low`.
      * `Overall_Sensitivity_Level = max(Confidentiality_HWM, Integrity_HWM, Availability_HWM)`.
    * The UI displays an interactive suggestion banner: *"Suggested FIPS-199 High-Water Mark: C: Moderate, I: High, A: Moderate -> Overall: High"*.
    * If the current manual values in `security-impact-level` are lower than the calculated high-water mark, a warning banner highlights the compliance discrepancy.
    * An **"Apply High-Water Mark Suggestion"** button allows one-click update of:
      * `security-impact-level.security-objective-confidentiality` = `Confidentiality_HWM`
      * `security-impact-level.security-objective-integrity` = `Integrity_HWM`
      * `security-impact-level.security-objective-availability` = `Availability_HWM`
      * `system-characteristics.security-sensitivity-level` = `"high"` (or corresponding level).
  * **Then** the triad cards render with distinct color-coded badges (Green = Low, Amber = Moderate, Red = High).

---

### US 4.6: System Operational Status
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** declare the system's operational lifecycle state,  
> **so that** assessors and security management know if the system is operational, in development, undergoing modification, or decommissioned.

* **Acceptance Criteria:**
  * **Given** Alice is in the "System Status" section of System Characteristics,
  * **When** Alice selects `system-characteristics.status.state` (required enum):
    * Allowed values: `operational`, `under-development`, `under-major-modification`, `disposition`, `other`.
  * **When** `state === "other"`, the `remarks` textarea becomes mandatory and is highlighted if left blank.
  * **Then** the chosen status is reflected in the top Document Header, Overview metrics, and Document Table as an OSCAL standard status badge.

---

### US 4.7: Authorization Boundary Definition & Base64 Diagram Embedding
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** define the system authorization boundary with narrative text and attach visual architecture diagrams embedded directly as Base64 back-matter resources,  
> **so that** the compliance boundary is self-contained, portable, and 100% NIST OSCAL compliant without relying on external file server dependencies.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Authorization Boundary" section,
  * **When** Alice edits `authorization-boundary`:
    * `description` (required, markup-multiline): Detailed narrative defining what assets, networks, and facilities are inside vs. outside the boundary.
  * **When** Alice uploads a boundary diagram:
    * The client-side `FileReader.readAsDataURL()` processes the image (PNG, SVG, JPEG) entirely in the browser (per [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md)).
    * The raw Base64 string is added to `back-matter.resources[]`:
      * `uuid`: new auto-generated UUID.
      * `title`: "Authorization Boundary Diagram - <filename>".
      * `base64`: `{ "value": "<base64-string>", "media-type": "image/png", "filename": "boundary.png" }`.
    * A `diagram` entry is appended to `authorization-boundary.diagrams[]`:
      * `uuid`: new auto-generated UUID.
      * `caption`: optional diagram title/caption (editable in UI).
      * `description`: 508 accessibility alt-text description (editable in UI).
      * `links`: `[{ "rel": "diagram", "href": "#" + resource_uuid }]`.
  * **When** the document is rendered:
    * The diagram component resolves `#resource-uuid` against `back-matter.resources[]` and displays the image preview inline.
  * **When** Alice deletes a diagram, the corresponding resource in `back-matter.resources[]` is purged if not referenced elsewhere.

---

### US 4.8: Network Architecture & Data Flow Documentation
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** document network architecture and data flow diagrams following the same standardized schema and embedding structure as the authorization boundary,  
> **so that** network topologies, cryptographic boundaries, and ingress/egress data paths are documented in full detail.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Network Architecture & Data Flow" section,
  * **When** Alice edits `network-architecture` (optional assembly):
    * `description` (required if assembly present, markup-multiline): Logical/physical topology narrative.
    * `diagrams[]`: visual network diagrams with caption, description, and `#resource-uuid` linking per DD-007.
  * **When** Alice edits `data-flow` (optional assembly):
    * `description` (required if assembly present, markup-multiline): Data movement, protocols, and encryption in transit.
    * `diagrams[]`: data flow diagrams embedded in `back-matter.resources[]`.
  * **Then** empty assemblies are purged before serialization per DD-014.

---

### US 4.9: System Properties & Standardized Responsible Parties
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** set standardized cloud deployment models, service models, assurance levels, and assign responsible parties to standard OSCAL SSP roles,  
> **so that** organizational accountability and cloud deployment parameters are formally recorded.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Properties & Responsible Parties" section,
  * **When** Alice selects standard system properties from guided dropdown palettes:
    * `cloud-deployment-model`: `public-cloud`, `private-cloud`, `community-cloud`, `government-only-cloud`, `hybrid-cloud`, `other`.
    * `cloud-service-model`: `saas`, `paas`, `iaas`, `other`.
    * `identity-assurance-level` (IAL): `1`, `2`, `3` (NIST SP 800-63-3).
    * `authenticator-assurance-level` (AAL): `1`, `2`, `3`.
    * `federation-assurance-level` (FAL): `1`, `2`, `3`.
  * **When** Alice assigns `responsible-parties[]`:
    * Alice selects a `role-id` from standard OSCAL SSP roles:
      * `authorizing-official`, `authorizing-official-poc`, `system-owner`, `system-poc-management`, `system-poc-technical`, `system-poc-other`, `information-system-security-officer`, `privacy-poc`, `security-operations`, `maintainer` (plus custom role input).
    * Alice assigns `party-uuids[]` using a **Party Picker** referencing `metadata.parties[]`.
    * The editor enforces 1 entry per `role-id` (grouping multiple party UUIDs under the single `role-id` entry to satisfy Metaschema constraint `oscal-unique-ssp-system-characteristics-responsible-party`).

---

### US 4.10: System Components Lifecycle & Component Definition Import
> Implements [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md) and [DD-031](../design_decisions/DD-031_schema_form_and_entity_editor.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** manage the system component inventory (software, hardware, services, interconnections, and the root `this-system` component) and import component templates from Stage 3 Component Definitions,  
> **so that** all technical and logical building blocks of the system are documented with full schema compliance.

* **Acceptance Criteria:**
  * **Given** Alice is in the "System Implementation" tab under "Components",
  * **When** viewing the component list:
    * The UI displays an `EntityTable` with columns: Title, Type badge, Status badge, Purpose, Control Implementation Count, Actions.
    * The root component of `type="this-system"` is always present and marked with a special system crown badge.
  * **When** Alice clicks "Add Component":
    * A dedicated Slide-Out Drawer / Modal opens with a complete schema-validated form:
      * `uuid` (required, auto-generated).
      * `type` (required): `this-system`, `system` (leveraged external), `software`, `hardware`, `service`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `network`, `interconnection`, or custom.
      * `title` (required, markup-line).
      * `description` (required, markup-multiline).
      * `purpose` (optional, markup-line).
      * `status` (required assembly): `state` (`operational`, `under-development`, `under-major-modification`, `disposition`, `other`) and `remarks`.
      * **Standard Property Palette**: `implementation-point` (`internal` | `external`), `vendor-name`, `version`, `model`, `virtual`, `public`, `allows-authenticated-scan`, `asset-type`, `leveraged-authorization-uuid`.
      * **Protocols & Port Ranges** (for `service` / `software`): `name` (e.g., `https`, `ssh`, `postgresql`), `title`, `port-ranges` (`start`, `end`, `transport: "TCP" | "UDP"`). Quick-add templates available for common ports (443, 22, 5432, 27017, 80).
  * **When** Alice clicks "Import from Component Definition":
    * A workspace modal lets Alice browse Stage 3 Component Definitions (`/api/documents/component-definitions`).
    * Selecting components copies their definition, properties, protocols, and control implementations into the SSP, attaching a link `{ "rel": "imported-from", "href": "../component-definitions/{cdef-uuid}.json" }`.
  * **Then** all saved components satisfy `required: ["uuid", "type", "title", "description", "status"]` in `oscal_ssp_schema.json`.

---

### US 4.11: System Users & Authorized Privileges Matrix
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** declare user classes, access types, privilege levels, and authorized functions performed,  
> **so that** the logical access control architecture and separation of duties are formally documented.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Users" sub-tab of System Implementation,
  * **When** Alice creates or edits a system user (`system-implementation.users[]`, minItems: 1):
    * The editor drawer exposes:
      * `uuid` (required, auto-generated).
      * `title` (required/optional, markup-line, e.g., "Cloud Infrastructure Administrator").
      * `short-name` (optional, string, e.g., "CloudAdmin").
      * `description` (optional, markup-multiline).
      * **Properties (`props`)**:
        * `type`: `internal` | `external` | `general-public`.
        * `privilege-level`: `privileged` | `non-privileged` | `no-logical-access`.
      * **Role Assignments (`role-ids[]`)**: links to `metadata.roles` (e.g., `asset-administrator`, `security-operations`).
      * **Authorized Privileges (`authorized-privileges[]`)**:
        * Alice can add privilege blocks with:
          * `title` (required, markup-line, e.g., "Kubernetes Cluster Administration").
          * `description` (optional, markup-multiline).
          * `functions-performed[]` (required, string[], minItems: 1, e.g., `["Deploy workloads", "Manage cluster RBAC", "Rotate TLS certificates"]`).
  * **Then** the user class records serialize cleanly without empty privilege arrays.

---

### US 4.12: Leveraged Authorizations (Common Control Providers)
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** register leveraged authorizations from external authorized systems (e.g., AWS, Azure, GCP, corporate IAM),  
> **so that** common controls can be inherited and customer responsibilities tracked.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Leveraged Authorizations" sub-tab of System Implementation,
  * **When** Alice adds a leveraged authorization (`system-implementation.leveraged-authorizations[]`):
    * The editor drawer captures:
      * `uuid` (required, auto-generated).
      * `title` (required, markup-line, e.g., "AWS FedRAMP High Authorization").
      * `party-uuid` (required, UUID): selected via Party Picker referencing the CSP in `metadata.parties[]`.
      * `date-authorized` (required, date): ISO 8601 `YYYY-MM-DD`.
      * `links`: optional link with `rel="system-security-plan"` referencing the CSP's published SSP or portal.
      * `props`, `remarks`.
  * **Then** after saving, this leveraged authorization is available for selection in external `type="system"` components (`props[name="leveraged-authorization-uuid"]`) and drives the security inheritance workflows in US 4.20.

---

### US 4.13: Inventory Items & Asset Instance Tracking
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** inventory physical and virtual asset instances (hosts, VMs, containers, appliances) and link them to logical system components,  
> **so that** vulnerability management, configuration baselines, and asset scans map directly to the system architecture.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Inventory Items" sub-tab of System Implementation,
  * **When** Alice adds an inventory item (`system-implementation.inventory-items[]`):
    * The editor drawer captures:
      * `uuid` (required, auto-generated).
      * `description` (required, markup-multiline, e.g., "Primary production PostgreSQL RDS instance (eu-central-1)").
      * **Network & Asset Properties (`props`)**:
        * `ipv4-address`, `ipv6-address`, `fqdn`, `mac-address`, `serial-number`, `asset-id`, `asset-tag`, `asset-type`, `is-scanned` (`yes` | `no`), `physical-location`.
      * **Implemented Components (`implemented-components[]`, minItems: 1)**:
        * A multi-select component picker links the asset to declared `system-implementation.components[]` by `component-uuid`.
      * **Responsible Parties (`responsible-parties[]`)**: assigns asset custodian / administrator parties.
  * **Then** the inventory item displays in the table and binds to its logical components without schema errors.

---

### US 4.14: Control Implementation Strategy & Global Parameter Defaults
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** define an overall control implementation narrative and set system-wide global parameter values,  
> **so that** high-level security architecture is articulated and default parameter values apply across all baseline controls.

* **Acceptance Criteria:**
  * **Given** Alice is in the "Control Implementation" tab,
  * **When** Alice edits top-level `control-implementation`:
    * `description` (required, markup-multiline): Comprehensive narrative describing the organization's implementation methodology, defense-in-depth model, and technical enforcement mechanisms.
  * **When** Alice manages global parameters in `control-implementation.set-parameters[]`:
    * Alice can add a global parameter override for any baseline parameter:
      * `param-id` (required, token): selected from baseline parameters picker.
      * `values[]` (required, string[], minItems: 1): assigned value(s).
      * `remarks` (optional, markup-multiline).
    * Global parameters apply across all controls referencing the parameter unless overridden at the control or component level (US 4.19).
  * **Then** the global description and parameter defaults serialize in compliant OSCAL format.

---

### US 4.15: Implemented Requirements & By-Component Mapping
> Implements [DD-030](../design_decisions/DD-030_unified_control_editor.md) via polymorphic `SSPAdapter.tsx`.
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** satisfy each baseline control by linking it to system components with component-specific implementation narratives,  
> **so that** every control has clear technical and operational realization details.

* **Acceptance Criteria:**
  * **Given** Alice opens a control in the Control Implementation workspace (using `UnifiedControlEditor` with `SSPAdapter`),
  * **When** viewing the control:
    * The editor displays the resolved baseline control title, parameters, prose parts, and guidance.
  * **When** Alice adds or edits an `implemented-requirement` for the control:
    * `uuid`: auto-generated UUID.
    * `control-id`: control token (e.g., `ac-1`, `ac-2`).
    * **By-Components Requirement (OSCAL Schema & Metaschema Mandate)**:
      * The requirement MUST contain at least one `by-components[]` entry (`minItems: 1`).
      * The requirement top-level does NOT have a `description` field (per OSCAL SSP Metaschema). All prose narratives MUST be placed in `by-components[].description`.
      * If no specific technical component is selected, the system defaults to the `this-system` root component.
    * Each `by-component` entry contains:
      * `component-uuid` (required, UUID): selected from declared system components.
      * `uuid` (required, auto-generated UUID).
      * `description` (required, markup-multiline): detailed narrative describing how this component satisfies the control.
      * `implementation-status`: `{ "state": "implemented" | "partial" | "planned" | "alternative" | "not-applicable", "remarks": "..." }`.
      * `props`: `control-origination` (US 4.18).
  * **When** a component was imported from a Stage 3 Component Definition with pre-existing control implementation prose for this control:
    * The UI displays a **"Pre-populate from Component Definition"** button, allowing Alice to import the vendor/component narrative into `by-component.description` with one click.
  * **Then** Alice can add multiple `by-components` per requirement (e.g., `ac-2` implemented partially by Keycloak and partially by PostgreSQL).

---

### US 4.16: Statement-Level By-Component Detail
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** document multi-part controls at the individual statement level (`statements[].by-components[]`),  
> **so that** complex controls (e.g., `ac-2` parts a, b, c, d) show exactly which component satisfies each specific sub-clause.

* **Acceptance Criteria:**
  * **Given** Alice is editing an implemented requirement with multiple control parts/statements (e.g., `ac-2` with `ac-2_smt_a`, `ac-2_smt_b`),
  * **When** Alice expands the Statement-Level Implementation section:
    * The UI lists all available statement parts from the resolved control.
    * Alice can add a `statements[]` entry:
      * `statement-id` (required, token, e.g., `ac-2_smt_a`).
      * `uuid` (required, auto-generated UUID).
      * `by-components[]` (required, minItems: 1): component-specific narrative for this exact statement part.
      * Optional statement-level `set-parameters[]`, `responsible-roles[]`, `props[]`, `links[]`.
  * **Then** the visual hierarchy clearly presents: `Control -> Implemented Requirement -> Statements -> By-Components`.

---

### US 4.17: Implementation Status Tracking & Metrics Dashboard
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** track the implementation status of each by-component entry (`implemented`, `partial`, `planned`, `alternative`, `not-applicable`) with aggregated progress metrics,  
> **so that** implementation coverage and audit readiness are immediately apparent.

* **Acceptance Criteria:**
  * **Given** Alice is editing control implementations or viewing the SSP Overview,
  * **When** Alice sets `implementation-status` on a `by-component`:
    * `state` options:
      * `implemented` (Fully satisfied - Green badge)
      * `partial` (Partially implemented - Amber badge; `remarks` required)
      * `planned` (Planned implementation - Blue badge; `remarks` with planned date required)
      * `alternative` (Compensating control - Purple badge; `remarks` explaining alternative required)
      * `not-applicable` (N/A - Gray badge; `remarks` justification required)
  * **When** Alice views the Control Implementation tab or Overview:
    * A **Status Metrics Bar** displays:
      * Total Baseline Controls (e.g., 156)
      * Implemented (e.g., 120), Partial (15), Planned (10), N/A (8), Undocumented (3)
      * Implementation Coverage %: `((Implemented + N/A) / Total) * 100`
    * A **Status Filter** allows filtering the control tree by status (e.g., show only `partial` or `undocumented` controls).

---

### US 4.18: Control Origination Classification
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** tag controls and by-components with standard OSCAL origination classifications,  
> **so that** organizational, system-specific, customer-configured, customer-provided, and inherited responsibilities are clearly segmented.

* **Acceptance Criteria:**
  * **Given** Alice is editing an `implemented-requirement` or `by-component`,
  * **When** Alice configures the `control-origination` property (`props[name="control-origination"]`):
    * Allowed standard values:
      * `organization` (organizational policies/procedures)
      * `system-specific` (built directly into the system)
      * `customer-configured` (configured by customer/tenant)
      * `customer-provided` (provided entirely by customer)
      * `inherited` (inherited from external common control provider)
    * Multiple originations can be assigned per requirement (e.g., partially `system-specific` and partially `inherited`).
  * **Then** origination badges appear in the control editor header and allow filtering across the control tree.

---

### US 4.19: 4-Tier Hierarchical Parameter Cascade & Inline Resolution
> Implements [DD-012](../design_decisions/DD-012_parameter_value_assignment_and_override_strategy.md) and [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** view and override parameter values across the 4-tier hierarchy (Catalog/Profile Baseline -> SSP Global -> Control Level -> Component Level) with real-time cascade resolution in control prose,  
> **so that** system-specific configurations are precisely targeted and parameter placeholders in statements resolve to effective active values.

* **Acceptance Criteria:**
  * **Given** a control with parameter placeholders (e.g., `ac-7_prm_1` in `ac-7`),
  * **When** the system evaluates the effective parameter value, it computes the **4-Tier Parameter Cascade**:
    1. **Component Level Override** (`by-components[].set-parameters` or `statements[].by-components[].set-parameters`) — Highest precedence.
    2. **Control Level Override** (`implemented-requirements[].set-parameters`) — Overrides global and baseline.
    3. **SSP Global Level Override** (`control-implementation.set-parameters`) — Overrides baseline defaults.
    4. **Baseline Value** (Profile `modify.set-parameters` or Catalog `param.values`) — Base default.
  * **When** Alice inspects a parameter in the control editor:
    * The UI displays the **Cascade Visualizer Card**:
      * **Active Effective Value** (bold, highlighted chip).
      * **Source Badge**: `[Component Override]`, `[Control Level]`, `[SSP Global]`, `[Profile Baseline]`, or `[Catalog Default]`.
      * **Inherited Fallback Value**: displays what value would apply if the current level override were removed.
      * **"Revert Override"** button to remove the local `set-parameter` entry.
  * **When** Alice edits parameter prose:
    * `ProseWithParams` renders embedded parameter chips (`{{ insert: param, param_id }}`) with their active resolved cascading value.
    * Real-time constraint checking validates values against catalog regex patterns or choice lists.

---

### US 4.20: Security Inheritance (Inherited, Satisfied & Provider Export)
> Implements [DD-036](../design_decisions/DD-036_ssp_security_inheritance_and_baseline_resolution.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** document inherited controls and customer responsibilities for leveraged systems, or export capabilities and responsibilities if my system acts as a provider,  
> **so that** the shared responsibility model is auditable and complete across the compliance chain.

* **Acceptance Criteria:**
  * **Given** Alice is editing a `by-component` linked to an external `type="system"` component with a `leveraged-authorization-uuid`,
  * **When** Alice configures **Common Control Consumer Inheritance**:
    * **Inherited Section (`inherited[]`)**:
      * `uuid` (required, auto-generated).
      * `provided-uuid` (optional UUID referencing the provider's `export.provided.uuid`).
      * `description` (required, markup-multiline, e.g., "Physical security and environmental protections inherited from AWS EU-Frankfurt data centers.").
      * Optional `responsible-roles[]`, `props[]`, `links[]`.
    * **Satisfied Section (`satisfied[]`)**:
      * `uuid` (required, auto-generated).
      * `responsibility-uuid` (optional UUID referencing provider's `export.responsibilities.uuid`).
      * `description` (required, markup-multiline, e.g., "Customer configures AWS IAM password policy to satisfy the shared identity requirement.").
      * Optional `responsible-roles[]`, `props[]`, `links[]`, `remarks`.
  * **When** Alice configures **Common Control Provider Export** (for systems that export capabilities to other systems):
    * `by-component.export`:
      * `provided[]`: capabilities provided to leveraging systems (`uuid`, `description`).
      * `responsibilities[]`: customer responsibilities imposed on leveraging systems (`uuid`, optional `provided-uuid`, `description`).
  * **Then** the control editor displays distinct Inheritance Badges (`Inherited`, `Shared Responsibility`, `Provider Export`) and all UUID linkages validate properly.

---

### US 4.21: Mandatory Field Validation & Schema Completeness Checking
> Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md) and [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** run automated schema validation and completeness checking before publishing or saving,  
> **so that** schema violations, unresolved open parameters, missing narratives, and broken cross-references are flagged and resolved.

* **Acceptance Criteria:**
  * **Given** Alice clicks "Validate" or attempts to publish a version,
  * **When** the validation engine runs:
    * **Level 1 (Structural Schema Validation)**:
      * Validates the document against NIST OSCAL SSP JSON Schema v1.2.2 (`oscal_ssp_schema.json` with `additionalProperties: false`).
      * Runs pre-serialization empty array purging per DD-014 (cleans `[]` from `set-parameters`, `props`, `links`, `by-components`, `statements`, `users`, `values`).
    * **Level 2 (Internal Referential Integrity)**:
      * All `by-components[].component-uuid` reference valid `system-implementation.components[].uuid`.
      * All `responsible-parties[].party-uuids` reference valid `metadata.parties[].uuid`.
      * All diagram `links[rel="diagram"]` reference valid `back-matter.resources[].uuid`.
      * `system-ids` has at least 1 entry.
    * **Level 3 (Completeness Audit Warnings)**:
      * Flags controls in the baseline that have 0 `by-components` ("Undocumented Controls").
      * Flags open baseline parameters that have no value assigned at any cascade level.
      * Flags `by-components` with status `partial`, `planned`, `alternative`, or `not-applicable` that lack remarks.
  * **Then** a structured Validation Report modal displays blocking Errors vs non-blocking Warnings with click-to-navigate field links.

---

### US 4.22: Document Overview, Metadata Management & Baseline Metrics
> Implements [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** manage document metadata, roles, parties, and review overall SSP health in the Document Overview pane,  
> **so that** administrative properties and top-level executive metrics are centralized.

* **Acceptance Criteria:**
  * **Given** Alice opens the "Document Overview" tab,
  * **When** Alice inspects the overview:
    * **Executive Metric Cards**:
      * Total Implemented Requirements / Baseline Controls (e.g. `145 / 156`).
      * Implementation Coverage % (e.g. `92.9%`).
      * Total System Components (e.g. `8`).
      * System Users / Privilege Classes (e.g. `4`).
      * Security Impact Level Triad (C: High, I: High, A: Moderate).
      * Open Parameters count (e.g. `3 open`).
    * **Sub-Tabs**:
      * **Metadata Tab**: edit `title`, `version`, `last-modified`, `metadata.parties[]` (persons, organizations, contact info), `metadata.roles[]` (system roles), `metadata.revisions[]`.
      * **Imported Baseline Tab**: displays referenced baseline profile/catalog with control family breakdown and re-resolve action.
      * **Properties Tab**: document-level properties managed cleanly per DD-011.

---

### US 4.23: Draft Auto-Save, View/Edit Mode Toggle & History
> Implements [DD-004 §4](../design_decisions/DD-004_editor_ux_patterns.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** switch seamlessly between View and Edit modes with automatic 30-second backend draft saving (`<uuid>_draft.json`),  
> **so that** uncommitted edits are protected from accidental navigation or browser crashes without polluting published versions.

* **Acceptance Criteria:**
  * **Given** Alice is in the SSP editor,
  * **When** Alice toggles the **Segmented Mode Control `[ 👁️ View | ✏️ Edit ]`**:
    * In `👁️ View` mode: Interface is clean and read-only.
    * In `✏️ Edit` mode: Interactive inputs, add/remove buttons, and drawers are active.
  * **When** Alice makes edits in Edit mode (`isDirty === true`):
    * The backend auto-saves an active working draft to `ssps/<uuid>_draft.json` every 30 seconds via `PUT /api/documents/ssps/{id}/draft`.
    * The `VersionDropdown` in the header toolbar shows `📝 Draft (editing)` with a lock icon.
  * **When** Alice clicks `🗑️ Delete Draft`, the working draft is deleted and the document reverts to the latest published version.
  * **When** Alice uses `Ctrl+Z` (Undo) / `Ctrl+Y` (Redo), state transitions smoothly through the in-memory history stack.

---

### US 4.24: Integrated In-Place Backend Versioning
> Implements [US 0.15](step0_global_requirements.md) and [DD-004 §5](../design_decisions/DD-004_editor_ux_patterns.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** save immutable published versions of an SSP under the same document UUID with automatic revision tracking,  
> **so that** historical baselines are preserved for compliance audits without UUID proliferation.

* **Acceptance Criteria:**
  * **Given** Alice has completed changes in a draft SSP,
  * **When** Alice clicks "Publish Version" or "Save Version":
    * A modal prompts for Version Number (e.g. `1.1.0`) and Version Remarks (e.g. "Annual SSP review and MFA control tailoring").
    * The backend validates the document against `oscal_ssp_schema.json`.
    * The backend saves the immutable snapshot as `ssps/<uuid>_v1.1.0.json`, updates `metadata.version = "1.1.0"`, appends an entry to `metadata.revisions[]`, and deletes `<uuid>_draft.json`.
  * **When** Alice opens the `VersionDropdown` in View mode:
    * Alice can inspect historical snapshots (`v1.0.0`, `v1.1.0`) as read-only views.

---

### US 4.25: Back-Matter Resource Attachments & Evidence Linking
> Implements [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** attach supporting compliance evidence, certificates, and external documentation in `back-matter.resources[]`,  
> **so that** all audit artifacts are bundled into the OSCAL document or linked via cryptographic rlinks.

* **Acceptance Criteria:**
  * **Given** Alice is managing supporting documentation in the SSP,
  * **When** Alice adds a resource to `back-matter.resources[]`:
    * `uuid` (required, auto-generated).
    * `title` (optional, string, e.g., "CSP ISO/IEC 27001 Certificate").
    * `description` (optional, markup-multiline).
    * `citation` (optional).
    * **Storage Options**:
      * **Embedded Base64 (for files ≤ 2MB)**: `base64: { value, media-type, filename }` stored client-side per DD-007.
      * **External Reference (`rlinks[]`, for files > 2MB)**: `rlinks: [{ href: "https://...", media-type: "application/pdf", hashes: [{ algorithm: "SHA-256", value: "..." }] }]`.
  * **Then** any `link` inside the SSP can cross-reference the resource using `#<resource-uuid>`.

---

### US 4.26: Multi-Stage Workflow & Export Integration
> Implements [DD-029](../design_decisions/DD-029_document_actions_pattern.md).
> **As a** Compliance Officer / System Owner (Alice)  
> **I want to** export the completed SSP in standard JSON, XML, and YAML formats or transition to Step 5 (Assessment Plan),  
> **so that** the plan can be submitted to external regulators or used to generate security assessment plans.

* **Acceptance Criteria:**
  * **Given** a published SSP document,
  * **When** Alice clicks "Export":
    * Options for JSON (`application/json`), XML (`application/xml`), and YAML (`application/yaml`).
    * The XML export correctly maps all singular/plural elements (`import-profile`, `by-component`, `diagram`, `resource`, `system-id`, `information-type`, `leveraged-authorization`, `inventory-item`) and preserves mixed-content inline parameter tags.
  * **When** Alice initiates Step 5 (Assessment Plan Builder), the AP builder can select this SSP as its target system, inheriting its resolved controls, components, and parameter bindings.

---

## 2. Alice's End-to-End User Journey

```
1. Create SSP (US 4.1) 
   └── Modal: Title "Enterprise Portal SSP v1" -> auto-creates 'this-system' component -> loads /ssp/{uuid}?edit=true

2. Configure Baseline & Metadata (US 4.2, US 4.22)
   └── Selects "FedRAMP Moderate Rev 5" profile -> resolves 156 controls -> sets author party & version 1.0.0

3. Declare System Characteristics & Identity (US 4.3, US 4.6, US 4.9)
   └── Adds system-id "SYS-2026-001", short name "EP-SMP", operational status, cloud PaaS properties, ISSO/AO roles

4. Classify Information Types & FIPS-199 HWM (US 4.4, US 4.5)
   └── Adds SP 800-60 "Customer PII" (C: High, I: Mod, A: Low) & "System Logs" (C: Low, I: High, A: Mod)
   └── FIPS-199 HWM auto-computes: C: High, I: High, A: Mod -> Alice accepts HWM suggestion (Overall Sensitivity: High)

5. Document Boundaries & Embed Diagrams (US 4.7, US 4.8)
   └── Writes boundary narrative -> uploads PNG architecture diagram -> client Base64 encodes to back-matter with #res-uuid

6. Inventory Components, Users, Leveraged Systems & Inventory (US 4.10, US 4.11, US 4.12, US 4.13)
   └── Imports Keycloak & PostgreSQL from Stage 3 CDEF; adds AWS IaaS as type="system"
   └── Creates Leveraged Auth "AWS FedRAMP High" with party AWS & date 2026-01-15
   └── Declares user types (Admin, Auditor) and inventory instances (RDS db-prod-1 linked to PostgreSQL)

7. Map Controls, Statements & By-Components (US 4.14, US 4.15, US 4.16)
   └── Sets global SSP implementation description & global param defaults
   └── For ac-1: assigns 'this-system' with organizational policy narrative
   └── For ac-2: maps Keycloak and PostgreSQL; creates statement breakdowns for ac-2_smt_a and ac-2_smt_b

8. Track Status, Origination & 4-Tier Parameters (US 4.17, US 4.18, US 4.19)
   └── Sets status: ac-1 implemented (system-specific), ac-2 partial (with remarks)
   └── Overrides ac-7_prm_1 at control level (value: 3); inspects cascade visualizer showing Component > Control > Global > Profile

9. Document Security Inheritance (US 4.20)
   └── For physical controls (pe-2, pe-3): sets component="AWS IaaS", adds inherited narrative & provided-uuid reference

10. Validate, Persist & Export (US 4.21, US 4.23, US 4.24, US 4.25, US 4.26)
    └── Runs validation: 0 schema errors, 1 open param warning resolved
    └── Clicks "Publish Version" -> saves v1.0.0 immutable snapshot -> exports valid OSCAL JSON/XML
```

---

## 3. Comprehensive Acceptance Matrix

| US # | Category | Core Feature | OSCAL v1.2.2 Path / Schema Constraint | Design Decisions |
|---|---|---|---|---|
| **US 4.1** | Document Creation | Minimal Dialog & Redirect | `system-security-plan.uuid`, `metadata`, scaffold | DD-002, DD-004 |
| **US 4.2** | Baseline Import | Profile/Catalog Resolution | `system-security-plan.import-profile.href` | DD-003, DD-028 |
| **US 4.3** | System Identity | System IDs & Name | `system-characteristics.system-ids` (`minItems: 1`), `system-name` | DD-014, DD-031 |
| **US 4.4** | Data Sensitivity | Information Types & NIST SP 800-60 | `system-information.information-types` (`base`, `selected`, `adjustment-justification`) | DD-014, DD-031 |
| **US 4.5** | Impact Level | FIPS-199 High-Water Mark | `system-characteristics.security-impact-level` (C, I, A objectives) | DD-020, DD-022 |
| **US 4.6** | System Status | Operational State | `system-characteristics.status.state`, `remarks` | DD-020 |
| **US 4.7** | Boundary & Diagrams | Base64 Back-Matter Embedding | `authorization-boundary.diagrams`, `back-matter.resources` (`#uuid`) | DD-007 |
| **US 4.8** | Network & Data Flow | Topology & Flow Diagrams | `system-characteristics.network-architecture`, `data-flow` | DD-007 |
| **US 4.9** | Properties & Roles | Cloud & Assurance Palettes | `system-characteristics.props`, `responsible-parties` | DD-011 |
| **US 4.10** | System Components | Component Inventory & CDEF Import | `system-implementation.components` (`type="this-system"`, `status`) | DD-021, DD-031 |
| **US 4.11** | User Classes | Privilege Matrix | `system-implementation.users.authorized-privileges` | DD-021, DD-031 |
| **US 4.12** | Leveraged Systems | Common Control Providers | `system-implementation.leveraged-authorizations` (`party-uuid`, `date-authorized`) | DD-036 |
| **US 4.13** | Inventory Items | Physical/Virtual Asset Tracking | `system-implementation.inventory-items` (`description`, `implemented-components`) | DD-021, DD-031 |
| **US 4.14** | Global Strategy | Global Implementation & Defaults | `control-implementation.description`, `set-parameters` | DD-009, DD-012 |
| **US 4.15** | Control Satisfaction | Implemented Reqs & By-Components | `implemented-requirements.by-components` (`description` on by-component) | DD-030, DD-036 |
| **US 4.16** | Statement Detail | Statement-Level By-Components | `implemented-requirements.statements.by-components` | DD-030, DD-036 |
| **US 4.17** | Status Tracking | Implementation State & Metrics | `by-components.implementation-status.state` (`implemented`, `partial`, etc.) | DD-020, DD-022 |
| **US 4.18** | Origination | Control Origination Property | `props[name="control-origination"]` (`organization`, `inherited`, etc.) | DD-011 |
| **US 4.19** | Parameter Cascade | 4-Tier Override Hierarchy | `set-parameters` (Component > Control > Global > Baseline) | DD-012, DD-036 |
| **US 4.20** | Inheritance | Inherited, Satisfied & Export | `by-components.inherited`, `satisfied`, `export` | DD-036 |
| **US 4.21** | Validation | Multi-Level OSCAL Schema Validation | `oscal_ssp_schema.json` (`additionalProperties: false`), referential integrity | DD-002, DD-014 |
| **US 4.22** | Document Overview | Metadata & Baseline Metrics | `metadata` (parties, roles, revisions), `import-profile` summary | DD-011, DD-022 |
| **US 4.23** | Draft Auto-Save | 30s Backend Auto-Save & Mode Toggle | `ssps/<uuid>_draft.json`, `[ 👁️ View \| ✏️ Edit ]` | DD-004 |
| **US 4.24** | Versioning | In-Place Version Snapshots | `ssps/<uuid>_v{version}.json`, `metadata.revisions` | DD-001, DD-004 |
| **US 4.25** | Back-Matter | Evidence & Resource Attachments | `back-matter.resources` (`base64` or `rlinks`) | DD-007 |
| **US 4.26** | Multi-Stage Workflow | Export & Stage 5 Transition | `GET /api/export/ssps/{id}?format=json\|xml\|yaml` | DD-029 |
