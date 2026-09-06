# DD-001: Architecture & Code Organization

## Status: Accepted
## Date: 2026-07-17 (Updated 2026-08-09)
## Decision Makers: Development Team

## Context
Originally, the Reposol frontend was built around two massive monolithic components in `src/components/`:
- `CatalogViewer.jsx` (~6.5k lines) — handled catalog AND profile viewing/editing.
- `DocumentEditor.jsx` (~6.8k lines) — handled document creation for ALL 8 OSCAL types.

These monoliths contained duplicated business logic, 80+ state hooks each, and were highly unmaintainable. To resolve this, we defined a modular component architecture, established repository file layouts and naming conventions, retired deprecated monolithic files, and extracted key shared components to enforce a clean separation of concerns and visual consistency.

---

## Decisions

### 1. Repository-Wide Directory Structure
The repository is organized following a strict full-stack separation:

```text
reposol/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py          # FastAPI app entry point (port 1000, SPA fallback)
│   │   ├── api/             # Domain-specific route files replacing routes.py (document_routes.py, etc.)
│   │   ├── dependencies.py  # FastAPI DI (get_workspace_id, require_write_permission)
│   │   ├── validation.py    # OSCAL schema validation (jsonschema)
│   │   ├── format_converter.py # JSON/YAML/XML conversion utilities
│   │   ├── constants.py     # Stage mapping, unified magic strings, and shared constants
│   │   ├── schemas/         # Official OSCAL v1.2.2 JSON Schemas
│   │   ├── repositories/    # Data access layer (document_repository.py, workspace_repository.py with atomic storage & file locks)
│   │   └── services/        # Domain services layer (document_service.py, profile_service.py)
│   └── tests/               # Pytest suite (unit, integration, storage, workflows)
│
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── lib/             # Pure JS helper modules (api.js, oscal-utils.js)
│   │   │   ├── profile/     # Split profile resolution modules
│   │   │   └── types/       # TypeScript types (oscal.d.ts, api.d.ts)
│   │   ├── hooks/           # Custom React hooks (useDocument, useDraft, useVersions, useUndoRedo)
│   │   ├── stores/          # Jotai atoms for global state management
│   │   ├── components/      # React components (grouped by domain)
│   │   └── styles/          # Global CSS only
│   └── tests/               # Frontend component tests (Vitest + RTL)
│
├── data/                    # Persisted OSCAL JSON documents (auto-created)
└── e2e/                     # Playwright browser-based E2E tests (see DD-024)
```

### 2. Frontend Decomposition & Domain-Driven Folders
The frontend `src/` directory uses a strict domain-driven subdivision:
- **`lib/`**: Contains pure, React-independent JavaScript utility logic.
  - `oscal-utils.ts` — Constants, formatting, UUID generation, array cleaning, and validation helpers.
  - `document-actions/` — Centralized action layer domain modules (catalog, profile, ssp, etc.) with immer produce, logging, and auto undo-snapshot.
  - `api-client.ts` — Centralized API client with interceptors.
