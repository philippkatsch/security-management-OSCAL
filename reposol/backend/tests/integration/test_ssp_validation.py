"""
Integration tests for Step 4: SSP Integrity and OSCAL Schema Validation.
Tests coverage for BE-SSP-05 and NIST OSCAL SSP v1.2.2 schema compliance.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.factories import SSPFactory, ProfileFactory, CatalogFactory


def test_valid_ssp_with_profile_baseline_passes(client: TestClient, saved_catalog, saved_profile):
    """Test that a valid SSP referencing a saved Profile passes validation (BE-SSP-05)."""
    # 1. Create a baseline Catalog & Profile
    cat_id, _ = saved_catalog()
    prof_id, _ = saved_profile(catalog_uuid=cat_id)

    # 2. Build SSP referencing the profile
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="Valid Enterprise SSP",
        profile_uuid=prof_id
    )

    # Validate via /api/validate/ssps
    val_res = client.post("/api/validate/ssps", json=ssp_doc)
    assert val_res.status_code == 200
    assert val_res.json().get("status") == "valid"

    # Validate via stage alias /api/validate/system-security-plans (BE-SSP-01)
    val_alias_res = client.post("/api/validate/system-security-plans", json=ssp_doc)
    assert val_alias_res.status_code == 200
    assert val_alias_res.json().get("status") == "valid"


def test_valid_ssp_with_catalog_baseline_passes(client: TestClient, saved_catalog):
    """Test that an SSP referencing a direct Catalog baseline passes validation (BE-SSP-05)."""
    # 1. Create a baseline Catalog
    cat_id, _ = saved_catalog()

    # 2. Build SSP referencing the catalog
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="Catalog-based SSP",
        catalog_uuid=cat_id
    )

    val_res = client.post("/api/validate/ssps", json=ssp_doc)
    assert val_res.status_code == 200
    assert val_res.json().get("status") == "valid"


def test_valid_ssp_with_external_url_baseline_passes(client: TestClient):
    """Test that an SSP with an external HTTP/HTTPS URI baseline passes validation gracefully (BE-SSP-05)."""
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="External Baseline SSP",
        import_profile_href="https://raw.githubusercontent.com/usnistgov/oscal-content/master/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json"
    )

    val_res = client.post("/api/validate/ssps", json=ssp_doc)
    assert val_res.status_code == 200
    assert val_res.json().get("status") == "valid"


def test_ssp_nonexistent_baseline_fails(client: TestClient):
    """Test that an SSP referencing a non-existent profile/catalog UUID fails integrity check."""
    missing_uuid = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        title="Invalid Baseline SSP",
        profile_uuid=missing_uuid
    )

    val_res = client.post("/api/validate/ssps", json=ssp_doc)
    assert val_res.status_code == 400
    assert "does not exist" in val_res.text


def test_ssp_duplicate_control_id_fails(client: TestClient, saved_catalog):
    """Test that duplicate control-ids in implemented-requirements fail validation."""
    cat_id, _ = saved_catalog()
    this_system_uuid = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Control impl",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Impl 1"}]
                },
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",  # Duplicate
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Impl 2"}]
                }
            ]
        }
    )

    val_res = client.post("/api/validate/ssps", json=ssp_doc)
    assert val_res.status_code == 400
    assert "Duplicate control-id" in val_res.text


def test_ssp_invalid_component_uuid_fails(client: TestClient, saved_catalog):
    """Test that referencing a non-existent component UUID in top-level by-components fails validation."""
    cat_id, _ = saved_catalog()
    non_existent_comp = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        catalog_uuid=cat_id,
        control_implementation={
            "description": "Control impl",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    "by-components": [
                        {"uuid": str(uuid.uuid4()), "component-uuid": non_existent_comp, "description": "Impl"}
                    ]
                }
            ]
        }
    )

    val_res = client.post("/api/validate/ssps", json=ssp_doc)
    assert val_res.status_code == 400
    assert "Referenced component" in val_res.text


def test_ssp_statement_level_component_validation(client: TestClient, saved_catalog):
    """Test that statement-level by-components are validated for existence and format (BE-SSP-05)."""
    cat_id, _ = saved_catalog()
    this_system_uuid = str(uuid.uuid4())
    non_existent_comp = str(uuid.uuid4())

    # Invalid statement component reference
    invalid_ssp = SSPFactory.build(
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Control impl",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Top impl"}],
                    "statements": [
                        {
                            "statement-id": "ac-1_smt.a",
                            "uuid": str(uuid.uuid4()),
                            "by-components": [
                                {"uuid": str(uuid.uuid4()), "component-uuid": non_existent_comp, "description": "Stmt impl"}
                            ]
                        }
                    ]
                }
            ]
        }
    )

    val_res = client.post("/api/validate/ssps", json=invalid_ssp)
    assert val_res.status_code == 400
    assert "Referenced component" in val_res.text

    # Valid statement component reference
    valid_ssp = SSPFactory.build(
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Control impl",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Top impl"}],
                    "statements": [
                        {
                            "statement-id": "ac-1_smt.a",
                            "uuid": str(uuid.uuid4()),
                            "by-components": [
                                {"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Stmt impl"}
                            ]
                        }
                    ]
                }
            ]
        }
    )

    val_valid_res = client.post("/api/validate/ssps", json=valid_ssp)
    assert val_valid_res.status_code == 200
    assert val_valid_res.json().get("status") == "valid"


def test_ssp_component_definition_import_validation(client: TestClient, saved_catalog):
    """Test that component UUIDs imported from Component Definitions in workspace are accepted (US 4.11)."""
    cat_id, _ = saved_catalog()

    # Create a Component Definition with a defined component
    cdef_id = str(uuid.uuid4())
    cdef_comp_id = str(uuid.uuid4())
    cdef_doc = {
        "component-definition": {
            "uuid": cdef_id,
            "metadata": {
                "title": "AWS Reference Components",
                "last-modified": "2026-07-20T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2"
            },
            "components": [
                {
                    "uuid": cdef_comp_id,
                    "type": "service",
                    "title": "Amazon S3 Storage",
                    "description": "Object storage service"
                }
            ]
        }
    }
    create_cdef = client.post("/api/documents/component-definition", json=cdef_doc)
    assert create_cdef.status_code == 201

    # SSP references the cdef component
    ssp_doc = SSPFactory.build(
        catalog_uuid=cat_id,
        control_implementation={
            "description": "Control impl",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "sc-13",
                    "by-components": [
                        {"uuid": str(uuid.uuid4()), "component-uuid": cdef_comp_id, "description": "Implemented via S3 encryption."}
                    ]
                }
            ]
        }
    )

    val_res = client.post("/api/validate/ssps", json=ssp_doc)
    assert val_res.status_code == 200
    assert val_res.json().get("status") == "valid"
