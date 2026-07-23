# Step 4: Detailed User Stories – SSP Builder

* **Persona:** Alice (Compliance Officer / System Owner)
* **Goal:** Creation of a complete System Security Plan (SSP) to document the specific security architecture, the linking of assets to controls, and the fine-grained parameter customization.

---

## 1. Breakdown of User Stories

### US 4.1: System Identification & FIPS-199 Categorization
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare basic system data, the operational status, and the FIPS-199 security objectives,  
> **so that** the system and its criticality (confidentiality, integrity, availability) are formally categorized.
*   **Acceptance Criteria:**
    *   Entry of system name, version, and description.
    *   Setting the system status (e.g., `operational`, `under-development`).
    *   Declaration of FIPS-199 security objectives (confidentiality, integrity, availability: each `low`, `moderate`, `high`) and calculation of the resulting system security level.

### US 4.2: System Boundaries & Diagram Attachments
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** describe the system boundaries (authorization boundary) and graphically document network and data flow diagrams,  
> **so that** the technical scope and interfaces of the system are clearly demarcated.
*   **Acceptance Criteria:**
    *   Textual description of the system boundary (`authorization-boundary`).
    *   Uploading and embedding network architecture and data flow diagrams in the SSP.
    *   **No Local Filesystem Storage (Standards Compliance):** To maximize the portability of OSCAL documents and keep the filesystem clean, uploaded diagrams are not saved as separate files on the server but are embedded directly as Base64-encoded attachments in `back-matter.resources` of the JSON document.
    *   **Referencing via Internal Links:** Each diagram references the corresponding resource in the `back-matter` via a standardized `links` element (e.g., `href: "#resource-uuid"`).
    *   **Fully Client-side Processing:** The conversion to Base64 takes place client-side in the browser. Backend upload and download endpoints for files are not required and are removed.

### US 4.3: User Groups & Authorization Roles
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** capture all user groups of the system and their authorization levels,  
> **so that** the user and role concept is documented in the system.
*   **Acceptance Criteria:**
    *   Declaration of user groups (`users`) with role name and estimated count.
    *   Documentation of authorization levels and privileged access rights (e.g., system administrators).

### US 4.4: Control Implementation via Components (by-components)
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** assign controls specifically to individual active components and write component-specific implementation statements,  
> **so that** the concrete technical and organizational realization of each requirement is traceable.
*   **Acceptance Criteria:**
    *   Assignment of one or more active components to a control.
    *   Entry of detailed descriptions per component (`by-components`).
    *   Automatic retrieval of predefined security capabilities (e.g., EAL evidence) from the Component Definitions to substantiate the documentation.

### US 4.5: Security Inheritance & Third-Party Certificates (Leveraged Authorizations)
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** declare controls as inherited and reference external security evidence (e.g., cloud provider certifications),  
> **so that** I reduce the documentation effort for shared or completely outsourced controls.
*   **Acceptance Criteria:**
    *   Marking a control as "fully inherited" (`inherited`) or "shared" (`shared`).
    *   Linking to an external authorization (`leveraged-authorization`, e.g., AWS FedRAMP Package).

### US 4.6: System-Specific Parameter Overrides
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** override baseline global parameters specifically for the system,  
> **so that** I can declare deviating, stricter, or system-specifically necessary configurations.
*   **Acceptance Criteria:**
    *   Overriding parameter values directly in the SSP (`set-parameters`).
    *   Consistency checks of the SSP upon saving to comply with any constraints of the source catalogs.

### US 4.7: Mandatory Field Validation and Guided Parameter Assignment in the SSP Builder
> **As a** System Owner (Bob)  
> **I want to** immediately see in the SSP Builder which parameters are still open and be required to fill them out using guided selection lists (dropdowns) and regex validation,  
> **so that** the SSP is fully documented and no unresolved placeholders remain.
*   **Acceptance Criteria:**
    *   **Mandatory Field Highlighting for Open Parameters:** If a parameter is defined in the referenced profile/catalog but has not been assigned a value in either the profile or the SSP, it is color-highlighted (e.g., yellow warning notice `"Open Parameter - Must be filled"`).
    *   **Dropdown Control & Regex:** Analogous to the Profile Builder, dropdown fields are displayed for parameters with predefined choices. Inputs are validated against the regex constraints of the catalog/profile, and invalid values are visually marked.
    *   **Completeness Warning upon Saving:** When saving the SSP, a list of all parameters that have not yet been assigned a value is displayed to the user to ensure completeness.

### US 4.8: Simplified SSP Creation & Direct Editing (Inner View)
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** be able to create a new SSP by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can configure system data and metadata directly within the editing area without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New SSP" opens a simple dialog that requires only the title.
    *   **Direct Redirection:** After clicking "Create Document," the SSP is initialized in the backend and the user is redirected immediately to the editing view (`/ssp/{uuid}?edit=true`).

