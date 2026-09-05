# Project: NIST OSCAL Assessment Results (AR / SAR) Builder & Reporter (Step 6)

## Architecture
The Assessment Results (AR / SAR) Builder & Reporter provides an end-to-end, schema-compliant web environment in Reposol for recording, managing, and reporting findings, observations, evidence, and risks arising from NIST OSCAL v1.2.2 Security Assessment Plans (AP).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: Title, Target AP Import Selector, [👁️ View | ✏️ Edit] Mode Toggle, Save/Validate │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Navigation Tabs & Modular Panels:                                                      │
│ 1. Overview & Metadata: Title, Version, Parties, Import AP Selector & Summary, Metrics │
│ 2. Assessment Findings: Control / Objective Targets, Status, Related Obs & Risks       │
│ 3. Observations & Evidence: Methods (EXAMINE, INTERVIEW, TEST), Evidence, Subjects     │
│ 4. Identified Risks: Statement, Status, CVSS/FedRAMP Characterization, Threat IDs,     │
│    Remediations, Risk Log Entries                                                      │
│ 5. Assessment Log & Attestations: Timeline, Execution Log Entries, Attestations        │
│ 6. Result Sets Sidebar: Result Set Navigation (<button> elements), Scoping & Controls  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Inventory
Every feature from the Phase 0 Survey is inventoried and mapped to a concrete milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Architectural Design Decision DD-038 | Dedicated AR Architecture, Scoping Model, Triad Correlation, AP Import Resolution, and Risk Categorization | M1_DOC | Phase 0 Spec Miner |
| 2 | Step 6 User Stories (US 6.1–6.17) | Complete user stories and acceptance criteria in `documentation/user_stories/step6_assessment_results.md` | M1_DOC | Phase 0 Spec Miner |
| 3 | Backend AR Semantic Integrity Validation | Implementation of `_validate_ar_integrity` in `validation.py` verifying root fields, `import-ap.href` workspace resolution, finding/observation/risk cross-references, UUID uniqueness, and target semantics | M2_BACKEND | Phase 0 Backend Explorer |
| 4 | Document Service Listing Pruning | Add `"import-ap"` to `_prune_doc_for_listing` in `document_service.py` to preserve plan reference in document summaries | M2_BACKEND | Phase 0 Backend Explorer |
| 5 | Backend Integration & Unit Test Suite | Update `test_assessment_results_crud.py` with `create_sample_ap` fixture and expand `test_validation.py` with AR semantic integrity test classes | M2_BACKEND | Phase 0 Backend Explorer |
| 6 | OSCAL AR v1.2.2 TypeScript Definitions | Complete strict types in `reposol/frontend/src/lib/types/oscal.d.ts` (FindingTarget, RelatedObservation, RelatedRisk, Finding, Observation, Risk, Result, AssessmentResults) | M3_ACTIONS_TYPES | Phase 0 Frontend Explorer |
| 7 | Granular Document Actions Suite (DD-029) | Implementation of `assessment-results-actions.ts` and `assessmentResultsReducer` providing pure, typed, immutable actions for all AR assemblies | M3_ACTIONS_TYPES | Phase 0 Frontend Explorer |
| 8 | Document Actions Unit Tests (Vitest) | Comprehensive unit tests for `assessment-results-actions.ts` in `reposol/frontend/src/tests/lib/assessment-results-actions.test.ts` | M3_ACTIONS_TYPES | Phase 0 Frontend Explorer |
| 9 | Modular Overview & Metadata Tab UI | OverviewMetadataTab with document title/version, import-ap browser banner, high-level metric cards, and back-matter attachments | M4_FRONTEND_UI | Phase 0 Frontend Explorer |
| 10 | Modular Assessment Findings Tab UI | AssessmentFindingsTab with `+ Add Finding`, target selector (`statement-id`, `objective-id`), status (`satisfied`, `not-satisfied`), reason, related observations & risks multi-selectors | M4_FRONTEND_UI | Phase 0 Frontend Explorer |
| 11 | Modular Observations & Evidence Tab UI | ObservationsEvidenceTab with `+ Add Observation`, method checkboxes (`EXAMINE`, `INTERVIEW`, `TEST`), evidence manager, collected/expires timestamps | M4_FRONTEND_UI | Phase 0 Frontend Explorer |
| 12 | Modular Identified Risks Tab UI | IdentifiedRisksTab with `+ Add Risk`, statement, status, characterization (CVSS/FedRAMP), remediations (`+ Add Remediation`, `+ Add Asset`, `+ Add Task`), and risk log (`+ Add Log Entry`) | M4_FRONTEND_UI | Phase 0 Frontend Explorer |
| 13 | Modular Assessment Log Tab UI | AssessmentLogTab with `+ Add Entry` (Timestamp, Title, Description), and Attestations manager | M4_FRONTEND_UI | Phase 0 Frontend Explorer |
| 14 | Result Sets Navigation & Scoping UI | ResultSetsSidebar using accessible `<button>` elements, title, start/end dates, and reviewed controls scoping | M4_FRONTEND_UI | Phase 0 Frontend Explorer |
| 15 | Elimination of Stubbed Handlers | Replace all 22+ `onChange={() => {}}` handlers across `ARPage.tsx` and subcomponents with active state action dispatches | M4_FRONTEND_UI | Phase 0 Frontend Explorer |
| 16 | Playwright E2E Test Suite Pass | 100% pass for `reposol/e2e/tests/step6-assessment-results.spec.ts` matching exact selectors, accessible labels, and user journeys | M5_E2E_VERIFY | Phase 0 Frontend Explorer |
| 17 | Full Verification Gate & Forensic Integrity Audit | 100% backend pytest, 100% frontend vitest, clean Vite build (0 TS errors), 100% Playwright E2E, and clean Forensic Integrity Audit | M5_E2E_VERIFY | Orchestrator Gate |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1_DOC | Documentation & Architectural Design (DD-038 & US 6.1-6.17) | Formulate `DD-038` in `documentation/design_decisions/` and update `step6_assessment_results.md` per Tier 1 rules | none | DONE |
| M2_BACKEND | Backend Semantic Integrity Validation & Document Service | Implement `_validate_ar_integrity` in `validation.py`, update `document_service.py`, fix `test_assessment_results_crud.py` fixture, add unit tests in `test_validation.py` | M1_DOC | DONE |
| M3_ACTIONS_TYPES | TypeScript Definitions & Document Actions Suite | Complete AR types in `oscal.d.ts`, implement `assessment-results-actions.ts` per DD-029, add Vitest unit tests | M1_DOC | DONE |
| M4_FRONTEND_UI | Modular Frontend UI & Elimination of Stubbed Handlers | Decompose `ARPage.tsx` into modular tabs/components, eliminate all stubbed handlers, wire to document actions | M2_BACKEND, M3_ACTIONS_TYPES | DONE |
| M5_E2E_VERIFY | End-to-End Verification & Forensic Integrity Audit | Verify Playwright E2E tests, run full regression across all suites, execute independent forensic integrity audit | M4_FRONTEND_UI | DONE |

