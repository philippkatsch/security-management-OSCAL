# DD-029: Document Actions Pattern

## Status: Accepted
## Date: 2026-08-10
## Decision Makers: Development Team

## Context
As the application grew, React components became bloated with inline data mutations using `produce()` from Immer scattered everywhere. This led to duplicated logic, inconsistent state updates, difficulty testing business logic independently from UI, and unreliable undo/redo snapshotting because `undo()` calls had to be manually placed in every component.

## Decisions

### 1. Centralized Action Layer
We established the **Document Actions Pattern**. All mutations to OSCAL documents must occur through centralized action modules located in `src/lib/document-actions/`.
- No inline `produce()` calls are allowed inside React components.

### 2. Domain Modules
Action logic is strictly separated by domain into specific modules:
- `catalog-actions.ts`: Actions for modifying groups, controls, and parameters.
- `ssp-actions.ts`: Actions for system characteristics, components, and implemented requirements.
- `assessment-plan-actions.ts`: Actions for reviewed controls, assessment subjects, assets, platforms, local definitions, tasks, dependencies, timing, terms & conditions, and back-matter (see [DD-037](DD-037_assessment_plan_architecture_and_scoping_model.md)).
- `poam-actions.ts`: Actions for POA&M items.
- `metadata-actions.ts`: Shared actions for document metadata (roles, parties, versions, props).

### 3. Action Middleware
Actions are wrapped in a standard middleware that automatically handles:
- **Immer `produce()`**: Safely applies mutations mutably but returns an immutable new state.
- **Auto Undo-Snapshot**: Automatically captures the pre-mutation state and pushes it to the undo stack via `useDocumentHistory` without requiring component intervention.
- **Logging**: Standardized console logging or telemetry for tracking user interactions.

### 4. `useDocumentActions` Hook
The frontend exposes a single `useDocumentActions` hook. It binds the current document state and history dispatcher to the domain action modules, exposing a clean API to components.
```typescript
const { addControl, updateStatement } = useDocumentActions();
```

### 5. Migration Pattern
For existing components:
1. Extract the inline `produce()` logic into a named function in the appropriate domain module.
2. Ensure the function takes the draft document as the first argument, followed by the action payload.
3. Replace the inline mutation in the component with a call to the bound action from `useDocumentActions`.

## Consequences
- **Testability**: Pure JavaScript action functions can be unit-tested without React.
- **Consistency**: Guaranteed reliable undo/redo history.
- **Maintainability**: Components are significantly thinner, strictly focusing on UI rendering.
