# DD-016: Cross-Document Import & Link Resolution Strategy

**Status:** Accepted  
**Date:** 2026-07-27  
**Applies to:** Stage 5 (AP), Stage 6 (AR), Stage 7 (POA&M), Stage 8 (Mapping)

---

## Context

The OSCAL Assessment Layer introduces a fundamental new concept not present in Stages 1–4: **cross-document imports**. Each assessment model mandates linking to a parent document:

| Model | Import Assembly | Target | Required? |
|---|---|---|---|
| Assessment Plan (AP) | `import-ssp` | System Security Plan | **Required** (1..1) |
| Assessment Results (AR) | `import-ap` | Assessment Plan | **Required** (1..1) |
| POA&M | `import-ssp` | System Security Plan | Optional (0..1), but either `import-ssp` or `system-id` must exist |
| Mapping Collection | `source-resource` / `target-resource` | Catalog or Profile | **Required** (1..1 each per mapping) |

This creates a **document dependency graph** where higher-layer documents consume and reference lower-layer documents. We need a consistent strategy for resolving, caching, and validating these links.

## Decision

### 1. Import Resolution Model

All `import-*` and resource references follow a **lazy resolution with on-demand fetch** model:

- **Local-First Resolution:** When the `href` is a bare fragment (`#uuid`) or a relative path, the system resolves it against the workspace's document store (`workspaces/{workspace_id}/{stage}/`).
- **Backend Resolver Endpoint:** A new endpoint `GET /api/resolve/{stage}/{uuid}` fetches and returns the resolved document from the workspace store. The frontend calls this when opening an editor that requires a parent document.
- **Caching:** Resolved parent documents are cached client-side in the editor's React state for the duration of the editing session. No persistent cross-session cache. The cache is invalidated when the editor is reopened.
- **External URIs:** If `href` is an absolute URI (`https://...`), the system displays the URL as a read-only link. External documents are NOT fetched automatically — the user must manually upload or import them.

### 2. Reference Validation

Cross-document references are validated at two levels:

**Level 1 — Structural (Client-side, on save):**
- Verify that the `href` in `import-ssp` / `import-ap` / `source-resource` / `target-resource` is non-empty and well-formed (valid `uri-reference`).
- For bare fragments (`#uuid`), verify the UUID resolves to a `back-matter.resource` within the same document.

**Level 2 — Referential Integrity (Backend, on save):**
- For local relative paths, verify the target document exists in the workspace store.
- For AP: Verify that `import-ssp.href` points to an existing SSP document.
- For AR: Verify that `import-ap.href` points to an existing AP document.
- For POA&M: If `import-ssp` is present, verify the SSP exists. If absent, verify `system-id` is populated.
- For Mapping: Verify that `source-resource.href` and `target-resource.href` point to existing catalogs or profiles.
- Validation failures produce **warnings** (not hard errors), allowing documents to reference future or external resources.

### 3. Imported Context Injection

When an editor loads a document with an import:

- **AP Editor:** Resolves the SSP and extracts `system-implementation.components[]`, `system-implementation.users[]`, `system-implementation.inventory-items[]`, and `control-implementation.implemented-requirements[]` to populate the assessment subject picker (US 5.8) and reviewed-controls selector (US 5.6).
- **AR Editor:** Resolves the AP and extracts `reviewed-controls`, `assessment-subjects`, and `tasks` to pre-populate the result set's `reviewed-controls` and provide context for logging and findings.
- **POA&M Editor:** Resolves the SSP to provide system context. Optionally resolves linked AR documents to enable risk import (US 7.5).
- **Mapping Editor:** Resolves source and target catalogs/profiles to populate the control picker for mapping entries.

### 4. Stale Reference Handling

When a parent document changes after an import was established:

- The system does **NOT** automatically propagate changes. Imports are point-in-time references.
- When opening an editor, the system compares the parent document's `metadata.last-modified` against a stored snapshot timestamp. If the parent has changed, a **non-blocking info banner** is displayed: _"The imported SSP has been modified since this assessment plan was last saved. Review the changes."_
- The user can manually re-sync by clicking "Refresh Import" which re-resolves the parent document and updates the injected context.

### 5. Cascading Delete Protection

- Deleting a document that is referenced by another document via `import-*` triggers a **warning dialog** listing all dependent documents.
- The deletion is NOT blocked but the user must acknowledge the warning.

## Consequences

- All editors for Stage 5–8 documents gain a consistent "Imported Document" panel in the Document Overview (US 0.P3).
- Cross-document integrity validation runs as supplementary checks alongside OSCAL schema validation (DD-002).
- No persistent server-side caching or dependency graph database is required — resolution is stateless and on-demand.
- Parent documents are never mutated by child documents.