---

## Interface Contracts

### Backend ↔ Frontend API Contract
- `GET /api/documents/assessment-results`: Returns list of assessment results summaries (including `uuid`, `metadata`, `import-ap`).
- `GET /api/documents/assessment-results/{id}`: Returns complete JSON document of the assessment results.
- `POST /api/documents/assessment-results`: Creates new assessment results document, validates against JSON schema v1.2.2 and `_validate_ar_integrity`.
- `PUT /api/documents/assessment-results/{id}`: Updates assessment results document with optimistic concurrency check, running semantic validation.
- `DELETE /api/documents/assessment-results/{id}`: Deletes assessment results document.

### Document Actions ↔ State Contract (DD-029)
- Action creators in `assessment-results-actions.ts` return pure action objects `{ type, payload }`.
- Reducers operate via Immer `produce()` for immutable document transitions.
- All actions integrate with `useDocumentActions` and undo/redo stacks (`pushUndoRedoState`).

---

## Code Layout
- `documentation/`
  - `user_stories/step6_assessment_results.md` (Authoritative Step 6 user stories US 6.1–US 6.17)
  - `design_decisions/DD-038_assessment_results_scoping_and_correlation.md` (AR Architecture & Scoping Model)
- `reposol/backend/`
  - `app/schemas/oscal_assessment-results_schema.json` (NIST OSCAL AR v1.2.2 JSON Schema)
  - `app/validation.py` (`_validate_ar_integrity` semantic referential integrity)
  - `app/services/document_service.py` (`_prune_doc_for_listing` including `import-ap`)
  - `tests/integration/test_assessment_results_crud.py` (Backend CRUD & schema tests with AP fixture)
  - `tests/unit/test_validation.py` (Unit tests for AR semantic integrity)
- `reposol/frontend/src/`
  - `lib/types/oscal.d.ts` (Typed OSCAL AR definitions)
  - `lib/document-actions/assessment-results-actions.ts` (Typed AR document action reducers)
  - `lib/document-actions/index.ts` (Exporting AR actions)
  - `components/assessment-results/`
    - `ARPage.tsx` (Main shell, tab coordinator, document action provider)
    - `tabs/OverviewMetadataTab.tsx` (Overview & Metadata)
    - `tabs/AssessmentFindingsTab.tsx` (Findings management & linking)
    - `tabs/ObservationsEvidenceTab.tsx` (Observations, methods & evidence)
    - `tabs/IdentifiedRisksTab.tsx` (Risks, characterizations & remediations)
    - `tabs/AssessmentLogTab.tsx` (Assessment log entries & attestations)
    - `components/ResultSetsSidebar.tsx` (Result sets selector with button roles)
    - `modals/` (APBrowserModal.tsx, FindingEditorModal.tsx, ObservationEditorModal.tsx, RiskEditorModal.tsx)
  - `tests/lib/assessment-results-actions.test.ts` (Vitest unit tests)
- `reposol/e2e/tests/`
  - `step6-assessment-results.spec.ts` (Playwright E2E test suite)
