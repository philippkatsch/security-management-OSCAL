# Step 4: Detailed User Stories – System Security Plan (SSP) Builder

* **Persona:** Alice (Compliance Officer / System Owner)
* **Goal:** Creation of a complete System Security Plan (SSP) that documents the specific security architecture of an information system, links the control baseline to concrete system components, maps implementation responsibilities at the component and statement level, manages parameter overrides across a cascading hierarchy, and integrates security inheritance from leveraged external systems — all according to the NIST OSCAL System Security Plan Model (v1.2.2). The SSP ties together Catalogs (Stage 1), Profiles (Stage 2), and Component Definitions (Stage 3) into a single, authoritative compliance document.

---

## 1. Breakdown of User Stories

### US 4.1: SSP Document Creation & Inner View
> Implements [US 0.14](step0_global_requirements.md) with SSP-specific additions.
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** create a new System Security Plan by entering only a document title and being immediately redirected to the in-place editing area (Inner View),  
> **so that** I can begin configuring system characteristics and control implementations without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Dialog:** Clicking "New SSP" opens a simple dialog requiring only the document title. The system generates a `system-security-plan.uuid` automatically.
    *   **Direct Redirection:** After clicking "Create Document," the SSP is initialized in the backend and the user is redirected to the editing view (`/ssp/{uuid}?edit=true`).
    *   **Document Shell:** The initialized document contains `system-security-plan.uuid`, `metadata` (with `title`, `last-modified`, `version`, `oscal-version`), an empty `import-profile`, empty `system-characteristics` scaffold (with required sub-assemblies), empty `system-implementation` (with a `this-system` component auto-created), and empty `control-implementation`.
    *   **OSCAL Compliance:** The generated document validates against the official NIST OSCAL SSP JSON Schema (v1.2.2).

### US 4.2: Baseline Profile Import
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** select and import the OSCAL profile or catalog that defines the control baseline for my system,  
> **so that** all required controls are loaded into the SSP and I can begin documenting their implementation.
*   **Acceptance Criteria:**
    *   **Import Profile Configuration:** Setting `import-profile.href` (required, `uri-reference`) to reference the baseline. The href can be:
        *   A workspace reference to a Reposol-managed profile or catalog (selected via a picker/browser).
        *   An absolute URI to an external OSCAL profile (e.g., `https://example.com/profiles/nist-800-53-mod-profile.json`).
        *   A bare URI fragment (`#uuid`) pointing to a `back-matter` resource.
    *   **Remarks:** Optional `remarks` field for commentary on the baseline selection (e.g., "NIST SP 800-53 Rev5 Moderate baseline tailored for cloud environments").
    *   **Baseline Resolution:** Upon import, the system resolves the referenced profile to obtain the full set of active controls, parameters (with defaults), and any modifications (alterations, parameter overrides). This resolved control set populates the SSP's control implementation workspace.
    *   **Control Count Summary:** After import, the UI displays a summary showing the total number of controls in the baseline, grouped by control family.
    *   **Baseline Change Detection:** If the imported profile is updated externally, the SSP editor highlights the change and allows the user to re-resolve the baseline.

### US 4.3: System Identification & Naming
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare basic system identity data including unique identifiers, full name, short name, and a comprehensive system description,  
> **so that** the system is formally identified and distinguishable across organizational and regulatory contexts.
*   **Acceptance Criteria:**
    *   **System IDs (Required, 1..*):** Adding one or more `system-ids` entries with:
        *   `id` (required, `string`) — Unique human- or machine-oriented identifier (e.g., `SYS-2026-001`).
        *   `identifier-type` (optional, `uri`) — Identifier scheme. Standard options: `http://datatracker.ietf.org/doc/html/rfc4122` (UUID), `http://fedramp.gov/ns/oscal` (FedRAMP ID), or custom URI.
    *   **System Name (Required, `string`):** Full name of the system (e.g., "Reposol Security Management Platform").
    *   **System Short Name (Optional, `string`):** Abbreviation or acronym (e.g., "Reposol SMP").
    *   **Description (Required, `markup-multiline`):** Comprehensive narrative description of the system's purpose, scope, and function.
    *   **Date Authorized (Optional, `date`):** The date the system received its authorization to operate (ATO). Rendered as a date picker.
    *   **Multiple System IDs:** Support for multiple system identifiers (e.g., one organizational ID, one FedRAMP ID).

### US 4.4: Information Types & Categorization
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare which types of information the system processes, stores, or transmits, and categorize them according to NIST SP 800-60 or other frameworks,  
> **so that** the data sensitivity is formally classified and drives the system's security categorization.
*   **Acceptance Criteria:**
    *   **Information Type Declaration:** Adding `system-information.information-types[]` entries (required, min: 1) with:
        *   `uuid` (optional, auto-generated) — Unique identifier. OSCAL warns if missing.
        *   `title` (required, `markup-line`) — Information type name (e.g., "Personally Identifiable Information (PII)").
        *   `description` (required, `markup-multiline`) — Description of the information type.
    *   **Categorization:** Each information type supports `categorizations[]` entries with:
        *   `system` (required, `uri`) — Categorization system identifier. Default: `http://doi.org/10.6028/NIST.SP.800-60v2r1` (NIST SP 800-60). Custom systems allowed.
        *   `information-type-ids[]` (required, `string[]`, min: 1) — Category identifiers within the system (e.g., `C.3.5.8`).
    *   **Per-Type Impact Assessment:** Each information type has three `impact` assemblies:
        *   `confidentiality-impact`, `integrity-impact`, `availability-impact`, each with:
            *   `base` (required, `string`) — Prescribed base impact: `fips-199-low`, `fips-199-moderate`, `fips-199-high` (custom values allowed).
            *   `selected` (optional, `string`) — Adjusted impact level after analysis (same allowed values).
            *   `adjustment-justification` (optional, `markup-multiline`) — Explanation for any deviation from the base level.
    *   **Privacy Designation:** Optional `props` on `system-information` with `name="privacy-designation"`, value `yes` or `no`.
    *   **Privacy Impact Assessment Link:** Optional `links` with `rel="privacy-impact-assessment"`.

