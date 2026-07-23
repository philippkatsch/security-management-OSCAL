# Step 7: Detailed User Stories – POA&M Tracker

* **Persona:** Alice (System Owner / ISSO)
* **Goal:** Capture, prioritization, and continuous tracking of identified security risks (findings) from assessment reports, creation of structured remediation plans with milestones, and documentation of risk deviations (e.g., risk acceptance).

---

## 1. Breakdown of User Stories

### US 7.1: POA&M Declaration & SSP Referencing
> **As a** System Owner (Alice)  
> **I want to** create a new Plan of Action and Milestones (POA&M) document and link it directly to the System Security Plan (SSP),  
> **so that** all remediation measures are tracked in the context of the correct system architecture and controls.
*   **Acceptance Criteria:**
    *   Creation of POA&M metadata.
    *   Linking of the affected SSP (`import-ssp`).
    *   Association of unique system identifiers to link with the target system.

### US 7.2: Risk Import from Assessment Results
> **As a** System Owner (Alice)  
> **I want to** import open risks and vulnerabilities directly from the Assessment Results into the POA&M,  
> **so that** sources of error are seamlessly transferred and no transcription errors occur.
*   **Acceptance Criteria:**
    *   Interface to import risk definitions from an Assessment Results JSON file.
    *   Automatic creation of POA&M items (`poam-items`) based on the imported risks.
    *   Preservation of links (reference to the risk ID of the assessment report).

### US 7.3: Remediation Plans & Milestones (Milestone Planning)
> **As a** System Owner (Alice)  
> **I want to** define concrete remediation measures (Remediation Plans), assign responsibilities, and set due dates for each open risk,  
> **so that** the remediation is planned and tracked in a structured manner.
*   **Acceptance Criteria:**
    *   Creation of remediation plans for each POA&M item.
    *   Definition of concrete milestones (`milestones`) with descriptions and target completion dates.
    *   Assignment of responsible roles and actors for execution.

### US 7.4: Risk Deviations & Special Dispositions
> **As a** System Owner (Alice)  
> **I want to** declare justified deviations, such as false positives or the temporary acceptance of a risk for operational reasons,  
> **so that** deviations from the target state are formally approved and documented.
*   **Acceptance Criteria:**
    *   Entry of risk deviations (`deviations`) on POA&M items.
    *   Classification as `false-positive` (false alarm) or `risk-acceptance` (risk acceptance).
    *   Providing a detailed justification (e.g., compensating controls or operational necessity).
    *   Additional deviation types: `operational-requirement` (operational necessity preventing full remediation) and `compensating-control` (compensating control reducing the risk to an acceptable level).

### US 7.5: Status Tracking & Completion Verification
> **As a** System Owner (Alice)  
> **I want to** monitor the progress of remediation and verify completed measures with evidence,  
> **so that** the risk can be officially closed and the system returned to a fully compliant state.
*   **Acceptance Criteria:**
    *   Updating the status of POA&M entries (e.g., `open` = open, `ongoing` = in progress, `completed` = completed).
    *   Providing evidence (e.g., reference to a new code commit, log, or re-assessment) before closing an entry.
    *   Adherence to the OSCAL POA&M schema during storage and export.

### US 7.6: Simplified POA&M Creation & Direct Editing (Inner View)
> **As a** System Owner (Alice)  
> **I want to** be able to create a new POA&M document by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can configure system links and metadata directly within the editing area without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New POA&M" opens a simple dialog that requires only the title.
    *   **Direct Redirection:** After clicking "Create Document," the POA&M is initialized in the backend and the user is redirected immediately to the editing view (`/poam/{uuid}?edit=true`).

### US 7.7: Integrated POA&M Versioning in the Backend (Versions instead of Drafts)
> **As a** System Owner (Alice)  
> **I want to** save, load, and delete versions of a POA&M directly as separate, OSCAL-compliant JSON documents in the backend,  
> **so that** version states can be managed persistently, cross-device, and visibly to other users.
*   **Acceptance Criteria:**
    *   **No UUID Bumping:** A new version is saved under the same UUID.
    *   **Save as Version (Save Version):** The "Save Version" button opens a dialog for the version number (e.g., `1.1.0`) and remarks. The file is persisted as `<uuid>_v<version>.json`.
    *   **Versions Drawer & Deletion:** Clicking `Versions` shows the loaded version and opens the drawer for navigation and deletion of versions.
    *   **Table:** The POA&M table displays the latest version by default.

