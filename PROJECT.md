# Project: Reposol OSCAL Management E2E & Full Test Integrity Audit

## Architecture
- **Backend**: Python FastAPI with `aiofiles` async persistence, `darkspell` conda environment, Pytest suite (278+ tests across 5 directories).
- **Frontend**: React, TypeScript, Vite, Jotai, React Query, Vitest suite (140+ tests across 13 test files).
- **E2E Testing**: Playwright test suite in `reposol/e2e/tests/` (33 `.spec.ts` files, 171 tests covering Steps 0–8, stress tests, `full-compliance-lifecycle.spec.ts`).

## Feature Inventory & Test Coverage Requirements
| # | Test Suite / Target | Description / Scope | Target Count | Milestone | Source |
|---|---------------------|---------------------|--------------|-----------|--------|
| 1 | Backend Pytest Suite | Unit, Storage, Integration, API Workflows, Stress tests in `reposol/backend/tests/` | 278+ tests | M1 | explorer_backend |
| 2 | Backend Concurrency Test Fix | Refactor `tests/test_concurrency.py` HTTPX `AsyncClient` syntax (`ASGITransport`) | 2 tests | M1 | explorer_backend |
| 3 | Frontend Vitest Import Fix | Fix orphaned `./profile-resolver` export in `src/lib/profile/index.ts` | 32 tests unlocked | M2 | explorer_frontend |
| 4 | Frontend Accordion Query Fix | Fix placeholder text locator mismatch in `EnhancementsAccordionIntegration.test.tsx` | 1 test fixed | M2 | explorer_frontend |
| 5 | Frontend Vitest Suite Execution | Run full Vitest suite (`npm test` in `reposol/frontend`) | 140+ tests | M2 | explorer_frontend |
| 6 | E2E Step 0 (Global Requirements) | Global setup, theme, layout, header, footer Playwright specs | 100% pass | M3 | explorer_e2e |
| 7 | E2E Step 1 (Catalog Management) | Catalog builder, group editor, param editor, control detail specs | 100% pass | M3 | explorer_e2e |
| 8 | E2E Step 2 (Profile Tailoring) | Profile builder, alter editor, imports, profile resolver specs | 100% pass | M3 | explorer_e2e |
| 9 | E2E Step 3 (System Security Plan) | SSP builder, implementation status, system characteristics specs | 100% pass | M3 | explorer_e2e |
| 10 | E2E Step 4 (Assessment Plan) | AP builder, assessment subjects, task specs | 100% pass | M3 | explorer_e2e |
| 11 | E2E Step 5 (Assessment Results) | AR builder, observations, risks, findings specs | 100% pass | M3 | explorer_e2e |
| 12 | E2E Step 6 (POA&M) | POA&M builder, remediation items, POAM entry specs | 100% pass | M3 | explorer_e2e |
| 13 | E2E Step 7 (Component Definition) | Component builder, capabilities, control implementations specs | 100% pass | M3 | explorer_e2e |
| 14 | E2E Step 8 (Traceability & Mapping) | Control mapping collection, gap analysis specs | 100% pass | M3 | explorer_e2e |
| 15 | E2E Stress & Lifecycle | Stress tests + `full-compliance-lifecycle.spec.ts` cross-stage E2E specs | 100% pass | M3 | explorer_e2e |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Pytest Verification & Fixes | Fix `test_concurrency.py` HTTPX transport; verify 294/294 Pytest pass | none | DONE |
| M2 | Frontend Vitest Remediation | Fix `@lib/profile` export, fix placeholder query, run & pass 100% Vitest tests | none | DONE |
| M3 | E2E Playwright Suite Audit & Execution | Execute 100% of 33 Playwright spec files (171 tests) against dual webServer | M1, M2 | DONE |
| M4 | Final Synthesis & Victory Sign-off | Synthesize full pass results and declare completion to Sentinel | M1, M2, M3 | IN_PROGRESS |




## Code Layout & Test Directories
- `reposol/e2e/`: Playwright config, dual webServer, package.json, and `tests/` directory (33 `.spec.ts` files)
- `reposol/backend/tests/`: Pytest test files across 5 subdirectories (`unit`, `storage`, `integration`, `api_workflows`, `stress`)
- `reposol/frontend/`: Frontend source (`src/`) and Vitest test files (`src/tests/`)
