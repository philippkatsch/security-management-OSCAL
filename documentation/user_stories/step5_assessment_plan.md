# Step 5: Detailed User Stories – Assessment Plan Builder

* **Persona:** Bob (Lead Assessor / Compliance Auditor)
* **Goal:** Planning a structured and audit-ready system assessment (Assessment Plan) by defining assessment objectives, in-scope assets, assessment methods, assessment teams, tools, and a milestone schedule, while linking the target SSP.

---

## 1. Breakdown of User Stories

### US 5.1: Plan Declaration & SSP Import
> **As a** Lead Assessor (Bob)  
> **I want to** declare a new assessment plan and import the corresponding System Security Plan (SSP),  
> **so that** all system definitions, components, and controls are automatically linked and do not need to be manually duplicated.
*   **Acceptance Criteria:**
    *   Capturing metadata of the assessment plan (title, version, version of the standard).
    *   Linking the underlying SSP using an import reference (`import-ssp`).
    *   Automatically reading the system context (name, components, scope) from the SSP.

### US 5.2: Audit Scope & Subject Selection
> **As a** Lead Assessor (Bob)  
> **I want to** explicitly select from the linked system model which locations, components, users, or assets are to be assessed,  
> **so that** the precise assessment scope (Assessment Subject) is contractually and technically established.
*   **Acceptance Criteria:**
    *   Selection of active system components and physical locations from the SSP for the scope of the audit.
    *   Declaration of local definitions (`local-definitions`) for testing purposes if certain assets or IP ranges are missing from the SSP (e.g., temporary testing environments).

### US 5.3: Objective & Control Selection (Objectives)
> **As a** Lead Assessor (Bob)  
> **I want to** determine which controls and assessment objectives (Objectives) are to be evaluated in this audit cycle,  
> **so that** the test scope has clearly defined criteria.
*   **Acceptance Criteria:**
    *   Selection of controls to be assessed from the SSP baseline (`reviewed-controls`).
    *   Selection or addition of assessment objectives (Objectives) and the testing methods to be applied (`examine`, `interview`, `test`) for each control.
    *   **ProseWithParams im Assessment Plan Editor:** Alle Textfelder für Assessment Objectives (`objectives`) und Assessment Actions/Methoden in US 5.3 und US 5.9 nutzen `ProseWithParams`.
    *   **Add Parameter Popover:** Auditoren können beim Formulieren konkreter Testinstruktionen und Prüfkriterien über den „Add Parameter“-Button Parameter aus dem importierten SSP oder Profil per Caret-relativem Dropdown einfügen.
    *   **Define New Parameter im AP:** Wählt der Auditor „➕ Define New Parameter...“, scrollt der Editor automatisch zum lokalen Parameter-Erstellungsbereich (`local-definitions.parameters`) des Assessment Plans.

### US 5.4: Assessment Assets (Assessment Tools & Team)
> **As a** Lead Assessor (Bob)  
> **I want to** document the assessment team (actors) and the tools used (scanners, test scripts) in the plan,  
> **so that** the assessment responsibilities and the approved testing resources are transparently declared.
*   **Acceptance Criteria:**
    *   Assignment of persons and organizations to the assessment team (`assessment-assets`).
    *   Capturing software tools used (e.g., vulnerability scanners, security linters) with versions and specifications.

### US 5.5: Task Scheduling (Tasks, Milestones & Actions)
> **As a** Lead Assessor (Bob)  
> **I want to** declare a detailed schedule with milestones and concrete assessment instructions (Assessment Actions),  
> **so that** all participants are informed about the timeline and the procedures to be executed.
*   **Acceptance Criteria:**
    *   Creation of tasks (`tasks`) and milestones with due dates.
    *   Definition of concrete procedures (assessment steps) that can be assigned to testers during execution.

### US 5.6: Simplified Assessment Plan Creation & Direct Editing (Inner View)
> **As a** Lead Assessor (Bob)  
> **I want to** be able to create a new assessment plan by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can configure metadata and scope directly within the editing area without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New AP" opens a simple dialog that requires only the title.
    *   **Direct Redirection:** After clicking "Create Document," the assessment plan is initialized in the backend and the user is redirected immediately to the editing view (`/assessment-plan/{uuid}?edit=true`).

### US 5.7: Integrated Assessment Plan Versioning in the Backend (Versions instead of Drafts)
> **As a** Lead Assessor (Bob)  
> **I want to** save, load, and delete versions of an assessment plan directly as separate, OSCAL-compliant JSON documents in the backend,  
> **so that** version states can be managed persistently, cross-device, and visibly to other users.
*   **Acceptance Criteria:**
    *   **No UUID Bumping:** A new version is saved under the same UUID.
    *   **Save as Version (Save Version):** The "Save Version" button opens a dialog for the version number (e.g., `1.1.0`) and remarks. The file is persisted as `<uuid>_v<version>.json`.
    *   **Versions Drawer & Deletion:** Clicking `Versions` shows the loaded version and opens the drawer for navigation and deletion of versions.
    *   **Table:** The AP table displays the latest version by default.

