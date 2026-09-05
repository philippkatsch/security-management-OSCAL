---
name: oscal_reference
description: >
  Look up OSCAL definitions, specifications, component structures, and sample data
  in the local oscal-reference repositories. Triggers on: OSCAL schema, OSCAL model,
  OSCAL specification, control catalog, profile structure, component definition schema,
  SSP structure, assessment plan model, assessment results model, POA&M model,
  mapping collection model, metaschema, OSCAL validation, Grundschutz, BSI catalog.
---
# OSCAL Reference Skill

When you need to look up the OSCAL format, its definitions, components, structure, schemas, or sample data, use this reference.

## 1. Repository Locations

All reference material is located in `oscal-reference/` at the repository root.

### NIST Official Repositories

| Directory | Contents | Use When |
|-----------|----------|----------|
| `OSCAL/` | Main NIST repository: schemas (`src/`), metaschema definitions, XML/JSON/YAML models | Looking up official schema structures, field definitions, or data types |
| `OSCAL-Pages/` | NIST OSCAL website source (Hugo), user guides, tutorials | Reading specification prose, understanding OSCAL concepts |
| `OSCAL-Reference/` | Model documentation generator, interactive XML/JSON schema reference | Checking exact field names, cardinality, and constraints |

### BSI Official Repository (Stand der Technik)

| Directory | Contents | Use When |
|-----------|----------|----------|
| `Stand-der-Technik-Bibliothek/control_layer/` | Official BSI catalogs (Grundschutz++, Lieferkettensicherheit, Mindeststandard-TLS, Risikomanagement, WLAN) & framework mappings (ISO 27001, ITGS 2023) | Referencing official BSI OSCAL catalogs and cross-framework mappings |
| `Stand-der-Technik-Bibliothek/implementation_layer/` | Official BSI component definitions and implementation blueprints (AWS, Keycloak, GA-Lotse, Netzarchitektur, Passwortrichtlinie) | Referencing official BSI component definitions and implementation layer artifacts |
| `Stand-der-Technik-Bibliothek/assessment_layer/` | BSI assessment artifacts and test definitions | Referencing BSI assessment models and evaluation guides |

### Grundschutz++ Tools & Sample Data

| Directory | Contents | Use When |
|-----------|----------|----------|
| `Grundschutz-Plus-Plus-Tools/ED23-Baustein-profile/` | Production OSCAL profiles (BSI IT-Grundschutz Edition 2023) | Referencing real-world profile structures and requirements |
| `Grundschutz-Plus-Plus-Tools/kataloge/` | Official C5-2026 and C3A OSCAL catalogs | Loading standard security control catalogs |
| `Grundschutz-Plus-Plus-Tools/beispiel-kataloge/` | Pre-built OSCAL catalogs for testing (DSGVO, KRITIS) | Loading sample catalog data for development/testing |
| `Grundschutz-Plus-Plus-Tools/hilfsdateien/` | Control mappings, JSON schemas, requirements, gap analysis | Cross-referencing framework mappings and requirements |
| `Grundschutz-Plus-Plus-Tools/Zielobjektkategorien/` | OSCAL profiles categorized by target object type (process & regular) | Studying profile patterns by category |
| `Grundschutz-Plus-Plus-Tools/one-page-apps/` | Browser-based OSCAL workflow tools (SSP generator, C5 converter, Assessment Plan/Results, POA&M, Viewer) | Understanding OSCAL lifecycle workflow patterns as reference implementations |
| `Grundschutz-Plus-Plus-Tools/handbuch/` | Comprehensive Grundschutz++ and OSCAL documentation & manual | Deepening domain knowledge on BSI Grundschutz++ methodologies |

## 2. Search Strategies

- **Schema field lookup:** Use `grep_search` in `oscal-reference/OSCAL/src/` for metaschema field definitions.
- **Model structure:** Use `list_dir` on `oscal-reference/OSCAL/src/metaschema/` to discover model files.
- **Sample data:** Use `list_dir` on `oscal-reference/Grundschutz-Plus-Plus-Tools/beispiel-kataloge/`, `kataloge/`, or `ED23-Baustein-profile/DE/`.
- **Specific model lookup:** Search for model keywords: `catalog`, `profile`, `ssp`, `component-definition`, `assessment-plan`, `assessment-results`, `plan-of-action-and-milestones`, `mapping-collection`.

## 3. Purpose

Ensure that all OSCAL structures generated or managed by Reposol strictly conform to NIST OSCAL specifications. Always verify field names, data types, and cardinality against the official schemas before implementing new features.
