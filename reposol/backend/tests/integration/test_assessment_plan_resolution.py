"""
Integration tests for Step 5: Assessment Plan Resolution Engine and API Endpoints.
Covers:
- GET /api/resolve/assessment-plan/{id}
- POST /api/resolve/assessment-plan/preview
- GET /api/resolve/ssp/{id} full context validation
- Scoping resolution (include-all, explicit selections, exclusions, coverage statistics)
- 3D Scoping Matrix resolution (subjects, assets, platforms, local definitions, timeline)
- GET /api/resolve/tree/assessment-plans/{id}
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def create_comprehensive_ssp(client: TestClient) -> dict:
    """Helper to create and save a rich SSP in the test database."""
    ssp_id = str(uuid.uuid4())
    comp1_uuid = str(uuid.uuid4())
    comp2_uuid = str(uuid.uuid4())
    inv_uuid = str(uuid.uuid4())
    user_uuid = str(uuid.uuid4())

    ssp_doc = {
        "system-security-plan": {
            "uuid": ssp_id,
            "metadata": {
                "title": "FedRAMP Moderate Banking Platform SSP",
                "last-modified": "2026-09-02T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2",
                "roles": [{"id": "system-owner", "title": "System Owner"}],
                "parties": [{"uuid": str(uuid.uuid4()), "type": "organization", "name": "Global Bank Corp"}]
            },
            "import-profile": {
                "href": "https://example.com/profiles/fedramp-moderate.json"
            },
            "system-characteristics": {
                "system-name": "Core Banking Production System",
                "description": "Core Banking Production System hosting critical banking transactions",
                "system-ids": [{"id": "bank-sys-01", "identifier-type": "https://fedramp.gov"}],
                "system-information": {
                    "information-types": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "Financial Transaction Records",
                            "description": "Ledger and account transaction data"
                        }
                    ]
                },
                "security-impact-level": {
                    "security-objective-confidentiality": "moderate",
                    "security-objective-integrity": "moderate",
                    "security-objective-availability": "moderate"
                },
                "status": {"state": "operational"},
                "authorization-boundary": {"description": "Banking Production VPC"}
            },
            "system-implementation": {
                "users": [
                    {
                        "uuid": user_uuid,
                        "title": "Lead Database Admin",
                        "short-name": "lead-dba",
                        "role-ids": ["dba"]
                    }
                ],
                "components": [
                    {
                        "uuid": comp1_uuid,
                        "type": "software",
                        "title": "Nginx Edge Proxy",
                        "description": "TLS termination and reverse proxy",
                        "status": {"state": "operational"}
                    },
                    {
                        "uuid": comp2_uuid,
                        "type": "software",
                        "title": "PostgreSQL Cluster",
                        "description": "Encrypted relational database",
                        "status": {"state": "operational"}
                    }
                ],
                "inventory-items": [
                    {
                        "uuid": inv_uuid,
                        "description": "AWS EC2 c5.4xlarge Production Node",
                        "implemented-components": [{"component-uuid": comp2_uuid}]
                    }
                ]
            },
            "control-implementation": {
                "description": "Implemented controls for banking system",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp1_uuid,
                                "description": "Access Control Policy and Procedures implemented on Edge Proxy"
                            }
                        ]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-2",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp1_uuid,
                                "description": "Account Management on Edge Proxy"
                            },
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp2_uuid,
                                "description": "Account Management on Database Cluster"
                            }
                        ],
                        "statements": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "statement-id": "ac-2_smt_a",
                                "by-components": [
                                    {
                                        "uuid": str(uuid.uuid4()),
                                        "component-uuid": comp1_uuid,
                                        "description": "Statement A automated provisioning"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "au-2",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp2_uuid,
                                "description": "Audit Events logging on Database Cluster"
                            }
                        ]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "sc-7",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp1_uuid,
                                "description": "Boundary Protection implemented via Nginx"
                            }
                        ]
                    }
                ]
            }
        }
    }
    res = client.post("/api/documents/ssp", json=ssp_doc)
    assert res.status_code == 201, f"Failed to save rich SSP: {res.text}"
    return {
        "ssp_id": ssp_id,
        "ssp_doc": ssp_doc,
        "comp1_uuid": comp1_uuid,
        "comp2_uuid": comp2_uuid,
        "inv_uuid": inv_uuid,
        "user_uuid": user_uuid
    }


def test_ssp_resolution_full_context(client: TestClient):
    """Test that SSP resolution returns full context (users, inventory, roles, parties, system-characteristics)."""
    ssp_context = create_comprehensive_ssp(client)
    ssp_id = ssp_context["ssp_id"]

    res = client.get(f"/api/resolve/ssp/{ssp_id}")
    assert res.status_code == 200, f"Failed: {res.text}"
    data = res.json()

    assert "system-characteristics" in data
    assert data["system-characteristics"]["system-name"] == "Core Banking Production System"
    assert "users" in data
    assert len(data["users"]) == 1
    assert data["users"][0]["short-name"] == "lead-dba"
    assert "inventory-items" in data
    assert len(data["inventory-items"]) == 1
    assert "roles" in data
    assert "parties" in data
    assert "components" in data
    assert len(data["components"]) == 2


def test_resolve_saved_assessment_plan(client: TestClient):
    """Test resolving a saved Assessment Plan referencing a target SSP."""
    ssp_context = create_comprehensive_ssp(client)
    ssp_id = ssp_context["ssp_id"]
    comp1_uuid = ssp_context["comp1_uuid"]

    ap_id = str(uuid.uuid4())
    act_uuid = str(uuid.uuid4())
    t1_uuid = str(uuid.uuid4())
    t2_uuid = str(uuid.uuid4())
    asset_comp_uuid = str(uuid.uuid4())

    ap_doc = {
        "assessment-plan": {
            "uuid": ap_id,
            "metadata": {
                "title": "Annual Security Authorization Assessment Plan",
                "last-modified": "2026-09-02T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2",
            },
            "import-ssp": {
                "href": f"../system-security-plans/{ssp_id}.json",
                "remarks": "Target production banking environment"
            },
            "reviewed-controls": {
                "description": "Tailored assessment scope for Access Control and Audit",
                "control-selections": [
                    {
                        "include-controls": [
                            {"control-id": "ac-1"},
                            {"control-id": "ac-2", "statement-ids": ["ac-2_smt_a"]},
                            {"control-id": "au-2"}
                        ],
                        "exclude-controls": [
                            {"control-id": "sc-7"}
                        ]
                    }
                ]
            },
            "assessment-subjects": [
                {
                    "type": "component",
                    "include-subjects": [{"subject-uuid": comp1_uuid, "type": "component"}]
                }
            ],
            "assessment-assets": {
                "components": [
                    {
                        "uuid": asset_comp_uuid,
                        "type": "software",
                        "title": "SonarQube Static Analyzer",
                        "description": "Source code security scanner",
                        "status": {"state": "operational"}
                    }
                ],
                "assessment-platforms": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "title": "Code Review Platform",
                        "uses-components": [{"component-uuid": asset_comp_uuid}]
                    }
                ]
            },
            "local-definitions": {
                "activities": [
                    {
                        "uuid": act_uuid,
                        "title": "Static Code Analysis Activity",
                        "description": "Run SAST tool against repository",
                        "props": [{"name": "method", "value": "TEST"}]
                    }
                ]
            },
            "tasks": [
                {
                    "uuid": t1_uuid,
                    "title": "Kickoff Meeting",
                    "type": "milestone",
                    "timing": {"on-date": {"date": "2026-10-01T09:00:00Z"}}
                },
                {
                    "uuid": t2_uuid,
                    "title": "Static Analysis Execution",
                    "type": "action",
                    "timing": {
                        "within-date-range": {
                            "start": "2026-10-02T09:00:00Z",
                            "end": "2026-10-05T17:00:00Z"
                        }
                    },
                    "dependencies": [{"task-uuid": t1_uuid}],
                    "associated-activities": [
                        {
                            "activity-uuid": act_uuid,
                            "subjects": [{"type": "component", "include-all": {}}]
                        }
                    ]
                }
            ],
            "terms-and-conditions": {
                "parts": [
                    {
                        "name": "rules-of-engagement",
                        "title": "ROE",
                        "prose": "Testing permitted only during off-peak hours."
                    }
                ]
            }
        }
    }

    # Save AP
    save_res = client.post("/api/documents/assessment-plan", json=ap_doc)
    assert save_res.status_code == 201, f"Failed: {save_res.text}"

    # Resolve AP
    res = client.get(f"/api/resolve/assessment-plan/{ap_id}")
    assert res.status_code == 200, f"Failed: {res.text}"
    resolved = res.json()

    # 1. Target SSP Verification
    assert resolved["target_ssp"]["uuid"] == ssp_id
    assert resolved["target_ssp"]["system_name"] == "Core Banking Production System"
    assert resolved["target_ssp"]["total_implemented_controls"] == 4
    assert resolved["target_ssp"]["total_components"] == 2

    # 2. Scoping Metrics Verification
    scoping = resolved["scoping"]
    assert scoping["total_ssp_controls"] == 4
    assert scoping["in_scope_count"] == 3
    assert scoping["excluded_count"] == 1
    assert scoping["coverage_percentage"] == 75.0
    in_scope_ids = [c["control_id"].lower() for c in scoping["in_scope_controls"]]
    assert "ac-1" in in_scope_ids
    assert "ac-2" in in_scope_ids
    assert "au-2" in in_scope_ids
    assert "sc-7" not in in_scope_ids

    # Statement ID tailoring verification
    ac2_detail = next(c for c in scoping["in_scope_controls"] if c["control_id"].lower() == "ac-2")
    assert ac2_detail["statement_ids"] == ["ac-2_smt_a"]

    # 3. Assessment Subjects Verification
    subjects = resolved["subjects"]
    assert len(subjects["resolved_subjects"]) == 1
    assert subjects["resolved_subjects"][0]["subject_uuid"] == comp1_uuid
    assert subjects["resolved_subjects"][0]["title"] == "Nginx Edge Proxy"

    # 4. Timeline Verification
    timeline = resolved["timeline"]
    assert len(timeline) == 2
    t1 = next(t for t in timeline if t["uuid"] == t1_uuid)
    assert t1["type"] == "milestone"
    assert t1["timing_type"] == "on-date"
    assert t1["start"] == "2026-10-01T09:00:00Z"

    t2 = next(t for t in timeline if t["uuid"] == t2_uuid)
    assert t2["type"] == "action"
    assert t2["timing_type"] == "within-date-range"
    assert t2["start"] == "2026-10-02T09:00:00Z"
    assert t2["end"] == "2026-10-05T17:00:00Z"
    assert t2["dependencies"] == [t1_uuid]


def test_preview_resolve_assessment_plan_inline(client: TestClient):
    """Test previewing an in-memory Assessment Plan document against an in-memory target SSP."""
    ssp_id = str(uuid.uuid4())
    comp_uuid = str(uuid.uuid4())
    inline_ssp = {
        "system-security-plan": {
            "uuid": ssp_id,
            "metadata": {
                "title": "Inline Draft SSP",
                "last-modified": "2026-09-02T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-profile": {"href": "https://example.com/profile.json"},
            "system-characteristics": {
                "system-name": "Cloud Microservices Fleet",
                "description": "Cloud microservices infrastructure fleet",
                "system-ids": [{"id": "fleet-01", "identifier-type": "https://fedramp.gov"}],
                "system-information": {
                    "information-types": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "Auth Tokens",
                            "description": "JWT and session tokens"
                        }
                    ]
                },
                "status": {"state": "operational"},
                "authorization-boundary": {"description": "Microservices VPC boundary"}
            },
            "system-implementation": {
                "components": [
                    {
                        "uuid": comp_uuid,
                        "type": "software",
                        "title": "Auth Gateway Microservice",
                        "description": "Authentication and authorization API gateway",
                        "status": {"state": "operational"}
                    }
                ]
            },
            "control-implementation": {
                "description": "Implemented controls",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ia-2",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp_uuid,
                                "description": "Identification and authentication enforcement"
                            }
                        ]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ia-5",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": comp_uuid,
                                "description": "Authenticator management enforcement"
                            }
                        ]
                    }
                ]
            }
        }
    }

    inline_ap = {
        "assessment-plan": {
            "uuid": str(uuid.uuid4()),
            "metadata": {
                "title": "Draft Microservices Audit Plan",
                "last-modified": "2026-09-02T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-ssp": {"href": f"../system-security-plans/{ssp_id}.json"},
            "reviewed-controls": {
                "control-selections": [
                    {"include-all": {}}
                ]
            }
        }
    }

    req_body = {
        "assessment-plan": inline_ap,
        "ssp": inline_ssp
    }

    res = client.post("/api/resolve/assessment-plan/preview", json=req_body)
    assert res.status_code == 200, f"Failed: {res.text}"
    data = res.json()

    assert data["target_ssp"]["system_name"] == "Cloud Microservices Fleet"
    assert data["scoping"]["total_ssp_controls"] == 2
    assert data["scoping"]["in_scope_count"] == 2
    assert data["scoping"]["coverage_percentage"] == 100.0


def test_control_tree_ap_endpoint(client: TestClient):
    """Test retrieving control tree for assessment plans via /api/resolve/tree/assessment-plans/{id}."""
    ssp_context = create_comprehensive_ssp(client)
    ssp_id = ssp_context["ssp_id"]

    ap_id = str(uuid.uuid4())
    ap_doc = {
        "assessment-plan": {
            "uuid": ap_id,
            "metadata": {
                "title": "Tree Scoped AP",
                "last-modified": "2026-09-02T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-ssp": {"href": f"../system-security-plans/{ssp_id}.json"},
            "reviewed-controls": {
                "control-selections": [
                    {"include-controls": [{"control-id": "ac-1"}, {"control-id": "ac-2"}]}
                ]
            }
        }
    }
    client.post("/api/documents/assessment-plan", json=ap_doc)

    res = client.get(f"/api/resolve/tree/assessment-plans/{ap_id}")
    assert res.status_code == 200
    tree = res.json()
    assert tree["total_controls"] == 2
    control_ids = [c["id"].lower() for c in tree["flat_list"]]
    assert "ac-1" in control_ids
    assert "ac-2" in control_ids