### US 4.5: Security Impact Level & FIPS-199 Categorization
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare the overall system security impact level for confidentiality, integrity, and availability,  
> **so that** the system's criticality is formally categorized and drives the baseline selection and security requirements.
*   **Acceptance Criteria:**
    *   **Security Sensitivity Level (Optional, `string`):** Overall sensitivity level for the system (e.g., `low`, `moderate`, `high`).
    *   **Security Impact Level (Optional Assembly):** Three required fields within `security-impact-level`:
        *   `security-objective-confidentiality` (required, `string`) — Target confidentiality level (e.g., `fips-199-moderate`).
        *   `security-objective-integrity` (required, `string`) — Target integrity level.
        *   `security-objective-availability` (required, `string`) — Target availability level.
    *   **Auto-Calculation Hint:** The UI suggests the highest individual impact level from the information types (US 4.4) as the system-wide security objective, following the FIPS-199 "high-water mark" principle.
    *   **Visual Summary:** A dashboard card showing the three security objectives with color-coded impact levels (green = low, yellow = moderate, red = high).

### US 4.6: System Operational Status
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare the current operational status of the system,  
> **so that** the system's lifecycle stage is formally documented.
*   **Acceptance Criteria:**
    *   **Status State (Required):** Setting `system-characteristics.status.state` from allowed values:
        *   `operational` — System is fully operational.
        *   `under-development` — System is being developed.
        *   `under-major-modification` — System is undergoing significant changes.
        *   `disposition` — System is being decommissioned.
        *   `other` — Custom state (requires `remarks`).
    *   **Remarks (Conditional):** If `state="other"`, the `remarks` field becomes required to explain the custom status.
    *   **Visual Status Badge:** The system status is displayed as a colored badge in the SSP overview and table view.

### US 4.7: Authorization Boundary Definition & Diagrams
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** describe the system's authorization boundary and attach architectural diagrams,  
> **so that** the technical scope, interfaces, and trust zones of the system are clearly demarcated for assessors and auditors.
*   **Acceptance Criteria:**
    *   **Authorization Boundary (Required):**
        *   `description` (required, `markup-multiline`) — Narrative description of the system boundary (e.g., "Includes all AWS EU-Frankfurt infrastructure, VPCs, Kubernetes clusters, and managed databases").
        *   `diagrams[]` (optional, `diagram` assembly array) — Visual boundary diagrams.
        *   `props[]`, `links[]`, `remarks` — Additional metadata and commentary.
    *   **Diagram Assembly:** Each diagram entry contains:
        *   `uuid` (required, auto-generated) — Unique diagram identifier.
        *   `description` (optional, `markup-multiline`) — Accessibility description (508 compliance).
        *   `caption` (optional, `markup-line`) — Diagram caption (e.g., "Figure 1: Authorization Boundary Overview").
        *   `links[]` — Link to the actual diagram resource with `rel="diagram"`, pointing to a `back-matter` resource via `#uuid` or an external URL.
        *   `props[]`, `remarks` — Additional metadata.
    *   **Diagram Uniqueness:** Each diagram `uuid` must be unique within the boundary assembly.
    *   **Base64 Embedding:** Diagrams are embedded as Base64-encoded attachments in `back-matter.resources[]` (see [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md)). No server-side file storage; conversion happens client-side.
    *   **Diagram Preview:** Embedded diagrams can be previewed inline in the editor.

### US 4.8: Network Architecture & Data Flow Documentation
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** document the network architecture and data flow patterns of the system with narrative descriptions and diagrams,  
> **so that** network topology and data movement are transparently captured for security analysis.
*   **Acceptance Criteria:**
    *   **Network Architecture (Optional):** Same structure as authorization boundary (US 4.7):
        *   `description` (required within assembly, `markup-multiline`) — Narrative of the network architecture.
        *   `diagrams[]` — Network topology diagrams.
        *   `props[]`, `links[]`, `remarks`.
    *   **Data Flow (Optional):** Same structure as authorization boundary:
        *   `description` (required within assembly, `markup-multiline`) — Narrative of data flows, encryption in transit, and data processing pathways.
        *   `diagrams[]` — Data flow diagrams.
        *   `props[]`, `links[]`, `remarks`.
    *   **Shared Diagram Structure:** Network architecture and data flow diagrams use the identical `diagram` assembly structure as the authorization boundary (US 4.7).
    *   **Section Visibility:** Network architecture and data flow sections are optional and collapsed by default, expandable when the user wants to add documentation.

### US 4.9: System-Level Properties & Responsible Parties
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** define system-level properties (cloud deployment model, service model, assurance levels) and assign responsible parties to system roles,  
> **so that** the system's operational context and organizational accountability are formally documented.
*   **Acceptance Criteria:**
    *   **Cloud Properties (Dropdowns):**
        *   `cloud-deployment-model`: `public-cloud`, `private-cloud`, `community-cloud`, `government-only-cloud`, `hybrid-cloud`, `other`.
        *   `cloud-service-model`: `saas`, `paas`, `iaas`, `other`.
    *   **Assurance Level Properties (Dropdowns):**
        *   `identity-assurance-level`: `1`, `2`, `3` (per NIST SP 800-63-3).
        *   `authenticator-assurance-level`: `1`, `2`, `3`.
        *   `federation-assurance-level`: `1`, `2`, `3`.
    *   **Responsible Parties:** Assigning `responsible-parties[]` entries with:
        *   `role-id` (required, `token`) — OSCAL standard SSP roles:
            *   `authorizing-official` — ATO authority.
            *   `authorizing-official-poc` — AO point of contact.
            *   `system-owner` — System owner.
            *   `system-poc-management` / `system-poc-technical` / `system-poc-other` — System points of contact.
            *   `information-system-security-officer` — ISSO.
            *   `privacy-poc` — Privacy point of contact.
            *   Custom role IDs allowed (OSCAL: `allow-other="yes"`).
        *   `party-uuids[]` (required, `uuid[]`) — References to parties defined in `metadata.parties[]`.
    *   **Role Uniqueness:** Each `role-id` appears at most once in `responsible-parties`.
    *   **Party Picker:** A picker displays available parties from the document metadata.

