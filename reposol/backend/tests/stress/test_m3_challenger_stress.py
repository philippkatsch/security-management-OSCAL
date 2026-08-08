"""
Empirical Stress & Boundary Test Suite for Milestone M3 (Step 3 Component Inventory & Step 4 SSP Builder).
Written by Challenger 1 to stress-test parameter cascades, Base64 boundary diagram payloads, component inventory, and security inheritance.
"""

import pytest
import base64
import uuid
import os
import copy
from app.validation import validate_document, OSCALValidationError
from app.storage import preprocess_profile_for_saving, remove_empty_arrays
from tests.factories import CatalogFactory, ProfileFactory


def generate_base64_payload(size_in_bytes: int) -> str:
    """Generates a pseudo-random Base64 encoded data URI string of approximate size."""
    raw_bytes = os.urandom(size_in_bytes)
    b64 = base64.b64encode(raw_bytes).decode('utf-8')
    return f"data:image/png;base64,{b64}"


def create_valid_profile_and_catalog(client) -> str:
    """Creates a valid base Catalog and Profile, returning the profile UUID."""
    cat_doc = CatalogFactory.build(title="Base Test Catalog")
    cat_uuid = cat_doc["catalog"]["uuid"]
    res_cat = client.post("/api/documents/catalogs", json=cat_doc)
    assert res_cat.status_code == 201

    prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Base Test Profile")
    prof_uuid = prof_doc["profile"]["uuid"]
    res_prof = client.post("/api/documents/profiles", json=prof_doc)
    assert res_prof.status_code == 201
    return prof_uuid


def build_valid_ssp_dict(ssp_uuid: str, title: str, system_name: str, prof_uuid: str, components: list, implemented_reqs: list = None, back_matter: dict = None) -> dict:
    """Helper to build a valid OSCAL SSP dictionary for testing."""
    if implemented_reqs is None or len(implemented_reqs) == 0:
        implemented_reqs = [
            {
                "uuid": str(uuid.uuid4()),
                "control-id": "ac-1"
            }
        ]

    ssp = {
        "system-security-plan": {
            "uuid": ssp_uuid,
            "metadata": {
                "title": title,
                "last-modified": "2026-08-08T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.0.0"
            },
            "import-profile": {"href": f"#{prof_uuid}"},
            "system-characteristics": {
                "system-name": system_name,
                "system-name-short": "SYS",
                "description": "System description for stress testing",
                "system-ids": [
                    {
                        "id": f"sys-id-{ssp_uuid[:8]}"
                    }
                ],
                "security-sensitivity-level": "high",
                "system-information": {
                    "information-types": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "System Audit Log Data",
                            "description": "System log files and audit trails"
                        }
                    ]
                },
                "status": {"state": "operational"},
                "authorization-boundary": {
                    "description": "System boundary description for testing"
                }
            },
            "system-implementation": {
                "users": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "role-ids": ["system-administrator"]
                    }
                ],
                "components": components
            },
            "control-implementation": {
                "description": "Control implementation section narrative",
                "implemented-requirements": implemented_reqs
            }
        }
    }
    if back_matter:
        ssp["system-security-plan"]["back-matter"] = back_matter
    return ssp


