"""
Integration tests for AR-to-POA&M Findings Import Bridge.
Tests US 7.6, US 7.5, DD-017 § 5 & § 6, and POST /api/documents/poams/{poam_id}/import-findings/{ar_id}.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def create_sample_ar_document(
    ar_id: str,
    finding_1_uuid: str,
    finding_2_uuid: str,
    finding_satisfied_uuid: str,
    obs_uuid: str,
    risk_uuid: str,
) -> dict:
    """Helper to construct a valid OSCAL Assessment Results document with observations, risks, and findings."""
    return {
        "assessment-results": {
            "uuid": ar_id,
            "metadata": {
                "title": "System Assessment Results Q3",
                "last-modified": "2026-08-10T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "import-ap": {
                "href": "../assessment-plans/ap-123.json"
            },
            "results": [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "System Assessment Finding Result",
                    "description": "Assessment execution result summary",
                    "start": "2026-08-01T00:00:00Z",
                    "reviewed-controls": {
                        "control-selections": [
                            {
                                "include-all": {}
                            }
                        ]
                    },
                    "observations": [
                        {
                            "uuid": obs_uuid,
                            "title": "Unencrypted Storage Observation",
                            "description": "DB volume lacks encryption at rest",
                            "methods": ["examine"],
                            "types": ["ssp-statement-issue"],
                            "collected": "2026-08-01T10:00:00Z"
                        }
                    ],
                    "risks": [
                        {
                            "uuid": risk_uuid,
                            "title": "High Severity Data Exposure Risk",
                            "description": "Unencrypted storage exposes PII to unauthorized access",
                            "statement": "Risk of data breach due to unencrypted disks",
                            "status": "open",
                            "props": [
                                {"name": "priority", "value": "1"}
                            ]
                        }
                    ],
                    "findings": [
                        {
                            "uuid": finding_1_uuid,
                            "title": "Database Storage Encryption Violation",
                            "description": "Database data volume is not encrypted using AES-256",
                            "target": {
                                "type": "statement-id",
                                "target-id": "ac-2_smt",
                                "status": {
                                    "state": "not-satisfied"
                                }
                            },
                            "related-observations": [
                                {"observation-uuid": obs_uuid}
                            ],
                            "related-risks": [
                                {"risk-uuid": risk_uuid}
                            ]
                        },
                        {
                            "uuid": finding_2_uuid,
                            "title": "Missing Multi-Factor Authentication",
                            "description": "Admin portal permits password-only authentication",
                            "target": {
                                "type": "objective-id",
                                "target-id": "ia-2_obj",
                                "status": {
                                    "state": "not-satisfied"
                                }
                            }
                        },
                        {
                            "uuid": finding_satisfied_uuid,
                            "title": "Password Complexity Policy Compliant",
                            "description": "Password length and character rules enforced",
                            "target": {
                                "type": "statement-id",
                                "target-id": "ia-5_smt",
                                "status": {
                                    "state": "satisfied"
                                }
                            }
                        }
                    ]
                }
            ]
        }
    }


def create_sample_poam_document(poam_id: str) -> dict:
    """Helper to construct a base target POA&M document."""
    return {
        "plan-of-action-and-milestones": {
            "uuid": poam_id,
            "metadata": {
                "title": "Target Compliance POA&M",
                "last-modified": "2026-08-10T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "import-ssp": {
                "href": "../ssps/ssp-target.json"
            },
            "poam-items": [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "Initial Baseline POA&M Item",
                    "description": "Baseline item created before import"
                }
            ]
        }
    }


def test_import_findings_all_unsatisfied_success(client: TestClient):
    """Test importing all unsatisfied findings from AR to POA&M."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    f2_id = str(uuid.uuid4())
    fsat_id = str(uuid.uuid4())
    obs_id = str(uuid.uuid4())
    risk_id = str(uuid.uuid4())

    ar_doc = create_sample_ar_document(ar_id, f1_id, f2_id, fsat_id, obs_id, risk_id)
    poam_doc = create_sample_poam_document(poam_id)

    # Save AR & POA&M docs
    res_ar = client.post("/api/documents/assessment-results", json=ar_doc)
    assert res_ar.status_code == 201, f"Failed to save AR: {res_ar.json()}"

    res_poam = client.post("/api/documents/poam", json=poam_doc)
    assert res_poam.status_code == 201, f"Failed to save POA&M: {res_poam.json()}"

    # Execute import
    res_import = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res_import.status_code == 200, f"Import failed: {res_import.json()}"

    body = res_import.json()
    assert body["status"] == "success"
    assert body["imported_findings_count"] == 2
    assert body["imported_observations_count"] == 1
    assert body["imported_risks_count"] == 1

    updated_poam = body["document"]["plan-of-action-and-milestones"]
    items = updated_poam["poam-items"]
    # 1 original + 2 imported
    assert len(items) == 3

    # Check imported risks and observations preserve original UUIDs per DD-017
    obs_list = updated_poam.get("observations", [])
    risk_list = updated_poam.get("risks", [])
    findings_list = updated_poam.get("findings", [])

    assert any(o.get("uuid") == obs_id for o in obs_list)
    assert any(r.get("uuid") == risk_id for r in risk_list)
    assert any(f.get("uuid") == f1_id for f in findings_list)
    assert any(f.get("uuid") == f2_id for f in findings_list)
    assert not any(f.get("uuid") == fsat_id for f in findings_list)