### US 4.10: System Components Declaration
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare all system components — including the system itself, external leveraged systems, software, hardware, services, networks, policies, and interconnections — with their operational status and technical properties,  
> **so that** the complete technical and organizational inventory of the system is documented.
*   **Acceptance Criteria:**
    *   **System Component CRUD:** Adding `system-implementation.components[]` entries (required, min: 1) with:
        *   `uuid` (required, auto-generated) — Unique component identifier.
        *   `type` (required, `string`) — Extended OSCAL SSP component types (superset of Stage 3 types):
            *   `this-system` — **The system as a whole** (auto-created on SSP initialization). Used for organizational/policy controls that apply system-wide rather than to a specific technical component.
            *   `system` — External/leveraged system (e.g., AWS IaaS, shared corporate services).
            *   `software`, `hardware`, `service`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation` — Same as Stage 3.
            *   `network` — Physical or virtual network (VPC, VLAN, subnet).
            *   `interconnection` — Network interconnection between systems or security domains.
            *   Custom types allowed (OSCAL: `allow-other="yes"`).
        *   `title` (required, `markup-line`) — Component name.
        *   `description` (required, `markup-multiline`) — Component description.
        *   `purpose` (optional, `markup-line`) — Business/technical purpose.
        *   `status` (required assembly) — Operational status with `state`: `under-development`, `operational`, `disposition`, `other`.
    *   **Component Properties:** Full OSCAL property support including all standard properties from Stage 3 (US 3.4) plus SSP-specific properties:
        *   `implementation-point`: `internal` | `external`.
        *   `leveraged-authorization-uuid` — UUID linking to a `leveraged-authorization` entry (US 4.12).
        *   `inherited-uuid` — UUID of the component in the leveraged system.
        *   `vendor-name` — Vendor/supplier name (for `software`, `hardware`, `service`).
        *   Interconnection-specific: `isa-title`, `isa-date`, `isa-remote-system-name`.
        *   Network properties: `ipv4-address`, `ipv6-address` (with `class`: `local` | `remote`), `uri`, `fqdn`, `direction` (`incoming` | `outgoing`).
    *   **Component Links:** Standard relation types from Stage 3 plus SSP-specific:
        *   `imported-from` — Link to the source Component Definition.
        *   `isa-agreement` — Link to the Interconnection Security Agreement document (for `type="interconnection"`).
    *   **Interconnection Roles:** For `type="interconnection"`, additional role IDs: `isa-poc-local`, `isa-poc-remote`, `isa-authorizing-official-local`, `isa-authorizing-official-remote`.
    *   **Component Import from CDEF:** A "Import from Component Definition" action allows selecting components from Stage 3 Component Definitions in the workspace, copying their definitions (title, description, type, properties, protocols) into the SSP and setting a `link` with `rel="imported-from"` back to the source.
    *   **Protocols & Port Ranges:** Service components support the same protocol/port-range structure as in Stage 3 (US 3.7).
    *   **`this-system` Auto-Creation:** The system auto-creates one component of `type="this-system"` on SSP initialization. This component represents the system as a whole and is used as the target for organizational controls in `by-component` statements.

### US 4.11: System Users & Authorized Privileges
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare all user types that interact with the system, their privilege levels, and the specific functions they are authorized to perform,  
> **so that** the user and role concept is formally documented for access control and audit purposes.
*   **Acceptance Criteria:**
    *   **System User Declaration:** Adding `system-implementation.users[]` entries with:
        *   `uuid` (required, auto-generated) — Unique user identifier.
        *   `title` (optional, `markup-line`) — User type name (e.g., "System Administrator", "End User", "Auditor").
        *   `short-name` (optional, `string`) — Abbreviation.
        *   `description` (optional, `markup-multiline`) — Description of the user type.
    *   **User Type Properties (`props`):**
        *   `type`: `internal` | `external` | `general-public`.
        *   `privilege-level`: `privileged` | `non-privileged` | `no-logical-access`.
    *   **Role Assignment:** `role-ids[]` (optional, `token[]`) — Linking user types to roles defined in `metadata.roles[]`. Standard operational roles: `asset-owner`, `asset-administrator`, `security-operations`, `network-operations`, `incident-response`, `help-desk`, `configuration-management` (custom allowed).
    *   **Authorized Privileges:** Adding `authorized-privileges[]` entries with:
        *   `title` (required, `markup-line`) — Privilege name (e.g., "Database Administration", "Read-Only Access").
        *   `description` (optional, `markup-multiline`) — Privilege description.
        *   `functions-performed[]` (required, `string[]`, min: 1) — Specific authorized functions (e.g., "Configure database backups", "View audit logs", "Manage user accounts").
    *   **User Uniqueness:** Each user `uuid` must be unique within `system-implementation.users[]`.

### US 4.12: Leveraged Authorizations
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare leveraged authorizations from external common control providers (e.g., cloud providers, shared corporate services),  
> **so that** I can reference their security posture and inherit controls without re-documenting them entirely.
*   **Acceptance Criteria:**
    *   **Leveraged Authorization Declaration:** Adding `system-implementation.leveraged-authorizations[]` entries with:
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `title` (required, `markup-line`) — Name of the leveraged system/authorization (e.g., "AWS IaaS FedRAMP Authorization").
        *   `party-uuid` (required, `uuid`) — Reference to the managing party (e.g., AWS) in `metadata.parties[]`.
        *   `date-authorized` (required, `date`) — Date the leveraged system received its authorization.
    *   **Link to Leveraged SSP:** Optional `links[]` with `rel="system-security-plan"` pointing to the leveraged system's SSP document.
    *   **Component Linkage:** After declaring a leveraged authorization, the user can create a `type="system"` component (US 4.10) with `props` setting `implementation-point="external"` and `leveraged-authorization-uuid` pointing to this entry's `uuid`. This linkage enables `inherited` and `satisfied` declarations in `by-component` entries (US 4.20).
    *   **Properties & Remarks:** Each leveraged authorization supports optional `props[]` and `remarks`.

### US 4.13: Inventory Items & Asset Tracking
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare physical and virtual inventory items (server instances, VMs, appliances) and link them to the logical system components they implement,  
> **so that** the asset inventory is documented at the instance level for vulnerability management and configuration auditing.
*   **Acceptance Criteria:**
    *   **Inventory Item Declaration:** Adding `system-implementation.inventory-items[]` entries with:
        *   `uuid` (required, auto-generated) — Unique inventory identifier.
        *   `description` (required, `markup-multiline`) — Description of the asset instance (e.g., "Primary database host server, EC2 instance i-0123456789").
    *   **Network & Asset Properties (`props`):**
        *   `ipv4-address`, `ipv6-address` — IP addresses.
        *   `fqdn` — Fully qualified domain name.
        *   `uri` — Service endpoint URI.
        *   `serial-number`, `netbios-name`, `mac-address` — Hardware identifiers.
        *   `physical-location` — Reference to a `metadata.location.uuid`.
        *   `is-scanned`: `yes` | `no` — Whether the asset is included in vulnerability scans.
        *   Shared asset properties: `asset-type`, `asset-id`, `asset-tag`, `public`, `virtual`, `vlan-id`, `network-id`, `label`, `sort-id`, `baseline-configuration-name`, `allows-authenticated-scan`, `function`, `model`, `os-name`, `os-version`, `software-name`, `software-version`, `software-patch-level`.
    *   **Implemented Components:** `implemented-components[]` entries linking the inventory item to one or more logical `system-component` UUIDs:
        *   `component-uuid` (required, `uuid`) — Reference to a `system-component`.
        *   `props[]`, `links[]`, `responsible-parties[]`, `remarks` — Per-component-instance metadata.
    *   **Responsible Parties:** `responsible-parties[]` entries assigning management responsibility for the inventory item.

### US 4.14: Control Implementation Overview & Global Parameters
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** provide an overall description of the system's control implementation strategy and set global parameter values that apply across all controls,  
> **so that** there is a single, high-level summary of the security approach and system-wide parameter defaults are established.
*   **Acceptance Criteria:**
    *   **Implementation Description (Required, `markup-multiline`):** A high-level description of how the system satisfies its baseline controls (e.g., "Controls are implemented through a combination of organizational policies, technical software controls, and inherited capabilities from AWS IaaS.").
    *   **Global Set-Parameters:** Adding `control-implementation.set-parameters[]` entries to set parameter values that apply across ALL controls in the baseline:
        *   `param-id` (required, `token`) — Parameter identifier from the imported profile/catalog.
        *   `values[]` (required, `string[]`, min: 1) — Parameter value(s).
        *   `remarks` (optional, `markup-multiline`).
    *   **Parameter Uniqueness:** Each `param-id` appears at most once at the global level.
    *   **Override Hierarchy Visibility:** The UI clearly indicates the parameter's current resolved value and its source in the cascade: Catalog Default → Profile Override → SSP Global → SSP Control-Level → SSP Component-Level.

### US 4.15: Implemented Requirements & By-Component Mapping
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** map each control from the imported baseline to one or more system components and provide component-specific implementation narratives,  
> **so that** every control has a traceable, component-level description of how it is realized in the system.
*   **Acceptance Criteria:**
    *   **Implemented Requirement Entry:** Adding `control-implementation.implemented-requirements[]` entries (required, min: 1) with:
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `control-id` (required, `token`) — Control identifier from the imported baseline (e.g., `ac-1`, `ac-2`, `sc-8.1`).
    *   **By-Component Implementation (Required):** Each implemented requirement MUST contain at least one `by-components[]` entry (OSCAL constraint: `has-cardinality min-occurs="1"`):
        *   `component-uuid` (required, `uuid`) — Reference to a `system-component` in `system-implementation.components[]`.
        *   `uuid` (required, auto-generated) — Unique `by-component` entry identifier.
        *   `description` (required, `markup-multiline`) — Component-specific implementation narrative describing how this component contributes to satisfying the control.
    *   **Component Uniqueness per Requirement:** Each `component-uuid` appears at most once per implemented requirement (OSCAL constraint).
    *   **Component Picker:** A searchable component picker displays all declared system components, grouped by type, for selection.
    *   **CDEF Pre-Population:** When a component was imported from a Component Definition (Stage 3) and has pre-defined `control-implementations` for the relevant control, the system offers to pre-populate the `by-component.description` from the CDEF's implementation narrative. The user can accept, modify, or replace the pre-populated text.
    *   **Properties & Links per Requirement:** Each implemented requirement supports `props[]`, `links[]`, and `remarks`.
    *   **Responsible Roles per Requirement:** `responsible-roles[]` can be assigned at the implemented requirement level with standard operational role IDs.

### US 4.16: Statement-Level By-Component Detail
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** provide fine-grained, component-specific implementation narratives at the individual control statement level,  
> **so that** complex multi-part controls are documented precisely, showing exactly which component fulfills which sub-requirement.
*   **Acceptance Criteria:**
    *   **Statement Entry:** Adding `statements[]` within an `implemented-requirement` with:
        *   `statement-id` (required, `token`) — The control statement part identifier (e.g., `ac-2_smt.a`, `ac-2_smt.b`).
        *   `uuid` (required, auto-generated) — Unique identifier.
    *   **By-Component per Statement:** Each statement contains its own `by-components[]` array, allowing different components to address different sub-requirements:
        *   `component-uuid`, `uuid`, `description` — Same structure as US 4.15.
    *   **Component Uniqueness per Statement:** Each `component-uuid` appears at most once per statement (OSCAL constraint).
    *   **Statement Uniqueness:** Each `statement-id` appears at most once per implemented requirement (OSCAL constraint).
    *   **Statement Picker:** The UI loads available statement IDs from the source catalog/profile for guided selection.
    *   **Statement-Level Roles:** Each statement supports `responsible-roles[]`, `props[]`, `links[]`, and `remarks`.
    *   **Visual Hierarchy:** Statements display as nested items under their parent implemented requirement: Control → Requirement → Statement → By-Component.

### US 4.17: Implementation Status Tracking
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** track the implementation status of each by-component entry (fully implemented, partial, planned, alternative, not applicable),  
> **so that** the overall implementation progress is visible at a glance and assessors can identify gaps.
*   **Acceptance Criteria:**
    *   **Implementation Status:** Setting `by-component.implementation-status.state` (optional assembly) with allowed values:
        *   `implemented` — Fully implemented.
        *   `partial` — Partially implemented (requires remarks explaining the gap).
        *   `planned` — Implementation is planned (requires remarks with timeline/plan).
        *   `alternative` — Alternative implementation in place (requires remarks explaining the alternative).
        *   `not-applicable` — Control does not apply to this component (requires justification in remarks).
        *   Custom states allowed (OSCAL: `allow-other="yes"`).
    *   **Remarks (Conditional):** `remarks` field for supplementary explanation, especially important for `partial`, `planned`, `alternative`, and `not-applicable` states.
    *   **Status Dashboard:** A summary view showing implementation status across all controls:
        *   Total controls in baseline.
        *   Count by status: implemented, partial, planned, alternative, not-applicable, not-documented.
        *   Progress percentage and color-coded progress bar.
    *   **Filter by Status:** The control list can be filtered by implementation status to focus on gaps.

### US 4.18: Control Origination Classification
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** classify the origination source of each control implementation (organization-defined, system-specific, customer-configured, customer-provided, inherited),  
> **so that** the nature and responsibility for each control is clearly categorized.
*   **Acceptance Criteria:**
    *   **Control Origination Property:** Setting `props` with `name="control-origination"` on `implemented-requirement` or `by-component` entries with allowed values:
        *   `organization` — Implemented through organizational policy or procedure.
        *   `system-specific` — Implemented specifically for this system.
        *   `customer-configured` — Configured by the customer using capabilities provided by the system.
        *   `customer-provided` — Entirely provided by the customer.
        *   `inherited` — Inherited from a leveraged external system.
    *   **Multiple Originations:** A single control can have multiple origination classifications (e.g., partially `system-specific` and partially `inherited`).
    *   **Origination Filter:** The control list can be filtered by origination type.

### US 4.19: System-Specific Parameter Override Hierarchy
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** override parameter values at multiple levels (global SSP, per-control, per-component) with clear visibility into the cascading resolution order,  
> **so that** I can declare system-specific configurations while understanding which level each value originates from.
*   **Acceptance Criteria:**
    *   **Three-Level Parameter Override in SSP:**
        1. **Global SSP Level** (`control-implementation.set-parameters[]`) — Applies to all controls (US 4.14).
        2. **Control Level** (`implemented-requirement.set-parameters[]`) — Overrides global defaults for a specific control.
        3. **Component Level** (`by-component.set-parameters[]`) — Overrides control-level defaults for a specific component's implementation.
    *   **Full Cascade Resolution:** The effective parameter value follows the cascade: Catalog Default → Profile `modify.set-parameters` → SSP Global → SSP Control-Level → SSP Component-Level. Each child level overrides its parent.
    *   **Cascade Visualization:** For each parameter, the UI displays:
        *   The **effective value** (bold, currently active).
        *   The **source** of the value (e.g., "Profile Override", "SSP Global", "Component-Level").
        *   The **inherited value** that would apply if the current override were removed.
    *   **Parameter Browser:** A picker loads available parameters from the resolved profile, showing `param-id`, `label`, current resolved value, `select.choices`, and `constraints` to guide value selection (see [DD-012](../design_decisions/DD-012_parameter_value_assignment_and_override_strategy.md)).
    *   **Constraint Validation:** Parameter values are validated against catalog/profile `constraints.tests.expression` and `select.choices`. Invalid values are highlighted with error messages.
    *   **Dropdown & Regex Controls:** Parameters with predefined `select.choices` render as dropdowns. Free-text parameters with regex constraints validate input in real-time.

### US 4.20: Security Inheritance (Inherited & Satisfied)
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare which control implementations are inherited from leveraged external systems and document how I satisfy the responsibilities imposed by those systems,  
> **so that** shared/inherited controls are properly documented and customer responsibilities are tracked.
*   **Acceptance Criteria:**
    *   **Inherited Declaration:** Within a `by-component` entry (linked to a `type="system"` component with a `leveraged-authorization-uuid`), adding `inherited[]` entries:
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `provided-uuid` (optional, `uuid`) — Reference to the `provided` entry in the leveraged system's SSP `export` section.
        *   `description` (required, `markup-multiline`) — Description of the inherited capability (e.g., "Physical data center access controls inherited from AWS IaaS").
        *   `responsible-roles[]`, `props[]`, `links[]` — Additional metadata.
    *   **Satisfied Declaration:** Adding `satisfied[]` entries to document how this system fulfills responsibilities imposed by the leveraged system:
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `responsibility-uuid` (optional, `uuid`) — Reference to the `responsibility` entry in the leveraged system's SSP `export` section.
        *   `description` (required, `markup-multiline`) — Description of how the responsibility is satisfied (e.g., "Customer configures IAM MFA policies using AWS IAM to satisfy the shared responsibility for multi-factor authentication").
        *   `responsible-roles[]`, `props[]`, `links[]`, `remarks`.
    *   **Export Section (Provider Side):** For systems that are themselves leveraged by others, `by-component.export` allows declaring:
        *   `provided[]` — Capabilities provided to leveraging systems (each with `uuid`, `description`).
        *   `responsibility[]` — Responsibilities imposed on leveraging systems (each with `uuid`, optional `provided-uuid`, `description`).
        *   The `export` assembly must contain at least one `provided` or `responsibility` entry.
    *   **Visual Inheritance Indicator:** Controls with `inherited` entries display a visual badge indicating partial or full inheritance.

### US 4.21: Mandatory Field Validation & Completeness Checking
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** see immediately which required fields are missing, which parameters are still unresolved, and which controls lack implementation narratives,  
> **so that** the SSP is fully documented before submission with no unresolved placeholders.
*   **Acceptance Criteria:**
    *   **Open Parameter Highlighting:** Parameters defined in the baseline profile/catalog but not assigned a value at any level (profile, SSP global, control, or component) are color-highlighted (e.g., yellow warning: "Open Parameter — Must be filled").
    *   **Dropdown & Regex Validation:** Parameters with predefined `select.choices` render as dropdowns. Free-text inputs are validated against catalog/profile `constraints` regex patterns. Invalid values are visually marked with error messages.
    *   **Control Completeness Check:** Controls without any `by-component` entries are flagged as "Not Documented."
    *   **Completeness Report on Save:** When saving the SSP, a completeness report is displayed showing:
        *   Parameters without assigned values (count and list).
        *   Controls without implementation narratives.
        *   Required fields that are empty (`system-name`, `description`, `authorization-boundary.description`, etc.).
        *   Missing `implementation-status` entries.
    *   **OSCAL Schema Validation:** Full validation against the official NIST OSCAL SSP JSON Schema (v1.2.2) on every save (see [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md)).
    *   **Validation Severity Levels:** Errors (schema violations, missing required fields) vs. Warnings (missing optional but recommended fields, open parameters).

### US 4.22: Document Overview, Import Management & Tags
> Implements [US 0.16](step0_global_requirements.md) with SSP-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** manage SSP metadata, baseline profile imports, and tags in the Document Overview pane,  
> **so that** the overall document structure and global tag system are well-maintained.
*   **Acceptance Criteria:**
    *   **Document Overview Pane:** When no specific control or component is selected, the right main pane shows horizontal tabs: **Metadata**, **Imported Profile**, and **Tags**.
    *   **Metadata Tab:** `metadata.title`, `metadata.version`, `metadata.oscal-version`, `metadata.last-modified`, `metadata.published`, `metadata.revisions[]`, `metadata.parties[]`, `metadata.roles[]`.
    *   **Imported Profile Tab:** Displays the currently imported baseline (`import-profile.href`), its resolved control count, and allows changing the baseline selection. Shows a summary of the baseline's control families and parameter count.
    *   **Tags Tab:** Divided into **Global Property Tags** and **Used / Existing Tags** with occurrence count and promote button (edit mode).
    *   **SSP Summary Dashboard:** Overview showing: system name, status, security impact levels, total controls, implementation progress (by status), open parameters count, component count, user count.

### US 4.23: In-Card Editing & Draft Persistence
> Implements [US 0.17](step0_global_requirements.md) with SSP-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** edit SSP details inline in cohesive card layouts and have unsaved changes cached locally,  
> **so that** data entry is uniform, and no work is lost on accidental navigation.
*   **Acceptance Criteria:**
    *   **Cohesive Card Layout:** The SSP editor presents content in visually grouped sections:
        *   **System Characteristics Card:** System identity, information types, impact levels, status.
        *   **Boundaries Card:** Authorization boundary, network architecture, data flow with diagram embedding.
        *   **System Implementation Card:** Components, users, inventory items, leveraged authorizations.
        *   **Control Implementation Card:** Control list with by-component narratives, parameters, statements.
    *   **Edit / Read-Only Toggle:** Clear mode switching between presentation and editable forms.
    *   **Exit Button with Draft Caching:** Unsaved changes cached in `localStorage`. Draft indicator shows when cached changes exist.
    *   **Discard Draft:** Option to explicitly discard cached changes and revert to last saved state.

### US 4.24: Integrated Backend Versioning
> Implements [US 0.15](step0_global_requirements.md) with SSP-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** save, load, and delete versions of an SSP document directly in the backend,  
> **so that** version states are managed persistently, cross-device, and are visible to other users.
*   **Acceptance Criteria:**
    *   **No UUID Bumping:** A new version is saved under the same document `uuid`.
    *   **Save Version:** "Save Version" dialog with version number (e.g., `1.1.0`) and remarks. Persisted as `{uuid}_v{version}.json`.
    *   **Automatic Revision Tracking:** Saving a version adds an entry to `metadata.revisions[]` with version number, timestamp, OSCAL version, and remarks.
    *   **Versions Drawer:** Drawer listing all versions with version number, timestamp, remarks, and actions (Load, Delete).
    *   **Table Default:** The SSP table displays the latest version by default.
    *   **OSCAL Validation on Save:** Each version is validated against the official OSCAL SSP JSON Schema (see [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md)).

### US 4.25: Back-Matter & Resource Attachments
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** attach supporting resources — architecture diagrams, compliance evidence, authorization letters, policies — to the SSP via the `back-matter` section,  
> **so that** all referenced documentation is bundled within the OSCAL document.
*   **Acceptance Criteria:**
    *   **Resource Management:** Adding `back-matter.resources[]` entries with:
        *   `uuid` (required, auto-generated), `title` (optional), `description` (optional), `citation` (optional), `rlinks[]` (optional), `base64` (optional).
    *   **Diagram Integration:** Diagrams referenced from `authorization-boundary`, `network-architecture`, and `data-flow` sections are stored as back-matter resources and linked via `#uuid` (see [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md)).
    *   **File Upload:** Client-side Base64 encoding for embedded attachments. No server-side file storage.
    *   **Cross-Reference:** Any `link.href` in the document can reference back-matter resources using `#uuid` fragment syntax.

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create SSP (US 4.1):** Alice navigates to the System Security Plans section and clicks "New SSP." She enters the title *"System Security Plan — Reposol Portal v1"* and is redirected to the editing view.

