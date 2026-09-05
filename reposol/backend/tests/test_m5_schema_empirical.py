"""
Empirical Challenge Test Suite for Milestone M5: Schema & Metaschema Invariants.

Tested Stages:
- Stage 3: Component Definition (status forbidden on defined-component; service protocols with port ranges)
- Stage 4: System Security Plan (6 mandatory root assemblies; status.state required on system-component)
- Stage 5: Assessment Plan (anyOf mutual exclusivity on task timing)
- Stage 6: Assessment Results (root findings rejected; finding target types restricted to statement-id and objective-id)
- Stage 7: POA&M (root-level findings/risks/observations; results wrapper strictly rejected)
- Stage 8: Mapping Collection (multi-mapping array; 6 canonical relationship tokens in metaschema and schema)
"""

import copy
import json
import os
import xml.etree.ElementTree as ET
import pytest
from jsonschema import Draft7Validator, ValidationError
from app.validation import SCHEMAS, sanitize_patterns, _get_validator

SCHEMA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "schemas"))
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
METASCHEMA_DIR = os.path.join(REPO_ROOT, "oscal-reference", "OSCAL", "src", "metaschema")


def get_validator_for_file(schema_file_name: str) -> Draft7Validator:
    path = os.path.join(SCHEMA_DIR, schema_file_name)
    with open(path, "r", encoding="utf-8") as f:
        raw_schema = json.load(f)
    return Draft7Validator(sanitize_patterns(raw_schema))