### US 7.8: Document Overview & Tag Management on POA&Ms
> **As a** System Owner (Alice)  
> **I want to** manage metadata, system links, and tags in the right main pane (Document Overview) when no specific finding is selected,  
> **so that** I can maintain the overall document and its global tag structure.
*   **Acceptance Criteria:**
    *   **Document Overview:** Horizontal tabs **Metadata**, **Imported SSP / AR** (select target SSP/reports), and **Tags** when selection is empty.
    *   **"Tags" Tab:** Divided into **Global Property Tags** and **Used / Existing Tags** (including occurrence count and promote button in edit mode).

### US 7.9: Detailed Editability & Exit Button for POA&Ms
> **As a** System Owner (Alice)  
> **I want to** edit details of POA&M findings, milestones, or deviations inline in a cohesive card and save edits using an exit button,  
> **so that** input is uniform and secure.
*   **Acceptance Criteria:**
    *   **In-Card Editor:** Header area and properties are edited in a single gray cohesive card with border.
    *   **Autocomplete (`datalist`):** Suggestions for already used key names during property definition.
    *   **Exit Button with Backend Drafting:** Exit ends editing and redirects to the read-only view. Unsaved changes are cached in `localStorage` for recovery.

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create POA&M (US 7.6):** Alice clicks on "New POA&M," enters the title *"Action Plan Reposol Portal 2026,"* and is redirected immediately to the editing view `/poam/{uuid}?edit=true`.
2.  **Maintain Global Metadata, Imports & Tags (US 7.1, US 7.8):** In the main pane (Document Overview) under *Metadata*, she enters version `1.0.0`, links the affected SSP, and imports open risks from the Assessment Results (US 7.2). Under *Tags*, she defines global property tags.
3.  **Remediation Planning & Milestones (US 7.3, US 7.9):** She plans remediation measures for the imported risk `risk-inactive-accounts` and assigns milestones in the in-place detail editor (US 7.9).
4.  **Special Cases & Deviations (US 7.4):** For unencrypted HTTP access in the backend, she documents a justified risk acceptance (`deviation`).
5.  **Close Risk & Provide Evidence (US 7.5):** Once the measure is implemented, she adds the build log and commit as evidence and closes the entry.
6.  **Versioning & Exit (US 7.7, US 7.9):** She saves version `1.0.0` in the version dialog and leaves the editor via the "Exit" button.

---

## 3. Functional Requirements for the System

- **Master Data Linking & Risk Import:** Direct link to the SSP, and importer for open vulnerabilities from Assessment Results (US 7.1, US 7.2).
- **Milestone Planning & Deviation Wizard:** Tracking of remediation measures, deadlines, and structured risk acceptances (US 7.3, US 7.4).
- **Verification Trail:** Mandatory verification evidence before closing a finding status (US 7.5).
- **Integrated Versioning:** Saving specific version files `<uuid>_v<version>.json`, drawer view, deletion, and read-only access for historical states (US 7.7).
- **Document Overview & Tags:** Metadata, Imports, and Tags subtabs in the main pane with tag promotion (US 7.8).
- **In-Card Edit & Exit Drafting:** Header/properties in a cohesive card, databindings via `datalist` autocomplete, and `localStorage` caching upon exit (US 7.9).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] The user can create a POA&M and link it to an SSP (US 7.1).
- [x] The system supports importing risks directly from Assessment Results (US 7.2).
- [x] Milestones and remediation measures can be defined and scheduled per finding (US 7.3).
- [x] The tool allows documenting risk acceptances and false positives with free-text justifications (US 7.4).
- [x] A finding can only be set to completed after assigning a proof of evidence (US 7.5).
- [x] The exported POA&M complies 100% with the official OSCAL POA&M schema (US 7.1).
- [x] New POA&Ms can be created simply and redirect directly to the editing area (US 7.6).
- [x] Document Overview offers tabs for metadata, source imports, and tag management including promotion (US 7.8).
- [x] Editing is performed in a cohesive detail card and drafts are cached locally upon exit (US 7.9).
- [x] Versions of a POA&M are persistently versioned in the backend and managed via the drawer (US 7.7).