2.  **Configure Metadata & Import Baseline (US 4.22, US 4.2):** In the Document Overview pane, she sets `version` to `1.0.0`, adds herself as a party, and under the **Imported Profile** tab selects the *"Reposol Corporate Baseline v2.0"* profile from the workspace. The system resolves 156 controls across 18 control families.

3.  **Define System Identity (US 4.3):** She enters the system name "Reposol Security Management Platform", short name "Reposol SMP", system ID `SYS-2026-001`, and a comprehensive system description. She sets the authorization date to `2026-06-15`.

4.  **Classify Information Types (US 4.4):** She declares two information types: "Security Compliance Data" (confidentiality: moderate, integrity: high, availability: moderate) and "User Account Information / PII" (confidentiality: high, integrity: moderate, availability: low), categorized under NIST SP 800-60.

5.  **Set Security Impact Level (US 4.5):** Based on the information type impacts, the UI suggests the high-water mark: Confidentiality = High, Integrity = High, Availability = Moderate. She accepts the suggestion and sets `security-sensitivity-level` to `high`.

6.  **Set System Status & Properties (US 4.6, US 4.9):** She sets the status to `operational`, cloud deployment model to `private-cloud`, service model to `paas`, and authenticator assurance level to `2`. She assigns herself as `system-owner` and her colleague as `information-system-security-officer`.

