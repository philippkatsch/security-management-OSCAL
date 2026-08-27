# E2E Test Infra: Stage 2 Profile Custom Grouping & Control Assignment

## Test Philosophy
- Opaque-box, requirement-driven. Derives from user requirements and acceptance criteria in `ORIGINAL_REQUEST.md`.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 (Feature Coverage) | Tier 2 (Boundary & Corner) | Tier 3 (Cross-Feature) |
|---|---------|---------------------|:-------------------------:|:--------------------------:|:----------------------:|
| 1 | Create Custom Group (+ button & context menu) | R1 | 5 | 5 | ✓ |
| 2 | Edit Custom Group Title & ID Inline | R1 | 5 | 5 | ✓ |
| 3 | Nest Custom Groups (Sub-groups) | R1 | 5 | 5 | ✓ |
| 4 | Delete Custom Group with Reassignment | R1 | 5 | 5 | ✓ |
| 5 | Virtual "📥 Unassigned Controls" Tree Node | R2 | 5 | 5 | ✓ |
| 6 | Tree Drag-and-Drop Control Assignment | R2 | 5 | 5 | ✓ |
| 7 | Control Pool Tab Grid Filter & Search | R2 | 5 | 5 | ✓ |
| 8 | Control Pool Grid Drag-and-Drop Assignment | R2 | 5 | 5 | ✓ |
| 9 | Unassign Control (Return to Pool) | R2 | 5 | 5 | ✓ |
| 10 | OSCAL Profile v1.1.2 Serialization | R3 | 5 | 5 | ✓ |
| 11 | Live Preview Resolution Sync (<500ms) | R3 | 5 | 5 | ✓ |
| 12 | Virtual Node Exclusion from Export/JSON | R3 | 5 | 5 | ✓ |

## Test Architecture
- **E2E Test Runner**: Playwright (`npx playwright test` in `reposol/frontend`)
- **Unit & Integration Runner**: Vitest (`npm test` in `reposol/frontend`) & Pytest (`pytest` in `reposol/backend` with conda `darkspell`)
- **Credentials**: `reposol/backend/tests/credentials.md`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | NIST 800-53 Baseline Restructuring into Domain Categories | F1, F2, F3, F5, F6, F8, F10, F11 | High |
| 2 | Multi-Catalog Import with Custom Governance Hierarchy | F1, F3, F4, F7, F8, F9, F10, F11 | High |
| 3 | Fast Re-organization via Sidebar Tree DnD & Inline Renaming | F1, F2, F5, F6, F9, F11, F12 | Medium |
| 4 | Bulk Assignment from Filtered Control Pool Grid | F1, F5, F7, F8, F9, F10, F11 | Medium |
| 5 | Group Deletion, Control Re-pooling and Re-assignment | F1, F3, F4, F5, F6, F9, F10 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature (60 test cases across 12 features)
- Tier 2: ≥5 per feature (60 test cases for boundary conditions)
- Tier 3: Pairwise combinations of major interactions (12 tests)
- Tier 4: ≥5 realistic end-to-end application scenarios
- Tier 5: Adversarial edge cases and coverage hardening
