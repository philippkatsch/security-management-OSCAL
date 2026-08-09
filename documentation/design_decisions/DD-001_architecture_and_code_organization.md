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
│   │   ├── routes.py        # CRUD, versioning, export, and status routes
│   │   ├── import_routes.py # Remote URL fetch, registry, and file upload routes
│   │   ├── validation.py    # OSCAL schema validation (jsonschema)
│   │   ├── format_converter.py # JSON/YAML/XML conversion utilities
│   │   ├── constants.py     # Stage mapping and shared constants
│   │   ├── schemas/         # Official OSCAL v1.1.2 JSON Schemas
│   │   ├── repositories/    # Data access layer (document_repository.py, workspace_repository.py with atomic storage & file locks)
│   │   └── services/        # Domain services layer (document_service.py, profile_service.py)
│   └── tests/               # Pytest suite (unit, integration, storage, workflows)
│
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── lib/             # Pure JS helper modules (api.js, oscal-utils.js, profile-resolver.js, status-machine.js)
│   │   ├── hooks/           # Custom React hooks (useDocument, useDraft, useVersions, useUndoRedo, useProfileResolution)
│   │   ├── components/      # React components (grouped by domain)
│   │   └── index.css        # Design system & global styles
│   └── tests/               # Frontend component tests (Vitest + RTL)
│
├── data/                    # Persisted OSCAL JSON documents (auto-created)
└── e2e/                     # Playwright browser-based E2E tests (see DD-024)
```

### 2. Frontend Decomposition & Domain-Driven Folders
The frontend `src/` directory uses a strict domain-driven subdivision:
- **`lib/`**: Contains pure, React-independent JavaScript utility logic.
  - `oscal-utils.js` — Constants, formatting, UUID generation, array cleaning, and validation helpers.
  - `profile-resolver.js` — Profile resolution engine.
  - `api.js` — Centralized API client.
  - `status-machine.js` — Document lifecycle state transitions (DD-023).
- **`hooks/`**: Contains custom React hooks encapsulating state management for cross-cutting concerns (e.g., `useDocument.js`, `useUndoRedo.js`, `useDraft.js`, `useVersions.js`, `useProfileResolution.js`).
- **`components/layout/`**: Holds layout shells such as sidebar navigation (`Layout.jsx`, `Navigation.jsx`).
- **`components/shared/`**: Contains reusable OSCAL editors and visual blocks shared across multiple pages (e.g. `PropsEditor`, `LinksEditor`, `ValidationFeedback`).
- **`components/catalog/`**: Catalog-specific pages and sidebar navigation (`CatalogPage.jsx`, `CatalogSidebar.jsx`).
- **`components/profile/`**: Profile-specific pages, tailoring panels, and config views (`ProfilePage.jsx`, `ProfileSidebar.jsx`, `ImportManager.jsx`, `ModifyPanel.jsx`).
- **`components/document/`**: Document creation dialogs (`CreateDocumentDialog.jsx`, `ImportWizard.jsx`).
- **`components/component-definition/`**: Component Definition inventory pages and editors (`ComponentPage.jsx`, `ComponentEditor.jsx`, `CapabilityEditor.jsx`).
- **`components/ssp/`**: System Security Plan builder pages, system characteristics, implementation editors (`SSPPage.jsx`, `SystemCharacteristicsEditor.jsx`, `ImplementationEditor.jsx`, `DiagramUploader.jsx`).
- **`components/assessment-plan/`**: Assessment Plan builder pages, task editors, subject scoping (`APPage.jsx`, `ActivityEditor.jsx`, `TaskEditor.jsx`).
- **`components/assessment-results/`**: Assessment Results reporter pages, result set editors (`ARPage.jsx`, `ResultSetEditor.jsx`).
- **`components/poam/`**: Plan of Action & Milestones tracker pages, item editors (`POAMPage.jsx`, `PoamItemEditor.jsx`).
- **`components/mapping/`**: Control Mapping editor pages, matrix visualization (`MappingPage.jsx`).
- **`components/shared/risk-assessment/`**: Shared assessment risk components reused across Steps 5-7 (`CharacterizationEditor`, `OriginsEditor`, `RelevantEvidenceEditor`, `RemediationsEditor`, `RiskLogEditor`). See [DD-017](DD-017_shared_assessment_entities.md).
- **`components/shared/dashboard/`**: Shared dashboard and analytics components reused across all steps (`MetricCard`, `ProgressBar`, `StatusBreakdown`, `CompletenessReport`). See [DD-022](DD-022_dashboard_analytics_component_library.md).
- **`components/shared/status/`**: Unified StatusBadge component and status configuration. See [DD-020](DD-020_status_badge_design_system.md).
- **`components/shared/entity/`**: Entity List-Detail editor pattern components (`EntityTable`, `EntityDetailPanel`, `BatchActionToolbar`). See [DD-021](DD-021_entity_list_detail_editor_pattern.md).
- **Legacy Pruning**: Deprecated monoliths (`DocumentEditor.jsx`, `MappingViewer.jsx`) are retired and replaced by domain-specific pages and shared components.

### 3. Shared Control Detail Components (Strategy/Adapter Pattern)
To align the visual representation of safety controls between the Catalog and Profile editors while maintaining their distinct saving behaviors (Catalogs mutate controls directly; Profiles map changes to `modify.alters` or `set-parameters`), we unified the panel into a single component, **`ControlDetailView`**, which embeds and coordinates the core child components (see [DD-008](file:///c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/documentation/design_decisions/DD-008_unified_control_detail_editor.md) for details):

1. **`ControlHeader`**: Displays the control ID, title, and class badges. Incorporates inline click-to-edit inputs, taking domain-specific `onChange` handlers via props.
2. **`ReadOnlyParts`**: Recursively renders read-only prose parts (statements, guidelines) and supports profile-specific indicators (Modified-Badge, Reset-Button) via optional props.
3. **`EnhancementsAccordion`**: Wraps control enhancements with count badges. In Catalog view, this acts as navigation; in Profile view, it renders inline, expandable content.

```text
ControlDetailView (Polymorphic Component)
├── Catalog Mode: Direct inline mutations
└── Profile Mode: Adapter callbacks routing to modify.alters
```

### 4. Naming Conventions
- **React Components**: PascalCase (e.g., `CatalogPage.jsx`, `ControlDetailView.jsx`).
- **Custom Hooks**: camelCase starting with `use` (e.g., `useDocument.js`).
- **Pure Libraries**: kebab-case (e.g., `profile-resolver.js`).
- **CSS Modules**: kebab-case matching the domain/component name (e.g., `tokens.css`).
- **Design Decisions**: `DD-NNN_short_description.md`.

### 5. Cross-References to Related DDs
- DD-004 (Editor UX)
- DD-008 (ControlDetailView for Steps 1-2)
- DD-020 (Status Badges)
- DD-021 (Entity List-Detail for Steps 3-8)
- DD-022 (Dashboard Components)
- DD-023 (Document Lifecycle)

---

## Consequences
- **Code Reuse (DRY)**: Over 150 lines of duplicate rendering and formatting code (such as `formatProse`) were eliminated.
- **Visual Consistency**: Spacing, borders, and typography are unified across both editors.
- **High Maintainability**: Refactoring layout or editing rules only requires modifying code in one place.
- **Portability**: Future OSCAL types across ALL 8 stages can use the same shared components without duplicating work.
