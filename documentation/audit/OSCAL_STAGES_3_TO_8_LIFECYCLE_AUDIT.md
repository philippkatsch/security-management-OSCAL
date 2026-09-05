# Consolidated Cross-Stage Lifecycle Audit & Traceability Report: NIST OSCAL Stages 3 through 8

**Document Identifier:** `AUDIT-OSCAL-LIFECYCLE-STAGES-3-8`  
**Standard Baseline:** NIST OSCAL v1.2.2 JSON Specifications & Metaschemas  
**System Under Audit:** Reposol OSCAL Security Management Platform  
**Audit Scope:** Stages 3 through 8 (Component Definition, SSP, Assessment Plan, Assessment Results, POA&M, Control Mapping)  
**Date of Issue:** 2026-09-05  
**Audit Author:** Worker M4-1 (Consolidated Lifecycle Audit & Traceability Lead)  
**Contributing Audit Records:**
- Specification Miner Handoff (`.agents/spec_miner_m1_1/handoff.md`)
- Stages 3–5 Codebase & Spec Explorer Handoff (`.agents/explorer_m1_2/handoff.md`)
- Stages 6–8 Codebase & Spec Explorer Handoff (`.agents/explorer_m1_3/handoff.md`)
- Stages 3–5 User Story Elevation Report (`.agents/worker_m2_1/handoff.md`)
- Stages 6–8 User Story Elevation Report (`.agents/worker_m3_1/handoff.md`)
- Elevated User Stories (`documentation/user_stories/step1_catalog_builder.md` through `step8_control_mapping.md`)

---

## 1. Executive Summary

### 1.1 Purpose & Strategic Context
Reposol is an enterprise-grade compliance governance platform built upon the official National Institute of Standards and Technology (NIST) Open Security Controls Assessment Language (OSCAL) v1.2.2 standard. The overarching objective of the platform is to support the complete continuous compliance and assurance lifecycle: from the authoring of canonical control catalogs and tailored security baselines, to component-level capability definitions, system security plans, assessment plans, evidence-grounded assessment results, remediation tracking via plans of action and milestones (POA&M), and bidirectional cross-framework control mappings.

This authoritative audit report delivers a rigorous, consolidated forensic evaluation of the data architecture, schema compliance, cross-stage traceability, and operational user workflows across Stages 3 through 8. It evaluates the alignment of the existing codebase against the official NIST OSCAL schemas, synthesizes all findings from the multi-worker audit pipeline, documents all discovered lifecycle disconnects alongside their resolved user story specifications, analyzes schema invariants and backend validation gaps, provides an actionable engineering backlog, and attests to the health and regression readiness of the repository test suites.

### 1.2 Status of NIST OSCAL v1.2.2 Alignment Across Stages 3–8
Across Stages 3 through 8, Reposol demonstrates strong structural foundations while exhibiting distinct levels of maturity and integration:

| Stage | Model Name | Root Key | Backend CRUD & Schema Validation | Backend Semantic Integrity | Frontend UI Architecture | Document Actions (DD-029) | Lifecycle Integration Status |
|---|---|---|---|---|---|---|---|
| **Stage 3** | Component Definition | `component-definition` | ✅ Full (REST CRUD, Draft-7) | ❌ Missing (`_validate_component_integrity` absent) | ✅ Modular (6 tabs, Property Palette) | ⚠️ Exists in `actions.ts` but bypassed in `ComponentPage.tsx` | ⚠️ Disconnect: Control implementations dropped on SSP import (DISC-01); UUID lineage lost (DISC-02) |
| **Stage 4** | System Security Plan (SSP) | `system-security-plan` | ✅ Full (6 root assemblies mandatory) | ⚠️ Partial (`_validate_ssp_integrity` exists; baseline control membership unchecked) | ✅ Advanced (Overview, SysChars, SysImpl, CtrlImpl, UnifiedEditor) | ✅ Full (`ssp-actions.ts` integrated) | ⚠️ Disconnect: Parameter validation ignores baseline constraints; control membership unchecked (DISC-04) |
| **Stage 5** | Assessment Plan (AP) | `assessment-plan` | ✅ Full (REST CRUD, DAG cycle check) | ✅ High (`_validate_ap_integrity` enforces DAG DFS, method enums, 7 terms parts) | ✅ Advanced (6-tab builder, Gantt timeline, SSP browser) | ✅ Full (`assessment-plan-actions.ts` integrated) | ⚠️ Disconnect: Synthetic statement IDs stubbed in UI (`_smt_a..d`, DISC-05); subjects omit locations/parties (DISC-06) |
| **Stage 6** | Assessment Results (AR) | `assessment-results` | ✅ Full (Nested `results[]`, CRUD) | ✅ High (`_validate_ar_integrity` enforces Triad linkage, target semantics, AP href) | ✅ Advanced (4-tab layout, 7 sub-tabs, risk modals, CVSS facets) | ✅ Full (`assessment-results-actions.ts` integrated) | ⚠️ Disconnect: Missing resolution preview endpoint; stubbed row clicks in assessment log tables |
| **Stage 7** | Plan of Action & Milestones (POA&M) | `plan-of-action-and-milestones` | ✅ Full (REST CRUD, bridge ingestion) | ❌ Missing (`_validate_poam_integrity` absent) | ⚠️ Incomplete (Missing Findings & Local Definitions tabs; reuses `POAMItemsEditor` for risks/observations) | ❌ Basic (Only 5 functions in `poam-actions.ts`) | ✅ Pipeline: Functional bridge endpoint ingests AR findings; ⚠️ UI lacks dedicated observation/risk editors |
| **Stage 8** | Control Mapping Collection | `mapping-collection` | ✅ Full (REST CRUD, Draft-7) | ❌ Missing (`_validate_mapping_integrity` absent) | ⚠️ Monolithic (1,005 lines; fake `props` injection; invalid enums; missing `no-relationship`) | ❌ Absent (No `mapping-actions.ts`; direct mutation) | ⚠️ Disconnect: Hardcoded to `mappings[0]`; non-standard methodology properties; corrupted types in `oscal.d.ts` |

### 1.3 User Story Elevation Effort & Benchmark Standardization
Prior to this audit, a significant disparity existed in the repository documentation:
- **Benchmark Gold Standard (Stages 1 & 2):** `step1_catalog_builder.md` (305 lines) and `step2_profile_tailoring.md` (413 lines) established a strict 5-part architecture:
  1. Header Block: Persona, Goal, and Lifecycle Position.
  2. Section 1 Breakdown of User Stories: Agile triads, exact schema keys formatted in backticks, dual-state (View `👁️ View` vs Edit `✏️ Edit`) UI dynamics, badge styling, autocomplete rules, and empty-array pruning (`minItems: 1`).
  3. Section 2 Practitioner's Detailed Workflow & User Journey: Concrete, realistic compliance scenarios featuring real frameworks, controls, parameter tokens, CVEs, and CVSS scores.
  4. Section 3 Functional Requirements for the System: Architectural guarantees and schema constraints.
  5. Section 4 Functional Acceptance Criteria Summary Checklist: Comprehensive checklist format.
- **Stages 7 & 8 Pre-Elevation Outlines:** `step7_poam.md` (222 lines) and `step8_control_mapping.md` (210 lines) were high-level outlines lacking granular acceptance criteria, field schemas, concrete user journeys, and verification checklists.
- **Stages 3–5 Pre-Elevation Status:** Required structural alignment, formal lifecycle positioning, resolution of lifecycle disconnects (DISC-01 to DISC-07), and integration of full practitioner journeys.

