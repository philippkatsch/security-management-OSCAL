# DD-024: End-to-End Testing Strategy

## Status: Accepted
## Date: 2026-08-09
## Decision Makers: Development Team

## Context

The Reposol project has comprehensive backend tests (Pytest + FastAPI TestClient) and frontend component tests (Vitest + React Testing Library), but lacks browser-based end-to-end tests that verify the full stack — frontend UI, API communication, and backend logic — working together in a real browser environment.

Additionally, DD-001 defined an `e2e_tests/` directory in the architecture plan (line 40) that was never implemented. The existing `backend/tests/e2e/` directory contained API-level workflow tests (using TestClient, not a browser), which created naming confusion between "API E2E" and "browser E2E" testing.

This decision establishes the E2E testing strategy, tool choices, test organization, and an AI-assisted test generation workflow.

---

## Decisions

### 1. Playwright as the Browser E2E Framework

**Choice:** [Playwright](https://playwright.dev/) over Cypress, Selenium, or other alternatives.

**Rationale:**
- **Codegen tool**: `playwright codegen` records browser interactions and generates test code automatically, reducing manual test writing effort
- **Multi-browser support**: Chromium, Firefox, and WebKit from a single API
- **Auto-waiting**: Built-in intelligent waiting for elements, reducing flaky tests
- **TypeScript-first**: Strong typing with excellent IDE support
- **Trace viewer**: Visual debugging with screenshots, video, and DOM snapshots on failure
- **webServer configuration**: Can automatically start both backend and frontend servers before tests
- **CI/CD ready**: Runs headlessly in pipelines with zero configuration

### 2. Test Organization — Renamed Layers

To eliminate naming confusion, the test layers are organized as follows:

| Layer | Location | Framework | Purpose | Speed |
|---|---|---|---|---|
| **Backend Unit** | `backend/tests/unit/` | Pytest | Isolated pure-logic tests | ~1s |
| **Backend Storage** | `backend/tests/storage/` | Pytest | File persistence & path security | ~2s |
| **Backend Integration** | `backend/tests/integration/` | Pytest + TestClient | API route testing (HTTP contract) | ~5s |
| **Backend API Workflows** | `backend/tests/api_workflows/` | Pytest + TestClient | Multi-step API-level workflow validation | ~10s |
| **Backend Stress** | `backend/tests/stress/` | Pytest | Performance & edge-case scenarios | ~15s |
| **Frontend Component** | `frontend/src/tests/components/` | Vitest + RTL | Isolated React component behavior | ~3s |
| **Frontend Integration** | `frontend/src/tests/integration/` | Vitest + RTL | Multi-component UI flow tests | ~5s |
| **Frontend Stress** | `frontend/src/tests/stress/` | Vitest | UI rendering performance & edge cases | ~5s |
| **Browser E2E** | `e2e/` | Playwright | Full-stack browser tests | ~60s |

Key rename: `backend/tests/e2e/` → `backend/tests/api_workflows/` to clearly distinguish API-level workflow tests from browser-based E2E tests.

### 3. Browser E2E Test Structure

```text
reposol/e2e/
├── package.json              # Playwright dependency & scripts
├── playwright.config.ts      # Browser config, webServer for backend + frontend
├── tsconfig.json             # TypeScript configuration
├── fixtures/
│   └── base.ts               # Shared fixtures (apiSetup helper, cleanup)
├── helpers/
│   └── api-setup.ts          # Programmatic OSCAL document creation via API
└── tests/
    ├── smoke.spec.ts          # App loads, navigation, health check
    ├── catalog/               # Catalog feature tests
    ├── profile/               # Profile feature tests
    ├── import-wizard/         # Import wizard tests
    ├── dashboard/             # Dashboard tests
    └── cross-document/        # Multi-document workflow tests
```

### 4. Test Data Strategy

- **API-first setup**: Test data is created programmatically via the backend API in `test.beforeEach()` or through the `apiSetup` fixture, not through UI clicks. This makes tests faster and more reliable.
- **Automatic cleanup**: The `apiSetup` fixture tracks all created documents and deletes them in `test.afterEach()`.
- **No shared state**: Each test is independent and creates its own data.

### 5. Selector Strategy

Tests use Playwright's recommended accessible locator hierarchy:
1. `getByRole()` — ARIA roles (preferred)
2. `getByText()` — visible text content
3. `getByLabel()` — form field labels
4. `getByTestId()` — `data-testid` attributes (fallback)

CSS selectors and XPath are avoided unless absolutely necessary.

### 6. AI-Assisted E2E Test Generation

An Antigravity skill (`e2e_test_writer`) enables AI-driven generation of deterministic Playwright tests:

1. **Input**: User story or feature description
2. **Explore**: Use Chrome DevTools MCP to navigate the app, understand UI state, identify selectors
3. **Analyze**: Read existing Playwright tests to avoid duplication
4. **Generate**: Write a deterministic `.spec.ts` file using project conventions
5. **Validate**: Run the generated test to verify it passes
6. **Output**: Committed, green Playwright test

The AI skill produces **deterministic Playwright test code**, not AI-driven runtime tests. This ensures tests are reproducible, fast, and CI/CD-compatible.

### 7. Strategy for Existing Tests

- **No tests are deleted** — all existing backend and frontend tests remain functional
- **New feature tests** are primarily written as Playwright E2E tests
- Backend integration tests serve as **fast API regression tests** (seconds vs. minutes for E2E)
- Frontend component tests remain for **isolated UI logic validation**
- The `api_workflows/` tests are frozen — new workflow tests go into Playwright E2E

### 8. Workspace-Level Cleanup Architecture

The original per-document cleanup strategy (tracking each created document and deleting individually) has two gaps:
1. Documents created through UI interactions are not tracked by `ApiSetup.createdDocuments` and survive test teardown.
2. Workspace directories (`data/workspaces/<uuid>/`) accumulate on disk even when all documents within them are deleted.

The cleanup architecture is organized in **three tiers**:

#### Tier 1: Backend `DELETE /api/workspaces/{workspace_id}` Endpoint
- A dedicated endpoint that deletes the entire workspace directory tree (`data/workspaces/<workspace_id>/`) in a single `shutil.rmtree()` call.
- Protected workspace IDs (`default`, `master`, `templates`) are rejected with `400 Bad Request`.
- Non-existent workspaces return `404 Not Found`.
- This endpoint follows the same pattern as DD-015 § 5 (localhost guard is not applied since test workspaces are ephemeral session data, not master templates).

#### Fixture-Level Workspace Wipe (`ApiSetup.cleanup()`)
- The `cleanup()` method in `helpers/api-setup.ts` calls `DELETE /api/workspaces/{workspaceId}` directly via `deleteWithRetry`.
- If the backend workspace endpoint fails or returns an error, the error is **thrown directly to Playwright**, ensuring that any backend deletion bug immediately fails the test and alerts developers.
- Disposes the Playwright `APIRequestContext` after cleanup.

#### Global Teardown Safety Net (`global-teardown.ts`)
- A Playwright `globalTeardown` script runs after all tests complete.
- It scans the `data/workspaces/` directory for UUID-named subdirectories that are not `default`.
- Any remaining test workspace directories are deleted via `fs.rmSync(path, { recursive: true, force: true })`.
- This catches workspaces from crashed test runs or tests that don't use the base fixture.

---

## Consequences

- **Positive**: Full-stack confidence that frontend + backend work together in a real browser
- **Positive**: Playwright codegen reduces manual test writing effort significantly
- **Positive**: AI skill enables rapid test generation from user stories
- **Positive**: Clear naming eliminates confusion between API-level and browser-level E2E tests
- **Negative**: E2E tests are slower than unit/integration tests (~60s vs ~5s)
- **Negative**: Playwright adds a Node.js dependency to the test infrastructure
- **Negative**: Browser tests can be flakier than API tests (mitigated by Playwright's auto-waiting)
