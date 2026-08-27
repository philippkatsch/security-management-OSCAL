# Project: OSCAL Knowledge Base Overhaul (Master-Detail Architecture)

## Architecture
The Knowledge Base portal (`/knowledge-base` and `/guide`) is refactored into a high-performance, interactive Master-Detail documentation and guidance portal covering all 8 stages of the NIST OSCAL compliance and audit lifecycle.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: Title, Search Input, Quick Category Filters, Active View Badges               │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│ Master Navigation Rail        │ Dynamic Active Detail Container                        │
│ ┌───────────────────────────┐ │ ┌────────────────────────────────────────────────────┐ │
│ │ 🌐 Global Overview        │ │ │ [Global Overview View]                             │ │
│ │ 📊 Action Matrix          │ │ │ - Cross-Stage Mental Model Comparison              │ │
│ │ 🔄 Profile Lifecycle Flow │ │ │ - 8-Step Lifecycle Roadmap & Architecture Flow      │ │
│ │                           │ │ │ - Core Governance & Mutation Principles            │ │
│ │ ─── 8 OSCAL STAGES ───    │ │ └────────────────────────────────────────────────────┘ │
│ │ 📖 1. Catalogs            │ │ OR                                                   │ │
│ │ ⚙️ 2. Profiles            │ │ ┌────────────────────────────────────────────────────┐ │
│ │ 🧱 3. Component Defs      │ │ │ [Stage Detail View: e.g. Step 2 Profiles]          │ │
│ │ 📋 4. SSPs                │ │ │ - Purpose, Scope & Mutation Model (Overlay)        │ │
│ │ 📅 5. Assessment Plans    │ │ │ - Sequential Operational Phases (1.Import 2.Merge) │ │
│ │ ✅ 6. Assessment Results  │ │ │ - NIST OSCAL 1.1.0 Directives & JSON Schemas       │ │
│ │ ⚠️ 7. POA&Ms              │ │ │ - Reposol Web Features & UI Capabilities Matrix    │ │
│ │ 🔗 8. Control Mappings    │ │ └────────────────────────────────────────────────────┘ │
│ └───────────────────────────┘ │                                                        │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

### Routing & URL State Synchronization
- `useSearchParams` hook binds active views and filters directly to browser query parameters:
  - `view`: `'overview' | 'stage' | 'matrix' | 'flow'` (default: `'overview'`)
  - `stage`: `'catalogs' | 'profiles' | 'component-definitions' | 'ssps' | 'assessment-plans' | 'assessment-results' | 'poams' | 'control-mappings'`
  - `q`: Search query string
- Fully preserves deep linking and browser back/forward navigation history.

### Data Layer Design
- Typed data records isolated in `src/components/knowledge-base/data/`:
  - `kbStageData.ts`: 8 stage definitions with metadata, operational phases, JSON directives, and feature guides.
  - `kbActionMatrixData.ts`: Comprehensive action comparison matrix rows across stages.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Master-Detail Stage Sidebar Navigation Rail | Left sidebar with stage icons, stage badges, category grouping, and active selection state | M2 | User Request R1 |
| 2 | Stage 1: Catalogs Deep-Dive Guide | Purpose, direct mutation model, 6 operational phases, NIST OSCAL JSON schemas, Reposol feature guide | M1 | User Request R2 |
| 3 | Stage 2: Profiles Deep-Dive Guide | Non-destructive overlay model, 3-phase resolution (Import->Merge->Modify), alters/params syntax, Reposol feature guide | M1 | User Request R2 |
| 4 | Stage 3: Component Definitions Deep-Dive Guide | Reusable inventory model, 11 OSCAL types, capability mappings, protocol/port ranges, Reposol feature guide | M1 | User Request R2 |
| 5 | Stage 4: SSPs Deep-Dive Guide | Concrete system instantiation, FIPS-199 categorization, component allocation, parameter cascades, Reposol feature guide | M1 | User Request R2 |
| 6 | Stage 5: Assessment Plans Deep-Dive Guide | Audit blueprint, reviewed controls, subjects/assets, task milestones, terms & conditions, Reposol feature guide | M1 | User Request R2 |
| 7 | Stage 6: Assessment Results Deep-Dive Guide | Findings ledger, satisfied/not-satisfied states, CVSS risk characterizations, multi-session tracking, Reposol feature guide | M1 | User Request R2 |
| 8 | Stage 7: POA&Ms Deep-Dive Guide | Remediation lifecycle, AR findings 1-click import, deviation dispositions, risk log history, Reposol feature guide | M1 | User Request R2 |
| 9 | Stage 8: Control Mappings Deep-Dive Guide | Crosswalk models, 6 relationship tokens, qualifiers, gap analysis, Sankey & Matrix visualizers, Reposol feature guide | M1 | User Request R2 |
| 10 | Global Overview & Mental Model Roadmap | Multi-stage lifecycle flow, mutation vs overlay vs inventory models, high-level comparison cards | M2 | User Request R1 |
| 11 | Comprehensive Action Comparison Matrix | Searchable comparison matrix detailing actions (add, delete, reorder, modify, withdraw) across stages | M2 | User Request R1 |
| 12 | Profile 3-Phase Resolution Dedicated View | Visual step-by-step breakdown of Import, Merge, and Modify resolution phases with deep insights | M2 | User Request R1 |
| 13 | Real-Time Cross-Portal Search & Filtering | Live search input filtering stage guides, phase cards, JSON directives, and action items | M2 | User Request R3 |
| 14 | URL Deep-Linking & Browser Query Sync | Synchronize `?view=...`, `?stage=...`, `?q=...` with browser history and address bar | M2 | User Request R3 |
| 15 | Design Decision & Architecture Sync (DD-033) | Update DD-033 in `documentation/design_decisions/` and US 0.32 in `documentation/user_stories/` | M3 | User Request R4 |
| 16 | Vitest Unit & Integration Test Suite | Comprehensive unit tests verifying rendering, sidebar selection, search filtering, phase deep-dives, URL sync | M4 | User Request R4 |
| 17 | Clean Build & Test Verification Gate | Execute `npm test` and `npm run build` to verify 100% pass rate with zero errors | M4 | User Request R4 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Data Layer: 8-Stage Knowledge Base Data Models | Create `kbStageData.ts` and `kbActionMatrixData.ts` with complete domain content for all 8 stages, operational phases, JSON schemas, and feature guides | none | DONE |
| M2 | UI Components & Master-Detail Navigation | Implement `KnowledgeBaseSidebar`, `StageDetailView`, `GlobalOverviewView`, `ActionMatrixView`, `ProfileLifecycleView`, `KnowledgeBasePage.tsx`, and CSS Modules | M1 | DONE |
| M3 | Documentation & Design Decision Alignment | Update `DD-033_oscal_knowledge_base_and_tailoring_semantics.md` and `step0_global_requirements.md` (US 0.32) | none | DONE |
| M4 | Test Suite, Verification & Final Audit | Expand Vitest test suite `KnowledgeBasePage.test.tsx`, run full test suite, verify clean build, execute Forensic Audit | M2, M3 | IN_PROGRESS |