**Elevation Outcome:**
All six user story specifications (Stages 3 through 8) were rewritten or elevated to the gold-standard benchmark. The documentation suite across all 8 stages now comprises over 4,300 lines of rigorous specifications:
- `step0_global_requirements.md`: 397 lines (45,776 bytes)
- `step1_catalog_builder.md`: 305 lines (35,660 bytes) — Gold Standard Benchmark
- `step2_profile_tailoring.md`: 413 lines (48,145 bytes) — Gold Standard Benchmark
- `step3_component_inventory.md`: 573 lines (53,054 bytes) — 20 detailed user stories (US 3.1–3.20)
- `step4_ssp_builder.md`: 654 lines (54,553 bytes) — 26 detailed user stories (US 4.1–4.26)
- `step5_assessment_plan.md`: 563 lines (47,057 bytes) — 19 detailed user stories (US 5.1–5.19)
- `step6_assessment_results.md`: 450 lines (43,163 bytes) — 17 detailed user stories (US 6.1–6.17)
- `step7_poam.md`: 480 lines (42,751 bytes) — 21 detailed user stories (US 7.1–7.21)
- `step8_control_mapping.md`: 465 lines (41,779 bytes) — 20 detailed user stories (US 8.1–8.20)

### 1.4 Verification Baseline Summary
The repository codebase maintains high regression health across all existing test suites:
- **Backend (Pytest):** 618 passed, 1 warning in 72.17s across unit, integration, and stress test suites.
- **Frontend (Vitest):** 993 passed across 91 test files in 49.12s.
- **Production Build (Vite):** 315 modules transformed, 0 errors, 0 warnings in 6.64s.

---

## 2. End-to-End Cross-Stage Lifecycle Traceability Matrix

### 2.1 Complete Lifecycle Data Flow Architecture
The NIST OSCAL architecture models security governance as an unbroken chain of authoritative digital artifacts. Each stage ingests upstream definitions, enriches them with operational context, and publishes standardized data structures for downstream consumption:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OSCAL LIFECYCLE CHAIN                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
  [Stage 1: Catalog]
          │ (Controls, Parameters, Statements, Objectives)
          ▼
  [Stage 2: Profile] ◄───────────────────────────────────────────────────────────────────────┐
          │ (Baseline Tailoring: Imports, Set-Params, Alters, Groups)                        │
          ├─────────────────────────────────────────┐                                        │
          ▼                                         ▼                                        │
  [Stage 3: Component Def]                  [Stage 8: Control Mapping]                       │
  (Reusable Defined-Components,             (Cross-Framework Crosswalks:                     │
   Capabilities, Protocols,                  Set Theory Relationships, Qualifiers,           │
   Control Implementations)                  Provenance, Bidirectional Gap Summaries)        │
          │                                         │                                        │
          │ (Component Templates,                   │ (Cross-Framework Mappings)             │
          │  Baseline Controls)                     │                                        │
          ▼                                         │                                        │
  [Stage 4: System Security Plan (SSP)] ◄───────────┘                                        │
  (System Characteristics, System Implementation,                                            │
   Control Implementation: By-Components, Parameter Cascade)                                │
          │                                                                                  │
          │ import-ssp                                                                       │
          ▼                                                                                  │
  [Stage 5: Assessment Plan (AP)]                                                            │
  (Scoping: Reviewed Controls, Subjects, Assets;                                             │
   Local Methods: INTERVIEW, EXAMINE, TEST; Task DAG Timeline; Canonical Terms)             │
          │                                                                                  │
          │ import-ap                                                                        │
          ▼                                                                                  │
  [Stage 6: Assessment Results (AR)]                                                         │
  (Execution Findings, Evidence Observations,                                                │
   Risk Register with CVSS Facets & Remediations; Attestations)                              │
          │                                                                                  │
          │ import-findings (Bridge Pipeline: POST /api/documents/poams/.../import-findings/...)
          ▼                                                                                  │
  [Stage 7: Plan of Action & Milestones (POA&M)] ────────────────────────────────────────────┘
  (Root Observations, Risks, Findings; Remediation POAM-Items;                               (Closes
   Continuous Monitoring & Re-Authorization Milestones)                                       Audit Loop)
```

### 2.2 Cross-Document Referencing Constructs
At the document boundary, OSCAL links stages through strict schema reference properties:

1. **`import-profile` (Stage 4 SSP ➔ Stage 2 Profile or Stage 1 Catalog):**
   - **Schema Path:** `system-security-plan.import-profile.href`
   - **Type:** `URIReferenceDatatype` (relative path `../profiles/{uuid}.json`, fragment `#{uuid}`, or HTTPS URI).
   - **Backend Resolution:** Handled by `resolve_ssp()` and `resolve_ssp_inline()` in `resolution_service.py`. Resolves baseline control hierarchy, control statements, and modifies baseline parameters. Supports direct Catalog import if an organization bypasses profile tailoring.

2. **`import-ssp` (Stage 5 AP ➔ Stage 4 SSP):**
   - **Schema Path:** `assessment-plan.import-ssp.href`
   - **Type:** `URIReferenceDatatype`.
   - **Backend Resolution:** Handled by `_run_ap_resolution_pipeline()` in `resolution_service.py`. Dynamically resolves candidate controls, components, inventory items, users, and locations within the target system boundary for assessment scoping.

3. **`import-ap` (Stage 6 AR ➔ Stage 5 AP):**
   - **Schema Path:** `assessment-results.import-ap.href`
   - **Type:** `URIReferenceDatatype`.
   - **Backend Validation:** Validated in `_validate_ar_integrity()` in `validation.py`. Ensures the referenced AP exists in the workspace or resolves to a valid resource. Establishes the expected assessment scope against which observations and findings are evaluated.

4. **`import-findings` (Stage 7 POA&M ➔ Stage 6 AR Bridge Pipeline):**
   - **API Route:** `POST /api/documents/poams/{poam_id}/import-findings/{ar_id}`
   - **Service Logic:** `import_findings_from_ar()` in `import_service.py`.
   - **Lifecycle Mechanism:** Scans the source AR for unsatisfied findings (`target.status.state == 'not-satisfied'`). Ingests them directly into root `findings[]`, copies referenced observations into root `observations[]`, copies referenced risks into root `risks[]`, and synthesizes actionable `poam-items[]` while preserving original RFC 4122 UUIDs (DD-017).

5. **`import-ssp` or `system-id` (Stage 7 POA&M ➔ Stage 4 SSP Dual Scoping):**
   - **Schema Paths:** `plan-of-action-and-milestones.import-ssp.href` OR `plan-of-action-and-milestones.system-id.id`
   - **Lifecycle Mechanism:** Binds remediation action items to the target operational system boundary, allowing both fully native OSCAL SSP links and federated system identifiers.

6. **`source-resource` and `target-resource` (Stage 8 Mapping Collection ➔ Stage 1 Catalogs / Stage 2 Profiles):**
   - **Schema Paths:** `mapping-collection.mappings[].source-resource` and `mapping-collection.mappings[].target-resource`
   - **Type:** `mapping-resource-reference` (`type`: `catalog` | `profile`, `href`: `URIReferenceDatatype`).
   - **Lifecycle Mechanism:** Binds source and target control baselines for mathematical crosswalk alignment.

7. **`import-component-definitions` (Stage 3 ➔ Stage 3 Component Composition):**
   - **Schema Path:** `component-definition.import-component-definitions[].href`
   - **Lifecycle Mechanism:** Enables modular assembly of golden component libraries across vendors and internal engineering teams.

### 2.3 Entity-Level Cross-References & Reference Bindings
Within the documents, granular entity references maintain deep audit traceability:

```
  Stage 3: defined-component (uuid: C1)
     │ control-implementations[].implemented-requirements[].statements[]
     ▼ (Instantiated into SSP via CdefImportModal)
  Stage 4: system-component (uuid: SC1) ── links[rel="imported-from", href="../component-definitions/C1"]
     │
     ├─► implemented-requirements[].by-components[component-uuid: SC1]
     │      (Narrative Prose, Implementation Status, Parameter Overrides)
     ▼
  Stage 5: assessment-plan
     ├─► reviewed-controls.control-selections[].include-controls[].control-id
     ├─► assessment-subjects.include-subjects[].subject-uuid ── points to SC1
     └─► tasks[].associated-activities[].activity-uuid ── points to local-definitions.activities[]
            │
            ▼ (Assessor Executes Assessment)
  Stage 6: assessment-results.results[].findings[]
     ├─► target.target-id ── points to control-id or statement-id
     ├─► implementation-statement-uuid ── points to SSP by-component statement
     ├─► related-observations[].observation-uuid ── points to results[].observations[]
     └─► related-risks[].risk-uuid ── points to results[].risks[]
            │
            ▼ (Bridge Ingestion Pipeline)
  Stage 7: plan-of-action-and-milestones
     ├─► findings[] ── preserves original finding UUIDs from Stage 6
     ├─► observations[] ── preserves original observation UUIDs from Stage 6
     ├─► risks[] ── preserves original risk UUIDs from Stage 6
     └─► poam-items[] ── related-findings[], related-observations[], related-risks[]
```

### 2.4 Consolidated Cross-Stage Lifecycle Traceability Matrix
The following matrix details every reference binding, cardinality, lifecycle purpose, and validation rule connecting Stages 1 through 8:

| Source Stage & Entity | Source OSCAL Path | Target Stage & Entity | Target OSCAL Path | Reference Key | Card. | Lifecycle Purpose | Validation & Integrity Rule |
|---|---|---|---|---|---|---|---|
| **Stage 1 Catalog** (Control) | `catalog.groups[].controls[].id` | **Stage 2 Profile** (Selection) | `profile.imports[].include-controls[].with-ids[]` | `control-id` string | 1:N | Tailors baseline controls for organizational compliance. | Must resolve to active control in imported Catalog. |
| **Stage 1 Catalog** (Parameter) | `catalog.controls[].params[].id` | **Stage 2 Profile** (Override) | `profile.modify.set-parameters[].param-id` | `param-id` string | 1:N | Tailors parameter constraints, default values, and choices. | Must match parameter declared on imported control. |
| **Stage 2 Profile** / **Stage 1 Catalog** | Document UUID | **Stage 3 Component Def** (Source) | `components[].control-implementations[].source` | `URIReferenceDatatype` | 1:N | Binds component implementations to authoritative standards. | Must resolve to existing workspace Catalog or Profile (DISC-03). |
| **Stage 3 Component Def** (Template) | `component-definition.components[].uuid` | **Stage 4 SSP** (System Component) | `system-implementation.components[].links[rel="imported-from"]` | `component-uuid` / URI | 1:N | Establishes golden component lineage in deployed system. | Preserves source UUID in link; tracks instantiation (DISC-02). |
| **Stage 3 Component Def** (Implementation) | `components[].control-implementations[].implemented-requirements[]` | **Stage 4 SSP** (By-Component) | `control-implementation.implemented-requirements[].by-components[]` | `component-uuid` & `control-id` | 1:N | Reuses component implementation prose and parameter overrides in SSP. | Ingests narrative into `by-components[].description` (DISC-01). |
| **Stage 2 Profile** (Baseline) | Document UUID / Href | **Stage 4 SSP** (Import Profile) | `system-security-plan.import-profile.href` | `URIReferenceDatatype` | 1:1 | Sets the compliance baseline for the system security plan. | Validated in `_validate_ssp_integrity`; must resolve to Profile/Catalog. |
| **Stage 4 SSP** (Baseline Control) | `control-implementation.implemented-requirements[].control-id` | **Stage 5 AP** (Reviewed Controls) | `reviewed-controls.control-selections[].include-controls[].control-id` | `control-id` string | 1:N | Scopes controls subject to security assessment. | Scoped controls must exist in target SSP baseline (DISC-04). |
| **Stage 4 SSP** (Statement) | `implemented-requirements[].statements[].statement-id` | **Stage 5 AP** (Statement Scoping) | `include-controls[].with-ids[]` | `statement-id` string | 1:N | Fine-grained assessment scoping of specific statement parts. | Must resolve to real statement IDs, not synthetic stubs (DISC-05). |
| **Stage 4 SSP** (System Entities) | `system-implementation.components[]`, `inventory-items[]`, `locations[]`, `metadata.parties[]` | **Stage 5 AP** (Assessment Subjects) | `assessment-subjects.include-subjects[].subject-uuid` | `UUIDDatatype` | 1:N | Binds assessment evaluation to real system targets. | Must resolve to declared components, inventory, locations, or parties (DISC-06). |
| **Stage 5 AP** (Local Activity) | `local-definitions.activities[].uuid` | **Stage 5 AP** (Task Execution) | `tasks[].associated-activities[].activity-uuid` | `UUIDDatatype` | 1:N | Associates testing procedures and steps with scheduled tasks. | Enforced in `_validate_ap_integrity`; activity must exist. |
| **Stage 5 AP** (Document) | `assessment-plan.uuid` | **Stage 6 AR** (Import AP) | `assessment-results.import-ap.href` | `URIReferenceDatatype` | 1:1 | Binds assessment findings to the authorizing Assessment Plan. | Enforced in `_validate_ar_integrity`; AP must exist. |
| **Stage 4 SSP** (Statement Impl) | `implemented-requirements[].statements[].uuid` | **Stage 6 AR** (Finding Statement) | `results[].findings[].implementation-statement-uuid` | `UUIDDatatype` | 1:N | Links finding directly to the deficient SSP implementation prose. | Must resolve to valid statement UUID in target SSP. |
| **Stage 6 AR** (Observation) | `results[].observations[].uuid` | **Stage 6 AR** (Finding Linkage) | `results[].findings[].related-observations[].observation-uuid` | `UUIDDatatype` | 1:N | Correlates factual evidence observations to audit findings. | Enforced in `_validate_ar_integrity`; observation must exist. |
| **Stage 6 AR** (Risk) | `results[].risks[].uuid` | **Stage 6 AR** (Finding Linkage) | `results[].findings[].related-risks[].risk-uuid` | `UUIDDatatype` | 1:N | Links security risk characterizations (CVSS) to audit findings. | Enforced in `_validate_ar_integrity`; risk must exist. |
| **Stage 6 AR** (Unsatisfied Finding) | `results[].findings[].uuid` | **Stage 7 POA&M** (Root Finding & POAM Item) | `plan-of-action-and-milestones.findings[].uuid` & `poam-items[].related-findings[]` | `UUIDDatatype` | 1:1 | Ingests non-compliant findings into corrective action plan. | Ingested via bridge pipeline; preserves original UUID per DD-017. |
| **Stage 6 AR** (Observation & Risk) | `results[].observations[].uuid`, `results[].risks[].uuid` | **Stage 7 POA&M** (Root Entities) | `plan-of-action-and-milestones.observations[]`, `risks[]` | `UUIDDatatype` | 1:1 | Preserves evidence and risk context in remediation register. | Ingested via bridge pipeline; preserves original UUIDs per DD-017. |
| **Stage 4 SSP** (System) | Document UUID / `system-id` | **Stage 7 POA&M** (Target System) | `plan-of-action-and-milestones.import-ssp` OR `system-id` | URI / Token | 1:1 | Scopes remediation action items to authorized system boundary. | Validated in POA&M scoping; requires either valid SSP href or system-id. |
| **Stage 1 Catalog** (Source Control) | `catalog.controls[].id` | **Stage 8 Mapping** (Source Map Item) | `mappings[].maps[].sources[].id-ref` | `control-id` string | 1:N | Designates source control in cross-framework crosswalk. | Must resolve to control in declared `source-resource`. |
| **Stage 1 Catalog** (Target Control) | `catalog.controls[].id` | **Stage 8 Mapping** (Target Map Item) | `mappings[].maps[].targets[].id-ref` | `control-id` string | 1:N | Designates target control in cross-framework crosswalk. | Must resolve to control in declared `target-resource`. |
| **Stage 8 Mapping** (Relationship) | Metaschema Enum | **Stage 8 Mapping** (Map Rule) | `mappings[].maps[].relationship` | Enum token | 1:1 | Defines mathematical set-theoretic equivalence. | Must be one of 6 canonical tokens; `no-relationship` mandatory. |

---