7.  **Define Authorization Boundary (US 4.7):** She writes a narrative description of the system boundary ("Includes all Hetzner Cloud infrastructure, Docker containers, managed PostgreSQL databases, and Keycloak identity service") and uploads an architecture diagram that is Base64-encoded and stored in back-matter.

8.  **Document Network Architecture (US 4.8):** She adds a network architecture description and uploads a network topology diagram showing the VPC layout, subnets, and ingress/egress points.

9.  **Declare System Components (US 4.10):** She imports components from the Stage 3 Component Definition: *Keycloak* (service), *PostgreSQL* (software), *Reposol Backend API* (software), *Reposol Frontend* (software). She adds *Hetzner Cloud IaaS* as `type="system"` with `implementation-point="external"`. The `this-system` component was auto-created.

10. **Declare Leveraged Authorization (US 4.12):** She creates a leveraged authorization for "Hetzner Cloud ISO 27001 Certification" with the authorization date and links it to the Hetzner component.

11. **Declare System Users (US 4.11):** She adds user types: "System Administrator" (privileged, internal), "Compliance Officer" (privileged, internal), "End User" (non-privileged, internal), and "External Auditor" (non-privileged, external). Each gets specific authorized privileges and functions.

12. **Add Inventory Items (US 4.13):** She declares specific instances: "Production DB Server" (IP 10.0.1.50, linked to PostgreSQL component), "Application Server 1" (IP 10.0.1.10, linked to Backend API component).

