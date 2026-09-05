"""
Empirical Challenger M5-2 Verification Suite
Verifies the technical reality of DISC-01 through DISC-07, POA&M structure,
and Control Mapping divergences, and checks the remediation coverage in
elevated user stories and the master audit report.
"""

import os
import json
import re
import uuid
import pytest
import asyncio
from typing import Dict, Any

from app.validation import validate_document, SCHEMAS, STAGE_ROOT_KEYS, _run_schema_validation, OSCALValidationError


BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPOSOL_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
FRONTEND_DIR = os.path.join(REPOSOL_DIR, "frontend")
DOCS_DIR = os.path.join(REPOSOL_DIR, "..", "documentation")
if not os.path.exists(DOCS_DIR):
    DOCS_DIR = os.path.abspath(os.path.join(REPOSOL_DIR, "documentation"))
AUDIT_FILE = os.path.join(DOCS_DIR, "audit", "OSCAL_STAGES_3_TO_8_LIFECYCLE_AUDIT.md")


# =========================================================================
# 1. DISC-01 & DISC-02: CdefImportModal.tsx & SystemImplementationTab.tsx
# =========================================================================
def test_disc_01_and_02_cdef_import_modal_remediated():
    modal_path = os.path.join(FRONTEND_DIR, "src", "components", "ssp", "drawers", "CdefImportModal.tsx")
    assert os.path.exists(modal_path), f"File not found: {modal_path}"
    
    with open(modal_path, "r", encoding="utf-8") as f:
        content = f.read()

    # DISC-01 & DISC-02 Remediated:
    # 1. source-component-uuid is preserved in props
    assert "source-component-uuid" in content, "Expected source-component-uuid in props"
    # 2. Fragment anchor #c.uuid is preserved in link href
    assert "#${c.uuid}" in content, "Expected component anchor in link href"
    # 3. onImport receives both importedComps and chosen (raw components with control-implementations)
    assert "onImport(importedComps, chosen)" in content or "onImport(importedComps, chosen" in content, "Expected chosen components passed to onImport"

    # Verify SystemImplementationTab.tsx consumes control-implementations
    ssp_impl_path = os.path.join(FRONTEND_DIR, "src", "components", "ssp", "SystemImplementationTab.tsx")
    with open(ssp_impl_path, "r", encoding="utf-8") as f:
        ssp_content = f.read()
    assert "handleImportCdefComponents" in ssp_content
    assert "upsertImplementedRequirement" in ssp_content
    assert "addByComponent" in ssp_content