### US 4.9: Integrated SSP Versioning in the Backend (Versions instead of Drafts)
> **As a** Compliance Officer (Alice)  
> **I want to** save, load, and delete versions of an SSP directly as separate, OSCAL-compliant JSON documents in the backend,  
> **so that** version states can be managed persistently, cross-device, and visibly to other users.
*   **Acceptance Criteria:**
    *   **No UUID Bumping:** A new version is saved under the same UUID.
    *   **Save as Version (Save Version):** The "Save Version" button opens a dialog for the version number (e.g., `1.1.0`) and remarks. The file is persisted as `<uuid>_v<version>.json`.
    *   **Versions Drawer & Deletion:** Clicking `Versions` shows the loaded version and opens the drawer for navigation and deletion of versions.
    *   **Table:** The SSP table displays the latest version by default.

### US 4.10: Document Overview & Tag Management on SSPs
> **As a** Compliance Officer (Alice)  
> **I want to** manage metadata, profile imports, and tags in the right main pane (Document Overview) when no specific control is selected,  
> **so that** I can maintain the overall document and its global tag structure.
*   **Acceptance Criteria:**
    *   **Document Overview:** Horizontal tabs **Metadata**, **Imported Profile** (import/select baselines), and **Tags** when selection is empty.
    *   **"Tags" Tab:** Divided into **Global Property Tags** and **Used / Existing Tags** (including occurrence count and promote button in edit mode).

### US 4.11: Detailed Editability & Exit Button for SSPs
> **As a** Compliance Officer (Alice)  
> **I want to** edit details of SSP controls/components inline in a cohesive card and save edits using an exit button,  
> **so that** input is uniform and secure.
*   **Acceptance Criteria:**
    *   **In-Card Editor:** Header area and properties are edited in a single gray cohesive card with border.
    *   **Autocomplete (`datalist`):** Suggestions for already used key names during property definition.
    *   **Exit Button with Backend Drafting:** Exit ends editing and redirects to the read-only view. Unsaved changes are cached in `localStorage` for recovery.

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create SSP (US 4.8):** Alice clicks on "New SSP," enters the title *"System Security Plan - Reposol Portal v1,"* and is redirected immediately to the editing view `/ssp/{uuid}?edit=true`.
2.  **Maintain Global Metadata, Imports & Tags (US 4.1, US 4.10):** In the main pane (Document Overview) under *Metadata*, she enters version `1.0.0` and selects the *Reposol Corporate Baseline v2.0* under *Imported Profile*. Under *Tags*, she defines global property tags.
3.  **Declare System Boundaries & Users (US 4.2, US 4.3):** She describes the system boundaries, uploads network diagrams, and captures user groups.
4.  **Link Baseline & Components (US 4.4, US 4.11):** She activates components and links them to the imported controls. For `ac-2`, she overrides the parameter review interval (US 4.6, US 4.7) and enters component-specific statements (US 4.4, US 4.11).
5.  **Document Inheritance (US 4.5):** She declares physical controls as inherited from AWS.
6.  **Versioning & Exit (US 4.9, US 4.11):** She saves version `1.0.0` in the version dialog and leaves the editor via the "Exit" button.

---

## 3. Functional Requirements for the System

- **Two-stage Workflow:** System definition (Stage 1) and implementation matrix (Stage 2) (US 4.1, US 4.4).
- **User & System Boundary Documentation:** Roles and integration of network diagrams (US 4.2, US 4.3).
- **Security Inheritance & Parameter Overrides:** Leveraged authorizations and system-specific overriding of parameters under constraint compliance (US 4.5, US 4.6, US 4.7).
- **Granular Component Assignment:** Assigning active components to controls and component-specific prose implementation (US 4.4).
- **Integrated Versioning:** Saving specific version files `<uuid>_v<version>.json`, drawer view, deletion, and read-only access for historical states (US 4.9).
- **Document Overview & Tags:** Metadata, Imports, and Tags subtabs in the main pane with tag promotion (US 4.10).
- **In-Card Edit & Exit Drafting:** Header/properties in a cohesive card, databindings via `datalist` autocomplete, and `localStorage` caching upon exit (US 4.11).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] The editor clearly separates system definition (Stage 1) from the control matrix (Stage 2) (US 4.1).
- [x] The user can define FIPS-199 security objectives for confidentiality, integrity, and availability separately (US 4.1).
- [x] The system supports uploading and embedding network and data flow diagrams (US 4.2).
- [x] Controls can be declared as inherited and linked to external security evidence (US 4.5).
- [x] In the implementation area, profile parameter values can be overridden specifically for the system (US 4.6).
- [x] A user can assign one or more active components to controls and enter a separate implementation description for each component (US 4.4).
- [x] The system verifies the existence of all linked profiles and components upon saving.
- [x] The generated SSP document matches the official OSCAL SSP schema upon output (US 4.1).
- [x] New SSP documents can be created simply and redirect directly to the editing area (US 4.8).
- [x] Document Overview offers tabs for metadata, source imports, and tag management including promotion (US 4.10).
- [x] Editing is performed in a cohesive detail card and drafts are cached locally upon exit (US 4.11).
- [x] Versions of an SSP are persistently versioned in the backend and managed via the drawer (US 4.9).
