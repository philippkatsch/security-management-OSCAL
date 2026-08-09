# DD-023: Document Lifecycle State Machine

## Status: Accepted
## Date: 2026-07-27
## Decision Makers: Development Team

## Context
US 0.6b introduced document lifecycle states (draft, active, archived, superseded) for all 8 OSCAL document types. However, no Design Decision defines the state transition rules, cascading effects on the document graph, editability constraints, or interaction with version management (DD-004) and workspace isolation (DD-015). Without this DD, lifecycle state behavior will be implemented inconsistently across stages.

## Key Decisions to Document:

### 1. State Transition Diagram
```
             ┌──────────────────────────────┐
             │                              ▼
  [draft] ──→ [active] ──→ [archived]
                  │
                  └──→ [superseded]
                        (links to successor UUID)
```

Valid transitions:
- `draft` → `active` (publishing/activation)
- `draft` → `archived` (abandoned draft, skip active)
- `active` → `archived` (end of lifecycle)
- `active` → `superseded` (replaced by newer version, requires successor-uuid)
- `archived` → `active` (reactivation, requires confirmation)
- `superseded` → (terminal state, no outbound transitions)

Invalid transitions (blocked):
- `archived` → `draft` (cannot un-publish to draft)
- `superseded` → any (superseded is terminal)
- Any → `superseded` without specifying `successor-uuid`

### 2. Storage Mechanism
Lifecycle state is stored as an OSCAL property on `metadata`:
```json
{
  "metadata": {
    "props": [
      { "name": "document-status", "value": "active", "ns": "https://reposol.dev/ns" },
      { "name": "superseded-by", "value": "<successor-uuid>", "ns": "https://reposol.dev/ns" }
    ]
  }
}
```
- Uses Reposol custom namespace `ns` to avoid conflicts with NIST standard props
- Default state for new documents: `draft`
- `superseded-by` prop only present when `document-status` = `superseded`

### 3. Editability Rules

| State | Editable? | UI Behavior |
|---|---|---|
| `draft` | ✅ Full read-write | Normal editor, no restrictions |
| `active` | ✅ Read-write with version bump | On save: prompt version increment dialog (DD-004 §5). Auto-increments `metadata.version` patch number. |
| `archived` | ❌ Read-only | All edit controls disabled. Yellow banner: 'This document is archived. Create a new version to make changes.' Action button: 'Reactivate' (transitions back to `active`). |
| `superseded` | ❌ Read-only | All edit controls disabled. Blue banner: 'This document has been superseded.' Link to successor document. No reactivation possible. |

### 4. Cascading Effects on Document Graph
When a document's lifecycle state changes, downstream documents that reference it (via `import-*` or `href`) are affected:

| Parent Action | Effect on Child Documents |
|---|---|
| Catalog archived | All Profiles importing it: orange warning banner 'Source catalog is archived. Consider updating your baseline.' |
| Profile archived | All SSPs importing it: orange warning banner 'Baseline profile is archived.' |
| SSP archived | All APs referencing it: orange warning banner 'Target SSP is archived.' All ARs: same. All POA&Ms: same. |
| Any document superseded | All children: blue info banner 'Parent document has been superseded by [successor title]. Click to update reference.' Action button: 'Update Import Reference' (updates `import-*.href` to point to successor UUID). |
| Catalog/Profile deleted | DD-016 existing deletion protection: confirmation dialog listing all referencing documents before allowing delete. |

Cascading checks are performed:
- **On document load** (frontend checks parent status via DD-016 resolution)
- **NOT on state change** (no push notifications; children detect parent changes lazily)

### 5. UI Components

#### Status Selector
- Dropdown in document header/metadata section
- Uses DD-020 StatusBadge for current state display
- Dropdown only shows valid transitions from current state
- 'Supersede' action opens modal: select successor document from workspace list

#### Lifecycle Banner
- Full-width dismissible banner below document header
- Color-coded per state (DD-020 tokens):
  - `archived`: `var(--status-lifecycle-archived)` background
  - `superseded`: `var(--status-lifecycle-superseded)` background
- Action buttons embedded in banner (Reactivate, Update Reference, etc.)

#### Workspace Document List Integration
- Default view filters to `draft` + `active` documents only
- Toggle: 'Show archived/superseded' reveals all documents
- Status column in document table uses DD-020 StatusBadge
- Sort by status groups active documents first

### 6. Interaction with Version Management (DD-004 §5)
- State transitions auto-generate revision entries in `metadata.revisions[]`:
  ```json
  { "title": "Status changed to archived", "published": "2026-07-27T15:00:00Z", "version": "2.1.0", "remarks": "Document archived by user" }
  ```
- `draft` → `active` transition: prompts for initial version number (e.g., '1.0.0')
- `active` → `archived`: records final version in revision history
- `active` → `superseded`: records supersession with successor reference in revision remarks

### 7. Interaction with Workspace Isolation (DD-015)
- Lifecycle state is per-document, not per-workspace
- Archived documents persist in workspace storage but are visually deprioritized
- Master templates (DD-015 `?w=master`) always remain in `active` state
- Template seeding (DD-015 `sync_master_templates()`) only copies `active` templates

### 8. Backend API Support
- `PATCH /api/{stage}/{uuid}/status` — updates lifecycle state
  - Request body: `{ "status": "archived", "successor_uuid": "..." }` (successor_uuid required only for superseded)
  - Validates transition legality, returns 400 for invalid transitions
  - Auto-updates `metadata.props` and `metadata.revisions`
  - Returns updated document
- `GET /api/{stage}/?status=active,draft` — filter document list by lifecycle state

## Cross-References
- DD-004 §5 (Version Management): State transitions trigger revision entries
- DD-015 (Workspace Isolation): Lifecycle state persists per-document in workspace
- DD-016 (Cross-Document Import): Parent lifecycle state detected during lazy resolution
- DD-020 (Status Badge Design System): Lifecycle badges use centralized color tokens
- US 0.6b (Document Lifecycle Status & Archival): User story defining requirements

## Consequences
- All 8 document types have consistent lifecycle state management
- Archived/superseded documents are never accidentally edited
- Document graph integrity is maintained through lazy cascading warnings
- Version history provides complete audit trail of state transitions
- No breaking changes to existing OSCAL schema (uses custom `props` namespace)