def test_import_findings_selective_uuids(client: TestClient):
    """Test importing only selected finding UUIDs."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    f2_id = str(uuid.uuid4())
    fsat_id = str(uuid.uuid4())
    obs_id = str(uuid.uuid4())
    risk_id = str(uuid.uuid4())

    ar_doc = create_sample_ar_document(ar_id, f1_id, f2_id, fsat_id, obs_id, risk_id)
    poam_doc = create_sample_poam_document(poam_id)

    client.post("/api/documents/assessment-results", json=ar_doc)
    client.post("/api/documents/poam", json=poam_doc)

    # Import ONLY finding 1
    res_import = client.post(
        f"/api/documents/poams/{poam_id}/import-findings/{ar_id}",
        json={"finding_uuids": [f1_id]}
    )
    assert res_import.status_code == 200
    body = res_import.json()
    assert body["imported_findings_count"] == 1

    updated_poam = body["document"]["plan-of-action-and-milestones"]
    # 1 original + 1 imported
    assert len(updated_poam["poam-items"]) == 2


def test_import_findings_idempotency(client: TestClient):
    """Test that running import twice does not create duplicate poam-items."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    f2_id = str(uuid.uuid4())
    fsat_id = str(uuid.uuid4())
    obs_id = str(uuid.uuid4())
    risk_id = str(uuid.uuid4())

    ar_doc = create_sample_ar_document(ar_id, f1_id, f2_id, fsat_id, obs_id, risk_id)
    poam_doc = create_sample_poam_document(poam_id)

    client.post("/api/documents/assessment-results", json=ar_doc)
    client.post("/api/documents/poam", json=poam_doc)

    # First import
    res1 = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res1.status_code == 200
    assert res1.json()["imported_findings_count"] == 2

    # Second import (idempotent check)
    res2 = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res2.status_code == 200
    assert res2.json()["imported_findings_count"] == 0
    assert len(res2.json()["document"]["plan-of-action-and-milestones"]["poam-items"]) == 3


def test_import_findings_nonexistent_poam_404(client: TestClient):
    """Test 404 when target POA&M document does not exist."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    f2_id = str(uuid.uuid4())
    fsat_id = str(uuid.uuid4())
    obs_id = str(uuid.uuid4())
    risk_id = str(uuid.uuid4())

    ar_doc = create_sample_ar_document(ar_id, f1_id, f2_id, fsat_id, obs_id, risk_id)
    client.post("/api/documents/assessment-results", json=ar_doc)

    res = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res.status_code == 404
    assert f"POA&M document '{poam_id}' not found" in res.json()["detail"]


def test_import_findings_nonexistent_ar_404(client: TestClient):
    """Test 404 when source AR document does not exist."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())

    poam_doc = create_sample_poam_document(poam_id)
    client.post("/api/documents/poam", json=poam_doc)

    res = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res.status_code == 404
    assert f"Assessment Results document '{ar_id}' not found" in res.json()["detail"]


def test_import_findings_invalid_uuid_400(client: TestClient):
    """Test 400 when malformed UUID is provided."""
    res = client.post("/api/documents/poams/invalid-poam-uuid/import-findings/invalid-ar-uuid")
    assert res.status_code == 400
    assert "Invalid POA&M UUID format" in res.json()["detail"]
