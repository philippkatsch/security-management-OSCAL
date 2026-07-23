# Step 3: Detailed User Stories – Component Definition

* **Persona:** Alice (Compliance Officer / Lead Engineer)
* **Goal:** Structured capture of all reusable IT security components (software, cloud services, policies, hardware) and their inherent compliance capabilities as well as dependencies according to the NIST OSCAL specification.

---

## 1. Breakdown of User Stories

### US 3.1: Component Declaration & Typing
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create IT assets and classify them according to standardized OSCAL types (e.g., `software`, `service`, `policy`, `hardware`),  
> **so that** the deployment method is documented in a machine-readable manner.
*   **Acceptance Criteria:**
    *   Creation of components with a unique ID and name.
    *   Assignment of standardized OSCAL component types (`software`, `service`, `policy`, `hardware`, `physical`, `process-procedure`).
    *   Entry of a free-text purpose.

### US 3.2: Custom Properties & Metadata
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** capture flexible product properties (properties) such as certifications or hosting models on components,  
> **so that** important audit evidence and metadata are stored directly on the asset.
*   **Acceptance Criteria:**
    *   Adding freely definable properties (`props`) with name, value, and optional remark.
    *   Capturing security certifications (e.g., `eal-level` = `EAL 4+`).
    *   Capturing technical details such as encryption algorithms used (e.g., `encryption-algorithms` = `AES-256`).

### US 3.3: Interfaces & Protocols
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** document the offered network interfaces and protocols used on components,  
> **so that** the technical communication structure and attack surface are transparently captured.
*   **Acceptance Criteria:**
    *   Definition of technical interfaces (`protocols`) on components.
    *   Capturing protocol type (e.g., `HTTPS`, `SSH`), port number (e.g., `443`, `22`), and security features (e.g., TLS 1.3).

### US 3.4: Component Dependencies (Dependencies)
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** declare dependencies between different system components,  
> **so that** relationships, data flows, and dependency chains become visible in the system architecture model.
*   **Acceptance Criteria:**
    *   Linking components with each other using cross-references (`dependencies`).
    *   Declaring that a software component requires a specific service or database for execution.
    *   Support for `import-component-definition` to import external component definitions (e.g., from vendor documentations or other Reposol instances).

### US 3.5: Role & Responsibility Assignment
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** bind organizational responsibilities directly to components,  
> **so that** responsible teams can be identified immediately in case of an audit or security incident.
*   **Acceptance Criteria:**
    *   Assignment of administrative and security-related roles (`responsible-roles`) to components.
    *   Linking roles such as `administrator` or `security-contact` with persons or teams.

### US 3.6: Embedded Security Capabilities (Control Implementations)
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** document which controls and detailed statements a product meets *out-of-the-box*,  
> **so that** these predefined security capabilities can be reused as templates in future System Security Plans (SSPs).
*   **Acceptance Criteria:**
    *   Linking a component to a rulebook/framework (Source).
    *   Assignment of covered controls (`implemented-requirements`) with detailed implementation descriptions.
    *   Fine-grained mapping of coverage down to the level of individual control statements (`statements`).

### US 3.7: Simplified Component Declaration & Direct Editing (Inner View)
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** be able to create a new component by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can configure the typing and metadata directly within the editing area without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New Component" opens a simple dialog that requires only the name.
    *   **Direct Redirection:** After clicking "Create Document," the component is initialized in the backend and the user is redirected immediately to the editing view (`/component/{uuid}?edit=true`).

### US 3.8: Integrated Component Versioning in the Backend (Versions instead of Drafts)
> **As a** Compliance Officer (Alice)  
> **I want to** save, load, and delete versions of a component definition directly as separate, OSCAL-compliant JSON documents in the backend,  
> **so that** version states can be managed persistently, cross-device, and visibly to other users.
*   **Acceptance Criteria:**
    *   **No UUID Bumping:** A new version is saved under the same UUID.
    *   **Save as Version (Save Version):** The "Save Version" button opens a dialog for the version number (e.g., `1.1.0`) and remarks. The file is persisted as `<uuid>_v<version>.json`.
    *   **Versions Drawer & Deletion:** Clicking `Versions` shows the loaded version and opens the drawer for navigation and deletion of versions.
    *   **Table:** The component table displays the latest version by default.

