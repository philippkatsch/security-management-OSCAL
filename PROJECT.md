# Project: Reposol OSCAL Management Platform

## Architecture
- **Backend (`reposol/backend/`):** FastAPI async application with modular API routers in `app/api/`, service layer in `app/services/`, repositories in `app/repositories/`, schema validation in `app/validation.py`, and multi-format conversion in `app/format_converter.py`.
- **Frontend (`reposol/frontend/src/`):** React + TypeScript application with stage-specific page components (`src/components/`), DocumentPageLayout, CSS Modules, Jotai stores (`src/stores/`), React Query hooks (`src/hooks/`), Monaco editor (`JsonEditor.tsx`), and StatusBadge system (`StatusBadge.tsx`).
- **E2E Testing (`reposol/e2e/`):** Playwright automated browser test suite with web server auto-spawning for backend (port 1000) and frontend (port 1001).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Stage 8 Control Mapping Sankey Diagram | Interactive Sankey diagram rendering control flows between source & target OSCAL frameworks in `MappingPage.tsx` | M1 | R1, DD-019, Step 8 Story |
| 2 | Stage 8 Matrix View & Gap Analysis | Interactive mapping matrix with 6 relationship types and unmapped control gap filter | M1 | R1, DD-019 |
| 3 | Stage 6/7 AR-to-POA&M Automated Import | Automated wizard/bridge button in `POAMPage.tsx` importing unsatisfied AR findings into POA&M items | M2 | R1, DD-017, Step 7 Story |
| 4 | Stage 7 Milestone & Progress Dashboard | POA&M remediation milestone tracking and status breakdown dashboard | M2 | R1, DD-022 |
| 5 | Stage 4 FIPS 199 & NIST 800-60 UI | Structured UI editor in `SystemCharacteristicsEditor.tsx` for FIPS 199 impact scoring & 800-60 info types | M3 | R1, Step 4 Story |
| 6 | Stage 2 Visual Baseline Diff Comparison | Side-by-side visual comparison in `ProfilePage.tsx` of resolved profile controls vs baseline catalog controls | M3 | R1, Step 2 Story |
| 7 | Stage 3 Component & Protocol Management | Management of 11 OSCAL component types, capability editor, and control implementations | M3 | R1, Step 3 Story |
| 8 | R2 Standardized Confirm & Export Modals | Replace `window.confirm` and `window.prompt` in `DocumentListPage.tsx` with `ConfirmModal` / `useConfirm` per DD-032 | M4 | R2, DD-032 |
| 9 | R2 Multi-Format Serialization & Validation | Lossless JSON/YAML/XML import/export and NIST OSCAL v1.2.0 Metaschema validation | M4 | R2, DD-002, DD-004 |
| 10 | R3 Monaco Editor & Live Syntax Checking | Virtualized Monaco editor with 500ms debounced syntax error hints and target element auto-scrolling | M4 | R3, DD-014 |
| 11 | R3 Lifecycle Dashboard & Badges | Stage pipeline cards, recent activity, and 14-category HSL status badge system | M4 | R3, DD-020 |
| 12 | Stage 1 Catalog & Parameter Management | Hierarchical control tree, multi-level parameters, parameter prose chips, and group editor | M4 | R1, Step 1 Story |
| 13 | Stage 5 Assessment Plan Activity Scheduler | Assessment objectives, reviewed controls scope, local definitions, and task activity editor | M4 | R1, Step 5 Story |
| 14 | E2E Opaque-Box Test Suite | Comprehensive Playwright test suite covering all 8 OSCAL stages and cross-stage workflows | E2E Track | R4 |
| 15 | Final Verification & Adversarial Hardening | Green bar on Pytest, Vitest, Playwright E2E, and Tier 5 white-box coverage hardening | M5 | R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Control Mapping Sankey Diagram & Stage 8 Polish | Sankey diagram visualization in `MappingPage.tsx` (SVG/Canvas) + mapping matrix gap analysis | None | DONE |
| M2 | AR-to-POA&M Findings Import Bridge | Automated findings-to-POA&M item import wizard & cross-reference linking in `POAMPage.tsx` | None | DONE |
| M3 | SSP FIPS 199/NIST 800-60 UI & Profile Baseline Diff | Structured FIPS 199 impact scoring in `SystemCharacteristicsEditor.tsx` & side-by-side visual profile baseline diff in `ProfilePage.tsx` | None | DONE |
| M4 | Modal Infrastructure & R2/R3 UI/UX Polish | Replace `window.confirm`/`window.prompt` in `DocumentListPage.tsx` with `ConfirmModal` per DD-032 + Monaco/badge robustness | None | DONE |
| E2E | E2E Testing Track | Requirement-driven Playwright test suite validation across Tiers 1-4 -> TEST_READY.md | Parallel | DONE |
| M5 | Final Compliance Verification & Adversarial Hardening | Phase 1: 100% E2E test pass across all tiers. Phase 2: Tier 5 adversarial coverage hardening | M1, M2, M3, M4, E2E | IN_PROGRESS |

## Interface Contracts
### Control Mapping ↔ Stage 8 Sankey Renderer
- Input: `mappingCollection: OscalMappingCollection` document object containing `mappings: OscalMappingEntry[]`
- Function: `renderSankeyDiagram(sources, targets, mappings)`
- Output: SVG node-and-link flow diagram visualizing mapped control relationships (`equal-to`, `equivalent-to`, `subset-of`, `superset-of`, `intersects-with`) and unmapped control gaps.

### Assessment Results ↔ POA&M Import Bridge
- Input: `assessmentResultsId: string`
- Endpoint: `POST /api/documents/poams/{poam_id}/import-findings/{ar_id}`
- Transformation: Converts unsatisfied AR findings (`finding.target.status == "not-satisfied"`) into `poam-item` objects with `finding-building-block` cross-references and initial `open` status.

### Profile ↔ Catalog Baseline Diff
- Input: `profileId: string`, `catalogId: string`
- Endpoint: `GET /api/resolve/profile/{profile_id}/diff/{catalog_id}`
- Output: Side-by-side control delta structure detailing added, removed, modified, and untouched controls.

## Code Layout
- `reposol/backend/app/api/`: FastAPI route modules (`document_routes.py`, `import_routes.py`, `resolution_routes.py`, `validation_routes.py`)
- `reposol/backend/app/services/`: Core logic (`document_service.py`, `resolution_service.py`, `profile_service.py`, `import_service.py`)
- `reposol/backend/app/format_converter.py`: JSON ↔ YAML ↔ XML bi-directional converter
- `reposol/backend/app/validation.py`: Metaschema validator engine using cached `Draft7Validator`
- `reposol/frontend/src/components/`: React stage page components (`catalog/`, `profile/`, `component-definition/`, `ssp/`, `assessment-plan/`, `assessment-results/`, `poam/`, `mapping/`, `common/`, `editors/`)
- `reposol/frontend/src/stores/`: Jotai state atoms (`documentAtoms.ts`, `uiAtoms.ts`)
- `reposol/frontend/src/hooks/`: React Query custom hooks (`useDocumentQuery.ts`, `useDocumentMutation.ts`)
- `reposol/e2e/tests/`: Playwright E2E spec files