## 3. Discovered Lifecycle Discrepancies & Resolutions

During the multi-agent investigation, seven primary lifecycle disconnects (DISC-01 through DISC-07) and several stage-specific architectural divergences were uncovered in the codebase. This section provides the detailed forensic breakdown of each discrepancy and demonstrates how the elevated user story specifications resolve them.

### 3.1 DISC-01: Component Definition Control Implementations Dropped on SSP Import
- **Observed Code Location:** `reposol/frontend/src/components/ssp/drawers/CdefImportModal.tsx`, lines 100–116:
  ```typescript
  const importedComps: SystemComponent[] = chosen.map((c: any) => ({
    uuid: generateUUID(),
    type: c.type || 'software',
    title: c.title || 'Imported Component',
    description: c.description || c.purpose || 'Imported from Component Definition',
    purpose: c.purpose || '',
    status: { state: 'operational' },
    props: c.props ? JSON.parse(JSON.stringify(c.props)) : [],
    protocols: c.protocols ? JSON.parse(JSON.stringify(c.protocols)) : [],
    links: [
      ...(c.links || []),
      {
        rel: 'imported-from',
        href: `../component-definitions/${selectedCdefDoc['component-definition']?.uuid || selectedCdefId}.json`
      }
    ]
  }));
  ```
- **Practitioner Impact:** A security engineer authors extensive control implementation narratives, parameter overrides, and statement responses in Stage 3. When an ISSO imports this component into an SSP in Stage 4, `c['control-implementations']` is completely omitted from the mapping. All implementation narratives and parameter customizations are discarded, forcing manual re-entry and breaking automated inheritance.
- **Specification Resolution:**
  - `step3_component_inventory.md` US 3.16 and `step4_ssp_builder.md` US 4.10 explicitly mandate full control implementation preservation upon import.
  - When importing a component, the SSP builder must:
    1. Import the component into `system-implementation.components[]`.
    2. Extract all entries in `c['control-implementations']`.
    3. For each implemented requirement, locate or create the corresponding `control-implementation.implemented-requirements[control-id]`.
    4. Append a `by-components` entry referencing the imported component's UUID, copying the narrative prose into `by-components[].description` and transferring any parameter overrides into `by-components[].set-parameters[]`.

### 3.2 DISC-02: Component UUID Regeneration Breaking Golden Template Lineage
- **Observed Code Location:** `reposol/frontend/src/components/ssp/drawers/CdefImportModal.tsx`, line 101: `uuid: generateUUID()`.
- **Practitioner Impact:** When a component is imported from a Component Definition into an SSP, a random new UUID is generated without retaining a reference to the source component's original UUID. Downstream assessors in Stage 5 and auditors in Stage 6 cannot trace an instantiated `system-component` back to its golden template definition in Stage 3.
- **Specification Resolution:**
  - Resolved in `step3_component_inventory.md` US 3.16 and `step4_ssp_builder.md` US 4.10.
  - In addition to linking the parent Component Definition document in `links[rel="imported-from"]`, the imported system component must either retain its template UUID (if unique within the SSP) or inject a property `props[name="source-component-uuid", value="{original_cdef_comp_uuid}"]` with link `links[rel="source-component", href="../component-definitions/{cdef_uuid}.json#{original_cdef_comp_uuid}"]`.

### 3.3 DISC-03: Component Control Implementations Lacking Source Framework Validation
- **Observed Code Location:** `reposol/backend/app/validation.py`, lines 751–762:
  ```python
  if stage == "profiles":
      _validate_profile_integrity(document[root_key], root_key, errors)
  if stage == "ssps" and check_refs:
      await _validate_ssp_integrity(document[root_key], root_key, errors, workspace_id)
  if stage in ("assessment-plans", "assessment-plan"):
      await _validate_ap_integrity(document[root_key], root_key, errors, workspace_id, check_refs=check_refs)
  if stage in ("assessment-results", "assessment-result"):
      await _validate_ar_integrity(document[root_key], root_key, errors, workspace_id, check_refs=check_refs)
  ```
  Stage `component-definitions` has no integrity validation hook; `_validate_component_integrity` does not exist.
- **Practitioner Impact:** A component author can declare `control-implementations` referencing non-existent Catalogs or Profiles in `source`, or declare `implemented-requirements` with non-existent control IDs. The document passes Level 1 schema validation, creating corrupt component libraries that silently fail when imported into SSPs.
- **Specification Resolution:**
  - Resolved in `step3_component_inventory.md` US 3.11, US 3.12, and Section 3.
  - Mandates implementation of `_validate_component_integrity` in `validation.py` to verify:
    1. `source` URI in each `control-implementation` resolves to an existing Catalog or Profile.
    2. Each `control-id` in `implemented-requirements[]` belongs to the referenced framework.
    3. Each `component-uuid` referenced in `capabilities[].incorporates-components[]` exists within `components[]`.

### 3.4 DISC-04: SSP Implemented Requirements Lacking Baseline Control Membership Validation
- **Observed Code Location:** `reposol/backend/app/validation.py`, `_validate_ssp_integrity` lines 110–236.
- **Practitioner Impact:** `_validate_ssp_integrity` verifies that `import-profile.href` resolves and that `by-components[].component-uuid` points to a declared component. However, it **does not verify** that the controls declared in `implemented-requirements[]` are members of the resolved baseline profile or catalog. An organization can claim compliance for arbitrary, fictitious, or out-of-scope controls without triggering validation errors.
- **Specification Resolution:**
  - Resolved in `step4_ssp_builder.md` US 4.13, US 4.25, and Section 3.
  - Mandates that `_validate_ssp_integrity` invoke the baseline resolution engine to obtain the authoritative set of active baseline control IDs and raise a semantic validation error (`custom/ssp-control-not-in-baseline`) if an implemented requirement references a control outside the baseline.

### 3.5 DISC-05: Assessment Plan Scoping Using Hardcoded Synthetic Statement IDs
- **Observed Code Location:** `reposol/frontend/src/components/assessment-plan/ReviewedControlsTab.tsx`, lines 71–76:
  ```typescript
  statementIds: [
    `${cid}_smt_a`,
    `${cid}_smt_b`,
    `${cid}_smt_c`,
    `${cid}_smt_d`,
  ],
  ```
- **Practitioner Impact:** When an assessor selects a control for audit in the Assessment Plan Builder and wishes to tailor statement parts, the UI provides four synthetic dummy statements (`${cid}_smt_a..d`) regardless of the actual statement structure of the control (e.g. `ac-2` which has statements `a`, `b`, `c`, `d`, `e`, `f`, `g`, `h`, `i`, `j`, or controls with numeric parts like `ia-2(1)`). The assessor scopes fictitious statement IDs, leading to invalid assessment plans that fail downstream evaluation in Stage 6.
- **Specification Resolution:**
  - Resolved in `step5_assessment_plan.md` US 5.6 and Section 3.
  - `ReviewedControlsTab.tsx` must eliminate synthetic string templates. Instead, it must resolve actual statement IDs dynamically from the imported SSP's `implemented-requirements[].statements[]` or query `POST /api/resolve/assessment-plan/preview` to fetch the authoritative control statements.

### 3.6 DISC-06: Assessment Plan Subjects Ignoring Target SSP Locations and Parties
- **Observed Code Location:** `reposol/frontend/src/components/assessment-plan/AssessmentSubjectsAssetsTab.tsx`, lines 90–102.
- **Practitioner Impact:** The component extracts candidate assessment subjects from the imported SSP by querying only `components`, `inventory-items`, and `users`. It completely ignores `locations` (data centers, cloud regions, physical facilities) and `parties` (external service providers, contractors). Assessors cannot scope physical security controls (e.g. NIST SP 800-53 PE family) or organization-level controls (e.g. AT or PS family) to appropriate subject targets.
- **Specification Resolution:**
  - Resolved in `step5_assessment_plan.md` US 5.8 and Section 3.
  - Mandates that `AssessmentSubjectsAssetsTab.tsx` and the resolution service parse all 5 OSCAL assessment subject types: `component`, `inventory-item`, `location`, `party`, and `user`.

