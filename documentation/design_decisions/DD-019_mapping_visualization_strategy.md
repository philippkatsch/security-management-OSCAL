# DD-019: Mapping Visualization & Gap Analysis Strategy

**Status:** Accepted  
**Date:** 2026-07-27 (updated 2026-08-13)  
**Applies to:** Stage 8 (Mapping Collection)

---

## Context

The OSCAL Mapping Collection model (v1.2.2) is unique among all OSCAL models: it relates controls from a **source framework** to controls of a **target framework** via defined relationship types. This cross-framework mapping requires specialized visualization not found in any other OSCAL editor.

The model supports:
- 6 relationship types (`equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`)
- 1:1, 1:N, and N:1 mappings (via `sources[]` and `targets[]` arrays on each `map` entry)
- Relationship qualifiers (`has-requirement`, `has-incompatibility`)
- Confidence scoring (category or percentage)
- Gap summaries (`source-gap-summary`, `target-gap-summary`)
- Coverage tracking (decimal 0.0–1.0)

We need a visualization strategy that makes these complex relationships intuitive.

## Decision

### 1. Primary View: Interactive Matrix

The default mapping view is an **interactive cross-reference matrix**:

```
                 ┌─────────────────────────────────────────────────┐
                 │         TARGET FRAMEWORK (ISO 27001)            │
                 │  A.5.1  A.5.2  A.5.3  A.6.1  A.6.2  A.7.1 ... │
┌────────────────┼─────────────────────────────────────────────────┤
│ SOURCE         │                                                 │
│ FRAMEWORK      │                                                 │
│ (NIST 800-53)  │                                                 │
│                │                                                 │
│ AC-1           │  ══     ──     ░░                               │
│ AC-2           │         ══            ▶▶                        │
│ AC-3           │  ──                          ◀◀                 │
│ AC-4           │                ░░                    ██         │
│ ...            │                                                 │
└────────────────┴─────────────────────────────────────────────────┘

Legend:  ══ equivalent-to  ▶▶ superset-of  ◀◀ subset-of
        ░░ intersects-with  ██ equal-to  ✕✕ no-relationship
        (empty) = unmapped
```

**Matrix Behavior:**
- **Rows** = Source controls (from `source-resource`)
- **Columns** = Target controls (from `target-resource`)
- **Cells** = Relationship indicator (icon + color)
- **Cell Click** = Opens the `map` entry detail card for editing
- **Row/Column Headers** = Click to filter to that control's mappings
- **Empty Cells** = No mapping exists → click to create one
- **Scroll** = Virtual scrolling for large frameworks (100+ controls)

### 2. Relationship Color Coding

| Relationship Type | Color | Icon | Semantics |
|---|---|---|---|
| `equal-to` | 🟣 Purple | `═` | Identical requirements |
| `equivalent-to` | 🟢 Green | `≈` | Similar with same effective meaning |
| `subset-of` | 🔵 Blue | `⊂` | Source is contained within target |
| `superset-of` | 🟠 Orange | `⊃` | Source contains target |
| `intersects-with` | 🟡 Yellow | `∩` | Partial overlap |
| `no-relationship` | 🔴 Red | `∅` | No overlap (explicitly mapped as unrelated) |
| Unmapped | ⬜ Empty | — | No mapping entry exists |

### 3. Gap Analysis Panel

A dedicated **Gap Analysis** panel provides coverage metrics and unmapped control identification:

```
┌──────────────────────────────────────────────────┐
│ 📊 Gap Analysis                                  │
│                                                  │
│ Source Coverage: ████████░░ 78%  (156/200)        │
│ Target Coverage: █████████░ 91%  (82/90)          │
│                                                  │
│ Unmapped Source Controls (44):                    │
│  ◻ PE-1  ◻ PE-2  ◻ PE-3  ◻ CP-1  ◻ CP-2 ...    │
│                                                  │
│ Unmapped Target Controls (8):                     │
│  ◻ A.18.1  ◻ A.18.2  ...                        │
│                                                  │
│ [Export CSV] [Export PDF] [Filter Unmapped]       │
└──────────────────────────────────────────────────┘
```

**Gap Calculation:**
- **Source Coverage** = (Number of source controls with at least 1 mapping) / (Total source controls) × 100
- **Target Coverage** = (Number of target controls with at least 1 mapping) / (Total target controls) × 100
- **Unmapped controls** are derived by comparing the full control list from the resolved `source-resource` / `target-resource` against the `map[].sources[].id-ref` and `map[].targets[].id-ref` values.
- If `source-gap-summary` or `target-gap-summary` assemblies exist in the OSCAL document, they are pre-populated from those. Otherwise, the system calculates them dynamically.

### 4. Sankey Flow Diagram Integration (Dual / Toggle View)