13. **Set Global Parameters (US 4.14):** She sets global SSP-level parameters: `audit-retention-period` = `365 days`, `session-timeout` = `15 minutes`.

14. **Map Control Implementations (US 4.15):** For control `ac-1` (Access Control Policy), she assigns the `this-system` component and writes: "The organization maintains a documented access control policy reviewed annually." For `ac-2` (Account Management), she assigns both Keycloak and PostgreSQL with distinct implementation narratives.

15. **Add Statement-Level Detail (US 4.16):** For `ac-2`, she breaks into statements: `ac-2_smt.a` → Keycloak ("Manages user account lifecycle including provisioning and deprovisioning"), `ac-2_smt.b` → PostgreSQL ("Database role assignments are reviewed quarterly").

16. **Set Implementation Status (US 4.17):** She marks `ac-1` as `implemented`, `ac-2` as `partial` (with remarks: "MFA integration planned for Q3 2026"), and `pe-2` (Physical Access) as `not-applicable` (hosted in cloud).

17. **Classify Control Origination (US 4.18):** She sets `ac-1` as `organization`, `ac-2` as `system-specific`, and physical controls as `inherited`.

18. **Override Parameters Per Control (US 4.19):** For `ac-7` (Unsuccessful Logon Attempts), she overrides `ac-7_prm_1` at the control level to `3` (stricter than the profile default of `5`). For the Keycloak by-component entry specifically, she sets it to `5` since Keycloak has its own lockout configuration.

