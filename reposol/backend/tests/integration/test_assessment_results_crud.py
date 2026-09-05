"""
Integration tests for Step 6: Assessment Results CRUD, Versioning, and Risk Characterization.
Tests coverage for US 6.1 through US 6.17.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def create_sample_ap(client: TestClient, title: str = "Governing Assessment Plan") -> str:
    """Helper to save a valid target Assessment Plan in the test store."""
    ap_id = str(uuid.uuid4())
    ap_doc = {
        "assessment-plan": {
            "uuid": ap_id,
            "metadata": {
                "title": title,
                "last-modified": "2026-07-30T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2",
            },
            "import-ssp": {
                "href": "https://example.com/ssps/target-ssp.json"
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
    res = client.post("/api/documents/assessment-plan", json=ap_doc)
    assert res.status_code == 201, f"Failed to create prerequisite AP: {res.text}"
    return ap_id


def create_sample_ar_document(ap_id: str = None, doc_id: str = None, title: str = "Test Assessment Results", version: str = "1.0.0") -> dict:
    """Helper to construct a valid OSCAL Assessment Results document."""
    if doc_id is None:
        doc_id = str(uuid.uuid4())
    if ap_id is None:
        ap_id = str(uuid.uuid4())
    obs_id = str(uuid.uuid4())
    risk_id = str(uuid.uuid4())
    finding_id = str(uuid.uuid4())

    return {
        "assessment-results": {
            "uuid": doc_id,
            "metadata": {
                "title": title,
                "last-modified": "2026-07-30T10:00:00Z",
                "version": version,
                "oscal-version": "1.2.2",
            },
            "import-ap": {
                "href": f"../assessment-plans/{ap_id}.json"
            },
            "results": [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "Quarterly System Scan Results",
                    "description": "Results of Q3 automated vulnerability assessment",
                    "start": "2026-07-01T09:00:00Z",
                    "reviewed-controls": {
                        "control-selections": [
                            {
                                "include-all": {}
                            }
                        ]
                    },
                    "observations": [
                        {
                            "uuid": obs_id,
                            "description": "Port 22 is exposed to public network",
                            "methods": ["examine"],
                            "collected": "2026-07-30T10:00:00Z"
                        }
                    ],
                    "risks": [
                        {
                            "uuid": risk_id,
                            "title": "Unauthenticated Administrative Access",
                            "description": "Potential remote shell access",
                            "statement": "Exposed SSH port presents remote execution risk",
                            "status": "open"
                        }
                    ],
                    "findings": [
                        {
                            "uuid": finding_id,
                            "title": "AC-1 Non-Compliance",
                            "description": "Access control policy enforcement gap",
                            "target": {
                                "type": "statement-id",
                                "target-id": "ac-1_smt",
                                "status": {
                                    "state": "not-satisfied"
                                }
                            },
                            "related-observations": [
                                {
                                    "observation-uuid": obs_id
                                }
                            ],
                            "related-risks": [
                                {
                                    "risk-uuid": risk_id
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }


def test_ar_create_and_get(client: TestClient):
    """Test creation and retrieval of Assessment Results (US 6.1, US 6.3, US 6.13)."""
    ap_id = create_sample_ap(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ar_document(ap_id=ap_id, doc_id=doc_id, title="Q3 Audit Results")

    # POST create
    response = client.post("/api/documents/assessment-results", json=doc)
    assert response.status_code == 201, f"Failed: {response.json()}"
    res_data = response.json()
    assert res_data["assessment-results"]["uuid"] == doc_id
    assert res_data["assessment-results"]["metadata"]["title"] == "Q3 Audit Results"

    # GET list
    list_res = client.get("/api/documents/assessment-results")
    assert list_res.status_code == 200
    docs = list_res.json()
    matching = [d.get("assessment-results") for d in docs if d.get("assessment-results", {}).get("uuid") == doc_id]
    assert len(matching) == 1
    assert "import-ap" in matching[0]
    assert matching[0]["import-ap"]["href"] == f"../assessment-plans/{ap_id}.json"

    # GET single
    get_res = client.get(f"/api/documents/assessment-results/{doc_id}")
    assert get_res.status_code == 200
    assert len(get_res.json()["assessment-results"]["results"]) == 1


def test_ar_risk_and_finding_structure(client: TestClient):
    """Test observations, risk characterization (DD-018), and findings in AR (US 6.6, US 6.7, US 6.10)."""
    ap_id = create_sample_ap(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ar_document(ap_id=ap_id, doc_id=doc_id, title="Risk & Findings AR")

    response = client.post("/api/documents/assessment-results", json=doc)
    assert response.status_code == 201, f"Failed: {response.json()}"

    saved = client.get(f"/api/documents/assessment-results/{doc_id}").json()
    results = saved["assessment-results"]["results"][0]
    assert len(results["observations"]) == 1
    assert len(results["risks"]) == 1
    assert results["risks"][0]["status"] == "open"
    assert results["findings"][0]["target"]["status"]["state"] == "not-satisfied"


def test_ar_update_and_delete(client: TestClient):
    """Test editing and deleting Assessment Results documents (US 6.1, US 6.15)."""
    ap_id = create_sample_ap(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ar_document(ap_id=ap_id, doc_id=doc_id, title="Initial AR")
    res_init = client.post("/api/documents/assessment-results", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    # Update
    doc["assessment-results"]["metadata"]["title"] = "Updated AR"
    update_res = client.post("/api/documents/assessment-results", json=doc)
    assert update_res.status_code in (200, 201)

    # Delete
    del_res = client.delete(f"/api/documents/assessment-results/{doc_id}")
    assert del_res.status_code == 200

    # 404 check
    assert client.get(f"/api/documents/assessment-results/{doc_id}").status_code == 404


def test_ar_versioning(client: TestClient):
    """Test version management for Assessment Results (US 6.16)."""
    ap_id = create_sample_ap(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_ar_document(ap_id=ap_id, doc_id=doc_id, title="Versioned AR", version="1.2.0")
    res_init = client.post("/api/documents/assessment-results", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    v_res = client.post(f"/api/documents/assessment-results/{doc_id}/versions?remarks=Final+release", json=doc)
    assert v_res.status_code in (200, 201), f"Failed: {v_res.json()}"

    list_v = client.get(f"/api/documents/assessment-results/{doc_id}/versions")
    assert list_v.status_code == 200
    assert any(v["version"] == "1.2.0" for v in list_v.json())
