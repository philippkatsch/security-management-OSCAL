# DD-020: Status Badge Design System

**Date:** 2026-07-27
**Status:** Proposed
**Decision Makers:** TBD

## Context
The Reposol OSCAL compliance management tool now covers 8 lifecycle stages (Catalog, Profile, Component Definition, SSP, Assessment Plan, Assessment Results, POA&M, Control Mapping). Across these stages, there are 20+ distinct status enums with colors defined ad-hoc in individual user stories. Without a central design system, the same semantic meaning (e.g., 'warning', 'in-progress') could receive different colors in different stages, leading to visual inconsistency and user confusion.

## Decisions

### 1. Unified Color Palette
Define semantic color tokens for ALL status categories across all 8 steps. Group them into these categories:

| Category | States | Steps Used |
|---|---|---|
| Document Lifecycle | draft (yellow), active (green), archived (gray), superseded (red) | 0-8 |
| Operational Status | operational (green), under-development (yellow), under-major-modification (orange), disposition (gray), other (gray) | 3, 4 |
| Implementation Status | implemented (green), partial (yellow), planned (blue), alternative (purple), not-applicable (gray) | 4, 6 |
| FIPS-199 Impact | low (green), moderate (yellow), high (red) | 4 |
| Finding Target Status | satisfied (green), not-satisfied (red) | 6, 7 |
| Traceability Status | satisfied (green), not-satisfied (red), in-progress (yellow), not-assessed (gray) | 0 |
| Risk Status | open (red), investigating (orange), remediating (yellow), deviation-requested (purple), deviation-approved (blue), closed (green) | 6, 7 |
| Remediation Lifecycle | recommendation (blue), planned (yellow), completed (green) | 6, 7 |
| Mapping Relationship | equal-to (purple), equivalent-to (green), subset-of (blue), superset-of (orange), intersects-with (yellow), no-relationship (red) | 8 |
| Confidence | high (green), medium (yellow), low (red), unspecified (gray) | 8 |
| Collection Status | complete (green), not-complete (yellow), draft (blue), deprecated (orange), superseded (red) | 8 |
| Assessment Method | EXAMINE (blue), INTERVIEW (green), TEST (orange), UNKNOWN (gray) | 5, 6 |

### 2. Reusable StatusBadge Component
- Single React component: `StatusBadge.jsx` in `components/shared/status/`
- Props: `category` (string enum), `value` (string), `size` ('sm'|'md'|'lg'), `showIcon` (boolean)
- Renders pill/badge with background color, text color, and optional icon
- Configuration-driven: color mapping defined in `statusConfig.js`, NOT hardcoded in component

### 3. CSS Design Tokens
- All colors as CSS custom properties in `tokens.css`
- Use HSL color space for easy dark mode derivation
- Naming convention: `--status-{category}-{value}` (e.g., `--status-risk-open: hsl(0, 72%, 51%)`)
- Text contrast: `--status-{category}-{value}-text` for accessible text on colored backgrounds
- Dark mode: `--status-{category}-{value}-dark` variants using `prefers-color-scheme: dark` media query

### 4. Extended Icon Taxonomy
Expand DD-011's 4-icon system to cover all stages:
- 🏷️ Properties (DD-011)
- ⚙️ Parameters (DD-011)
- 🔧 Advanced Settings (DD-011)
- ℹ️ Metadata (DD-011)
- 📋 Assessment (AP, AR)
- 🎯 Finding (target status)
- ⚠️ Risk (risk lifecycle)
- 🔄 Remediation (remediation lifecycle)
- 📊 Dashboard/Analytics
- 🗺️ Mapping (relationships)
- 🔗 Cross-Reference (imports/links)
- 📝 Document (lifecycle)

### 5. Accessibility
- WCAG AA minimum contrast ratio (4.5:1 for normal text, 3:1 for large text)
- Color-blind-safe: every badge includes text label + optional icon, never color-only
- Focus ring on interactive badges: `outline: 2px solid var(--color-focus)` with `outline-offset: 2px`

### 6. Badge Rendering Variants
- **Pill Badge**: Default, rounded-full background with text (used in tables, cards)
- **Dot + Label**: Small colored dot + text label (used in compact list views)
- **Full-Width Status Bar**: Colored top border on cards (used in detail panels)
- **Metric Card Accent**: Left border color on metric cards (used in dashboards)

## Consequences
- Visual consistency guaranteed across all 8 stages
- Adding new status values only requires updating `statusConfig.js` and `tokens.css`
- DD-017's `RiskStatusBadge` becomes a thin wrapper around the universal `StatusBadge`
- Dark mode support is built-in from day one via HSL token derivation
- Breaking change: existing ad-hoc color definitions in user stories are superseded by this DD

## Cross-References
- DD-011 (Properties vs Parameters icon taxonomy — extended here)
- DD-017 (Risk lifecycle status badges — defined as `RiskStatusBadge`, now unified into `StatusBadge`)
- DD-019 (Mapping relationship colors — now centralized here)
- DD-022 (Dashboard components use these color tokens)
