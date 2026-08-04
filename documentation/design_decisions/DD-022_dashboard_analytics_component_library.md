# DD-022: Dashboard & Analytics Component Library

**Date:** 2026-07-27
**Status:** Proposed
**Decision Makers:** Technical Leadership, Frontend Team

## Context
Across all 8 OSCAL lifecycle stages, 22 distinct dashboard and analytics views have been identified in the user stories. These include metric cards, progress bars, status breakdowns, timeline visualizations, heat maps, comparison views, completeness reports, and node graphs. Without a shared component library, each step will reinvent these widgets with inconsistent styling, behavior, and responsive design.

## Decisions

### 1. Component Catalog
All dashboard components live in `components/shared/dashboard/`. Each component uses DD-020 color tokens for consistent styling.

| Component | Description | Used In Steps |
|---|---|---|
| `MetricCard` | Count + label + optional trend arrow (↑↓) + accent color border | 0, 1, 2, 3, 4, 5, 6, 7 |
| `MetricCardGrid` | Responsive grid layout for multiple MetricCards (auto-fit, min 200px) | 0, 1, 2, 3, 4, 5, 6, 7 |
| `ProgressBar` | Percentage bar with color stages (green→yellow→red thresholds) + label | 4, 7 |
| `StatusBreakdown` | Horizontal stacked bar or grouped counts showing items per status | 4, 6, 7 |
| `TimelineView` | Horizontal Gantt-style task/event timeline with bars + diamond milestones | 5, 6, 7 |
| `HeatMap` | 2D grid (e.g., severity × status) with color intensity cells | 7 |
| `ComparisonView` | Side-by-side panels with delta indicators (↑↓ arrows, color-coded changes) | 2, 6 |
| `CompletenessReport` | Pass (✅) / Warn (⚠️) / Fail (❌) checklist with navigation links | 4, 5 |
| `CoverageBar` | 0-100% horizontal bar with color gradient + percentage label | 4, 8 |
| `TrendChart` | Simple line or bar chart for temporal metrics | 6 |
| `NodeGraph` | Interactive document lifecycle graph with clickable nodes and edges | 0 |

### 2. MetricCard API
```jsx
<MetricCard
  label="Total Controls"        // string, required
  value={142}                    // number or string, required
  icon="🎯"                     // optional emoji or SVG
  trend={{ direction: 'up', value: '+5', period: 'vs. last assessment' }} // optional
  accentColor="var(--color-primary)"  // optional, defaults to theme primary
  onClick={() => navigate('/...')}    // optional click handler for drill-down
/>
```
- Glassmorphic card styling (semi-transparent background, subtle backdrop-blur, border radius 12px)
- Hover lift effect (`transform: translateY(-2px)`, `box-shadow` increase)
- Responsive: min-width 200px, max-width 300px in grid context

### 3. ProgressBar API
```jsx
<ProgressBar
  value={72}                     // 0-100 percentage
  label="Implementation Progress" // optional label above bar
  showPercentage={true}          // show '72%' text on bar
  thresholds={[                  // color transitions
    { max: 33, color: 'var(--status-impl-planned)' },
    { max: 66, color: 'var(--status-impl-partial)' },
    { max: 100, color: 'var(--status-impl-implemented)' }
  ]}
  segments={[                    // optional segmented display
    { label: 'Implemented', value: 45, color: '...' },
    { label: 'Partial', value: 20, color: '...' },
    { label: 'Planned', value: 7, color: '...' },
  ]}
/>
```

### 4. TimelineView API
```jsx
<TimelineView
  items={[
    { id: 'task-1', type: 'action', title: 'Vulnerability Scan', start: '2026-03-01', end: '2026-03-15', status: 'completed' },
    { id: 'task-2', type: 'milestone', title: 'Report Due', date: '2026-03-20', status: 'pending' },
  ]}
  dependencies={[
    { from: 'task-1', to: 'task-2' }  // rendered as arrow
  ]}
  onItemClick={(item) => openDetail(item.id)}
/>
```
- Action items rendered as horizontal bars spanning date range
- Milestone items rendered as diamond (◆) markers
- Dependencies rendered as curved SVG arrows connecting items
- Horizontal scrolling for long timelines, pinch-to-zoom on touch
- Overdue items highlighted with red pulsing border (DD-020 overdue indicator)