19. **Document Inheritance (US 4.20):** For physical security controls assigned to the Hetzner component, she adds `inherited` entries: "Physical data center access controls, environmental protections, and media handling inherited from Hetzner Cloud ISO 27001 certified facilities." She adds `satisfied` entries for customer responsibilities: "Customer configures firewall rules and network segmentation."

20. **Validate & Check Completeness (US 4.21):** She runs the completeness check. The report shows 3 open parameters, 12 controls without implementation narratives, and 0 schema errors. She addresses the gaps.

21. **Attach Evidence (US 4.25):** She uploads the Hetzner ISO 27001 certificate and an internal access control policy document as back-matter resources.

22. **Save Version (US 4.24):** She clicks "Save Version," enters `1.0.0` with remarks "Initial SSP for Reposol Portal," and the document is validated and persisted.

---

## 3. Functional Requirements for the System

- **Baseline Import & Resolution:** Importing an OSCAL profile or catalog as the control baseline, resolving it to obtain all active controls, parameters, and modifications (US 4.2).
- **System Characteristics Management:** System identification, naming, information type categorization (NIST SP 800-60), FIPS-199 security impact levels, operational status, authorization date, and cloud/assurance-level properties (US 4.3, US 4.4, US 4.5, US 4.6, US 4.9).
- **Boundary & Architecture Documentation:** Authorization boundary (required), network architecture (optional), and data flow (optional) with narrative descriptions and Base64-embedded diagrams stored in back-matter (US 4.7, US 4.8).
- **System Implementation Inventory:** Components (14+ OSCAL types including `this-system`, `system`, `network`, `interconnection`), system users with privilege levels and authorized functions, inventory items with IP/asset properties, and leveraged authorizations (US 4.10, US 4.11, US 4.12, US 4.13).
- **Component Import from CDEF:** Importing component definitions from Stage 3 into the SSP, with link traceability via `rel="imported-from"` (US 4.10).
- **Control Implementation with By-Component:** Mapping every baseline control to specific system components with component-level narratives, at both control and statement granularity (US 4.15, US 4.16).
- **Implementation Status Tracking:** Five-state status model (`implemented`, `partial`, `planned`, `alternative`, `not-applicable`) with dashboard summary and filtering (US 4.17).
- **Control Origination Classification:** Categorizing implementation sources (`organization`, `system-specific`, `customer-configured`, `customer-provided`, `inherited`) (US 4.18).
- **Three-Level Parameter Override Hierarchy:** Global SSP → per-control → per-component parameter overrides with cascade visualization and constraint validation (US 4.19).
- **Security Inheritance Model:** `inherited` and `satisfied` declarations in by-component entries linked to leveraged authorizations, plus `export` with `provided` and `responsibility` for provider-side SSPs (US 4.20).
- **Mandatory Field Validation & Completeness:** Open parameter highlighting, dropdown/regex validation, control completeness checks, and OSCAL schema validation on save (US 4.21).
- **Document Management:** Overview with import management and tags (US 4.22), inline editing with draft caching (US 4.23), backend versioning with OSCAL validation (US 4.24), and back-matter resource management with Base64 embedding (US 4.25).

