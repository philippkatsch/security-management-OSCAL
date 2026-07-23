# Step 6: Detailed User Stories – Assessment Results Reporter

* **Persona:** Bob (Lead Assessor) & Continuous Testing Tool
* **Goal:** Structured capture and documentation of test results, assessment log entries, observations (evidence data), identified risks, as well as the final evaluation (attestation) of controls to output a standard-compliant assessment report (Assessment Results).

---

## 1. Breakdown of User Stories

### US 6.1: Report Declaration & AP Import
> **As a** Lead Assessor (Bob)  
> **I want to** create a new assessment report and import the underlying Assessment Plan (AP),  
> **so that** the planned scope definition and target objectives automatically flow into the report.
*   **Acceptance Criteria:**
    *   Creation of report metadata.
    *   Linking of the underlying assessment plan using an import reference (`import-ap`).
    *   Import of all target specifications (Controls, Objectives) from the plan.

### US 6.2: Assessment Log (Assessment Log)
> **As a** Lead Assessor (Bob)  
> **I want to** create a chronological log of the performed audit activities,  
> **so that** it is precisely traceable when which assessments were carried out by whom.
*   **Acceptance Criteria:**
    *   Capturing of chronological log entries (`assessment-log`) with start and end times.
    *   Linking log entries with the tasks (Tasks/Actions) defined in the plan and the executing actors (testers).

### US 6.3: Observations & Evidence (Observations)
> **As a** Lead Assessor (Bob)  
> **I want to** declare individual observations (Observations) and link them to concrete evidence (e.g., log files, screenshots, policy texts),  
> **so that** every finding (both compliance and deviation) is audit-proof.
*   **Acceptance Criteria:**
    *   Creation of observations (`observations`) with a unique ID, description, and type (e.g., `satisfied` for compliance, `under-review` for ambiguities).
    *   Linking evidence (artifacts) from the back-matter (e.g., PDF files, TXT logs, or PNG screenshots).
    *   Association with the affected system components.

### US 6.4: Risk & Vulnerability Analysis
> **As a** Lead Assessor (Bob)  
> **I want to** derive and evaluate concrete risks (Risks) from negative observations,  
> **so that** the system owner knows which vulnerabilities are critical and must be remediated.
*   **Acceptance Criteria:**
    *   Declaration of risks (`risks`) with a description of the weakness (Weakness) and a threat statement.
    *   Classification of severity (e.g., `critical`, `high`, `medium`, `low`).
    *   Linking the risk to the causing observation (Observation).
    *   Providing remediation recommendations.

### US 6.5: Findings & Control Status (Attestation)
> **As a** Lead Assessor (Bob)  
> **I want to** create summary findings (Findings), evaluate the compliance status of the assessed controls, and provide a final verdict,  
> **so that** the Authorizing Official (AO) receives the overall context for authorization (ATO).
*   **Acceptance Criteria:**
    *   Creation of findings (`findings`) that aggregate observations and risks.
    *   Attestation of the control status (e.g., `satisfied` = met, `not-satisfied` = not met).
    *   Submission of a formal attestation statement by the auditor.

### US 6.6: Simplified Report Creation & Direct Editing (Inner View)
> **As a** Lead Assessor (Bob)  
> **I want to** be able to create a new assessment report by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can capture metadata and findings directly within the editing area without preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New AR" opens a simple dialog that requires only the title.
    *   **Direct Redirection:** After clicking "Create Document," the report is initialized in the backend and the user is redirected immediately to the editing view (`/assessment-results/{uuid}?edit=true`).

### US 6.7: Integrated Report Versioning in the Backend (Versions instead of Drafts)
> **As a** Lead Assessor (Bob)  
> **I want to** save, load, and delete versions of an assessment report directly as separate, OSCAL-compliant JSON documents in the backend,  
> **so that** version states can be managed persistently, cross-device, and visibly to other users.
*   **Acceptance Criteria:**
    *   **No UUID Bumping:** A new version is saved under the same UUID.
    *   **Save as Version (Save Version):** The "Save Version" button opens a dialog for the version number (e.g., `1.1.0`) and remarks. The file is persisted as `<uuid>_v<version>.json`.
    *   **Versions Drawer & Deletion:** Clicking `Versions` shows the loaded version and opens the drawer for navigation and deletion of versions.
    *   **Table:** The AR table displays the latest version by default.

