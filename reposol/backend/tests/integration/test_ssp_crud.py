"""
Integration tests for Step 4: System Security Plan (SSP) CRUD, Lifecycle, Versioning, and Export.
Tests coverage for US 4.1 through US 4.25 and DD-036.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.factories import SSPFactory, ProfileFactory, CatalogFactory


def test_ssp_create_and_get(client: TestClient, saved_catalog):
    """Test creation and retrieval of an SSP document via all stage aliases (BE-SSP-01)."""
    cat_id, _ = saved_catalog()
    doc_id = str(uuid.uuid4())
    doc = SSPFactory.build(doc_id=doc_id, title="Enterprise Security Plan", catalog_uuid=cat_id)

    # POST create via /api/documents/ssp
    response = client.post("/api/documents/ssp", json=doc)
    assert response.status_code == 201, f"Failed: {response.json()}"
    res_data = response.json()
    assert res_data["system-security-plan"]["uuid"] == doc_id
    assert res_data["system-security-plan"]["metadata"]["title"] == "Enterprise Security Plan"

    # GET single via /api/documents/ssp/{id}
    get_res = client.get(f"/api/documents/ssp/{doc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["system-security-plan"]["uuid"] == doc_id

    # GET single via /api/documents/ssps/{id}
    get_ssps_res = client.get(f"/api/documents/ssps/{doc_id}")
    assert get_ssps_res.status_code == 200
    assert get_ssps_res.json()["system-security-plan"]["uuid"] == doc_id

    # GET single via /api/documents/system-security-plans/{id}
    get_ssp_alias_res = client.get(f"/api/documents/system-security-plans/{doc_id}")
    assert get_ssp_alias_res.status_code == 200
    assert get_ssp_alias_res.json()["system-security-plan"]["uuid"] == doc_id

    # GET list via /api/documents/ssps
    list_res = client.get("/api/documents/ssps")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d.get("system-security-plan", {}).get("uuid") == doc_id for d in docs)

    # GET list via /api/documents/system-security-plans
    list_alias_res = client.get("/api/documents/system-security-plans")
    assert list_alias_res.status_code == 200
    assert any(d.get("system-security-plan", {}).get("uuid") == doc_id for d in list_alias_res.json())


def test_ssp_update_and_delete(client: TestClient, saved_catalog):
    """Test updating and deleting an SSP document."""
    cat_id, _ = saved_catalog()
    doc_id = str(uuid.uuid4())
    doc = SSPFactory.build(doc_id=doc_id, title="Original SSP Title", catalog_uuid=cat_id)
    create_res = client.post("/api/documents/ssps", json=doc)
    assert create_res.status_code == 201

    # Update document via POST /api/documents/ssps
    doc["system-security-plan"]["metadata"]["title"] = "Updated SSP Title"
    doc["system-security-plan"]["system-characteristics"]["system-name"] = "Updated System Name"
    post_update_res = client.post("/api/documents/ssps", json=doc)
    assert post_update_res.status_code == 200
    assert post_update_res.json()["system-security-plan"]["metadata"]["title"] == "Updated SSP Title"

    # Verify update persisted
    get_res = client.get(f"/api/documents/ssps/{doc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["system-security-plan"]["metadata"]["title"] == "Updated SSP Title"
    assert get_res.json()["system-security-plan"]["system-characteristics"]["system-name"] == "Updated System Name"

    # Delete document
    del_res = client.delete(f"/api/documents/ssps/{doc_id}")
    assert del_res.status_code == 200

    # Verify document no longer exists
    get_after_del = client.get(f"/api/documents/ssps/{doc_id}")
    assert get_after_del.status_code == 404


def test_ssp_draft_isolation(client: TestClient, saved_catalog):
    """Test that drafts can be saved and do not overwrite published documents."""
    cat_id, _ = saved_catalog()
    doc_id = str(uuid.uuid4())
    doc = SSPFactory.build(doc_id=doc_id, title="Published SSP", catalog_uuid=cat_id)
    create_res = client.post("/api/documents/ssps", json=doc)
    assert create_res.status_code == 201

    # Save a draft modification via version route
    draft_doc = SSPFactory.build(doc_id=doc_id, title="Draft Modified SSP", catalog_uuid=cat_id)
    draft_res = client.post(f"/api/documents/ssps/{doc_id}/versions?is_draft=true", json=draft_doc)
    assert draft_res.status_code in (200, 201)

    # Exporting reads the published version, not the draft
    export_res = client.get(f"/api/export/ssps/{doc_id}?format=json")
    assert export_res.status_code == 200
    assert export_res.json()["system-security-plan"]["metadata"]["title"] == "Published SSP"


def test_ssp_export_formats(client: TestClient, saved_catalog):
    """Test exporting SSP in JSON, YAML, and XML formats."""
    cat_id, _ = saved_catalog()
    doc_id = str(uuid.uuid4())
    doc = SSPFactory.build(doc_id=doc_id, title="Exportable SSP", catalog_uuid=cat_id)
    create_res = client.post("/api/documents/ssps", json=doc)
    assert create_res.status_code == 201

    # JSON export
    json_res = client.get(f"/api/export/ssps/{doc_id}?format=json")
    assert json_res.status_code == 200
    assert "system-security-plan" in json_res.json()

    # YAML export
    yaml_res = client.get(f"/api/export/ssps/{doc_id}?format=yaml")
    assert yaml_res.status_code == 200
    assert "system-security-plan:" in yaml_res.text

    # XML export
    xml_res = client.get(f"/api/export/ssps/{doc_id}?format=xml")
    assert xml_res.status_code == 200
    assert "<system-security-plan" in xml_res.text


def test_ssp_system_characteristics_structure(client: TestClient, saved_catalog):
    """Test creating and persisting full system characteristics per US 4.1 - 4.9."""
    cat_id, _ = saved_catalog()
    doc_id = str(uuid.uuid4())
    info_type_uuid = str(uuid.uuid4())
    doc = SSPFactory.build(
        doc_id=doc_id,
        title="FIPS 199 System Plan",
        catalog_uuid=cat_id,
        system_characteristics={
            "system-ids": [
                {"id": "FEDRAMP-SYS-101", "identifier-type": "https://fedramp.gov"},
                {"id": "INTERNAL-SYS-001", "identifier-type": "https://enterprise.internal"}
            ],
            "system-name": "Mission Critical Cloud",
            "system-name-short": "MCC",
            "description": "Production enterprise application hosting mission critical workloads.",
            "system-information": {
                "information-types": [
                    {
                        "uuid": info_type_uuid,
                        "title": "Personally Identifiable Information (PII)",
                        "description": "User customer data and records.",
                        "confidentiality-impact": {"base": "fips-199-moderate"},
                        "integrity-impact": {"base": "fips-199-moderate"},
                        "availability-impact": {"base": "fips-199-low"}
                    }
                ]
            },
            "security-sensitivity-level": "moderate",
            "security-impact-level": {
                "security-objective-confidentiality": "fips-199-moderate",
                "security-objective-integrity": "fips-199-moderate",
                "security-objective-availability": "fips-199-low"
            },
            "status": {"state": "operational", "remarks": "Full production authorization."},
            "authorization-boundary": {
                "description": "Isolated AWS GovCloud VPC with strict security group boundaries."
            }
        }
    )

    create_res = client.post("/api/documents/ssps", json=doc)
    assert create_res.status_code == 201

    get_res = client.get(f"/api/documents/ssps/{doc_id}")
    assert get_res.status_code == 200
    sys_chars = get_res.json()["system-security-plan"]["system-characteristics"]
    assert len(sys_chars["system-ids"]) == 2
    assert sys_chars["system-name-short"] == "MCC"
    assert sys_chars["security-sensitivity-level"] == "moderate"
    assert len(sys_chars["system-information"]["information-types"]) == 1


def test_ssp_system_implementation_entities(client: TestClient, saved_catalog):
    """Test full system implementation entity collections (US 4.10 - 4.14)."""
    cat_id, _ = saved_catalog()
    doc_id = str(uuid.uuid4())
    party_uuid = str(uuid.uuid4())
    comp1_uuid = str(uuid.uuid4())
    comp2_uuid = str(uuid.uuid4())
    inv_uuid = str(uuid.uuid4())
    auth_uuid = str(uuid.uuid4())

    doc = SSPFactory.build(
        doc_id=doc_id,
        title="Full Implementation SSP",
        catalog_uuid=cat_id,
        metadata_extras={
            "parties": [
                {
                    "uuid": party_uuid,
                    "type": "organization",
                    "name": "Cloud Service Provider Inc."
                }
            ]
        },
        system_implementation={
            "users": [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "SecOps Lead",
                    "role-ids": ["security-operations"],
                    "authorized-privileges": [
                        {
                            "title": "Root Access",
                            "description": "Full access to production cluster",
                            "functions-performed": ["admin", "audit"]
                        }
                    ]
                }
            ],
            "components": [
                {
                    "uuid": comp1_uuid,
                    "type": "this-system",
                    "title": "Enterprise Cloud Platform",
                    "description": "Root boundary anchor",
                    "status": {"state": "operational"}
                },
                {
                    "uuid": comp2_uuid,
                    "type": "service",
                    "title": "Managed PostgreSQL RDS",
                    "description": "Database as a service",
                    "status": {"state": "operational"},
                    "protocols": [
                        {"uuid": str(uuid.uuid4()), "name": "postgresql", "port-ranges": [{"start": 5432, "end": 5432, "transport": "TCP"}]}
                    ]
                }
            ],
            "leveraged-authorizations": [
                {
                    "uuid": auth_uuid,
                    "title": "AWS GovCloud FedRAMP High Authorization",
                    "party-uuid": party_uuid,
                    "date-authorized": "2026-01-15"
                }
            ],
            "inventory-items": [
                {
                    "uuid": inv_uuid,
                    "description": "Production DB Primary Instance",
                    "implemented-components": [{"component-uuid": comp2_uuid}]
                }
            ]
        },
        control_implementation={
            "description": "Control implementations",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    "by-components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "component-uuid": comp1_uuid,
                            "description": "Policy and procedures maintained."
                        }
                    ]
                }
            ]
        }
    )

    create_res = client.post("/api/documents/ssps", json=doc)
    assert create_res.status_code == 201, f"Failed: {create_res.json()}"

    get_res = client.get(f"/api/documents/ssps/{doc_id}")
    assert get_res.status_code == 200
    sys_impl = get_res.json()["system-security-plan"]["system-implementation"]
    assert len(sys_impl["components"]) == 2
    assert len(sys_impl["leveraged-authorizations"]) == 1
    assert len(sys_impl["inventory-items"]) == 1