---

## 4. Functional Acceptance Criteria (Summary)

- [ ] An SSP document can be created with minimal input (title only) and the user is redirected to the editor with a `this-system` component auto-created (US 4.1).
- [ ] A baseline profile/catalog can be imported and resolved to load all active controls and parameters (US 4.2).
- [ ] System identity data (system-ids, name, short name, description, authorization date) can be captured with required field validation (US 4.3).
- [ ] Information types can be declared with NIST SP 800-60 categorization and per-type CIA impact assessment (US 4.4).
- [ ] System-wide security impact levels can be set with FIPS-199 high-water mark suggestion (US 4.5).
- [ ] System operational status can be set from OSCAL standard states with conditional remarks (US 4.6).
- [ ] Authorization boundary can be described with narrative text and Base64-embedded diagrams stored in back-matter (US 4.7).
- [ ] Network architecture and data flow can optionally be documented with the same diagram structure (US 4.8).
- [ ] Cloud properties, assurance levels, and responsible parties with OSCAL standard SSP roles can be assigned (US 4.9).
- [ ] System components can be declared with all OSCAL SSP types (including `this-system`, `system`, `network`, `interconnection`) and imported from Stage 3 Component Definitions (US 4.10).
- [ ] System users can be declared with type, privilege level, role assignments, and authorized privileges with functions performed (US 4.11).
- [ ] Leveraged authorizations can be declared with party reference, authorization date, and SSP link (US 4.12).
- [ ] Inventory items can be declared with network/asset properties and linked to logical system components (US 4.13).
- [ ] A global control implementation description and SSP-level parameter defaults can be set (US 4.14).
- [ ] Each baseline control can be mapped to components via by-component entries with implementation narratives, and CDEF descriptions are offered for pre-population (US 4.15).
- [ ] Statement-level by-component detail can be provided for multi-part controls (US 4.16).
- [ ] Implementation status (implemented, partial, planned, alternative, not-applicable) can be tracked per by-component entry with a status dashboard and filtering (US 4.17).
- [ ] Control origination (organization, system-specific, customer-configured, customer-provided, inherited) can be classified per control or by-component (US 4.18).
- [ ] Parameters can be overridden at three SSP levels (global, control, component) with cascade visualization, source indication, and constraint validation (US 4.19).
- [ ] Security inheritance can be declared via inherited/satisfied entries linked to leveraged authorizations, and export with provided/responsibility can be declared for provider SSPs (US 4.20).
- [ ] Open parameters, missing implementation narratives, and schema violations are highlighted with a completeness report on save (US 4.21).
- [ ] Document overview offers tabs for metadata, imported profile summary, and tag management with promotion (US 4.22).
- [ ] Inline editing with draft caching in `localStorage` prevents data loss (US 4.23).
- [ ] Document versions can be saved, loaded, and deleted with automatic revision tracking and OSCAL validation (US 4.24).
- [ ] Back-matter resources can be attached via client-side Base64 encoding and cross-referenced from diagrams, links, and evidence references (US 4.25).
- [ ] The generated SSP document fully complies with the official NIST OSCAL System Security Plan JSON Schema v1.2.2 (all stories).
