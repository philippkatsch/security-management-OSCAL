# DD-001: Architecture & Code Organization

## Status: Accepted
## Date: 2026-07-17 (Consolidated 2026-07-19)
## Decision Makers: Development Team

## Context
Originally, the Reposol frontend was built around two massive monolithic components in `src/components/`:
- `CatalogViewer.jsx` (~6.5k lines) — handled catalog AND profile viewing/editing.
- `DocumentEditor.jsx` (~6.8k lines) — handled document creation for ALL 8 OSCAL types.

These monoliths contained duplicated business logic, 80+ state hooks each, and were highly unmaintainable. To resolve this, we defined a modular component architecture, established repository file layouts and naming conventions, and extracted key shared components to enforce a clean separation of concerns and visual consistency.

---

## Decisions

### 1. Repository-Wide Directory Structure
The repository is organized following a strict full-stack separation:

```text
reposol/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py          # FastAPI app entry point (port 1000)
│   │   ├── routes.py        # CRUD + validation API routes
│   │   ├── storage.py       # Local JSON persistence with path-traversal protection
│   │   └── validation.py    # OSCAL schema validation (jsonschema)
│   └── tests/               # Pytest suite
│
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── lib/             # Pure JS helper modules (centralized api, resolvers)
│   │   ├── hooks/           # Custom React hooks (useDocument, useDraft, useUndoRedo)
│   │   ├── components/      # React components (grouped by domain)
│   │   └── styles/          # Design system & modular CSS
│   └── tests/               # Frontend component tests
│
├── data/                    # Persisted OSCAL JSON documents (auto-created)
└── e2e_tests/               # End-to-end test suite
```

### 2. Frontend Decomposition & Domain-Driven Folders
The frontend `src/` directory uses a strict domain-driven subdivision:
- **`lib/`**: Contains pure, React-independent JavaScript utility logic.
  - `oscal-utils.js` — Constants, formatting, and general helpers.
  - `profile-resolver.js` — Profile resolution engine.
  - `api.js` — Centralized API client.
- **`hooks/`**: Contains custom React hooks encapsulating state management for cross-cutting concerns (e.g., `useDocument.js`, `useUndoRedo.js`, `useDraft.js`).
- **`components/layout/`**: Holds layout shells such as sidebar navigation.
- **`components/shared/`**: Contains reusable OSCAL editors and visual blocks shared across multiple pages (e.g. `PropsEditor`, `LinksEditor`, `ValidationFeedback`).
- **`components/catalog/`**: Catalog-specific pages and sidebar navigation.
- **`components/profile/`**: Profile-specific pages, tailoring panels, and config views.
- **`components/document/`**: Document creation dialogs.

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

---

## Consequences
- **Code Reuse (DRY)**: Over 150 lines of duplicate rendering and formatting code (such as `formatProse`) were eliminated.
- **Visual Consistency**: Spacing, borders, and typography are unified across both editors.
- **High Maintainability**: Refactoring layout or editing rules only requires modifying code in one place.
- **Portability**: Future OSCAL types (such as SSPs or Component Definitions) can use the same shared components without duplicating work.