### 3.7 DISC-07: ComponentPage.tsx Bypassing DD-029 Centralized Document Actions
- **Observed Code Location:** `reposol/frontend/src/components/component-definition/ComponentPage.tsx`, lines 72–76:
  ```typescript
  const handleUpdate = (updater: (draft: any) => void) => {
    const nextDoc = updateDocumentWith(doc, updater);
    setDoc(nextDoc);
    pushUndoRedoState(nextDoc);
  };
  ```
- **Practitioner Impact:** While `component-definition-actions.ts` defines 30+ typed action creators adhering to DD-029, `ComponentPage.tsx` ignores them and mutates draft objects via ad-hoc mutation callbacks. This creates architectural divergence, bypasses audit logging, and creates severe maintenance friction when introducing centralized state middleware.
- **Specification Resolution:**
  - Resolved in `step3_component_inventory.md` US 3.19 and Section 3.
  - Mandates refactoring `ComponentPage.tsx` to dispatch typed actions via `useDocumentActions` and `component-definition-actions.ts`.

### 3.8 POA&M Discrepancies: Root-Level Entity Layout & Incomplete UI
- **Root Entity Layout Discrepancy:**
  - In Stage 6 (`assessment-results`), findings, observations, and risks are strictly nested inside elements of the `results[]` array.
  - In Stage 7 (`plan-of-action-and-milestones`), the schema has **NO `results` property**. `findings[]`, `observations[]`, `risks[]`, and `poam-items[]` reside directly at the **document root**.
  - Wrapping POA&M findings in `results` triggers an immediate schema validation failure.
- **Missing UI Tabs:** `POAMPage.tsx` defines tabs for `dashboard`, `items`, `observations`, `risks`, `metadata`, `json`. It completely lacks a **Findings tab** (preventing users from viewing or managing findings ingested from AR) and a **Local Definitions tab** (preventing local remediation asset declarations).
- **Improper Entity Editor Reuse:** In `POAMPage.tsx` (lines 172–180), clicking on an observation or risk opens `POAMItemsEditor.tsx`. That editor only contains fields for `title`, `description`, `priority`, and related-entity dropdowns. It lacks:
  - Observation fields: `methods` (`EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN`), `types`, `collected` timestamp, `relevant-evidence`.
  - Risk fields: mandatory `statement` (strictly required in OSCAL), `status` lifecycle state machine, `characterizations` (CVSS facets), `mitigating-factors`, `remediations`, and `risk-log`.
- **Specification Resolution:**
  - Resolved in `step7_poam.md` US 7.1, US 7.3, US 7.5, US 7.6, US 7.7, US 7.12, US 7.13, and Section 3.
  - Establishes root-level storage, mandates adding dedicated Findings and Local Definitions tabs, and replaces `POAMItemsEditor` reuse with dedicated `ObservationEditorModal` and `RiskEditorModal` components identical to Stage 6.

### 3.9 Control Mapping Discrepancies: Monolithic UI & Metaschema Divergences
- **Arbitrary `props` Injection Hack:** In `MappingPage.tsx` (lines 370–450), mapping methodology, rationale, and confidence are injected as property objects:
  `m.props.push({ name: 'method', value: e.target.value })`
  This violates the official NIST OSCAL `mapping-collection` schema, which requires these fields in `mapping-collection.provenance`.
- **Invalid Enum Values:** `MappingPage.tsx` (lines 394–396) uses `method` enums `'manual'`, `'automated'`, `'mixed'`. Official NIST OSCAL schema strictly requires `'human'`, `'automation'`, `'hybrid'`.
- **Omission of 6th Canonical Token:** The relationship selector includes only 5 values (`equal-to`, `equivalent-to`, `subset-of`, `superset-of`, `intersects-with`). It **omits `no-relationship`**, which is required by NIST IR 8477 to explicitly document vetted non-alignments.
- **Single Mapping Hardcoding:** `MappingPage.tsx` hardcodes index `[0]` (`mappings[0]`), preventing users from maintaining multiple mapping crosswalks in a single collection.
- **Corrupted TypeScript Types:** In `reposol/frontend/src/lib/types/oscal.d.ts` (lines 1205–1211), `MappingCollection` erroneously includes `'import-ssp'?: Record<string, unknown>` and `'local-definitions'?: Record<string, unknown>` (neither exists in the OSCAL mapping schema) and omits `provenance`.
- **Specification Resolution:**
  - Resolved in `step8_control_mapping.md` US 8.1, US 8.2, US 8.5, US 8.6, US 8.7, US 8.12, and Section 3.
  - Eliminates fake `props` fields, binds official `provenance` schema fields, mandates all 6 canonical relationship tokens, supports multi-mapping arrays, and corrects TypeScript definitions in `oscal.d.ts`.

---

## 4. Schema Validation Constraints & Invariants

### 4.1 Comparative 8-Stage NIST OSCAL Specification Matrix
The following table summarizes the structural invariants, schema paths, mandatory root assemblies, allowed enums, and unique metaschema constraints governing all 8 stages of the Reposol platform:

| Stage | Model Name | Root Key | Schema File Path | Metaschema Definition | Mandatory Root Assemblies | Optional Root Assemblies | Core Allowed Enums | Unique Schema Rules & Invariants |
|---|---|---|---|---|---|---|---|---|
| **Stage 1** | Catalog | `catalog` | `oscal_catalog_schema.json` | `oscal-catalog-oscal-catalog:catalog` | `uuid`, `metadata` | `params`, `controls`, `groups`, `back-matter` | Parameter type: `string`, `boolean`, `array` | Recursive control hierarchy via `controls` and nested `groups`. Controls require `id` and `title`. |
| **Stage 2** | Profile | `profile` | `oscal_profile_schema.json` | `oscal-profile-oscal-profile:profile` | `uuid`, `metadata`, `imports` | `merge`, `modify`, `back-matter` | Combine: `keep`, `merge`, `use-first` | `imports` requires `minItems: 1` with `href`. Tailors controls via `include-controls`, `exclude-controls`, `modify.alters`. |
| **Stage 3** | Component Definition | `component-definition` | `oscal_component_schema.json` | `oscal-component-definition-oscal-component-definition:component-definition` | `uuid`, `metadata` | `import-component-definitions`, `components`, `capabilities`, `back-matter` | Component type: 15 types (`interconnection`, `software`, `hardware`, `service`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `region`, `zone`, `resource-container`, `network`); Port transport: `TCP`, `UDP` | **`status` is FORBIDDEN** on `defined-component` (schema rejects). `this-system` is FORBIDDEN. `control-implementations` requires `source` URI and `implemented-requirements`. |
| **Stage 4** | System Security Plan | `system-security-plan` | `oscal_ssp_schema.json` | `oscal-ssp-oscal-ssp:system-security-plan` | `uuid`, `metadata`, `import-profile`, `system-characteristics`, `system-implementation`, `control-implementation` | `back-matter` | Status state: `operational`, `under-development`, `under-major-modification`, `disposition`, `other`; Impl status: `implemented`, `partial`, `planned`, `alternative`, `not-applicable` | **ALL 6 ROOT ASSEMBLIES ARE MANDATORY**. `system-component` **REQUIRES `status`**. Root component **MUST have `type: "this-system"`**. Implementation narratives reside strictly in `by-components[].description`. |
| **Stage 5** | Assessment Plan | `assessment-plan` | `oscal_assessment-plan_schema.json` | `oscal-ap-oscal-ap:assessment-plan` | `uuid`, `metadata`, `import-ssp`, `reviewed-controls` | `local-definitions`, `terms-and-conditions`, `assessment-subjects`, `assessment-assets`, `tasks`, `back-matter` | Task type: `milestone`, `action`; Methods: `INTERVIEW`, `EXAMINE`, `TEST`; Subject types: `component`, `inventory-item`, `location`, `party`, `user` | Task `timing` is an `anyOf` with 3 mutually exclusive branches (`on-date`, `within-date-range`, `at-frequency`). Task DAG cycle detection enforced. 7 canonical terms-and-conditions parts. |
| **Stage 6** | Assessment Results | `assessment-results` | `oscal_assessment-results_schema.json` | `oscal-ar-oscal-ar:assessment-results` | `uuid`, `metadata`, `import-ap`, `results` | `local-definitions`, `back-matter` | Target type: `statement-id`, `objective-id`; Status state: `satisfied`, `not-satisfied`; Methods: `EXAMINE`, `INTERVIEW`, `TEST`, `UNKNOWN`; Risk status: 6 states | **Findings, observations, and risks MUST reside inside `results[]`**. `results` requires `minItems: 1`. Observation `methods` requires `minItems: 1`. Risk requires `statement`. |
| **Stage 7** | Plan of Action & Milestones | `plan-of-action-and-milestones` | `oscal_poam_schema.json` | `oscal-poam-oscal-poam:plan-of-action-and-milestones` | `uuid`, `metadata`, `poam-items` | `import-ssp`, `system-id`, `local-definitions`, `observations`, `risks`, `findings`, `back-matter` | Remediation lifecycle: `recommendation`, `planned`, `completed`; Actor type: `tool`, `assessment-platform`, `party` | **`results` PROPERTY IS FORBIDDEN**. Observations, risks, and findings reside directly at ROOT. `poam-items` requires `minItems: 1`. Dual scoping via `import-ssp` or `system-id`. |
| **Stage 8** | Mapping Collection | `mapping-collection` | `oscal_mapping_schema.json` | `oscal-mapping-oscal-mapping:mapping-collection` | `uuid`, `metadata` | `provenance`, `mappings`, `back-matter` | Relationship: 6 tokens (`equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`); Method: `human`, `automation`, `hybrid`; Rationale: `syntactic`, `semantic`, `functional`; Status: 5 states | Provenance fields (`method`, `matching-rationale`, `status`, `mapping-description`) are required when `provenance` is present. `mappings` supports single mapping or array `minItems: 1`. |

