"""
Integration tests for Step 4: SSP Baseline Resolution, 4-Tier Parameter Cascade,
Prose Placeholder Substitution, and Live Preview.
Tests coverage for BE-SSP-02, BE-SSP-03, BE-SSP-04, BE-SSP-06, and DD-036.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.factories import SSPFactory, ProfileFactory, CatalogFactory


def test_resolve_ssp_with_profile_baseline(client: TestClient):
    """Test resolving an SSP that imports a Profile baseline (BE-SSP-03)."""
    # 1. Create source catalog with controls
    cat_id = str(uuid.uuid4())
    cat_doc = CatalogFactory.with_controls(doc_id=cat_id, title="Source Catalog")
    client.post("/api/documents/catalogs", json=cat_doc)

    # 2. Create Profile importing the catalog
    prof_id = str(uuid.uuid4())
    prof_doc = ProfileFactory.importing(catalog_uuid=cat_id, doc_id=prof_id, title="NIST Moderate Baseline Profile")
    client.post("/api/documents/profiles", json=prof_doc)

    # 3. Create SSP referencing the profile
    this_system_uuid = str(uuid.uuid4())
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="Enterprise Cloud SSP",
        profile_uuid=prof_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "Core System", "description": "Anchor", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Implemented controls",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    "by-components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "component-uuid": this_system_uuid,
                            "description": "Policy is reviewed annually.",
                            "implementation-status": {"state": "implemented"}
                        }
                    ]
                }
            ]
        }
    )
    save_ssp = client.post("/api/documents/ssps", json=ssp_doc)
    assert save_ssp.status_code == 201

    # 4. Resolve SSP via GET /api/resolve/ssp/{ssp_id}
    res = client.get(f"/api/resolve/ssp/{ssp_id}")
    assert res.status_code == 200
    data = res.json()

    assert data["source_baseline"]["type"] == "profile"
    assert data["source_baseline"]["id"] == prof_id
    assert len(data["control_tree"]["groups"]) > 0 or len(data["control_tree"]["controls"]) > 0
    assert data["implementation_summary"]["implemented"] >= 1
    assert data["implementation_summary"]["total"] >= 1


def test_resolve_ssp_with_direct_catalog_baseline(client: TestClient):
    """Test resolving an SSP that directly imports a Catalog baseline (BE-SSP-03)."""
    # 1. Create source catalog
    cat_id = str(uuid.uuid4())
    cat_doc = CatalogFactory.with_controls(doc_id=cat_id, title="Direct SP 800-53 Catalog")
    client.post("/api/documents/catalogs", json=cat_doc)

    # 2. Create SSP directly referencing the catalog
    this_system_uuid = str(uuid.uuid4())
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="Direct Catalog SSP",
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "Anchor", "description": "Anchor", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Control impl",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-2",
                    "by-components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "component-uuid": this_system_uuid,
                            "description": "Account management procedures.",
                            "implementation-status": {"state": "implemented"}
                        }
                    ]
                }
            ]
        }
    )
    save_ssp = client.post("/api/documents/ssps", json=ssp_doc)
    assert save_ssp.status_code == 201

    # 3. Resolve SSP
    res = client.get(f"/api/resolve/ssp/{ssp_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["source_baseline"]["type"] == "catalog"
    assert data["source_baseline"]["id"] == cat_id
    assert data["implementation_summary"]["total"] >= 2


def test_4_tier_parameter_cascade(client: TestClient):
    """Test 4-tier parameter cascading: Baseline -> Global -> Control -> Component (BE-SSP-04)."""
    cat_id = str(uuid.uuid4())
    cat_doc = CatalogFactory.build(
        doc_id=cat_id,
        title="Cascade Catalog",
        params=[
            {"id": "prm_global_default", "values": ["catalog_default_val"], "label": "Global Param"},
            {"id": "prm_control_default", "values": ["catalog_ctrl_val"], "label": "Ctrl Param"},
            {"id": "prm_comp_default", "values": ["catalog_comp_val"], "label": "Comp Param"},
            {"id": "prm_untouched", "values": ["baseline_only_val"], "label": "Untouched Param"},
        ],
        controls=[
            {
                "id": "ac-1",
                "title": "Access Control Policy",
                "params": [
                    {"id": "prm_global_default", "values": ["catalog_default_val"]},
                    {"id": "prm_control_default", "values": ["catalog_ctrl_val"]},
                    {"id": "prm_comp_default", "values": ["catalog_comp_val"]},
                    {"id": "prm_untouched", "values": ["baseline_only_val"]},
                ],
                "parts": [
                    {
                        "id": "ac-1_smt",
                        "name": "statement",
                        "prose": "Policy frequency is {{ insert: param, prm_global_default }} with review {{ insert: param, prm_control_default }}."
                    }
                ]
            }
        ]
    )
    client.post("/api/documents/catalogs", json=cat_doc)

    this_system_uuid = str(uuid.uuid4())
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="Cascade SSP",
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "System", "description": "System", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Control impl",
            # Tier 3: SSP Global override
            "set-parameters": [
                {"param-id": "prm_global_default", "values": ["ssp_global_val"], "remarks": "Set at global SSP level"}
            ],
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    # Tier 2: Control level override
                    "set-parameters": [
                        {"param-id": "prm_control_default", "values": ["ssp_control_val"], "remarks": "Set at control level"}
                    ],
                    "by-components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "component-uuid": this_system_uuid,
                            "description": "Component narrative",
                            # Tier 1: Component level override
                            "set-parameters": [
                                {"param-id": "prm_comp_default", "values": ["ssp_comp_val"], "remarks": "Set at component level"}
                            ],
                            "implementation-status": {"state": "implemented"}
                        }
                    ]
                }
            ]
        }
    )
    save_ssp = client.post("/api/documents/ssps", json=ssp_doc)
    assert save_ssp.status_code == 201

    # Resolve and check cascaded values
    res = client.get(f"/api/resolve/ssp/{ssp_id}")
    assert res.status_code == 200
    data = res.json()

    ctrl = data["control_tree"]["controls"][0]
    resolved_params = {p["param-id"].lower(): p for p in ctrl["resolved_parameters"]}

    # Check Tier 3 (Global) resolution
    assert "prm_global_default" in resolved_params
    assert resolved_params["prm_global_default"]["effective_values"] == ["ssp_global_val"]
    assert resolved_params["prm_global_default"]["origin"] == "ssp-global"

    # Check Tier 2 (Control) resolution
    assert "prm_control_default" in resolved_params
    assert resolved_params["prm_control_default"]["effective_values"] == ["ssp_control_val"]
    assert resolved_params["prm_control_default"]["origin"] == "control-override"

    # Check Tier 4 (Baseline Fallback) resolution
    assert "prm_untouched" in resolved_params
    assert resolved_params["prm_untouched"]["effective_values"] == ["baseline_only_val"]
    assert resolved_params["prm_untouched"]["origin"] in ("catalog-default", "baseline-default")


def test_prose_parameter_placeholder_substitution(client: TestClient):
    """Test that {{ insert: param, id }} placeholders in control prose are replaced (BE-SSP-04)."""
    cat_id = str(uuid.uuid4())
    cat_doc = CatalogFactory.build(
        doc_id=cat_id,
        title="Prose Catalog",
        controls=[
            {
                "id": "ia-2",
                "title": "Identification and Authentication",
                "params": [
                    {"id": "ia-2_prm_1", "values": ["default_mfa"], "label": "MFA methods"}
                ],
                "parts": [
                    {
                        "id": "ia-2_smt",
                        "name": "statement",
                        "prose": "The system enforces multi-factor authentication using {{ insert: param, ia-2_prm_1 }} for all privileged users."
                    }
                ]
            }
        ]
    )
    client.post("/api/documents/catalogs", json=cat_doc)

    this_system_uuid = str(uuid.uuid4())
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="Prose Substitution SSP",
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "System", "description": "System", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Impl",
            "set-parameters": [
                {"param-id": "ia-2_prm_1", "values": ["hardware security keys (FIDO2/WebAuthn)"]}
            ],
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ia-2",
                    "by-components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "component-uuid": this_system_uuid,
                            "description": "FIDO2 keys deployed to all administrators.",
                            "implementation-status": {"state": "implemented"}
                        }
                    ]
                }
            ]
        }
    )
    client.post("/api/documents/ssps", json=ssp_doc)

    res = client.get(f"/api/resolve/ssp/{ssp_id}")
    assert res.status_code == 200
    data = res.json()
    resolved_ctrl = data["control_tree"]["controls"][0]
    resolved_prose = resolved_ctrl["parts"][0]["prose"]
    assert "hardware security keys (FIDO2/WebAuthn)" in resolved_prose
    assert "{{ insert: param" not in resolved_prose


def test_implementation_status_aggregation(client: TestClient):
    """Test correct categorization and aggregation of implementation status states."""
    cat_id = str(uuid.uuid4())
    cat_doc = CatalogFactory.build(
        doc_id=cat_id,
        title="Metrics Catalog",
        controls=[
            {"id": "ac-1", "title": "AC-1 Policy"},
            {"id": "ac-2", "title": "AC-2 Account Mgmt"},
            {"id": "ac-3", "title": "AC-3 Access Enforcement"},
            {"id": "ac-4", "title": "AC-4 Info Flow"},
            {"id": "ac-5", "title": "AC-5 Separation of Duties"},
        ]
    )
    client.post("/api/documents/catalogs", json=cat_doc)

    this_system_uuid = str(uuid.uuid4())
    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(
        doc_id=ssp_id,
        title="Metrics SSP",
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "System", "description": "System", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Impl",
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-1",
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "D1", "implementation-status": {"state": "implemented"}}]
                },
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-2",
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "D2", "implementation-status": {"state": "partially-implemented"}}]
                },
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-3",
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "D3", "implementation-status": {"state": "not-applicable"}}]
                },
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "ac-4",
                    "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "D4", "implementation-status": {"state": "planned"}}]
                }
            ]
        }
    )
    client.post("/api/documents/ssps", json=ssp_doc)

    res = client.get(f"/api/resolve/ssp/{ssp_id}")
    assert res.status_code == 200
    summary = res.json()["implementation_summary"]

    assert summary["total"] == 5
    assert summary["implemented"] == 1
    assert summary["partially_implemented"] == 1
    assert summary["not_applicable"] == 1
    assert summary["planned"] >= 2  # ac-4 (planned) + ac-5 (unimplemented/none counted as planned)


def test_control_tree_route_ssp(client: TestClient):
    """Test GET /api/resolve/tree/ssps/{id} returns hierarchical tree (BE-SSP-02)."""
    cat_id = str(uuid.uuid4())
    cat_doc = CatalogFactory.with_controls(doc_id=cat_id, title="Tree Catalog")
    client.post("/api/documents/catalogs", json=cat_doc)

    ssp_id = str(uuid.uuid4())
    ssp_doc = SSPFactory.build(doc_id=ssp_id, title="Tree SSP", catalog_uuid=cat_id)
    client.post("/api/documents/ssps", json=ssp_doc)

    # Test via normalized stage 'ssps'
    tree_res = client.get(f"/api/resolve/tree/ssps/{ssp_id}")
    assert tree_res.status_code == 200
    tree_data = tree_res.json()
    assert "flat_list" in tree_data
    assert tree_data["total_controls"] > 0

    # Test via stage alias 'system-security-plans'
    alias_res = client.get(f"/api/resolve/tree/system-security-plans/{ssp_id}")
    assert alias_res.status_code == 200
    assert alias_res.json()["total_controls"] == tree_data["total_controls"]


def test_ssp_live_preview_route(client: TestClient):
    """Test POST /api/resolve/ssp/preview with in-memory payload without saving to disk (BE-SSP-06)."""
    cat_id = str(uuid.uuid4())
    cat_doc = CatalogFactory.build(
        doc_id=cat_id,
        title="Preview Source Catalog",
        controls=[
            {
                "id": "si-4",
                "title": "Information System Monitoring",
                "params": [{"id": "si-4_prm_1", "values": ["hourly"]}],
                "parts": [{"id": "si-4_smt", "name": "statement", "prose": "Monitor traffic {{ insert: param, si-4_prm_1 }}."}]
            }
        ]
    )
    client.post("/api/documents/catalogs", json=cat_doc)

    this_system_uuid = str(uuid.uuid4())
    in_memory_ssp = SSPFactory.build(
        title="In-Memory Preview SSP",
        catalog_uuid=cat_id,
        system_implementation={
            "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
            "components": [
                {"uuid": this_system_uuid, "type": "this-system", "title": "System", "description": "System", "status": {"state": "operational"}}
            ]
        },
        control_implementation={
            "description": "Preview impl",
            "set-parameters": [{"param-id": "si-4_prm_1", "values": ["continuously in real-time"]}],
            "implemented-requirements": [
                {
                    "uuid": str(uuid.uuid4()),
                    "control-id": "si-4",
                    "by-components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "component-uuid": this_system_uuid,
                            "description": "SIEM agent continuously streams telemetry.",
                            "implementation-status": {"state": "implemented"}
                        }
                    ]
                }
            ]
        }
    )

    # Post directly to preview endpoint without persisting
    preview_res = client.post("/api/resolve/ssp/preview", json=in_memory_ssp)
    assert preview_res.status_code == 200
    preview_data = preview_res.json()

    assert preview_data["source_baseline"]["type"] == "catalog"
    ctrl = preview_data["control_tree"]["controls"][0]
    assert "continuously in real-time" in ctrl["parts"][0]["prose"]
    assert preview_data["implementation_summary"]["implemented"] == 1
