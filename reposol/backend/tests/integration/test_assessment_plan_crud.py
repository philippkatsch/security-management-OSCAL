"""
Integration tests for Step 5: Assessment Plan CRUD, Listing, Versioning, and Draft Persistence.
Tests coverage for US 5.1 through US 5.18.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def create_sample_ssp(client: TestClient, title: str = "Target Production SSP") -> str:
    """Helper to save a valid target SSP in the test store."""
    ssp_id = str(uuid.uuid4())
    comp_uuid = str(uuid.uuid4())
    ssp_doc = {
        "system-security-plan": {
            "uuid": ssp_id,
            "metadata": {
                "title": title,
                "last-modified": "2026-09-02T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2",
            },
            "import-profile": {
                "href": "https://example.com/profiles/baseline.json"
            },
            "system-characteristics": {
                "system-name": "Core Banking Production System",
                "description": "Banking core production processing system",
                "system-ids": [{"id": "bank-sys-01", "identifier-type": "https://fedramp.gov"}],
                "system-information": {
                    "information-types": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "Financial Transaction Data",
                            "description": "Core banking account balances and transactions"
                        }
                    ]
                },
                "security-impact-level": {
                    "security-objective-confidentiality": "moderate",
                    "security-objective-integrity": "moderate",
                    "security-objective-availability": "low"
                },
                "status": {"state": "operational"},
                "authorization-boundary": {"description": "Banking AWS cluster"}
            },
            "system-implementation": {
                "users": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "title": "System Administrator",
                        "short-name": "sysadmin",
                        "role-ids": ["admin"]
                    }
                ],
                "components": [
                    {
                        "uuid": comp_uuid,
                        "type": "software",
                        "title": "Web Application Server",
                        "description": "Nginx front-end",
                        "status": {"state": "operational"}
                    }
                ],
                "inventory-items": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "description": "Primary DB Host",
                        "implemented-components": []
                    }
                ]
            },
            "control-implementation": {
                "description": "Baseline control implementation",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp_uuid,
                                "description": "Access control policies reviewed annually"
                            }
                        ]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-2",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp_uuid,
                                "description": "Automated account management workflows"
                            }
                        ]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "au-2",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp_uuid,
                                "description": "Audit event logging configured across all hosts"
                            }
                        ]
                    }
                ]
            }
        }
    }
    res = client.post("/api/documents/ssp", json=ssp_doc)
    assert res.status_code == 201, f"Failed to save target SSP: {res.text}"
    return ssp_id


def create_sample_ap_document(ssp_id: str, doc_id: str = None, title: str = "Test Assessment Plan", version: str = "1.0.0") -> dict:
    """Helper to construct a valid OSCAL Assessment Plan document."""
    if doc_id is None:
        doc_id = str(uuid.uuid4())
    return {
        "assessment-plan": {
            "uuid": doc_id,
            "metadata": {
                "title": title,
                "last-modified": "2026-09-02T10:00:00Z",
                "version": version,
                "oscal-version": "1.2.2",
            },
            "import-ssp": {
                "href": f"../system-security-plans/{ssp_id}.json",
                "remarks": "Annual security authorization audit"
            },
            "reviewed-controls": {
                "control-selections": [
                    {
                        "include-all": {}
                    }
                ]
            }
        }
    }


def test_ap_create_and_get(client: TestClient):
    """Test creation and retrieval of an Assessment Plan document (US 5.1, US 5.13)."""
    ssp_id = create_sample_ssp(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ap_document(ssp_id=ssp_id, doc_id=doc_id, title="Enterprise Audit AP")

    # POST create
    response = client.post("/api/documents/assessment-plan", json=doc)
    assert response.status_code == 201, f"Failed: {response.json()}"
    res_data = response.json()
    assert res_data["assessment-plan"]["uuid"] == doc_id
    assert res_data["assessment-plan"]["metadata"]["title"] == "Enterprise Audit AP"
    assert res_data["assessment-plan"]["import-ssp"]["href"] == f"../system-security-plans/{ssp_id}.json"

    # GET list and verify import-ssp is present in pruned summary
    list_res = client.get("/api/documents/assessment-plan")
    assert list_res.status_code == 200
    docs = list_res.json()
    matching_doc = next((d.get("assessment-plan") for d in docs if d.get("assessment-plan", {}).get("uuid") == doc_id), None)
    assert matching_doc is not None
    assert matching_doc.get("import-ssp") is not None
    assert matching_doc["import-ssp"]["href"] == f"../system-security-plans/{ssp_id}.json"

    # GET single
    get_res = client.get(f"/api/documents/assessment-plan/{doc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["assessment-plan"]["metadata"]["title"] == "Enterprise Audit AP"


def test_ap_update_and_delete(client: TestClient):
    """Test editing and deleting an Assessment Plan document (US 5.1, US 5.15)."""
    ssp_id = create_sample_ssp(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ap_document(ssp_id=ssp_id, doc_id=doc_id, title="Initial AP Title")
    res_init = client.post("/api/documents/assessment-plan", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    # Update title and add tasks
    t_uuid = str(uuid.uuid4())
    doc["assessment-plan"]["metadata"]["title"] = "Updated AP Title"
    doc["assessment-plan"]["tasks"] = [
        {
            "uuid": t_uuid,
            "title": "Initial Kickoff",
            "type": "milestone",
            "timing": {"on-date": {"date": "2026-10-01T09:00:00Z"}}
        }
    ]
    update_res = client.post("/api/documents/assessment-plan", json=doc)
    assert update_res.status_code in (200, 201)

    # Verify update
    get_res = client.get(f"/api/documents/assessment-plan/{doc_id}")
    assert get_res.json()["assessment-plan"]["metadata"]["title"] == "Updated AP Title"
    assert len(get_res.json()["assessment-plan"]["tasks"]) == 1

    # Delete
    del_res = client.delete(f"/api/documents/assessment-plan/{doc_id}")
    assert del_res.status_code == 200

    # Verify 404 after deletion
    get_404 = client.get(f"/api/documents/assessment-plan/{doc_id}")
    assert get_404.status_code == 404


def test_ap_versioning(client: TestClient):
    """Test saving and retrieving document versions for Assessment Plans (US 5.16)."""
    ssp_id = create_sample_ssp(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ap_document(ssp_id=ssp_id, doc_id=doc_id, title="Versioned AP", version="1.1.0")
    res_init = client.post("/api/documents/assessment-plan", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    # Save version 1.1.0
    v_res = client.post(f"/api/documents/assessment-plan/{doc_id}/versions?remarks=Added+tasks", json=doc)
    assert v_res.status_code in (200, 201), f"Failed: {v_res.json()}"

    # List versions
    list_v = client.get(f"/api/documents/assessment-plan/{doc_id}/versions")
    assert list_v.status_code == 200
    versions = list_v.json()
    assert len(versions) >= 1
    assert any(v["version"] == "1.1.0" for v in versions)

    # Fetch specific version
    v_get = client.get(f"/api/documents/assessment-plan/{doc_id}/versions/1.1.0")
    assert v_get.status_code == 200
    assert v_get.json()["assessment-plan"]["uuid"] == doc_id


def test_ap_draft_save_and_retrieve(client: TestClient):
    """Test saving and loading draft versions of an Assessment Plan (US 5.15)."""
    ssp_id = create_sample_ssp(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ap_document(ssp_id=ssp_id, doc_id=doc_id, title="Official Plan")
    client.post("/api/documents/assessment-plan", json=doc)

    # Save Draft
    draft_doc = create_sample_ap_document(ssp_id=ssp_id, doc_id=f"{doc_id}-draft", title="Unsaved In-Progress Draft")
    draft_res = client.post("/api/documents/assessment-plan", json=draft_doc)
    assert draft_res.status_code in (200, 201)

    # Retrieve with for_ui / draft
    get_draft = client.get(f"/api/documents/assessment-plan/{doc_id}?for_ui=true")
    assert get_draft.status_code == 200
    assert get_draft.json()["assessment-plan"]["metadata"]["title"] == "Unsaved In-Progress Draft"


def test_ap_schema_validation(client: TestClient):
    """Test that invalid Assessment Plan structures fail schema validation (DD-002, US 5.12)."""
    invalid_doc = {
        "assessment-plan": {
            "uuid": "invalid-uuid",
            "metadata": {}  # Missing title, version, last-modified
        }
    }
    res = client.post("/api/documents/assessment-plan", json=invalid_doc)
    assert res.status_code in (400, 422)
