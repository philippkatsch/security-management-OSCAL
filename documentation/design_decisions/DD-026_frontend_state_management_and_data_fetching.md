# DD-026: Frontend State Management and Data Fetching

## Status: Accepted
## Date: 2026-08-09
## Decision Makers: Development Team

## Context
Previously, state management used manual deep cloning (`JSON.parse(JSON.stringify())`) and monolithic files. Data fetching manually managed loading and error states, leading to prop-drilling and boilerplate.

## Decisions

### 1. Separation of State Concerns
- **UI State**: Jotai atoms (`uiAtoms`, `workspaceAtoms`). Only strictly client-side UI state goes here (e.g., active tabs, sidebar open/close).
- **Server State**: `@tanstack/react-query`. Used for all API data fetching, caching, invalidation, and data synchronization.

### 2. Hook Split Architecture
We split monolithic hooks into specialized, composable hooks:
- `useDocumentData`: React Query wrapper for fetching and caching document data.
- `useDocumentHistory`: Manages local undo/redo stacks.
- `useUnsavedChangesWarning`: Warns user before navigating away with unsaved edits.
- `useDocumentLifecycle`: A thin facade composition of the above hooks. Manual composition of the underlying hooks is permitted when granular control is needed.

### 3. Document Actions Pattern (Immer)
- Direct inline mutations (`produce()`) scattered across components are strictly prohibited.
- Adopted the **Document Actions Pattern** (see DD-029). All document modifications occur via centralized domain modules in `src/lib/document-actions/`.
- These modules use Immer for safe immutable deep updates and provide automatic undo-snapshot capture and action logging.

## Consequences
- Clean separation between ephemeral UI state and cached server state.
- Predictable, centralized document mutations.
- Eliminates prop-drilling and manual fetch boilerplate.
- Finer-grained re-renders and robust caching strategies.
