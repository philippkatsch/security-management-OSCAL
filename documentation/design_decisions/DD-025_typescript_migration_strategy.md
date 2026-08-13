# DD-025: TypeScript Migration Strategy

## Status: Accepted
## Date: 2026-08-09
## Decision Makers: Development Team

## Context
The frontend codebase is entirely plain JavaScript. Given the complexity of deeply nested OSCAL data structures, type safety is critical to prevent runtime bugs.

## Decisions
1. All new frontend files MUST be TypeScript (`.tsx`/`.ts`).
2. Existing files will be migrated incrementally: `lib/` and `hooks/` first, then `components/`.
3. `tsconfig.json` with `strict: true`, `allowJs: true` for gradual migration.
4. Core OSCAL type interfaces defined in `src/lib/types/oscal.d.ts`.
5. API response types in `src/lib/types/api.d.ts`.

## Consequences
Better IDE autocompletion, compile-time error detection, self-documenting code. Short-term cost of migration effort.