### US 6.8: Document Overview & Tag Management on Assessment Reports
> **As a** Lead Assessor (Bob)  
> **I want to** manage metadata, assessment plan imports, and tags in the right main pane (Document Overview) when no specific finding is selected,  
> **so that** I can maintain the overall document and its global tag structure.
*   **Acceptance Criteria:**
    *   **Document Overview:** Horizontal tabs **Metadata**, **Imported AP** (select target AP), and **Tags** when selection is empty.
    *   **"Tags" Tab:** Divided into **Global Property Tags** and **Used / Existing Tags** (including occurrence count and promote button in edit mode).

### US 6.9: Detailed Editability & Exit Button for Assessment Reports
> **As a** Lead Assessor (Bob)  
> **I want to** edit details of observations, risks, or findings inline in a cohesive card and save edits using an exit button,  
> **so that** input is uniform and secure.
*   **Acceptance Criteria:**
    *   **In-Card Editor:** Header area and properties are edited in a single gray cohesive card with border.
    *   **Autocomplete (`datalist`):** Suggestions for already used key names during property definition.
    *   **Exit Button with Backend Drafting:** Exit ends editing and redirects to the read-only view. Unsaved changes are cached in `localStorage` for recovery.

---

## 2. Bob's Detailed Workflow & User Journey

1.  **Create Report (US 6.6):** Bob clicks on "New AR," enters the title *"Assessment Report Reposol Portal Q3,"* and is redirected immediately to the editing view `/assessment-results/{uuid}?edit=true`.
2.  **Maintain Global Metadata, Imports & Tags (US 6.1, US 6.8):** In the main pane (Document Overview) under *Metadata*, he enters version `1.0.0` and selects the *Annual Audit Reposol Portal v1* under *Imported AP*. Under *Tags*, he defines global property tags.
3.  **Logging & Evidence (US 6.2, US 6.3):** He logs activities in the assessment log. For identified deviations, he creates an observation (e.g., `obs-ac-2-fail`), links evidence, and associates them with components in the in-place editor (US 6.9).
4.  **Risk & Attestation Analysis (US 6.4, US 6.5):** He derives and classifies the risk `risk-inactive-accounts`. He aggregates observations and risks into findings and attests the control status (satisfied/not-satisfied).
5.  **Versioning & Exit (US 6.7, US 6.9):** He saves version `1.0.0` in the version dialog and leaves the editor via the "Exit" button.

---

## 3. Functional Requirements for the System

- **Automatic AP Import:** Resolving target specifications from the referenced assessment plan to construct the actual state matrix (US 6.1).
- **Logging & Evidence Capturing:** Log entries and observations with file attachments and component assignments (US 6.2, US 6.3).
- **Risk Analysis & Attestation Engine:** Risk definition with severities, and findings for attesting the control compliance status (US 6.4, US 6.5).
- **Integrated Versioning:** Saving specific version files `<uuid>_v<version>.json`, drawer view, deletion, and read-only access for historical states (US 6.7).
- **Document Overview & Tags:** Metadata, Imports, and Tags subtabs in the main pane with tag promotion (US 6.8).
- **In-Card Edit & Exit Drafting:** Header/properties in a cohesive card, databindings via `datalist` autocomplete, and `localStorage` caching upon exit (US 6.9).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] An auditor can create a report and link it to an existing assessment plan (US 6.1).
- [x] The system allows chronological capturing of test activities (US 6.2).
- [x] The editor supports creating observations and linking file attachments (screenshots, logs) as evidence (US 6.3).
- [x] The auditor can classify identified vulnerabilities as risks and assign severities (US 6.4).
- [x] The system allows the evaluation of the compliance status (satisfied/not-satisfied) at the control level (US 6.5).
- [x] The exported report complies 100% with the official OSCAL Assessment Results schema (US 6.1).
- [x] New assessment reports can be created simply and redirect directly to the editing area (US 6.6).
- [x] Document Overview offers tabs for metadata, source AP imports, and tag management including promotion (US 6.8).
- [x] Editing is performed in a cohesive detail card and drafts are cached locally upon exit (US 6.9).
- [x] Versions of an assessment report are persistently versioned in the backend and managed via the drawer (US 6.7).