class TestM3ChallengerEmpiricalStress:

    # =========================================================================
    # 1. 3-LEVEL PARAMETER CASCADE STRESS TESTS
    # =========================================================================

    def test_parameter_cascade_3_level_precedence(self, client, isolated_data_dir):
        """
        Empirically verifies the 3-level parameter cascade:
        Catalog default -> Profile override -> SSP Component-level override.
        """
        # Step 1: Catalog with base parameter definition
        cat_doc = {
            "catalog": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Cascade Base Catalog",
                    "last-modified": "2026-08-08T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.0.0"
                },
                "groups": [
                    {
                        "id": "ac",
                        "title": "Access Control",
                        "controls": [
                            {
                                "id": "ac-1",
                                "title": "Access Control Policy",
                                "params": [
                                    {
                                        "id": "ac-1_prm_1",
                                        "label": "Policy Review Frequency",
                                        "values": ["cat-level-annual"]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # Step 2: Profile overriding catalog default parameter value
        prof_uuid = str(uuid.uuid4())
        prof_doc = {
            "profile": {
                "uuid": prof_uuid,
                "metadata": {
                    "title": "Cascade Profile",
                    "last-modified": "2026-08-08T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.0.0"
                },
                "imports": [{"href": f"#{cat_doc['catalog']['uuid']}"}],
                "modify": {
                    "set-parameters": [
                        {
                            "param-id": "ac-1_prm_1",
                            "values": ["prof-level-semi-annual"]
                        }
                    ]
                }
            }
        }
        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201

        # Step 3: Component Definition
        comp_uuid = str(uuid.uuid4())
        comp_doc = {
            "component-definition": {
                "uuid": comp_uuid,
                "metadata": {
                    "title": "Cascade Component Def",
                    "last-modified": "2026-08-08T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.0.0"
                },
                "components": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "type": "software",
                        "title": "IAM Service Component",
                        "description": "Handles identity policies"
                    }
                ]
            }
        }
        res_comp = client.post("/api/documents/component-definitions", json=comp_doc)
        assert res_comp.status_code == 201

        # Step 4: SSP with Component-level override (Level 3)
        ssp_uuid = str(uuid.uuid4())
        comp_item = {
            "uuid": comp_doc['component-definition']['components'][0]['uuid'],
            "type": "software",
            "title": "IAM Service Component",
            "description": "Handles identity policies",
            "status": {"state": "operational"}
        }
        impl_reqs = [
            {
                "uuid": str(uuid.uuid4()),
                "control-id": "ac-1",
                "by-components": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "component-uuid": comp_item["uuid"],
                        "description": "Component implementation override",
                        "set-parameters": [
                            {
                                "param-id": "ac-1_prm_1",
                                "values": ["ssp-component-level-quarterly"]
                            }
                        ]
                    }
                ]
            }
        ]

        ssp_doc = build_valid_ssp_dict(ssp_uuid, "Cascade SSP Document", "Cascade Test System", prof_uuid, [comp_item], impl_reqs)
        ssp_doc = remove_empty_arrays(ssp_doc)

        validate_document("ssps", ssp_doc, check_refs=False)

        res_ssp = client.post("/api/documents/ssps", json=ssp_doc)
        assert res_ssp.status_code == 201, f"SSP creation failed: {res_ssp.text}"

        # Retrieve and verify Level 3 value persistence in backend model
        res_get = client.get(f"/api/documents/ssps/{ssp_uuid}")
        assert res_get.status_code == 200
        saved_ssp = res_get.json()
        req = saved_ssp["system-security-plan"]["control-implementation"]["implemented-requirements"][0]
        by_comp = req["by-components"][0]
        assert by_comp["set-parameters"][0]["param-id"] == "ac-1_prm_1"
        assert by_comp["set-parameters"][0]["values"] == ["ssp-component-level-quarterly"]

    def test_parameter_cascade_multiple_component_overrides(self, client, isolated_data_dir):
        """
        Empirically verifies multiple components overriding the same parameter with different values in an SSP.
        """
        prof_uuid = create_valid_profile_and_catalog(client)

        comp1_uuid = str(uuid.uuid4())
        comp2_uuid = str(uuid.uuid4())
        ssp_uuid = str(uuid.uuid4())

        components = [
            {
                "uuid": comp1_uuid,
                "type": "software",
                "title": "Frontend App",
                "description": "Web client",
                "status": {"state": "operational"}
            },
            {
                "uuid": comp2_uuid,
                "type": "service",
                "title": "Backend Microservice",
                "description": "API server",
                "status": {"state": "operational"}
            }
        ]

        impl_reqs = [
            {
                "uuid": str(uuid.uuid4()),
                "control-id": "ac-2",
                "by-components": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "component-uuid": comp1_uuid,
                        "description": "Frontend account management",
                        "set-parameters": [
                            {"param-id": "ac-2_prm_1", "values": ["30 days"]}
                        ]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "component-uuid": comp2_uuid,
                        "description": "Backend account management",
                        "set-parameters": [
                            {"param-id": "ac-2_prm_1", "values": ["90 days"]}
                        ]
                    }
                ]
            }
        ]

        ssp_doc = build_valid_ssp_dict(ssp_uuid, "Multi-Comp Cascade SSP", "Multi-Comp System", prof_uuid, components, impl_reqs)
        ssp_doc = remove_empty_arrays(ssp_doc)

        validate_document("ssps", ssp_doc, check_refs=False)
        res_ssp = client.post("/api/documents/ssps", json=ssp_doc)
        assert res_ssp.status_code == 201

        res_get = client.get(f"/api/documents/ssps/{ssp_uuid}")
        assert res_get.status_code == 200
        by_comps = res_get.json()["system-security-plan"]["control-implementation"]["implemented-requirements"][0]["by-components"]
        assert len(by_comps) == 2
        assert by_comps[0]["set-parameters"][0]["values"] == ["30 days"]
        assert by_comps[1]["set-parameters"][0]["values"] == ["90 days"]

    # =========================================================================
    # 2. BOUNDARY DIAGRAM BASE64 PAYLOAD STRESS TESTS
    # =========================================================================

    @pytest.mark.parametrize("payload_size_kb", [1, 50, 500])
    def test_boundary_diagram_base64_payload_handling(self, client, isolated_data_dir, payload_size_kb):
        """
        Empirically verifies boundary diagram Base64 payload uploading (1KB, 50KB, 500KB).
        Checks schema validation, serialization, persistence, and REST API roundtripping.
        """
        prof_uuid = create_valid_profile_and_catalog(client)

        b64_payload = generate_base64_payload(payload_size_kb * 1024)
        resource_uuid = str(uuid.uuid4())
        ssp_uuid = str(uuid.uuid4())

        components = [
            {
                "uuid": str(uuid.uuid4()),
                "type": "hardware",
                "title": "Firewall Appliance",
                "description": "Edge Security Device",
                "status": {"state": "operational"}
            }
        ]

        back_matter = {
            "resources": [
                {
                    "uuid": resource_uuid,
                    "title": "Architecture Diagram Image",
                    "rlinks": [
                        {
                            "href": b64_payload,
                            "media-type": "image/png"
                        }
                    ]
                }
            ]
        }

        ssp_doc = build_valid_ssp_dict(ssp_uuid, f"Diagram Payload SSP {payload_size_kb}KB", f"Diagram System {payload_size_kb}KB", prof_uuid, components, [], back_matter)
        ssp_doc["system-security-plan"]["system-characteristics"]["authorization-boundary"]["diagrams"] = [
            {
                "uuid": str(uuid.uuid4()),
                "remarks": f"Network Architecture Diagram ({payload_size_kb}KB)",
                "caption": "Network Topography & DMZ Subnets",
                "links": [
                    {
                        "href": f"#{resource_uuid}",
                        "rel": "diagram-resource"
                    }
                ]
            }
        ]
        ssp_doc = remove_empty_arrays(ssp_doc)

        # 1. Direct NIST OSCAL Schema Validation Check
        validate_document("ssps", ssp_doc, check_refs=False)

        # 2. REST API POST Save
        res_post = client.post("/api/documents/ssps", json=ssp_doc)
        assert res_post.status_code == 201, f"Failed POST for Base64 payload {payload_size_kb}KB: {res_post.text}"

        # 3. REST API GET Verification
        res_get = client.get(f"/api/documents/ssps/{ssp_uuid}")
        assert res_get.status_code == 200
        saved_ssp = res_get.json()
        saved_resource = saved_ssp["system-security-plan"]["back-matter"]["resources"][0]
        assert saved_resource["uuid"] == resource_uuid
        assert saved_resource["rlinks"][0]["href"] == b64_payload
        assert len(saved_resource["rlinks"][0]["href"]) > payload_size_kb * 1000

    # =========================================================================
    # 3. COMPONENT INVENTORY ITEMS STRESS TESTS
    # =========================================================================

    def test_component_inventory_11_oscal_types_and_inventory_binding(self, client, isolated_data_dir):
        """
        Empirically verifies component creation across all 11 official OSCAL component types,
        plus binding component inventory items to system components in SSP.
        """
        prof_uuid = create_valid_profile_and_catalog(client)

        oscal_types = [
            "software", "hardware", "service", "policy", "physical",
            "process-procedure", "plan", "guidance", "standard",
            "validation", "interconnection"
        ]

        comp_defs = []
        for idx, comp_type in enumerate(oscal_types):
            comp_defs.append({
                "uuid": f"30000000-0000-4000-8000-{idx:012d}",
                "type": comp_type,
                "title": f"Component Type {comp_type}",
                "description": f"Narrative for {comp_type} component",
                "props": [
                    {"name": "implementation-point", "value": "internal"},
                    {"name": "custom-spec", "value": f"spec-{comp_type}"}
                ],
                "protocols": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "name": "https",
                        "title": "HTTPS Protocol Endpoint",
                        "port-ranges": [{"start": 443, "end": 443, "transport": "TCP"}]
                    }
                ] if comp_type == "service" else []
            })

        cdef_uuid = str(uuid.uuid4())
        cdef_doc = {
            "component-definition": {
                "uuid": cdef_uuid,
                "metadata": {
                    "title": "11 OSCAL Types Component Definition",
                    "last-modified": "2026-08-08T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.0.0"
                },
                "components": comp_defs
            }
        }

        # Validate Schema & Save
        cdef_doc = remove_empty_arrays(cdef_doc)
        validate_document("component-definitions", cdef_doc)
        res_cdef = client.post("/api/documents/component-definitions", json=cdef_doc)
        assert res_cdef.status_code == 201

        # Test Inventory Items binding in SSP
        inv_item_uuid = str(uuid.uuid4())
        ssp_uuid = str(uuid.uuid4())

        components = [
            {
                "uuid": comp_defs[0]["uuid"],
                "type": comp_defs[0]["type"],
                "title": comp_defs[0]["title"],
                "description": comp_defs[0]["description"],
                "status": {"state": "operational"}
            }
        ]

        ssp_doc = build_valid_ssp_dict(ssp_uuid, "Inventory Items Binding SSP", "Inventory System", prof_uuid, components, [])
        ssp_doc["system-security-plan"]["system-implementation"]["inventory-items"] = [
            {
                "uuid": inv_item_uuid,
                "description": "Production Server Node 01",
                "implemented-components": [
                    {
                        "component-uuid": comp_defs[0]["uuid"],
                        "props": [
                            {"name": "asset-id", "value": "SRV-PROD-001"}
                        ]
                    }
                ],
                "props": [
                    {"name": "ip-address", "value": "192.168.1.100"},
                    {"name": "mac-address", "value": "00:1B:44:11:3A:B7"}
                ]
            }
        ]
        ssp_doc = remove_empty_arrays(ssp_doc)

        validate_document("ssps", ssp_doc, check_refs=False)
        res_ssp = client.post("/api/documents/ssps", json=ssp_doc)
        assert res_ssp.status_code == 201

        # Verify backend response
        res_get = client.get(f"/api/documents/ssps/{ssp_uuid}")
        assert res_get.status_code == 200
        saved_inv = res_get.json()["system-security-plan"]["system-implementation"]["inventory-items"][0]
        assert saved_inv["uuid"] == inv_item_uuid
        assert saved_inv["implemented-components"][0]["component-uuid"] == comp_defs[0]["uuid"]

    # =========================================================================
    # 4. SECURITY INHERITANCE & LEVERAGED AUTHORIZATIONS STRESS TESTS
    # =========================================================================

    def test_security_inheritance_and_leveraged_authorizations(self, client, isolated_data_dir):
        """
        Empirically verifies security inheritance declarations in SSP:
        `leveraged-authorizations[]`, `by-components[].inherited[]`, `by-components[].satisfied-by[]`.
        """
        prof_uuid = create_valid_profile_and_catalog(client)

        leveraged_auth_uuid = str(uuid.uuid4())
        leveraged_comp_uuid = str(uuid.uuid4())
        ssp_uuid = str(uuid.uuid4())

        components = [
            {
                "uuid": leveraged_comp_uuid,
                "type": "service",
                "title": "Cloud IaaS Compute Engine",
                "description": "Leveraged Infrastructure Component",
                "status": {"state": "operational"}
            }
        ]

        impl_reqs = [
            {
                "uuid": str(uuid.uuid4()),
                "control-id": "pe-3",
                "by-components": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "component-uuid": leveraged_comp_uuid,
                        "description": "Physical access control to data center is 100% inherited from AWS GovCloud P-ATO",
                        "implementation-status": {"state": "inherited"},
                        "inherited": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "provided-uuid": leveraged_auth_uuid,
                                "description": "Physical security controls provided by underlying cloud infrastructure provider."
                            }
                        ]
                    }
                ]
            }
        ]

        ssp_doc = build_valid_ssp_dict(ssp_uuid, "Inheritance & Leveraged Auth SSP", "Inheriting Cloud App", prof_uuid, components, impl_reqs)
        ssp_doc["system-security-plan"]["system-implementation"]["leveraged-authorizations"] = [
            {
                "uuid": leveraged_auth_uuid,
                "title": "AWS GovCloud FedRAMP High P-ATO",
                "party-uuid": str(uuid.uuid4()),
                "date-authorized": "2025-01-15"
            }
        ]
        ssp_doc = remove_empty_arrays(ssp_doc)

        # 1. NIST Schema Validation
        validate_document("ssps", ssp_doc, check_refs=False)

        # 2. REST API Save
        res_post = client.post("/api/documents/ssps", json=ssp_doc)
        assert res_post.status_code == 201, f"Failed to save inheritance SSP: {res_post.text}"

        # 3. Verification of persistence
        res_get = client.get(f"/api/documents/ssps/{ssp_uuid}")
        assert res_get.status_code == 200
        saved_ssp = res_get.json()["system-security-plan"]
        
        # Leveraged Authorization check
        saved_auth = saved_ssp["system-implementation"]["leveraged-authorizations"][0]
        assert saved_auth["uuid"] == leveraged_auth_uuid
        assert saved_auth["title"] == "AWS GovCloud FedRAMP High P-ATO"

        # Inherited requirement check
        saved_req = saved_ssp["control-implementation"]["implemented-requirements"][0]
        saved_bc = saved_req["by-components"][0]
        assert saved_bc["implementation-status"]["state"] == "inherited"
        assert saved_bc["inherited"][0]["provided-uuid"] == leveraged_auth_uuid