# =========================================================================
# 2. DISC-03: validation.py Missing Component Definition Semantic Integrity
# =========================================================================
@pytest.mark.asyncio
async def test_disc_03_missing_component_integrity_validation():
    # Construct a Component Definition with completely bogus control-implementation source
    cdef_doc = {
        "component-definition": {
            "uuid": "33333333-3333-4333-8333-333333333333",
            "metadata": {
                "title": "Corrupt CDEF",
                "last-modified": "2026-09-05T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "components": [
                {
                    "uuid": "44444444-4444-4444-8444-444444444444",
                    "type": "software",
                    "title": "Software Asset",
                    "description": "Component with non-existent source",
                    "control-implementations": [
                        {
                            "uuid": "55555555-5555-4555-8555-555555555555",
                            "source": "https://non-existent.domain/bogus-catalog.json",
                            "description": "Claims compliance with phantom catalog",
                            "implemented-requirements": [
                                {
                                    "uuid": "66666666-6666-4666-8666-666666666666",
                                    "control-id": "fake-phantom-control-999",
                                    "description": "Fictitious requirement"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }
    
    # Check that Level 1 schema validation passes
    schema_errors = _run_schema_validation("component-definitions", cdef_doc)
    assert len(schema_errors) == 0, f"Schema validation unexpectedly failed: {schema_errors}"

    # Now run validate_document
    # Because _validate_component_integrity does NOT exist, validate_document passes silently
    # without checking whether 'source' or 'control-id' actually exist!
    try:
        await validate_document("component-definitions", cdef_doc, check_refs=True)
        # Pass confirms DISC-03: no semantic integrity validation is performed for component definitions
        passed = True
    except OSCALValidationError:
        passed = False

    assert passed is True, "DISC-03 falsified: validate_document rejected corrupt component-definition references"


# =========================================================================
# 3. DISC-04: validation.py Lack of Baseline Control Membership in SSP
# =========================================================================
@pytest.mark.asyncio
async def test_disc_04_missing_ssp_baseline_control_membership():
    # Construct an SSP with a 100% valid schema structure and valid components,
    # but claiming a fictitious control-id: "phantom-nonexistent-control-999"
    comp_uuid = str(uuid.uuid4())
    ssp_doc = {
        "system-security-plan": {
            "uuid": str(uuid.uuid4()),
            "metadata": {
                "title": "Test SSP",
                "last-modified": "2026-06-25T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "import-profile": {"href": "https://example.com/baselines/nist-800-53-rev5-moderate.json"},
            "system-characteristics": {
                "system-ids": [{"id": "sys-1", "identifier-type": "https://fedramp.gov"}],
                "system-name": "Test System",
                "description": "Test System Description",
                "system-information": {
                    "information-types": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "Information Title",
                            "description": "Information Description"
                        }
                    ]
                },
                "status": {"state": "operational"},
                "authorization-boundary": {
                    "description": "Boundary description"
                }
            },
            "system-implementation": {
                "users": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "role-ids": ["provider"]
                    }
                ],
                "components": [
                    {
                        "uuid": comp_uuid,
                        "type": "software",
                        "title": "Mock Component",
                        "description": "Mock Component Description",
                        "status": {"state": "operational"}
                    }
                ]
            },
            "control-implementation": {
                "description": "Control Implementation Description",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "phantom-nonexistent-control-999",  # Non-existent control outside any baseline
                        "by-components": [
                            {
                                "component-uuid": comp_uuid,
                                "uuid": str(uuid.uuid4()),
                                "description": "Implemented by software"
                            }
                        ]
                    }
                ]
            }
        }
    }

    # Verify that schema validation passes
    schema_errors = _run_schema_validation("ssps", ssp_doc)
    assert len(schema_errors) == 0, f"Schema validation failed: {schema_errors}"

    # Now run validate_document with check_refs=True
    # Because _validate_ssp_integrity does NOT check control-id against baseline membership,
    # it passes without any error!
    try:
        await validate_document("ssps", ssp_doc, check_refs=True)
        passed = True
    except OSCALValidationError as e:
        passed = False
        print(f"Validation errors: {e.errors}")

    assert passed is True, "DISC-04 falsified: validation.py rejected phantom control-id"


# =========================================================================
# 4. DISC-05: ReviewedControlsTab.tsx Dynamic Statement IDs
# =========================================================================
def test_disc_05_dynamic_statement_ids():
    tab_path = os.path.join(FRONTEND_DIR, "src", "components", "assessment-plan", "ReviewedControlsTab.tsx")
    assert os.path.exists(tab_path), f"File not found: {tab_path}"
    
    with open(tab_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Dynamic extraction from SSP statements or set-parameters
    assert "reqStmts" in content, "Expected reqStmts dynamic extraction"
    assert "r.statements" in content, "Expected r.statements extraction"
    assert "FALLBACK_CANDIDATE_CONTROLS" in content, "Expected fallback catalog candidate lookup"


# =========================================================================
# 5. DISC-06: AssessmentSubjectsAssetsTab.tsx Omitted Locations and Parties
# =========================================================================
def test_disc_06_locations_and_parties_included():
    tab_path = os.path.join(FRONTEND_DIR, "src", "components", "assessment-plan", "AssessmentSubjectsAssetsTab.tsx")
    assert os.path.exists(tab_path), f"File not found: {tab_path}"
    
    with open(tab_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify that setSspEntities includes locations and parties
    assert "locations: locs" in content, "Expected locations in setSspEntities"
    assert "parties: pts" in content, "Expected parties in setSspEntities"

    # Verify handleAutoPopulateSubjects populates location and party
    assert "type: 'location'" in content, "Expected location subject type auto-population"
    assert "type: 'party'" in content, "Expected party subject type auto-population"


# =========================================================================
# 6. DISC-07: ComponentPage.tsx Bypassing Document Actions
# =========================================================================
def test_disc_07_component_page_using_document_actions():
    page_path = os.path.join(FRONTEND_DIR, "src", "components", "component-definition", "ComponentPage.tsx")
    assert os.path.exists(page_path), f"File not found: {page_path}"
    
    with open(page_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify component-definition-actions is imported and used
    assert "component-definition-actions" in content, "Expected component-definition-actions imported"
    assert "useDocumentActions" in content, "Expected useDocumentActions hook"
    assert "dispatch(" in content, "Expected dispatch calls in ComponentPage.tsx"


# =========================================================================
# 7. POA&M & Mapping Validation and Layout
# =========================================================================
def test_poam_and_mapping_validation_missing():
    val_path = os.path.join(BACKEND_DIR, "app", "validation.py")
    with open(val_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "_validate_poam_integrity" in content, "Expected _validate_poam_integrity in validation.py"
    assert "_validate_mapping_integrity" in content, "Expected _validate_mapping_integrity in validation.py"
    assert "_validate_component_integrity" in content, "Expected _validate_component_integrity in validation.py"


def test_mapping_page_standard_provenance_and_enums():
    mapping_page = os.path.join(FRONTEND_DIR, "src", "components", "mapping", "MappingPage.tsx")
    assert os.path.exists(mapping_page), f"File not found: {mapping_page}"
    with open(mapping_page, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify standard OSCAL 1.1 mapping actions and helpers
    assert "useDocumentActions" in content, "Expected useDocumentActions in MappingPage"
    assert "renderDetailPanel" in content, "Expected renderDetailPanel helper in MappingPage"
    assert "batchSetRelationship" in content, "Expected batchSetRelationship action in MappingPage"
    assert "deleteMapEntries" in content, "Expected deleteMapEntries action in MappingPage"

    # Check valid method enums per OSCAL 1.1 ('human', 'automation', 'hybrid')
    assert "human" in content, "Expected OSCAL 1.1 'human' method"
    assert "automation" in content, "Expected OSCAL 1.1 'automation' method"
    assert "hybrid" in content, "Expected OSCAL 1.1 'hybrid' method"


# =========================================================================
# 8. Elevated User Stories & Audit Report Completeness
# =========================================================================
def test_elevated_user_stories_and_audit_report_coverage():
    assert os.path.exists(AUDIT_FILE), f"Audit file not found: {AUDIT_FILE}"
    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        audit_content = f.read()

    # Master audit report must detail all 7 discrepancies
    for disc in ["DISC-01", "DISC-02", "DISC-03", "DISC-04", "DISC-05", "DISC-06", "DISC-07"]:
        assert disc in audit_content, f"Audit report missing {disc}"

    # Check user story files exist and have substantial elevated content
    stages = [
        ("step3_component_inventory.md", ["US 3.1", "US 3.11", "US 3.16", "US 3.19"]),
        ("step4_ssp_builder.md", ["US 4.1", "US 4.10", "US 4.13", "US 4.25"]),
        ("step5_assessment_plan.md", ["US 5.1", "US 5.6", "US 5.8"]),
        ("step6_assessment_results.md", ["US 6.1", "US 6.7"]),
        ("step7_poam.md", ["US 7.1", "US 7.3", "US 7.5", "US 7.12"]),
        ("step8_control_mapping.md", ["US 8.1", "US 8.2", "US 8.5", "US 8.7"]),
    ]

    for fname, required_stories in stages:
        fpath = os.path.join(DOCS_DIR, "user_stories", fname)
        assert os.path.exists(fpath), f"User story file not found: {fpath}"
        with open(fpath, "r", encoding="utf-8") as f:
            story_content = f.read()
            assert len(story_content.splitlines()) >= 300, f"{fname} is less than 300 lines ({len(story_content.splitlines())} lines)"
            for st in required_stories:
                assert st in story_content, f"{fname} missing user story {st}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