- **`hooks/`**: Contains custom React hooks encapsulating state management for cross-cutting concerns (e.g., `useDocumentData.ts`, `useDocumentHistory.ts`, `useDocumentLifecycle.ts`, `useDocumentActions.ts`).
- **`components/layout/`**: Holds layout shells such as sidebar navigation (`Layout.tsx`, `Navigation.tsx`, `DocumentPageLayout.tsx`).
- **`components/shared/`**: Contains reusable OSCAL editors and visual blocks shared across multiple pages (e.g. `PropsEditor`, `LinksEditor`, `ValidationFeedback`).
- **`components/catalog/`**: Catalog-specific pages and sidebar navigation (`CatalogPage.tsx`, `CatalogSidebar.tsx`).
- **`components/profile/`**: Profile-specific pages, tailoring panels, and config views (`ProfilePage.tsx`, `ProfileSidebar.tsx`, `ImportManager.tsx`, `ModifyPanel.tsx`).
- **`components/document/`**: Document creation dialogs (`CreateDocumentDialog.tsx`, `ImportWizard.tsx`).
- **`components/component-definition/`**: Component Definition inventory pages and editors (`ComponentPage.tsx`, `ComponentEditor.tsx`, `CapabilityEditor.tsx`).
- **`components/ssp/`**: System Security Plan builder pages, system characteristics, implementation editors (`SSPPage.tsx`, `SystemCharacteristicsEditor.tsx`, `ImplementationEditor.tsx`, `DiagramUploader.tsx`).
- **`components/assessment-plan/`**: Assessment Plan builder pages, task editors, subject scoping (`APPage.tsx`, `ActivityEditor.tsx`, `TaskEditor.tsx`).
- **`components/assessment-results/`**: Assessment Results reporter pages, result set editors (`ARPage.tsx`, `ResultSetEditor.tsx`).
- **`components/poam/`**: Plan of Action & Milestones tracker pages, item editors (`POAMPage.tsx`, `PoamItemEditor.tsx`).
- **`components/mapping/`**: Control Mapping editor pages, matrix visualization (`MappingPage.tsx`).
- **`components/traceability/`**: Traceability domain components for tracing requirements across documents.
- **`components/dashboard/`**: Dashboard pages (`DashboardPage.tsx`).
- **`components/shared/risk-assessment/`**: Shared assessment risk components reused across Steps 5-7 (`CharacterizationEditor`, `OriginsEditor`, `RelevantEvidenceEditor`, `RemediationsEditor`, `RiskLogEditor`). See [DD-017](DD-017_shared_assessment_entities.md).
- **`components/shared/dashboard/`**: Shared dashboard and analytics components reused across all steps (`MetricCard`, `ProgressBar`, `StatusBreakdown`, `CompletenessReport`). See [DD-022](DD-022_dashboard_analytics_component_library.md).
- **`components/shared/status/`**: Unified StatusBadge component and status configuration. See [DD-020](DD-020_status_badge_design_system.md).
- **`components/shared/entity/`**: Entity List-Detail editor pattern components (`EntityTable`, `EntityDetailPanel`, `BatchActionToolbar`). See [DD-021](DD-021_entity_list_detail_editor_pattern.md).
- **Legacy Pruning**: Deprecated monoliths (`DocumentEditor.jsx`, `MappingViewer.jsx`) are retired and replaced by domain-specific pages and shared components.

### 3. Shared Control Detail Components (Strategy/Adapter Pattern)
To cleanly separate direct mutation logic from adapter logic, we use a single **`UnifiedControlEditor`** paired with a shared **`ControlTree`**. We removed `CatalogControlEditor`, `ProfileControlOverlay`, and inline SSP editors. For full details on the stage adapters and polymorphism, see DD-030.

### 4. Naming Conventions
- **React Components**: PascalCase (e.g., `CatalogPage.tsx`, `CatalogControlEditor.tsx`).
- **TypeScript**: All new frontend files must be TypeScript (`.tsx`/`.ts`).
- **CSS Modules**: CSS Modules (`*.module.css`) for component styling.
- **Custom Hooks**: camelCase starting with `use` (e.g., `useDocument.ts`).
- **Pure Libraries**: kebab-case (e.g., `profile-resolver.ts`).
- **Barrel Exports**: Use `index.ts` convention for cleaner module exports.
- **Design Decisions**: `DD-NNN_short_description.md`.

### 5. Cross-References to Related DDs
- DD-004 (Editor UX)
- DD-020 (Status Badges)
- DD-029 (Document Actions Pattern)
- DD-030 (Unified Control Editor - supersedes DD-008)
- DD-021 (Entity List-Detail for Steps 3-8)
- DD-022 (Dashboard Components)

---

## Consequences
- **Code Reuse (DRY)**: Over 150 lines of duplicate rendering and formatting code (such as `formatProse`) were eliminated.
- **Visual Consistency**: Spacing, borders, and typography are unified across both editors.
- **High Maintainability**: Refactoring layout or editing rules only requires modifying code in one place.
- **Portability**: Future OSCAL types across ALL 8 stages can use the same shared components without duplicating work.