def load_schema(name: str) -> dict:
    path = os.path.join(SCHEMA_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ==============================================================================
# STAGE 3: Component Definition
# ==============================================================================

@pytest.fixture
def valid_component_definition():
    return {
        "component-definition": {
            "uuid": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
            "metadata": {
                "title": "Minimal Component Definition",
                "last-modified": "2026-09-05T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "components": [
                {
                    "uuid": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                    "type": "service",
                    "title": "PostgreSQL Database Service",
                    "description": "Enterprise relational database server."
                }
            ]
        }
    }


def test_stage3_status_forbidden_on_defined_component(valid_component_definition):
    """
    Challenge 3.1:
    Verify that oscal_component_schema.json strictly forbids 'status' on defined-component.
    """
    validator = get_validator_for_file("oscal_component_schema.json")
    
    # 1. Valid document passes
    errors = list(validator.iter_errors(valid_component_definition))
    assert errors == [], f"Unexpected errors on valid component-definition: {errors}"
    
    # 2. Injecting 'status' as an object (as found in SSP system-component)
    doc_with_status_obj = copy.deepcopy(valid_component_definition)
    doc_with_status_obj["component-definition"]["components"][0]["status"] = {
        "state": "operational"
    }
    errors = list(validator.iter_errors(doc_with_status_obj))
    assert len(errors) > 0
    assert any("Additional properties are not allowed" in e.message and "'status' was unexpected" in e.message for e in errors)
    
    # 3. Injecting 'status' as a string
    doc_with_status_str = copy.deepcopy(valid_component_definition)
    doc_with_status_str["component-definition"]["components"][0]["status"] = "operational"
    errors = list(validator.iter_errors(doc_with_status_str))
    assert len(errors) > 0
    assert any("Additional properties are not allowed" in e.message and "'status' was unexpected" in e.message for e in errors)


def test_stage3_service_protocols_with_port_ranges(valid_component_definition):
    """
    Challenge 3.2:
    Verify that oscal_component_schema.json accepts service protocols with TCP/UDP port ranges.
    """
    validator = get_validator_for_file("oscal_component_schema.json")
    doc = copy.deepcopy(valid_component_definition)
    doc["component-definition"]["components"][0]["protocols"] = [
        {
            "uuid": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
            "name": "https",
            "title": "Encrypted HTTPS Transport",
            "port-ranges": [
                {
                    "start": 443,
                    "end": 443,
                    "transport": "TCP"
                },
                {
                    "start": 8443,
                    "end": 8443,
                    "transport": "TCP"
                }
            ]
        },
        {
            "uuid": "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80",
            "name": "dns",
            "title": "Domain Name Service",
            "port-ranges": [
                {
                    "start": 53,
                    "end": 53,
                    "transport": "UDP"
                }
            ]
        }
    ]
    # Valid protocols with port ranges must validate with zero errors
    errors = list(validator.iter_errors(doc))
    assert errors == [], f"Expected valid protocols to pass, got: {errors}"
    
    # Negative test: invalid transport type (e.g. ICMP or SCTP)
    doc_invalid_transport = copy.deepcopy(doc)
    doc_invalid_transport["component-definition"]["components"][0]["protocols"][0]["port-ranges"][0]["transport"] = "SCTP"
    errors = list(validator.iter_errors(doc_invalid_transport))
    assert len(errors) > 0
    assert any("'SCTP' is not one of ['TCP', 'UDP']" in e.message for e in errors)


# ==============================================================================
# STAGE 4: System Security Plan (SSP)
# ==============================================================================

@pytest.fixture
def valid_ssp():
    return {
        "system-security-plan": {
            "uuid": "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8091",
            "metadata": {
                "title": "Minimal System Security Plan",
                "last-modified": "2026-09-05T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-profile": {
                "href": "../profiles/fedramp-moderate.json"
            },
            "system-characteristics": {
                "system-name": "Core Banking Production",
                "description": "Financial transaction processing environment.",
                "system-ids": [
                    {
                        "id": "SYS-PROD-001"
                    }
                ],
                "system-information": {
                    "information-types": [
                        {
                            "uuid": "f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8091a2",
                            "title": "Financial Transaction Data",
                            "description": "Sensitive banking ledger entries."
                        }
                    ]
                },
                "security-sensitivity-level": "moderate",
                "status": {
                    "state": "operational"
                },
                "authorization-boundary": {
                    "description": "AWS us-east-1 VPC production perimeter."
                }
            },
            "system-implementation": {
                "users": [
                    {
                        "uuid": "a7b8c9d0-e1f2-4a3b-4c5d-6e7f8091a2b3",
                        "title": "System Administrator",
                        "role-ids": ["admin"]
                    }
                ],
                "components": [
                    {
                        "uuid": "b8c9d0e1-f2a3-4b4c-5d6e-7f8091a2b3c4",
                        "type": "this-system",
                        "title": "Core Banking Authorization Boundary",
                        "description": "Primary root component representing organizational boundary.",
                        "status": {
                            "state": "operational"
                        }
                    }
                ]
            },
            "control-implementation": {
                "description": "Implementation of FedRAMP Moderate controls.",
                "implemented-requirements": [
                    {
                        "uuid": "c9d0e1f2-a3b4-4c5d-6e7f-8091a2b3c4d5",
                        "control-id": "ac-2"
                    }
                ]
            }
        }
    }


def test_stage4_all_six_root_assemblies_mandatory(valid_ssp):
    """
    Challenge 4.1:
    Verify that oscal_ssp_schema.json requires ALL SIX root assemblies:
    uuid, metadata, import-profile, system-characteristics, system-implementation, control-implementation.
    """
    validator = get_validator_for_file("oscal_ssp_schema.json")
    
    # 1. Baseline valid document validates cleanly
    errors = list(validator.iter_errors(valid_ssp))
    assert errors == [], f"Unexpected errors on valid SSP: {errors}"
    
    # 2. Check schema definition directly
    raw_schema = load_schema("oscal_ssp_schema.json")
    ssp_def = raw_schema["definitions"]["oscal-ssp-oscal-ssp:system-security-plan"]
    mandatory_assemblies = [
        "uuid",
        "metadata",
        "import-profile",
        "system-characteristics",
        "system-implementation",
        "control-implementation"
    ]
    for assembly in mandatory_assemblies:
        assert assembly in ssp_def["required"], f"Expected {assembly} to be in required list"
    
    # 3. Empirically verify omitting each assembly raises ValidationError
    for assembly in mandatory_assemblies:
        doc = copy.deepcopy(valid_ssp)
        del doc["system-security-plan"][assembly]
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{assembly}' is a required property" in e.message for e in errors)


def test_stage4_system_component_requires_status_state(valid_ssp):
    """
    Challenge 4.2:
    Verify that system-component requires status, and status requires state.
    """
    validator = get_validator_for_file("oscal_ssp_schema.json")
    
    # Baseline valid
    errors = list(validator.iter_errors(valid_ssp))
    assert errors == []
    
    # Case A: Omit 'status' entirely from system-component
    doc_no_status = copy.deepcopy(valid_ssp)
    del doc_no_status["system-security-plan"]["system-implementation"]["components"][0]["status"]
    errors = list(validator.iter_errors(doc_no_status))
    assert len(errors) > 0
    assert any("'status' is a required property" in e.message for e in errors)
    
    # Case B: 'status' is empty dict (missing 'state')
    doc_empty_status = copy.deepcopy(valid_ssp)
    doc_empty_status["system-security-plan"]["system-implementation"]["components"][0]["status"] = {}
    errors = list(validator.iter_errors(doc_empty_status))
    assert len(errors) > 0
    assert any("'state' is a required property" in e.message for e in errors)
    
    # Case C: 'state' with invalid enum value
    doc_invalid_state = copy.deepcopy(valid_ssp)
    doc_invalid_state["system-security-plan"]["system-implementation"]["components"][0]["status"]["state"] = "active"
    errors = list(validator.iter_errors(doc_invalid_state))
    assert len(errors) > 0
    assert any("'active' is not one of ['under-development', 'operational', 'disposition', 'other']" in e.message for e in errors)
    
    # Case D: Valid state tokens
    for valid_state in ["under-development", "operational", "disposition", "other"]:
        doc_valid_state = copy.deepcopy(valid_ssp)
        doc_valid_state["system-security-plan"]["system-implementation"]["components"][0]["status"]["state"] = valid_state
        errors = list(validator.iter_errors(doc_valid_state))
        assert errors == []


# ==============================================================================
# STAGE 5: Assessment Plan (AP)
# ==============================================================================

@pytest.fixture
def valid_assessment_plan():
    return {
        "assessment-plan": {
            "uuid": "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a",
            "metadata": {
                "title": "Minimal Assessment Plan",
                "last-modified": "2026-09-05T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-ssp": {
                "href": "../ssps/core-banking.json"
            },
            "reviewed-controls": {
                "control-selections": [
                    {
                        "include-all": {}
                    }
                ]
            },
            "tasks": [
                {
                    "uuid": "e2f3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a6b",
                    "type": "action",
                    "title": "Authentication Assessment Task",
                    "description": "Examine session controls and lockout policies.",
                    "timing": {
                        "on-date": {
                            "date": "2026-10-15T09:00:00Z"
                        }
                    }
                }
            ]
        }
    }


def test_stage5_task_timing_branches_individually_valid(valid_assessment_plan):
    """
    Challenge 5.1:
    Verify that each of the three timing branches in task is individually valid:
    1. on-date
    2. within-date-range
    3. at-frequency
    """
    validator = get_validator_for_file("oscal_assessment-plan_schema.json")
    
    # Branch 1: on-date
    doc_on_date = copy.deepcopy(valid_assessment_plan)
    doc_on_date["assessment-plan"]["tasks"][0]["timing"] = {
        "on-date": {
            "date": "2026-10-15T09:00:00Z"
        }
    }
    errors = list(validator.iter_errors(doc_on_date))
    assert errors == []
    
    # Branch 2: within-date-range
    doc_date_range = copy.deepcopy(valid_assessment_plan)
    doc_date_range["assessment-plan"]["tasks"][0]["timing"] = {
        "within-date-range": {
            "start": "2026-10-15T09:00:00Z",
            "end": "2026-10-22T17:00:00Z"
        }
    }
    errors = list(validator.iter_errors(doc_date_range))
    assert errors == []
    
    # Branch 3: at-frequency
    for unit in ["seconds", "minutes", "hours", "days", "months", "years"]:
        doc_freq = copy.deepcopy(valid_assessment_plan)
        doc_freq["assessment-plan"]["tasks"][0]["timing"] = {
            "at-frequency": {
                "period": 1,
                "unit": unit
            }
        }
        errors = list(validator.iter_errors(doc_freq))
        assert errors == []


def test_stage5_task_timing_anyof_mutual_exclusivity(valid_assessment_plan):
    """
    Challenge 5.2:
    Empirically test whether oscal_assessment-plan_schema.json enforces mutual exclusivity
    across the three timing branches via anyOf + additionalProperties: false.
    """
    validator = get_validator_for_file("oscal_assessment-plan_schema.json")
    
    # Combination A: on-date AND within-date-range
    doc_combo_ab = copy.deepcopy(valid_assessment_plan)
    doc_combo_ab["assessment-plan"]["tasks"][0]["timing"] = {
        "on-date": {"date": "2026-10-15T09:00:00Z"},
        "within-date-range": {"start": "2026-10-15T09:00:00Z", "end": "2026-10-22T17:00:00Z"}
    }
    errors = list(validator.iter_errors(doc_combo_ab))
    assert len(errors) > 0
    assert any("is not valid under any of the given schemas" in e.message for e in errors)
    
    # Combination B: on-date AND at-frequency
    doc_combo_ac = copy.deepcopy(valid_assessment_plan)
    doc_combo_ac["assessment-plan"]["tasks"][0]["timing"] = {
        "on-date": {"date": "2026-10-15T09:00:00Z"},
        "at-frequency": {"period": 7, "unit": "days"}
    }
    errors = list(validator.iter_errors(doc_combo_ac))
    assert len(errors) > 0
    assert any("is not valid under any of the given schemas" in e.message for e in errors)
    
    # Combination C: within-date-range AND at-frequency
    doc_combo_bc = copy.deepcopy(valid_assessment_plan)
    doc_combo_bc["assessment-plan"]["tasks"][0]["timing"] = {
        "within-date-range": {"start": "2026-10-15T09:00:00Z", "end": "2026-10-22T17:00:00Z"},
        "at-frequency": {"period": 7, "unit": "days"}
    }
    errors = list(validator.iter_errors(doc_combo_bc))
    assert len(errors) > 0
    assert any("is not valid under any of the given schemas" in e.message for e in errors)
    
    # Combination D: All three branches simultaneously
    doc_all_three = copy.deepcopy(valid_assessment_plan)
    doc_all_three["assessment-plan"]["tasks"][0]["timing"] = {
        "on-date": {"date": "2026-10-15T09:00:00Z"},
        "within-date-range": {"start": "2026-10-15T09:00:00Z", "end": "2026-10-22T17:00:00Z"},
        "at-frequency": {"period": 7, "unit": "days"}
    }
    errors = list(validator.iter_errors(doc_all_three))
    assert len(errors) > 0
    assert any("is not valid under any of the given schemas" in e.message for e in errors)
    
    # Empty timing object is also rejected
    doc_empty_timing = copy.deepcopy(valid_assessment_plan)
    doc_empty_timing["assessment-plan"]["tasks"][0]["timing"] = {}
    errors = list(validator.iter_errors(doc_empty_timing))
    assert len(errors) > 0
    assert any("is not valid under any of the given schemas" in e.message for e in errors)


# ==============================================================================
# STAGE 6: Assessment Results (AR)
# ==============================================================================

@pytest.fixture
def valid_assessment_results():
    return {
        "assessment-results": {
            "uuid": "f1a2b3c4-d5e6-4a7b-8c9d-0e1f2a3b4c5d",
            "metadata": {
                "title": "Minimal Assessment Results",
                "last-modified": "2026-09-05T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-ap": {
                "href": "../assessment-plans/plan.json"
            },
            "results": [
                {
                    "uuid": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
                    "title": "Q3 Annual Assessment Result Set",
                    "description": "Full scope testing evaluation.",
                    "start": "2026-09-01T09:00:00Z",
                    "reviewed-controls": {
                        "control-selections": [
                            {"include-all": {}}
                        ]
                    },
                    "findings": [
                        {
                            "uuid": "b3c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e",
                            "title": "Unenforced Session Lockout",
                            "description": "Account remains unlocked after 5 invalid attempts.",
                            "target": {
                                "type": "statement-id",
                                "target-id": "ac-7_smt_a",
                                "status": {
                                    "state": "not-satisfied"
                                }
                            }
                        }
                    ]
                }
            ]
        }
    }


def test_stage6_findings_outside_results_strictly_rejected(valid_assessment_results):
    """
    Challenge 6.1:
    Verify that oscal_assessment-results_schema.json rejects findings placed at root level outside results[].
    """
    validator = get_validator_for_file("oscal_assessment-results_schema.json")
    
    # 1. Baseline nested findings validate cleanly
    errors = list(validator.iter_errors(valid_assessment_results))
    assert errors == []
    
    # 2. Move findings array to root level
    doc_root_findings = copy.deepcopy(valid_assessment_results)
    findings = doc_root_findings["assessment-results"]["results"][0].pop("findings")
    doc_root_findings["assessment-results"]["findings"] = findings
    
    errors = list(validator.iter_errors(doc_root_findings))
    assert len(errors) > 0
    assert any("Additional properties are not allowed ('findings' was unexpected)" in e.message for e in errors)
    
    # 3. Try placing observations at root level
    doc_root_obs = copy.deepcopy(valid_assessment_results)
    doc_root_obs["assessment-results"]["observations"] = []
    errors = list(validator.iter_errors(doc_root_obs))
    assert len(errors) > 0
    assert any("Additional properties are not allowed ('observations' was unexpected)" in e.message for e in errors)


def test_stage6_finding_target_types_restricted(valid_assessment_results):
    """
    Challenge 6.2:
    Verify that finding.target.type strictly allows ONLY 'statement-id' and 'objective-id'.
    """
    validator = get_validator_for_file("oscal_assessment-results_schema.json")
    
    # Case A: type = 'statement-id' -> VALID
    doc_smt = copy.deepcopy(valid_assessment_results)
    doc_smt["assessment-results"]["results"][0]["findings"][0]["target"]["type"] = "statement-id"
    doc_smt["assessment-results"]["results"][0]["findings"][0]["target"]["target-id"] = "ac-7_smt_a"
    errors = list(validator.iter_errors(doc_smt))
    assert errors == []
    
    # Case B: type = 'objective-id' -> VALID
    doc_obj = copy.deepcopy(valid_assessment_results)
    doc_obj["assessment-results"]["results"][0]["findings"][0]["target"]["type"] = "objective-id"
    doc_obj["assessment-results"]["results"][0]["findings"][0]["target"]["target-id"] = "ac-7_obj_1"
    errors = list(validator.iter_errors(doc_obj))
    assert errors == []
    
    # Case C: type = 'control-id' -> INVALID (rejected by schema enum)
    doc_ctrl = copy.deepcopy(valid_assessment_results)
    doc_ctrl["assessment-results"]["results"][0]["findings"][0]["target"]["type"] = "control-id"
    doc_ctrl["assessment-results"]["results"][0]["findings"][0]["target"]["target-id"] = "ac-7"
    errors = list(validator.iter_errors(doc_ctrl))
    assert len(errors) > 0
    assert any("'control-id' is not one of ['statement-id', 'objective-id']" in e.message for e in errors)
    
    # Case D: type = 'component-id' -> INVALID
    doc_comp = copy.deepcopy(valid_assessment_results)
    doc_comp["assessment-results"]["results"][0]["findings"][0]["target"]["type"] = "component-id"
    errors = list(validator.iter_errors(doc_comp))
    assert len(errors) > 0
    assert any("'component-id' is not one of ['statement-id', 'objective-id']" in e.message for e in errors)


# ==============================================================================
# STAGE 7: Plan of Action and Milestones (POA&M)
# ==============================================================================

@pytest.fixture
def valid_poam():
    return {
        "plan-of-action-and-milestones": {
            "uuid": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "metadata": {
                "title": "Enterprise Remediation POA&M",
                "last-modified": "2026-09-05T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-ssp": {
                "href": "../ssps/production.json"
            },
            "observations": [
                {
                    "uuid": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                    "description": "Log inspection revealed unencrypted syslog transmission.",
                    "methods": ["EXAMINE"],
                    "collected": "2026-09-01T10:00:00Z"
                }
            ],
            "risks": [
                {
                    "uuid": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                    "title": "Cleartext Log Eavesdropping",
                    "description": "Network eavesdropping vulnerability.",
                    "statement": "An attacker on the internal subnet can intercept sensitive authentication tokens.",
                    "status": "open"
                }
            ],
            "findings": [
                {
                    "uuid": "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80",
                    "title": "AU-9 Protection of Audit Information Unsatisfied",
                    "description": "Audit transmission lacks encryption in transit.",
                    "target": {
                        "type": "statement-id",
                        "target-id": "au-9_smt_a",
                        "status": {
                            "state": "not-satisfied"
                        }
                    }
                }
            ],
            "poam-items": [
                {
                    "uuid": "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8091",
                    "title": "Upgrade Syslog Daemon to TLS 1.3",
                    "description": "Reconfigure rsyslog on all production nodes to use mutual TLS encryption.",
                    "related-findings": [
                        {
                            "finding-uuid": "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80"
                        }
                    ]
                }
            ]
        }
    }


def test_stage7_root_level_entities_valid(valid_poam):
    """
    Challenge 7.1:
    Verify that in POA&M, observations, risks, findings, and poam-items reside directly at root.
    """
    validator = get_validator_for_file("oscal_poam_schema.json")
    # All entities directly at root validates cleanly
    errors = list(validator.iter_errors(valid_poam))
    assert errors == []


def test_stage7_results_wrapper_strictly_rejected(valid_poam):
    """
    Challenge 7.2:
    Verify that oscal_poam_schema.json strictly rejects documents that wrap entities in a 'results' object.
    """
    validator = get_validator_for_file("oscal_poam_schema.json")
    
    # Wrap findings inside a results object
    doc_wrapped = copy.deepcopy(valid_poam)
    findings = doc_wrapped["plan-of-action-and-milestones"].pop("findings")
    doc_wrapped["plan-of-action-and-milestones"]["results"] = [
        {"findings": findings}
    ]
    
    errors = list(validator.iter_errors(doc_wrapped))
    assert len(errors) > 0
    assert any("Additional properties are not allowed ('results' was unexpected)" in e.message for e in errors)


# ==============================================================================
# STAGE 8: Control Mapping (Mapping Collection)
# ==============================================================================

@pytest.fixture
def valid_mapping_collection():
    return {
        "mapping-collection": {
            "uuid": "11111111-2222-4333-8444-555555555555",
            "metadata": {
                "title": "NIST SP 800-53 Rev 5 to ISO/IEC 27001:2022 Crosswalk",
                "last-modified": "2026-09-05T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "provenance": {
                "method": "human",
                "matching-rationale": "semantic",
                "status": "draft",
                "mapping-description": "Bilateral security control mapping between NIST and ISO."
            },
            "mappings": [
                {
                    "uuid": "22222222-3333-4444-8555-666666666666",
                    "source-resource": {
                        "type": "catalog",
                        "href": "../catalogs/nist-sp800-53-r5.json"
                    },
                    "target-resource": {
                        "type": "catalog",
                        "href": "../catalogs/iso-27001-2022.json"
                    },
                    "maps": [
                        {
                            "uuid": "33333333-4444-4555-8666-777777777777",
                            "relationship": "subset-of",
                            "sources": [
                                {
                                    "type": "control",
                                    "id-ref": "ac-2"
                                }
                            ],
                            "targets": [
                                {
                                    "type": "control",
                                    "id-ref": "A.9.2.1"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }


def test_stage8_multi_mapping_array_supported(valid_mapping_collection):
    """
    Challenge 8.1:
    Verify that oscal_mapping_schema.json supports an array of multiple mapping items.
    """
    validator = get_validator_for_file("oscal_mapping_schema.json")
    
    # 1. Single mapping in array validates
    errors = list(validator.iter_errors(valid_mapping_collection))
    assert errors == []
    
    # 2. Multi-mapping array (e.g. NIST->ISO and NIST->CIS in one file)
    doc_multi = copy.deepcopy(valid_mapping_collection)
    second_mapping = {
        "uuid": "44444444-5555-4666-8777-888888888888",
        "source-resource": {
            "type": "catalog",
            "href": "../catalogs/nist-sp800-53-r5.json"
        },
        "target-resource": {
            "type": "catalog",
            "href": "../catalogs/cis-controls-v8.json"
        },
        "maps": [
            {
                "uuid": "55555555-6666-4777-8888-999999999999",
                "relationship": "equivalent-to",
                "sources": [{"type": "control", "id-ref": "ac-2"}],
                "targets": [{"type": "control", "id-ref": "5.1"}]
            }
        ]
    }
    doc_multi["mapping-collection"]["mappings"].append(second_mapping)
    
    # Must validate cleanly with multiple mappings
    errors = list(validator.iter_errors(doc_multi))
    assert errors == []
    assert len(doc_multi["mapping-collection"]["mappings"]) == 2


def test_stage8_canonical_relationship_tokens_in_metaschema_and_schema(valid_mapping_collection):
    """
    Challenge 8.2:
    Verify the 6 canonical relationship tokens in both:
    1. The official XML Metaschema constraints (oscal_mapping-common_metaschema.xml)
    2. The JSON schema validation behavior (oscal_mapping_schema.json)
    """
    validator = get_validator_for_file("oscal_mapping_schema.json")
    
    canonical_tokens = [
        "equal-to",
        "equivalent-to",
        "subset-of",
        "superset-of",
        "intersects-with",
        "no-relationship"
    ]
    
    # 1. Metaschema constraint verification
    metaschema_file = os.path.join(METASCHEMA_DIR, "oscal_mapping-common_metaschema.xml")
    assert os.path.exists(metaschema_file), f"Metaschema not found at {metaschema_file}"
    
    tree = ET.parse(metaschema_file)
    root = tree.getroot()
    
    found_tokens = []
    for elem in root.iter():
        if elem.attrib.get("name") == "relationship":
            for allowed in elem.iter():
                if allowed.tag.endswith("enum"):
                    val = allowed.attrib.get("value")
                    if val:
                        found_tokens.append(val)
    
    # Metaschema must specify exactly the 6 canonical tokens
    assert set(found_tokens) == set(canonical_tokens), (
        f"Metaschema tokens mismatch! Expected {canonical_tokens}, found {found_tokens}"
    )
    
    # 2. JSON Schema accepts all 6 canonical tokens
    for token in canonical_tokens:
        doc = copy.deepcopy(valid_mapping_collection)
        doc["mapping-collection"]["mappings"][0]["maps"][0]["relationship"] = token
        errors = list(validator.iter_errors(doc))
        assert errors == [], f"Expected canonical token '{token}' to validate, got: {errors}"


def test_stage5_at_frequency_period_and_unit_constraints(valid_assessment_plan):
    """
    Challenge 5.3:
    Verify that task.timing.at-frequency enforces positive integer period and valid unit enum.
    """
    validator = get_validator_for_file("oscal_assessment-plan_schema.json")
    
    # Negative test: unit = 'weeks' (invalid enum; allowed: seconds, minutes, hours, days, months, years)
    doc_invalid_unit = copy.deepcopy(valid_assessment_plan)
    doc_invalid_unit["assessment-plan"]["tasks"][0]["timing"] = {
        "at-frequency": {
            "period": 2,
            "unit": "weeks"
        }
    }
    errors = list(validator.iter_errors(doc_invalid_unit))
    assert len(errors) > 0
    assert any("is not valid under any of the given schemas" in e.message for e in errors)
    
    # Negative test: period = 0 (PositiveIntegerDatatype requires >= 1)
    doc_zero_period = copy.deepcopy(valid_assessment_plan)
    doc_zero_period["assessment-plan"]["tasks"][0]["timing"] = {
        "at-frequency": {
            "period": 0,
            "unit": "days"
        }
    }
    errors = list(validator.iter_errors(doc_zero_period))
    assert len(errors) > 0


def test_stage6_finding_target_status_state_enum(valid_assessment_results):
    """
    Challenge 6.3:
    Verify that finding.target.status.state accepts only 'satisfied' or 'not-satisfied'.
    """
    validator = get_validator_for_file("oscal_assessment-results_schema.json")
    
    # Valid: 'satisfied'
    doc_sat = copy.deepcopy(valid_assessment_results)
    doc_sat["assessment-results"]["results"][0]["findings"][0]["target"]["status"]["state"] = "satisfied"
    errors = list(validator.iter_errors(doc_sat))
    assert errors == []
    
    # Valid: 'not-satisfied'
    doc_not_sat = copy.deepcopy(valid_assessment_results)
    doc_not_sat["assessment-results"]["results"][0]["findings"][0]["target"]["status"]["state"] = "not-satisfied"
    errors = list(validator.iter_errors(doc_not_sat))
    assert errors == []
    
    # Invalid: 'open', 'pass', 'fail' in state field
    for invalid_state in ["open", "pass", "fail", "closed"]:
        doc_inv = copy.deepcopy(valid_assessment_results)
        doc_inv["assessment-results"]["results"][0]["findings"][0]["target"]["status"]["state"] = invalid_state
        errors = list(validator.iter_errors(doc_inv))
        assert len(errors) > 0
        assert any(f"'{invalid_state}' is not one of ['satisfied', 'not-satisfied']" in e.message for e in errors)


def test_stage7_poam_dual_scoping_and_poam_items_required(valid_poam):
    """
    Challenge 7.3:
    Verify that POA&M supports dual scoping (import-ssp or system-id) and strictly requires poam-items.
    """
    validator = get_validator_for_file("oscal_poam_schema.json")
    
    # Scoping via system-id instead of import-ssp
    doc_sys_id = copy.deepcopy(valid_poam)
    del doc_sys_id["plan-of-action-and-milestones"]["import-ssp"]
    doc_sys_id["plan-of-action-and-milestones"]["system-id"] = {
        "id": "SYS-FED-001"
    }
    errors = list(validator.iter_errors(doc_sys_id))
    assert errors == []
    
    # Both import-ssp and system-id can coexist
    doc_both = copy.deepcopy(valid_poam)
    doc_both["plan-of-action-and-milestones"]["system-id"] = {
        "id": "SYS-FED-001"
    }
    errors = list(validator.iter_errors(doc_both))
    assert errors == []
    
    # Omit poam-items -> strictly fails (poam-items is mandatory)
    doc_no_items = copy.deepcopy(valid_poam)
    del doc_no_items["plan-of-action-and-milestones"]["poam-items"]
    errors = list(validator.iter_errors(doc_no_items))
    assert len(errors) > 0
    assert any("'poam-items' is a required property" in e.message for e in errors)


def test_stage8_provenance_methodology_enums_strictly_enforced(valid_mapping_collection):
    """
    Challenge 8.3:
    Verify that provenance method, matching-rationale, and status strictly enforce their enums.
    """
    validator = get_validator_for_file("oscal_mapping_schema.json")
    
    # Method invalid: 'manual' (only 'human', 'automation', 'hybrid' allowed)
    doc_inv_method = copy.deepcopy(valid_mapping_collection)
    doc_inv_method["mapping-collection"]["provenance"]["method"] = "manual"
    errors = list(validator.iter_errors(doc_inv_method))
    assert len(errors) > 0
    assert any("'manual' is not one of ['human', 'automation', 'hybrid']" in e.message for e in errors)
    
    # Matching-rationale invalid: 'exact' (only 'syntactic', 'semantic', 'functional' allowed)
    doc_inv_rat = copy.deepcopy(valid_mapping_collection)
    doc_inv_rat["mapping-collection"]["provenance"]["matching-rationale"] = "exact"
    errors = list(validator.iter_errors(doc_inv_rat))
    assert len(errors) > 0
    assert any("'exact' is not one of ['syntactic', 'semantic', 'functional']" in e.message for e in errors)
    
    # Status invalid: 'in-progress' (only 'complete', 'not-complete', 'draft', 'deprecated', 'superseded' allowed)
    doc_inv_stat = copy.deepcopy(valid_mapping_collection)
    doc_inv_stat["mapping-collection"]["provenance"]["status"] = "in-progress"
    errors = list(validator.iter_errors(doc_inv_stat))
    assert len(errors) > 0
    assert any("'in-progress' is not one of ['complete', 'not-complete', 'draft', 'deprecated', 'superseded']" in e.message for e in errors)
