# Step 8: Detailed User Stories – Control Mapping (Mapping Collection)

* **Persona:** Alice (Compliance Officer / Framework Developer)
* **Goal:** Creation of machine-readable cross-framework mappings (Control Mappings) between different security catalogs, automatic detection of coverage gaps, and visual representation of control relationships to support regulatory equivalence analyses.

---

## 1. Breakdown of User Stories

### US 8.1: Mapping Declaration & Provenance
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** create a mapping document containing provenance information (creator, timestamp, methodology) as well as references to the source and target frameworks,  
> **so that** the origin and traceability of the control mappings are transparently documented.
*   **Acceptance Criteria:**
    *   Capturing metadata (title, version, OSCAL version).
    *   Declaration of the source resource (`source-resource`) and target resource (`target-resource`) as `href` references to existing catalogs or profiles.
    *   Provenance section with details on the author, a description of the mapping methodology applied, and the creation date.

### US 8.2: Creating Control Mappings (Control Mapping Pairs)
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** map individual controls of the source framework to controls of the target framework with a defined relationship type,  
> **so that** the semantic relationships between the standards are represented in a machine-readable format.
*   **Acceptance Criteria:**
    *   Mapping of individual source controls to target controls as individual mapping entries.
    *   Selection of the relationship type from: `equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`.
    *   Providing remarks and a justification for each mapping entry.
    *   Support for 1:1, 1:N, and N:1 mappings.

### US 8.3: Automatic Gap Analysis & Coverage Report
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want** the system to automatically identify unmapped controls and generate a coverage report,  
> **so that** I can quickly identify gaps in cross-framework compliance and perform targeted remediation.
*   **Acceptance Criteria:**
    *   Visual marking (indicator) for mapped vs. unmapped controls on both sides (source and target frameworks).
    *   Coverage percentage (Coverage) per framework.
    *   Exportable gap report (e.g., as CSV or PDF).
    *   Filter function to display only unmapped controls.

### US 8.4: Mapping Visualization (Matrix & Sankey)
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** view control mappings in different visual representations,  
> **so that** I can intuitively capture relationships between frameworks and present them to stakeholders.
*   **Acceptance Criteria:**
    *   **Matrix View:** Source controls as rows and target controls as columns with relationship indicators in the cells.
    *   **Optional Sankey/Flow Diagram:** Representation of control flows at the group level as a Sankey diagram.
    *   Color coding by relationship type (e.g., `equivalent-to` = green, `subset-of` = blue, `no-relationship` = red).

### US 8.5: Simplified Mapping Creation & Direct Editing (Inner View)
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** be able to create a new mapping document by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can configure source and target frameworks as well as mappings directly in the editing area without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New Mapping" opens a simple dialog that requires only the title.
    *   **Direct Redirection:** After clicking "Create Document," the mapping is initialized in the backend and the user is redirected immediately to the editing view (`/mapping/{uuid}?edit=true`).
    *   **In-place Configuration:** All further settings (source/target resources, mappings, metadata) are performed directly in this inner view.

> [!NOTE]
> This user story follows the global pattern from **US 0.P1** (Simplified Creation & Inner View).

### US 8.6: Versioning, Document Overview & Editability
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** persistently save versions of a mapping document, manage the document overview with metadata, imported catalogs, and tags, and edit all mapping details inline in a cohesive card,  
> **so that** the management, traceability, and usability of the mapping editor comply with established system standards.
*   **Acceptance Criteria:**
    *   **Integrated Versioning (US 0.P2):**
        *   **No UUID Bumping:** A new version is saved under the same UUID.
        *   **Save as Version (Save Version):** The "Save Version" button opens a dialog for the version number (e.g., `1.1.0`) and remarks. The file is persisted as `<uuid>_v<version>.json`.
        *   **Versions Drawer & Deletion:** Clicking `Versions` shows the loaded version and opens the drawer for navigation and deletion of versions.
        *   **Read-Only History:** Older versions are opened in read-only mode.
        *   **Table:** The mapping table displays the latest version by default.
    *   **Document Overview (US 0.P3):**
        *   **Right Main Pane:** Displayed when no specific mapping is selected on the left. Contains the horizontal tabs **Metadata** (title, version, OSCAL version, remarks), **Imported Catalogs** (select source and target catalogs/profiles), and **Tags**.
        *   **"Tags" Tab:** Divided into **Global Property Tags** and **Used / Existing Tags** (including occurrence count and promote button in edit mode).
    *   **Detailed Editability (US 0.P4):**
        *   **In-Card Editor:** Header area and properties are edited in a single gray cohesive card with border.
        *   **Autocomplete (`datalist`):** Suggestions for already used key names during property definition.
        *   **Exit Button with Backend Drafting:** Exit ends editing and redirects to the read-only view. Unsaved changes are cached in `localStorage` for recovery.

