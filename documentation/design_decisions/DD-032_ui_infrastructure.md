# DD-032: UI Infrastructure

## Status: Accepted
## Date: 2026-08-10
## Decision Makers: Development Team

## Context
The Reposol frontend relied heavily on browser-native UI elements (`window.alert`, `window.confirm`), lacked centralized error handling, and had fragmented loading states. As the application migrated to a modern architecture, a robust, accessible, and unified UI infrastructure was required.

## Decisions

### 1. Toast Notification System
- Replaced all blocking `window.alert()` calls with `react-hot-toast`.
- A centralized `ToastProvider` at the root of the app handles positioning and styling.
- Used for non-blocking feedback (e.g., successful saves, validation errors, background task completion).

### 2. Standardized Confirmation Dialogs
- Replaced all blocking `window.confirm()` calls with a custom `ConfirmModal` component.
- The `useConfirm` hook provides a simple Promise-based API for triggering the modal.
- Ensures accessible, visually consistent warnings for destructive actions (e.g., deleting entities).

### 3. Route-Level Error Boundaries
- Implemented React `ErrorBoundary` components at the router level.
- Prevents the entire application from crashing due to isolated component errors, displaying a user-friendly fallback UI with recovery options instead of a blank white screen.

### 4. Robust API Client
- Centralized `api-client.ts` wraps standard fetch calls.
- Configured with interceptors to handle global 401 Unauthorized errors, format response JSON automatically, and standardize error throwing for React Query consumption.

### 5. Suspense and Code Splitting
- Introduced a unified `LoadingSpinner` component.
- Implemented React `Suspense` for lazy-loading route components, improving initial bundle size and time-to-interactive.

### 6. Common UI Utility Components
To accelerate development and maintain consistency, we introduced:
- **`EmptyState`**: A standardized component for empty lists and tables, featuring consistent illustrations and primary call-to-action buttons.
- **`EditableCard`**: A container offering a clean read-only view that seamlessly toggles into an inline form mode.
- **`ListEditor<T>`**: A generic component for managing simple arrays of items (adding, removing, reordering) without full entity table overhead.

## Consequences
- **Accessibility & UX**: Eliminated jarring browser native dialogs in favor of integrated, accessible UI components.
- **Resilience**: The application gracefully handles API failures and render errors.
- **Developer Experience**: Common UI patterns are encapsulated in simple hooks and utility components.
