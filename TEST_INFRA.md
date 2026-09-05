# E2E Test Infra: Step 4 NIST OSCAL System Security Plan (SSP) Builder

## Test Philosophy
- Opaque-box, requirement-driven. Derives from user requirements and acceptance criteria in `ORIGINAL_REQUEST.md` and `documentation/user_stories/step4_ssp_builder.md` (US 4.1 – US 4.26).
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 (Feature Coverage) | Tier 2 (Boundary & Corner) | Tier 3 (Cross-Feature) |
|---|---------|---------------------|:-------------------------:|:--------------------------:|:----------------------:|
| 1 | System Identity & System IDs | US 4.1, US 4.3 | ✓ | ✓ | ✓ |
| 2 | System Operational Status & Remarks | US 4.6 | ✓ | ✓ | ✓ |
| 3 | SP 800-60 Info Types & CIA Categorization | US 4.4 | ✓ | ✓ | ✓ |
| 4 | FIPS-199 High-Water Mark Calculation & Suggestion | US 4.5 | ✓ | ✓ | ✓ |
| 5 | Authorization Boundary & Diagram Base64 Embedding | US 4.7, US 4.8 | ✓ | ✓ | ✓ |
| 6 | Standard Property Palette (Cloud / Assurance) | US 4.2, US 4.9 | ✓ | ✓ | ✓ |
| 7 | System Components CRUD & `this-system` Root | US 4.10, US 4.11 | ✓ | ✓ | ✓ |
| 8 | System Users & Authorized Privilege Matrix | US 4.12 | ✓ | ✓ | ✓ |
| 9 | Leveraged Authorizations (CSPs) | US 4.13 | ✓ | ✓ | ✓ |
| 10 | Managed Inventory Items Asset Tracking | US 4.14 | ✓ | ✓ | ✓ |
| 11 | Baseline Profile/Catalog Selection & Resolution | US 4.2, US 4.15 | ✓ | ✓ | ✓ |
| 12 | Implemented Requirements & By-Components Editor | US 4.15, US 4.16 | ✓ | ✓ | ✓ |
| 13 | Statement-Level Implementation Mappings | US 4.17, US 4.18 | ✓ | ✓ | ✓ |
| 14 | 4-Tier Parameter Cascade Visualizer & Overrides | US 4.19 | ✓ | ✓ | ✓ |
| 15 | Symmetric Security Inheritance (Consumer / Provider) | US 4.20 | ✓ | ✓ | ✓ |
| 16 | Document Overview, Back-Matter & Mode Toggle | US 4.21, US 4.22, US 4.23 | ✓ | ✓ | ✓ |

## Test Architecture
- **E2E Test Runner**: Playwright (`npx playwright test step4-ssp-builder.spec.ts` in `reposol/e2e/` with conda `darkspell`)
- **Unit & Integration Runner**: Vitest (`npm test` in `reposol/frontend`) & Pytest (`pytest` in `reposol/backend` with conda `darkspell`)
- **Credentials**: `reposol/backend/tests/credentials.md`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Enterprise Cloud Platform FedRAMP Moderate SSP Workflow | F1–F7, F11, F12, F14, F16 | High |
| 2 | Common Control Provider (CSP) Capability Export | F7, F9, F12, F15 | High |
| 3 | Hybrid Cloud Infrastructure & Microservices Architecture | F1, F5, F7, F8, F10, F13 | High |
| 4 | Multi-Tier Parameter Cascade Customization & Verification | F11, F12, F14 | Medium |
| 5 | Full Lifecycle Create -> Edit -> Persist -> Reload -> Validate | F1–F16 | High |

## Coverage Thresholds
- Tier 1: Feature coverage across all 16 core SSP subsystems
- Tier 2: Boundary conditions, remarks validation, empty array purging, conflict banners
- Tier 3: Cross-feature combinations (Profile import, Component binding, Diagrams, Inheritance)
- Tier 4: Real-world FedRAMP Moderate & NIST SP 800-53 Rev 5 application workflows