The mapping visualization provides an interactive **dual-view toggle** between Matrix View and **Sankey Flow Diagram**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ View Mode: [ Matrix View ]  [ Sankey Flow View ]                       │
├────────────────────────────────────────────────────────────────────────┤
│ SOURCE (NIST 800-53)      RELATIONSHIP FLOWS      TARGET (ISO 27001)   │
│ ┌────────────┐                                  ┌────────────┐       │
│ │ PE-1       ├─────────────────────────────────►│ A.11.1     │       │
│ ├────────────┤    (equal-to: 🟣 Purple)         ├────────────┤       │
│ │ AC-2       ├───────────┐                      │ A.9.2.1    │       │
│ ├────────────┤           └─────────────────────►├────────────┤       │
│ │ AC-3       ├─────────────────────────────────►│ A.9.4.2    │       │
│ ├────────────┤  (intersects-with: 🟡 Yellow)     └────────────┘       │
│ │ Unmapped   │                                  ┌────────────┐       │
│ │ (PE-2...)  ├─── ✕ (Red Dashed Link)           │ Unmapped   │       │
│ └────────────┘                                  │ (A.18.1..) │       │
│                                                 └────────────┘       │
└────────────────────────────────────────────────────────────────────────┘
```

**Sankey Architecture & Interactions:**
- **Layout Topology:** 3-column structural layout — Source controls on the left column, Target controls on the right column, and central SVG Bézier curve flow links connecting corresponding controls.
- **Bézier Path Calculation:** Curved flow links calculated via React SVG cubic Bézier paths.
- **Color-Coded Relationship Flows:** Flow paths color-coded according to the relationship palette defined in Section 2 (`equal-to`: purple, `equivalent-to`: green, `subset-of`: blue, `superset-of`: orange, `intersects-with`: yellow, `no-relationship`: red) using `STATUS_CONFIG['mapping-relationship']`.
- **Unmapped Control Gap Sections:** Unmapped source and target controls are rendered in dedicated bottom gap blocks (or distinct muted nodes with dashed strokes) showing visual flow termination.
- **Interactive Highlighting & Detail Tooltips:** Hovering over a control node or flow link highlights all associated connections, dims non-selected links, and displays a floating detail card with Source Control ID, Target Control ID, Relationship type, Confidence score, Rationale, and Remarks.
- **Pure React SVG Implementation:** Built as a self-contained, lightweight React SVG component (`SankeyDiagram.tsx`) without external heavy graphing dependencies (avoiding D3 package bloat), guaranteeing fast initial rendering, CSS variable theme compatibility, and seamless Vitest integration.

### 5. Confidence & Coverage Display

Each mapping level (provenance, mapping, map) can carry confidence and coverage scores:

| Level | Confidence Display | Coverage Display |
|---|---|---|
| **Provenance** (document-level) | Badge in Document Overview header | Progress bar in Gap Analysis panel |
| **Mapping** (per source/target pair) | Badge in mapping card header | Progress bar in mapping detail |
| **Map** (per relationship entry) | Small badge in matrix cell tooltip | N/A |

**Confidence Rendering:**
- `high` = 🟢 badge
- `medium` = 🟡 badge
- `low` = 🔴 badge
- `unspecified` = ⬜ gray badge
- Percentage (0.0–1.0) = displayed as percent with color gradient

### 6. Qualifier Rendering

Qualifiers add constraints to relationships. They appear as **annotation badges** below the relationship indicator in the map detail card:

```
AC-2 ──[equivalent-to]── A.5.18
  ⚠ Source has-requirement (restricted): "AC-2 requires MFA which A.5.18 does not mandate"
  ⚠ Target has-incompatibility (addressable): "A.5.18 requires annual review cycle not in AC-2"
```

**Qualifier Color Coding:**
- `restricted` = 🔴 (hard constraint that may break the relationship)
- `addressable` = 🟡 (can be addressed with additional measures)
- `blocked` = ⚫ (fundamental incompatibility)

### 7. Mapping Overrides Visualization

Since `mapping` and `map` can override provenance-level `method`, `matching-rationale`, and `status`:

- When a mapping-level or map-level override differs from the provenance default, the UI displays an **override indicator** (🔄 icon) with a tooltip showing: _"Method overridden: human (provenance default) → automation (this mapping)"_
- The Document Overview shows a summary of how many mappings use overridden values vs provenance defaults.

## Consequences

- The Matrix View provides a scalable, interactive primary editor for control mappings.
- Gap Analysis is auto-calculated from resolved source/target catalogs — no manual gap tracking needed.
- Sankey flow diagram provides a high-level topological visualization of framework mapping flows alongside the fine-grained Matrix View via a seamless view toggle.
- Qualifier and confidence annotations surface relationship nuances directly in the editor.
- All visualization is client-side rendered using SVG — no server-side rendering required.