> [!NOTE]
> This user story combines the global patterns from **US 0.P2** (Versioning), **US 0.P3** (Document Overview & Tags), and **US 0.P4** (Detailed Editability & Exit Button).

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create Mapping (US 8.5):** Alice clicks on "New Mapping," enters the title *"NIST 800-53 → ISO 27001 Mapping,"* and is redirected immediately to the editing view `/mapping/{uuid}?edit=true`.
2.  **Maintain Global Metadata, Imports & Tags (US 8.1, US 8.6):** In the main pane (Document Overview) under *Metadata*, she enters version `1.0.0` and records provenance information (author, mapping methodology: *"Manual expert analysis based on NIST SP 800-53 Rev. 5 and ISO/IEC 27001:2022"*, date). Under *Imported Catalogs*, she links the previously created NIST 800-53 catalog as the source resource and the ISO 27001 catalog as the target resource. Under *Tags*, she defines global property tags such as `mapping-scope` and `confidence-level`.
3.  **Create Control Mappings (US 8.2, US 8.6):** She switches to the mapping editor and creates individual mappings:
    *   `AC-2` (Account Management) → `A.5.18` (Access Rights) with relationship type `subset-of` and the remark that AC-2 covers a narrower scope.
    *   `AC-3` (Access Enforcement) → `A.8.3` (Access Control to Information) with relationship type `equivalent-to`.
    *   `IA-2` (Identification and Authentication) → `A.8.5` (Secure Authentication) **and** `A.5.17` (Authentication Information) as a 1:N mapping.
    *   For `PE-1` (Physical and Environmental Protection Policy), she documents `no-relationship`, as ISO 27001 covers this in a separate Annex.
4.  **Perform Gap Analysis (US 8.3):** Alice starts the automatic gap analysis. The system shows coverage of 78 % for NIST 800-53 and 85 % for ISO 27001. She filters for unmapped controls and identifies missing mappings for the *Physical Security* and *Contingency Planning* groups. She exports the gap report as CSV.
5.  **Verify Visualization (US 8.4):** In the matrix view, she verifies the mappings visually – green cells for `equivalent-to`, blue for `subset-of`, red for `no-relationship`. In the optional Sankey diagram, she views the control flows at the group level (e.g., "Access Control" → "Annex A.5", "Annex A.8").
6.  **Versioning & Exit (US 8.6):** She saves version `1.0.0` in the version dialog with the note *"Initial framework mapping – 78% coverage"* and leaves the editor via the "Exit" button.

---

## 3. Functional Requirements for the System

- **Provenance & Framework Referencing:** Capture of author, methodology, and date, as well as linking of source and target frameworks via `href` references (US 8.1).
- **Structured Control Mappings:** Creation of individual mapping entries with defined relationship types (`equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`) and support for 1:1, 1:N, and N:1 mappings (US 8.2).
- **Automatic Gap Analysis:** Identification of unmapped controls, calculation of coverage percentages, and export of gap reports (US 8.3).
- **Multi-View Visualization:** Matrix representation with relationship indicators and optional Sankey diagram with color coding by relationship type (US 8.4).
- **Integrated Versioning:** Saving specific version files `<uuid>_v<version>.json`, drawer view, deletion, and read-only access for historical states (US 8.6).
- **Document Overview & Tags:** Metadata, Imported Catalogs, and Tags subtabs in the main pane with tag promotion (US 8.6).
- **In-Card Edit & Exit Drafting:** Header/properties in a cohesive card, databindings via `datalist` autocomplete, and `localStorage` caching upon exit (US 8.6).

---

## 4. Functional Acceptance Criteria (Summary)

- [ ] A user can create a mapping document with provenance information and framework references (US 8.1).
- [ ] The system allows mapping individual source controls to target controls with defined relationship types (US 8.2).
- [ ] Mapping entries support 1:1, 1:N, and N:1 mappings with remarks and justifications (US 8.2).
- [ ] Automatic gap analysis identifies unmapped controls and calculates coverage percentages (US 8.3).
- [ ] An exportable gap report can be generated and filtered (US 8.3).
- [ ] The matrix view represents source and target controls with color-coded relationship indicators (US 8.4).
- [ ] An optional Sankey/flow diagram visualizes control flows at the group level (US 8.4).
- [ ] New mappings can be created simply and redirect directly to the editing area (US 8.5).
- [ ] Document Overview offers tabs for metadata, imported catalogs, and tag management including promotion (US 8.6).
- [ ] Editing is performed in a cohesive detail card and drafts are cached locally upon exit (US 8.6).
- [ ] Versions of a mapping document are persistently versioned in the backend and managed via the drawer (US 8.6).
- [ ] The exported mapping complies 100% with the official OSCAL Mapping Collection schema (US 8.1).