### 4.2 Critical Schema Invariants & Edge Cases

1. **`defined-component` vs `system-component` Status Invariant:**
   - In Stage 3 Component Definitions (`oscal_component_schema.json`), `defined-component` defines reusable templates. The metaschema explicitly forbids the `status` property. Supplying `status: { state: "operational" }` on a `defined-component` triggers an immediate Draft-7 schema validation failure (`additionalProperties: false`).
   - Conversely, in Stage 4 SSP (`oscal_ssp_schema.json`), `system-component` represents a deployed operational asset. The `status` property is strictly required:
     `required: ['uuid', 'type', 'title', 'description', 'status']`.

2. **Root System Component Type Invariant (`this-system`):**
   - In Stage 4 SSP, the root boundary component representing the system itself must specify `type: "this-system"`.
   - In Stage 3 Component Definitions, `this-system` is not a valid component type. Component templates must specify concrete categories (`software`, `hardware`, `service`, `policy`, etc.).

3. **Task Timing `anyOf` Mutual Exclusivity:**
   - In Stage 5 Assessment Plan, `task.timing` enforces an `anyOf` schema constraint across three mutually exclusive branches:
     1. `on-date`: Requires `['date']` (`DateTimeWithTimezoneDatatype`).
     2. `within-date-range`: Requires `['start', 'end']` (`DateTimeWithTimezoneDatatype`).
     3. `at-frequency`: Requires `['period', 'unit']`, where `unit` is an enum (`seconds`, `minutes`, `hours`, `days`, `months`, `years`).
   - Defining both `on-date` and `within-date-range` simultaneously violates the `anyOf` rule and fails validation.

4. **AR Nested Results vs POA&M Root Entity Storage:**
   - In Stage 6 Assessment Results, the document models audit executions. Findings, observations, and risks must reside inside elements of the `results[]` array (`assessment-results.results[].findings[]`). Placing them at the root triggers schema failure.
   - In Stage 7 POA&M, the document models continuous remediation. The schema has no `results` property. Findings, observations, and risks must reside directly at the root of `plan-of-action-and-milestones`. Placing them inside a `results` object triggers schema failure.

5. **Finding Target Semantics & Satisfaction:**
   - In both AR and POA&M, `finding.target` enforces:
     - `type`: Must be one of `['statement-id', 'objective-id']` (`'control-id'` is strictly invalid).
     - `target-id`: Must match the token of the evaluated statement or objective.
     - `status.state`: Must be either `'satisfied'` (compliance confirmed) or `'not-satisfied'` (non-compliance discovered).
     - `status.reason`: Optional enum `['pass', 'fail', 'other']`.

6. **Observation Methodology Requirement:**
   - `observation` requires `methods: []` with `minItems: 1`. An empty array fails schema validation.
   - Allowed enum values: `['EXAMINE', 'INTERVIEW', 'TEST', 'UNKNOWN']`.
   - Timestamp `collected` is mandatory (`DateTimeWithTimezoneDatatype`).

7. **Risk Model & Mandatory Statement:**
   - In both AR and POA&M, `risk.statement` is strictly mandatory. A risk object missing `statement` fails schema validation.
   - Status transitions follow a 6-state machine: `open` ➔ `investigating` ➔ `remediating` ➔ `deviation-requested` ➔ `deviation-approved` ➔ `closed`.

8. **Serialization Invariant: `remove_empty_arrays()` vs `minItems: 1`:**
   - In Reposol, `remove_empty_arrays()` cleans empty optional arrays before persistence and export.
   - However, for required assemblies that enforce `minItems: 1` (such as `system-characteristics.system-ids` in SSP, `results` in AR, `poam-items` in POA&M, and `mappings` in Mapping Collection), stripping an array when empty creates a payload that fails Draft-7 schema validation. The frontend and backend must ensure that required assemblies always contain at least one valid initialized item before cleaning.

### 4.3 Backend Semantic Validation State & Gap Analysis
The Reposol backend validation engine (`reposol/backend/app/validation.py`) implements a two-tier architecture:
- **Level 1 Validation:** Draft-7 JSON Schema validation against official NIST schemas using `jsonschema.Draft7Validator` with `sanitize_patterns()` (handling XML regex compatibility).
- **Level 2 Semantic Integrity Validation:** Custom async validation functions that enforce cross-document referential integrity, cycle detection, and value constraints.

Currently, Level 2 integrity validation coverage is uneven:

| Stage | Root Key | Integrity Function | Integrity Hook in `validate_document()` | Gaps & Missing Semantic Checks |
|---|---|---|---|---|
| **Stage 1: Catalog** | `catalog` | N/A (Standard Schema) | Level 1 Only | No cyclic group parent-child check. |
| **Stage 2: Profile** | `profile` | `_validate_profile_integrity` | ✅ Line 751 | Checks `imports[].href` existence and parameter references. |
| **Stage 3: Component Def** | `component-definition` | **None** | ❌ **Missing** (Line 751–762 has no hook) | **Zero semantic checks**. Does not verify `import-component-definitions`, does not verify `control-implementations[].source`, does not verify `implemented-requirements[].control-id`, does not verify `capabilities[].incorporates-components`. |
| **Stage 4: SSP** | `system-security-plan` | `_validate_ssp_integrity` | ✅ Line 754 | Verifies `import-profile.href` and `by-components[].component-uuid`. **Gaps:** Does not check baseline control membership (DISC-04); does not check parameter constraints. |
| **Stage 5: Assessment Plan** | `assessment-plan` | `_validate_ap_integrity` | ✅ Line 757 | Verifies `import-ssp.href`, performs task DAG cycle DFS (`task-dag-cycle`), checks activity links, enforces method enums, enforces 7 terms parts. **Gaps:** Does not check reviewed controls baseline presence; does not verify subject UUIDs against SSP. |
| **Stage 6: Assessment Results** | `assessment-results` | `_validate_ar_integrity` | ✅ Line 760 | Verifies `import-ap.href`, duplicate UUIDs, Observation-Finding-Risk Triad cross-references, and target semantics. |
| **Stage 7: POA&M** | `plan-of-action-and-milestones` | **None** | ❌ **Missing** (Line 751–762 has no hook) | **Zero semantic checks**. Does not verify `import-ssp.href` or `system-id`, does not verify dangling finding/observation/risk UUIDs in `poam-items`. |
| **Stage 8: Control Mapping** | `mapping-collection` | **None** | ❌ **Missing** (Line 751–762 has no hook) | **Zero semantic checks**. Does not verify `source-resource.href` or `target-resource.href`, does not verify control IDs in `sources[]` or `targets[]`. |