---

## Interface Contracts

### Data Model Contract (`src/components/knowledge-base/data/kbStageData.ts`)
```typescript
export type OscalStageId = 
  | 'catalogs'
  | 'profiles'
  | 'component-definitions'
  | 'ssps'
  | 'assessment-plans'
  | 'assessment-results'
  | 'poams'
  | 'control-mappings';

export interface OperationalPhase {
  phaseNumber: number;
  title: string;
  subtitle?: string;
  scope: string;
  description: string;
  directives: { name: string; syntax: string; explanation: string }[];
  caveatOrTip?: string;
}

export interface JsonExample {
  title: string;
  description: string;
  jsonCode: string;
}

export interface ReposolFeatureGuide {
  title: string;
  description: string;
  icon: string;
  capabilities: string[];
}

export interface OscalStageGuide {
  id: OscalStageId;
  stepNumber: number;
  title: string;
  label: string;
  icon: string;
  badgeLabel: string;
  mutationBehavior: 'Direct Data Mutation' | 'Non-Destructive Overlay' | 'Architecture Inventory' | 'System Implementation' | 'Audit Planning' | 'Audit Execution & Findings' | 'Remediation Lifecycle' | 'Cross-Framework Crosswalk';
  badgeStyle: 'mutation' | 'overlay' | 'inventory' | 'impl' | 'plan' | 'results' | 'poam' | 'mapping';
  foundationalPurpose: string;
  scope: string;
  keyResponsibilities: string[];
  operationalPhases: OperationalPhase[];
  jsonExamples: JsonExample[];
  reposolFeatures: ReposolFeatureGuide[];
}
```

### Action Matrix Contract (`src/components/knowledge-base/data/kbActionMatrixData.ts`)
```typescript
export interface ActionComparisonItem {
  id: string;
  action: string;
  catalogBehavior: string;
  profileBehavior: string;
  sspBehavior?: string;
  oscalMechanism: string;
  practicalTip: string;
  category: 'content' | 'hierarchy' | 'parameters' | 'status';
}
```

---

## Code Layout
- `reposol/frontend/src/components/knowledge-base/`
  - `data/kbStageData.ts` (Stage domain data for steps 1-8)
  - `data/kbActionMatrixData.ts` (Action matrix comparison data)
  - `views/GlobalOverviewView.tsx` (Global roadmap & mental models)
  - `views/StageDetailView.tsx` (Stage deep dive view)
  - `views/ActionMatrixView.tsx` (Interactive comparison matrix)
  - `views/ProfileLifecycleView.tsx` (3-phase resolution view)
  - `KnowledgeBaseSidebar.tsx` (Master navigation rail)
  - `KnowledgeBasePage.tsx` (Main shell with search & URL query state)
  - `KnowledgeBasePage.module.css` (CSS module styles)
- `reposol/frontend/src/tests/components/`
  - `KnowledgeBasePage.test.tsx` (Vitest unit & integration tests)
- `documentation/design_decisions/`
  - `DD-033_oscal_knowledge_base_and_tailoring_semantics.md` (Architecture decision record)
- `documentation/user_stories/`
  - `step0_global_requirements.md` (US 0.32 acceptance criteria)