### US 5.8: Document Overview & Tag Management on Assessment Plans
> **As a** Lead Assessor (Bob)  
> **I want to** manage metadata, SSP imports, and tags in the right main pane (Document Overview) when no specific assessment objective is selected,  
> **so that** I can maintain the overall document and its global tag structure.
*   **Acceptance Criteria:**
    *   **Document Overview:** Horizontal tabs **Metadata**, **Imported SSP** (select target SSP), and **Tags** when selection is empty.
    *   **"Tags" Tab:** Divided into **Global Property Tags** and **Used / Existing Tags** (including occurrence count and promote button in edit mode).

### US 5.9: Detailed Editability & Exit Button for Assessment Plans
> **As a** Lead Assessor (Bob)  
> **I want to** edit details of assessment objectives, tools, or milestones inline in a cohesive card and save edits using an exit button,  
> **so that** input is uniform and secure.
*   **Acceptance Criteria:**
    *   **In-Card Editor:** Header area and properties are edited in a single gray cohesive card with border.
    *   **Autocomplete (`datalist`):** Suggestions for already used key names during property definition.
    *   **Exit Button with Backend Drafting:** Exit ends editing and redirects to the read-only view. Unsaved changes are cached in `localStorage` for recovery.
    *   **ProseWithParams Integration:** Detail-Texte und Prüfanweisungen unterstützen `ProseWithParams` mit Caret-relativer Parameter-Einbindung und automatischem Scrollen bei „Define New Parameter...“.

### US 5.10: Assessment Terms & Conditions (Terms & Conditions)
> **As a** Lead Assessor and Compliance Auditor (Bob)  
> **I want to** document the terms and conditions, rules of behavior, and constraints of the assessment (Rules of Engagement) in the Assessment Plan,  
> **so that** all participants know the boundaries and conditions of the assessment before it starts and can formally agree.
*   **Acceptance Criteria:**
    *   Capturing of `terms-and-conditions` with structured text (Prose) in the Assessment Plan.
    *   Subdivision into sections (e.g., scope constraints, escalation rules, time windows, privacy requirements).
    *   Ability to load predefined templates for terms and conditions.

---

## 2. Bob's Detailed Workflow & User Journey

1.  **Create Assessment Plan (US 5.6):** Bob clicks on "New AP," enters the title *"Annual Audit Reposol Portal v1,"* and is redirected immediately to the editing view `/assessment-plan/{uuid}?edit=true`.
2.  **Maintain Global Metadata, Imports & Tags (US 5.1, US 5.8):** In the main pane (Document Overview) under *Metadata*, he enters version `1.0.0` and selects the *System Security Plan - Reposol Portal v1* under *Imported SSP*. Under *Tags*, he defines global property tags.
3.  **Declare Assessment Scope & Subjects (US 5.2):** He selects the components from the SSP and captures local testing definitions.
4.  **Link Controls & Assessment Objectives (US 5.3, US 5.9):** He selects the controls and documents assessment objectives and the methods `examine` and `test` in the in-place editor (US 5.9).
5.  **Declare Team, Tools & Scheduling (US 5.4, US 5.5):** He enters testers and the Nessus scanner, sets milestones, and specific assessment actions.
6.  **Versioning & Exit (US 5.7, US 5.9):** He saves version `1.0.0` in the version dialog and leaves the editor via the "Exit" button.

---

## 3. Functional Requirements for the System

- **Centralized SSP Import:** Reading existing SSPs to reference system structures (US 5.1).
- **Subject Mapping & Assessment Objectives:** Association of system components to subjects and linking controls to assessment objectives and test methods (US 5.2, US 5.3).
- **Resource & Time Scheduling:** Capture of testers, tools, milestones, and work instructions (US 5.4, US 5.5).
- **Integrated Versioning:** Saving specific version files `<uuid>_v<version>.json`, drawer view, deletion, and read-only access for historical states (US 5.7).
- **Document Overview & Tags:** Metadata, Imports, and Tags subtabs in the main pane with tag promotion (US 5.8).
- **In-Card Edit & Exit Drafting:** Header/properties in a cohesive card, databindings via `datalist` autocomplete, and `localStorage` caching upon exit (US 5.9).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] An auditor can create an assessment assessment plan and link it to an existing SSP (US 5.1).
- [x] The system allows selective adding of components and locations from the SSP into the audit scope (US 5.2).
- [x] The editor supports assigning assessment methods and objectives to selected controls (US 5.3).
- [x] Assessment teams and testing tools can be documented in a structured manner (US 5.4).
- [x] Milestones and specific work instructions (tasks) can be created with due dates (US 5.5).
- [x] The exported assessment plan complies 100% with the official OSCAL Assessment Plan schema (US 5.1).
- [x] New assessment plans can be created simply and redirect directly to the editing area (US 5.6).
- [x] Document Overview offers tabs for metadata, source SSP imports, and tag management including promotion (US 5.8).
- [x] Editing is performed in a cohesive detail card and drafts are cached locally upon exit (US 5.9).
- [x] Versions of an assessment plan are persistently versioned in the backend and managed via the drawer (US 5.7).
- [ ] Terms and conditions and rules of engagement can be documented in the Assessment Plan (US 5.10).
