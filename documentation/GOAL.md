# Project Goal: Reposol - OSCAL Management Tool

## Vision
The main objective of this project is the development of a comprehensive tool ("Reposol") for editing, modifying, and managing the **OSCAL format (Open Security Controls Assessment Language)** across all stages. 

The tool is intended to provide a holistic solution for managing security controls, system plans, and assessments in a standardized format.

## Core Features

The tool is designed to cover the entire OSCAL lifecycle, including:

1. **Catalog Management (Catalogs):**
   - Loading, viewing, and managing various security control catalogs (e.g., NIST SP 800-53, ISO 27001).
   
2. **Profile Creation (Profiles):**
   - Creating and editing profiles to adapt controls to specific requirements or baselines (tailoring).
   
3. **System Security Plans (SSPs):**
   - Creating and managing detailed System Security Plans based on the defined profiles and catalogs.
   
4. **Support for all other Stages:**
   - **Component Definitions:** Managing hardware and software components.
   - **Assessment Plans:** Planning security assessments.
   - **Assessment Results:** Documenting and evaluating audit findings.
   - **Plan of Action and Milestones (POA&M):** Tracking and remediating identified vulnerabilities.

5. **Control Mapping (Framework Mappings):**
   - Mapping controls between different frameworks (e.g., NIST 800-53 ↔ ISO 27001 ↔ BSI IT-Grundschutz) with relationship types, automatic gap analysis, and visualization.

6. **Interoperability & Lifecycle:**
   - Importing and exporting OSCAL documents in JSON, XML, and YAML.
   - Lifecycle Dashboard with a visual comprehensive overview of all documents and their associations.
   - Reference integrity check for import chains between documents.

## OSCAL Compliance and Standardization Focus
- **Strict Default Schema Compliance**: This repository focuses exclusively on **default standard properties** for OSCAL. To guarantee 100% compatibility with official schemas (where `additionalProperties: false` is strictly enforced), the codebase does not introduce or save custom, non-default properties directly on controls, groups, or additions.
- **Interoperability**: Any custom annotations or organizational metadata must be modeled using standard OSCAL constructs such as the `props` (properties) array rather than custom top-level keys.

## References & Resources
- **OSCAL GitHub Repository:** [https://github.com/usnistgov/OSCAL/](https://github.com/usnistgov/OSCAL/)
- The OSCAL format (from version 1.2.0 onwards) defines standardized JSON, XML, and YAML structures for security-relevant documentations and comprises 8 models: Catalog, Profile, Component Definition, SSP, Assessment Plan, Assessment Results, POA&M, and Mapping.