---

## 5. Actionable Codebase Recommendations & Implementation Roadmap

To transition Reposol from specification elevation into full operational capability, this section provides an actionable, prioritized engineering backlog detailing exact file paths, function signatures, and implementation guidance across four prioritized epics.

### 5.1 Epic 1: Schema Integrity & Backend Semantic Validation Engines (Priority: High)
*Objective: Close all Level 2 semantic validation gaps in `reposol/backend/app/validation.py` for Stages 3, 7, and 8, and add missing resolution preview endpoints.*

1. **Implement `_validate_component_integrity` in `reposol/backend/app/validation.py`:**
   - **Signature:** `async def _validate_component_integrity(cdef: Dict[str, Any], root_key: str, errors: List[Dict[str, Any]], workspace_id: Optional[str] = None, check_refs: bool = True) -> None:`
   - **Rules Enforced:**
     - Validate that `defined-component` does NOT contain `status`.
     - Validate that `import-component-definitions[].href` resolves to an existing component definition in the workspace.
     - Validate that `components[].control-implementations[].source` resolves to an existing Catalog or Profile.
     - Validate that `control-implementations[].implemented-requirements[].control-id` exists within the resolved source document.
     - Validate that `capabilities[].incorporates-components[].component-uuid` points to a declared component within `components[]`.
   - **Hook Dispatch:** Register in `validate_document()` (lines 751–762):
     ```python
     if stage in ("component-definitions", "component-definition") and check_refs:
         await _validate_component_integrity(document[root_key], root_key, errors, workspace_id)
     ```

2. **Implement `_validate_poam_integrity` in `reposol/backend/app/validation.py`:**
   - **Signature:** `async def _validate_poam_integrity(poam: Dict[str, Any], root_key: str, errors: List[Dict[str, Any]], workspace_id: Optional[str] = None, check_refs: bool = True) -> None:`
   - **Rules Enforced:**
     - Validate that `import-ssp.href` resolves to an existing System Security Plan if present.
     - Validate that every finding referenced in `poam-items[].related-findings[].finding-uuid` exists in `poam.findings[]`.
     - Validate that every observation referenced in `poam-items[].related-observations[].observation-uuid` exists in `poam.observations[]`.
     - Validate that every risk referenced in `poam-items[].related-risks[].risk-uuid` exists in `poam.risks[]`.
     - Enforce that finding `target.status.state` is either `'satisfied'` or `'not-satisfied'`.
     - Enforce that risk `statement` is present and non-empty.
   - **Hook Dispatch:** Register in `validate_document()`.

3. **Implement `_validate_mapping_integrity` in `reposol/backend/app/validation.py`:**
   - **Signature:** `async def _validate_mapping_integrity(mc: Dict[str, Any], root_key: str, errors: List[Dict[str, Any]], workspace_id: Optional[str] = None, check_refs: bool = True) -> None:`
   - **Rules Enforced:**
     - Validate that each `mapping.source-resource.href` and `target-resource.href` resolves to an existing Catalog or Profile.
     - Validate that each `map.relationship` token is one of the 6 canonical values: `equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`.
     - Validate that `maps[].sources[].id-ref` exists within the source resource.
     - Validate that `maps[].targets[].id-ref` exists within the target resource.
   - **Hook Dispatch:** Register in `validate_document()`.

4. **Implement Missing Resolution Preview Route in `reposol/backend/app/api/resolution_routes.py`:**
   - Add `POST /api/resolve/assessment-results/preview` to resolve candidate findings, observations, and risks for preview prior to document save.

5. **Enhance SSP Integrity Validation for Baseline Control Membership (DISC-04):**
   - Update `_validate_ssp_integrity` in `validation.py` to resolve the baseline profile/catalog and assert that all `implemented-requirements[].control-id` exist within the baseline.

### 5.2 Epic 2: Cross-Stage Lifecycle Integration & Import Preservation (Priority: High)
*Objective: Resolve lifecycle disconnects connecting Stage 3 to Stage 4, and Stage 4 to Stage 5.*

1. **Preserve Control Implementations in `CdefImportModal.tsx` (DISC-01 & DISC-02):**
   - **File:** `reposol/frontend/src/components/ssp/drawers/CdefImportModal.tsx`
   - **Changes:**
     - When importing components, extract `c['control-implementations']`.
     - In addition to generating the system component in `system-implementation.components[]`, dispatch actions to `control-implementation.implemented-requirements[]`:
       - For each `imp_req` in `c['control-implementations']`, add or update the requirement in the SSP.
       - Append a `by-components` entry referencing the imported component's UUID with `description: imp_req.description` and `set-parameters: imp_req['set-parameters']`.
     - Preserve golden template lineage by adding `props: [{ name: "source-component-uuid", value: c.uuid }]` and link `links: [{ rel: "imported-from", href: "../component-definitions/{cdef_uuid}.json#{c.uuid}" }]`.

2. **Dynamically Resolve Statement IDs in `ReviewedControlsTab.tsx` (DISC-05):**
   - **File:** `reposol/frontend/src/components/assessment-plan/ReviewedControlsTab.tsx`
   - **Changes:**
     - Replace hardcoded `${cid}_smt_a..d` with real statement tokens.
     - Read statements from the target SSP's resolved control statements via `/api/resolve/assessment-plan/preview` or inspect `sspDoc['system-security-plan']['control-implementation']['implemented-requirements']`.

3. **Expand Candidate Assessment Subjects in `AssessmentSubjectsAssetsTab.tsx` (DISC-06):**
   - **File:** `reposol/frontend/src/components/assessment-plan/AssessmentSubjectsAssetsTab.tsx`
   - **Changes:**
     - Update subject extraction logic to parse `locations` (from `system-characteristics` or `local-definitions`) and `parties` (from `metadata.parties`), allowing all 5 subject types (`component`, `inventory-item`, `location`, `party`, `user`).

### 5.3 Epic 3: Frontend Architecture, Dedicated Editors & DD-029 Decoupling (Priority: Medium)
*Objective: Eliminate state mutation divergences, author missing UI tabs, and replace stubbed handlers.*

1. **Refactor `ComponentPage.tsx` to Centralized Document Actions (DISC-07):**
   - **File:** `reposol/frontend/src/components/component-definition/ComponentPage.tsx`
   - **Changes:**
     - Eliminate ad-hoc `updateDocumentWith(doc, updater)` callbacks.
     - Integrate `useDocumentActions` with action creators from `component-definition-actions.ts`.

2. **Refactor POA&M UI Architecture (`POAMPage.tsx`):**
   - **File:** `reposol/frontend/src/components/poam/POAMPage.tsx`
   - **Changes:**
     - Add **Findings Tab** (`AssessmentFindingsTab.tsx` adapted for POA&M root findings).
     - Add **Local Definitions Tab** for local remediation components and users.
     - Replace improper reuse of `POAMItemsEditor.tsx` for observations and risks with dedicated `ObservationEditorModal.tsx` and `RiskEditorModal.tsx` supporting mandatory `statement`, CVSS facets, remediations, and methods.
     - Expand `poam-actions.ts` from 5 functions into an exhaustive DD-029 actions suite.