### US 3.9: Document Overview & Tag Management on Components
> **As a** Compliance Officer (Alice)  
> **I want to** manage metadata and tags in the right main pane (Document Overview) when no specific component is selected,  
> **so that** I can maintain the overall document and its global tag structure.
*   **Acceptance Criteria:**
    *   **Document Overview:** Horizontal tabs **Metadata** and **Tags** when selection is empty.
    *   **"Tags" Tab:** Divided into **Global Property Tags** and **Used / Existing Tags** (including occurrence count and promote button in edit mode).

### US 3.10: Detailed Editability & Exit Button for Components
> **As a** Compliance Officer (Alice)  
> **I want to** edit component details inline in a cohesive card and save edits using an exit button,  
> **so that** input is uniform and secure.
*   **Acceptance Criteria:**
    *   **In-Card Editor:** Header area (name, type, purpose) and properties are edited in a single gray cohesive card with border.
    *   **Autocomplete (`datalist`):** Suggestions for already used key names during property definition.
    *   **Exit Button with Backend Drafting:** Exit ends editing and redirects to the read-only view. Unsaved changes are cached in `localStorage` for recovery.

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create Component (US 3.7):** Alice clicks on "New Component," enters the title *"Reposol Components,"* and is redirected immediately to the editing view `/component/{uuid}?edit=true`.
2.  **Maintain Global Metadata & Tags (US 3.9):** In the main pane (Document Overview) under *Metadata*, she enters version `1.0.0` and creates a global tag `owner`.
3.  **Declare Assets & Edit Details (US 3.1, US 3.10):** She creates the component *AWS Cognito* (type: `service`). In the in-place editor, she assigns Cognito the global tag `owner` with the value `Platform-Engineering`.
4.  **Define Properties & Ports (US 3.2, US 3.3):** She enters `eal-level` `"EAL 4+"` for *AWS Cognito* and declares HTTPS on port 1000 for the *Reposol Backend API*.
5.  **Link Dependencies & Responsibilities (US 3.4, US 3.5):** She links the *Reposol Backend API* to *AWS Cognito* and assigns roles.
6.  **Link Security Capabilities (US 3.6):** She documents that *AWS Cognito* satisfies `AC-7` out-of-the-box.
7.  **Versioning & Exit (US 3.8, US 3.10):** She clicks "Save Version," saves version `1.0.0`, and leaves the editor via the "Exit" button.

---

## 3. Functional Requirements for the System

- **OSCAL Component Classification:** Support for types such as `software`, `service`, `hardware`, `policy`, etc. (US 3.1).
- **Flexible Product Properties (Properties) & Protocols:** Props and technical interfaces (`protocols`) (US 3.2, US 3.3).
- **Relationship Model:** Assignment of dependencies (`dependencies`) and administrative roles (US 3.4, US 3.5).
- **Control Implementations:** Mapping of covered controls (`implemented-requirements`) at the statement level (US 3.6).
- **Integrated Versioning:** Version-specific saving, drawer view, deletion, and read-only access for historical states (US 3.8).
- **Document Overview & Tags:** Metadata and Tags subtabs in the main pane with tag promotion (US 3.9).
- **In-Card Edit & Exit Drafting:** Header/properties in a cohesive card, databindings via `datalist` autocomplete, and `localStorage` caching upon exit (US 3.10).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] A user can create components and classify them according to standardized OSCAL types (US 3.1).
- [x] The editor supports assigning properties (`props`), links, and responsible entities to the component (US 3.2, US 3.5).
- [x] Interfaces and protocols (e.g., HTTPS on port 443) can be stored on components (US 3.3).
- [x] The user can declare dependencies between components (US 3.4).
- [x] Native security capabilities of a product can be captured and described as built-in control implementations (US 3.6).
- [x] The generated document complies with the official OSCAL Component Definition schema (US 3.1).
- [x] New component documents can be created simply and redirect directly to the editing area (US 3.7).
- [x] Document Overview offers tabs for metadata and tag management including promotion (US 3.9).
- [x] Editing is performed in a cohesive detail card and drafts are stored locally upon exit (US 3.10).
- [x] Versions of a component definition are persistently versioned in the backend and managed via the drawer (US 3.8).