### 5. CompletenessReport API
```jsx
<CompletenessReport
  title="Assessment Plan Completeness"
  sections={[
    { name: 'Objective Coverage', status: 'pass', message: 'All 45 controls have objectives', link: '#objectives' },
    { name: 'Task-Activity Linkage', status: 'warn', message: '2 tasks have no activities', link: '#tasks', count: 2 },
    { name: 'Subject Resolution', status: 'fail', message: '3 subjects reference missing components', link: '#subjects', count: 3 },
  ]}
  onNavigate={(link) => scrollToSection(link)}
/>
```
- Status icons: ✅ pass (green), ⚠️ warn (yellow), ❌ fail (red)
- Clickable rows navigate to relevant section
- Summary line at top: 'X passed, Y warnings, Z failures'

### 6. HeatMap API
```jsx
<HeatMap
  xAxis={{ label: 'Status', values: ['open', 'investigating', 'remediating', 'closed'] }}
  yAxis={{ label: 'Severity', values: ['Critical', 'High', 'Medium', 'Low'] }}
  data={[
    { x: 'open', y: 'Critical', value: 3 },
    { x: 'open', y: 'High', value: 7 },
    // ...
  ]}
  colorScale={[
    { max: 0, color: 'var(--color-surface)' },
    { max: 3, color: 'hsl(45, 90%, 60%)' },
    { max: 7, color: 'hsl(25, 90%, 50%)' },
    { max: 99, color: 'hsl(0, 80%, 45%)' }
  ]}
  onCellClick={(cell) => filterRisks(cell.x, cell.y)}
/>
```
- CSS Grid-based rendering (no charting library needed)
- Cell shows numeric count, colored by intensity
- Click cell to filter the entity list below

### 7. Charting Strategy
- **No external charting library by default.** MetricCard, ProgressBar, StatusBreakdown, HeatMap, CoverageBar, and CompletenessReport are all implementable with pure CSS/HTML.
- **SVG-based rendering** for TimelineView (dependency arrows), NodeGraph (lifecycle diagram), and TrendChart.
- **If complexity demands it**, a lightweight library (Recharts ~50KB gzipped, or lightweight Plotly.js subset) can be introduced later. This DD does NOT mandate a library — it mandates the component API contracts.

### 8. Responsive Design
- MetricCardGrid uses CSS Grid with `auto-fit` and `minmax(200px, 1fr)`
- Dashboard sections collapse to single-column on viewport < 768px
- TimelineView switches from horizontal to vertical layout on mobile
- HeatMap adds horizontal scroll for many columns

### 9. Dashboard Section Layout
Every dashboard/overview page follows a standard section layout:
1. **Hero Banner** — Document title, type badge, lifecycle status (DD-020), quick-action buttons
2. **MetricCardGrid** — 3-5 metric cards summarizing key numbers
3. **StatusBreakdown** — Visual breakdown by primary status dimension
4. **Detail Sections** — Entity-specific content (tables, timelines, charts)
5. **CompletenessReport** — Optional validation summary at bottom

## Consequences
- 22 dashboard views across 8 stages share identical styling and behavior
- Adding a new dashboard only requires composing existing components
- No external charting library dependency for the core component set
- Consistent responsive behavior across all dashboard views
- Performance: CSS Grid and pure HTML/SVG rendering avoids JavaScript-heavy chart libraries

## Cross-References
- DD-020 (Status Badge Design System): All dashboard components use DD-020 color tokens
- DD-021 (Entity List-Detail Pattern): Dashboard views often sit above entity tables as a summary header
- DD-004 (Editor UX): Dashboard views are read-only; clicking metric cards navigates to editable entity views