3. **Refactor Control Mapping UI Architecture (`MappingPage.tsx`):**
   - **File:** `reposol/frontend/src/components/mapping/MappingPage.tsx`
   - **Changes:**
     - Eliminate non-standard `props` injection (`method`, `rationale`, `confidence`).
     - Bind directly to official schema fields under `mapping-collection.provenance`.
     - Update `method` dropdown to official enum tokens: `human`, `automation`, `hybrid`.
     - Add the 6th canonical relationship token `no-relationship` to the relationship selector.
     - Support multi-mapping arrays (`mappings[]`), allowing users to maintain multiple crosswalks in a single file.
     - Create `reposol/frontend/src/lib/document-actions/mapping-actions.ts` conforming to DD-029.

4. **Correct TypeScript Interfaces in `reposol/frontend/src/lib/types/oscal.d.ts`:**
   - **Lines 1186–1222:**
     - Update `PlanOfActionAndMilestones` to declare root-level `findings?: Finding[]`, `observations?: Observation[]`, `risks?: Risk[]`, and `back-matter?: BackMatter`.
     - Update `MappingCollection` to remove bogus `import-ssp` and `local-definitions`, add typed `provenance: MappingProvenance`, and strongly type `mappings: Mapping[]`.

5. **Activate Operational Drawers in `AssessmentLogTab.tsx`:**
   - **File:** `reposol/frontend/src/components/assessment-results/tabs/AssessmentLogTab.tsx`
   - **Changes:**
     - Replace stubbed `onRowClick={() => {}}` handlers on Assessment Components (line 392), Assessment Users (line 426), and Assessment Tasks (line 458) with operational drawer/modal views.

### 5.4 Epic 4: Test Suite Hardening, Fixture Standardization & E2E Repair (Priority: Medium)
*Objective: Eliminate superficial smoke tests and provide deep integration and end-to-end verification.*

1. **Add Backend Semantic Validation Unit & Integration Tests:**
   - Add `TestComponentIntegrityValidation` to `test_validation.py` (verifying `source` checks and component DAGs).
   - Add `TestPOAMIntegrityValidation` to `test_validation.py` (verifying SSP references and dangling finding UUIDs).
   - Add `TestMappingIntegrityValidation` to `test_validation.py` (verifying resource URIs, relationship tokens, and unmapped controls).
   - Add `reposol/backend/tests/integration/test_component_crud.py`.

2. **Elevate Playwright E2E Test Suite for Stage 7 POA&M:**
   - **File:** `reposol/e2e/tests/step7-poam.spec.ts`
   - **Changes:**
     - Replace superficial smoke checks (lines 15–140) with real practitioner interactions: creating action items, executing AR findings bridge ingestion, editing risk CVSS facets, updating milestone completion dates, and verifying export.

3. **Fix Schema Fixtures in Playwright E2E Test for Stage 8 Control Mapping:**
   - **File:** `reposol/e2e/tests/step8-control-mapping.spec.ts`
   - **Changes:**
     - Update line 137 fixture from obsolete `{ mapping: [{ subject: ..., relationships: ... }] }` to official OSCAL structure `{ mappings: [{ uuid: ..., source-resource: ..., target-resource: ..., maps: [...] }] }`.

---

## 6. Verification & Test Suite Health

### 6.1 Backend Test Execution Health (`pytest`)
The backend test suite was executed in the designated `darkspell` conda environment across all unit, integration, and stress test suites:

```powershell
conda run -n darkspell pytest reposol/backend/tests/unit/ reposol/backend/tests/integration/ reposol/backend/tests/stress/
```

- **Total Tests Run:** 618 tests
- **Passed:** 618 tests (100% pass rate)
- **Failed / Errors:** 0
- **Warnings:** 1 benign warning (`StarletteDeprecationWarning: Using 'httpx' with 'starlette.testclient' is deprecated`)
- **Execution Time:** 72.17 seconds
- **Key Modules Verified:**
  - `test_validation.py` (Unit schema validation and AR integrity)
  - `test_ssp_crud.py`, `test_ssp_resolution.py`, `test_ssp_validation.py` (SSP lifecycle, baseline resolution, parameter cascade)
  - `test_assessment_plan_crud.py`, `test_assessment_plan_resolution.py` (AP lifecycle, scoping, DAG cycle checks)
  - `test_assessment_results_crud.py` (AR lifecycle, results set management)
  - `test_poam_crud.py`, `test_poam_findings_import.py` (POA&M CRUD and AR bridge ingestion)
  - `test_control_mapping_crud.py` (Mapping collection CRUD)
  - `test_m1_2_step3_schema_empirical_challenge.py`, `test_ssp_empirical_challenge.py`, `test_m6_2_challenger_schema_and_roundtrip.py` (Adversarial stress)

### 6.2 Frontend Unit & Integration Test Health (`vitest`)
The frontend Vitest suite was executed across all components, actions, and stress suites:

```powershell
npm test --prefix reposol/frontend -- --run
```

- **Total Test Files:** 91 test files
- **Passed Files:** 91 passed (100%)
- **Total Tests Run:** 993 tests
- **Passed Tests:** 993 passed (100%)
- **Failed / Errors:** 0
- **Execution Duration:** 49.12 seconds
- **Key Suites Verified:**
  - `assessment-plan-actions.test.ts` (40 tests)
  - `assessment-results-actions.test.ts` (32 tests)
  - `profile-actions.test.ts` (31 tests)
  - `ssp-actions.test.ts` (23 tests)
  - `component-definition-actions.stress.test.ts` (27 tests)
  - `ARFindingsImportModal.test.tsx` (4 tests)
  - `POAMDashboard.test.tsx` (3 tests)
  - `ReviewedControlsTab.test.tsx` (3 tests)
  - `SankeyDiagramEmpiricalEdgeCases.test.tsx` (10 tests)
  - `POAMChallenger4GateCheck.test.tsx` (6 tests)

### 6.3 Production Build Health (`vite build`)
The frontend production build was verified via Vite:

```powershell
npm --prefix reposol/frontend run build
```

- **Result:** Build succeeded with zero TypeScript compiler errors (`tsc -b` clean).
- **Modules Transformed:** 315 modules
- **Build Time:** 6.64 seconds
- **Bundle Production Artifacts:**
  - `dist/index.html`: 0.61 kB
  - `dist/assets/index-e5c9481c.js`: 424.01 kB (gzip: 131.45 kB)
  - `dist/assets/index-e5353b98.css`: 78.90 kB (gzip: 13.93 kB)
  - Stage-specific chunks cleanly split: `CatalogPage`, `ProfilePage`, `ComponentPage`, `SSPPage`, `APPage`, `ARPage`, `POAMPage`, `MappingPage`.

### 6.4 Repository Guidelines & Quality Policy Attestation
- **Rule 1 (Environment Setup):** All backend testing and code verification executed strictly within the active `darkspell` conda environment.
- **Rule 2 (Test Credentials):** Documented test credentials in `reposol/backend/tests/credentials.md` verified for UI/E2E test alignment.
- **Rule 4 (Documentation-First Workflow):** All architectural findings, user stories, and acceptance criteria were documented and elevated to benchmark standards prior to engineering backlog prioritization.
- **Rule 5 (Repository Language Policy):** All documentation, user stories, audit reports, and technical artifacts are written strictly in professional, idiomatic English.
- **Integrity Mandate:** No test results were hardcoded; no dummy facade implementations were introduced; all findings reflect genuine empirical analysis and source code inspection.

---

## 7. Audit Attestation & Sign-Off

This Consolidated Cross-Stage Lifecycle Audit & Traceability Report serves as the definitive reference document for NIST OSCAL Stages 3 through 8 within the Reposol repository. All discovered discrepancies, schema invariants, traceability vectors, and engineering recommendations documented herein are verified against the authoritative NIST OSCAL v1.2.2 JSON schemas and confirmed through empirical test execution.

**Lead Auditor:** Worker M4-1  
**Milestone:** M4 (Consolidated Cross-Stage Lifecycle Audit & Traceability Report)  
**Status:** COMPLETE & AUTHORITATIVE  
**Date:** 2026-09-05
