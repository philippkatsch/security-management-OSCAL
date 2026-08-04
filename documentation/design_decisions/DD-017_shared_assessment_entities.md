# DD-017: Shared Assessment Entities — Observations, Risks, and Findings

**Status:** Accepted  
**Date:** 2026-07-27  
**Applies to:** Stage 6 (AR), Stage 7 (POA&M)

---

## Context

OSCAL defines three core assessment entities that are **structurally identical** across Assessment Results (AR) and Plan of Action & Milestones (POA&M):

| Entity | AR Location | POA&M Location | Shared Metaschema |
|---|---|---|---|
| **Observation** | `results[].observations[]` | `observations[]` | `oscal_assessment-common_metaschema.xml` |
| **Risk** | `results[].risks[]` | `risks[]` | `oscal_assessment-common_metaschema.xml` |
| **Finding** | `results[].findings[]` | `findings[]` | `oscal_assessment-common_metaschema.xml` |

These entities form a **linked triad**: Findings reference Observations (evidence) and Risks (impact). Risks contain Remediations (response plans) and a Risk Log (status history). POA&M Items reference all three via `related-findings`, `related-observations`, and `related-risks`.

We need a unified component architecture and data flow strategy to avoid duplicating complex UI code.

## Decision

### 1. Shared Component Library

All three entities are implemented as **shared, reusable React components** under `components/shared/assessment/`:

```
components/shared/assessment/
├── ObservationCard.jsx       # Renders/edits a single observation
├── RiskCard.jsx              # Renders/edits a single risk (with characterization, remediation, risk-log)
├── FindingCard.jsx           # Renders/edits a single finding (with target status)
├── ObservationList.jsx       # Manages observation[] array with CRUD
├── RiskList.jsx              # Manages risk[] array with CRUD
├── FindingList.jsx           # Manages finding[] array with CRUD
├── RiskStatusBadge.jsx       # Visual badge for risk status lifecycle
├── CharacterizationEditor.jsx # CVSS/facet characterization sub-editor
├── RemediationEditor.jsx     # Remediation response lifecycle editor
├── RiskLogTimeline.jsx       # Chronological risk-log entry timeline
└── EvidenceAttachment.jsx    # relevant-evidence management with DD-007 Base64
```

These components receive their data via props and emit changes via `onChange` callbacks — they are **editor-agnostic** and work in both AR and POA&M contexts.

### 2. Risk Lifecycle State Machine

Risk `status` follows a defined lifecycle with allowed transitions:

```
open → investigating → remediating → deviation-requested → deviation-approved → closed
                   ↘ closed (direct close if false-positive)
                   ↘ deviation-requested → deviation-approved → closed
                                         → deviation-rejected (custom) → remediating
```

**UI Rules:**
- `RiskStatusBadge.jsx` renders the current status with color coding (Note: DD-020 is the authoritative source for all status colors):
  - `open` = 🔴 Red
  - `investigating` = 🟠 Orange
  - `remediating` = 🟡 Yellow
  - `deviation-requested` = 🟣 Purple
  - `deviation-approved` = 🔵 Blue (with ⚠ deviation icon)
  - `closed` = 🟢 Green
- Status transitions are validated: the UI only allows valid next states (e.g., from `open` you can go to `investigating` or `closed`, but not directly to `deviation-approved`).
- Every status change automatically creates a `risk-log` entry with the `status-change` field, `start` timestamp, and optional `logged-by`.

### 3. Risk Properties & Deviation Handling

OSCAL defines special risk properties for deviation management:

| Property Name | Semantics | When Set |
|---|---|---|
| `false-positive` | Risk is a false positive | User marks during risk review |
| `accepted` | Risk is formally accepted | After `deviation-approved` status |
| `risk-adjusted` | Risk has been re-assessed/adjusted | After mitigating factor analysis |
| `priority` | Integer priority ranking | User assigns during triage |

**UI Behavior:**
- When a user marks a risk as `false-positive`, the system automatically:
  1. Sets `props[name="false-positive"]` with value `true`
  2. Transitions `status` to `closed`
  3. Logs a `risk-log` entry with type `closed`
- When `deviation-approved` is set, the system prompts for a justification in `remarks` and sets `props[name="accepted"]`.

### 4. Remediation Response Lifecycle

Each risk can have multiple `remediations[]` (type: `response`) with a lifecycle:

```
recommendation → planned → completed
```

| Lifecycle State | Meaning | Color |
|---|---|---|
| `recommendation` | Suggested action, not yet scheduled | 🔵 Blue |
| `planned` | Scheduled for implementation | 🟡 Yellow |
| `completed` | Remediation verified and closed | 🟢 Green |

**Response Type Classification** (property `type`):
- `avoid` — Eliminate the risk source
- `mitigate` — Reduce likelihood or impact
- `transfer` — Transfer risk to third party (insurance, outsourcing)
- `accept` — Formally accept the residual risk
- `share` — Share risk across organizational boundaries
- `contingency` — Prepare contingency/fallback plan
- `none` — No action required

### 5. Data Flow: AR → POA&M Risk Import

When creating a POA&M from Assessment Results (US 7.5):

1. User selects "Import from Assessment Results" in the POA&M editor.
2. System presents a file picker / document selector scoped to AR documents in the workspace.
3. For each `risk` in the selected AR's `results[].risks[]` where `status ≠ closed`:
   - A copy of the `risk` assembly is created in `poam.risks[]` with the **same UUID** (preserving traceability).
   - A `poam-item` is auto-generated with `related-risks[].risk-uuid` pointing to the imported risk.
   - Linked `observations` and `findings` are also imported if referenced.
4. The user can review and modify imported items before saving.

**Key Rule:** Imported risks preserve their original `uuid` for cross-document traceability. The POA&M does NOT maintain a live link — it's a point-in-time snapshot.

### 6. Cross-Reference Integrity

Within a single document, all cross-references must resolve:
- `finding.related-observations[].observation-uuid` → must match an `observation.uuid` in the same document.
- `finding.related-risks[].risk-uuid` → must match a `risk.uuid` in the same document.
- `poam-item.related-findings[].finding-uuid` → must match a `finding.uuid` in the same document.
- `poam-item.related-observations[].observation-uuid` → must match an `observation.uuid` in the same document.
- `poam-item.related-risks[].risk-uuid` → must match a `risk.uuid` in the same document.
- `risk.related-observations[].observation-uuid` → must match an `observation.uuid` in the same document.

**Validation:** These integrity checks run as Level 2 supplementary validation (DD-002) on save. Broken references produce **errors** (not warnings) since they indicate data corruption.

## Consequences

- Assessment Results and POA&M editors share ~80% of their UI code via the shared component library.
- Risk lifecycle is enforced via a state machine, reducing invalid transitions.
- AR → POA&M import preserves UUID traceability across the document lifecycle.
- Cross-reference integrity is enforced at save time, preventing dangling UUID references.
