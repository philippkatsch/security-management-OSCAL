"""
Challenger 2 Milestone 6: Empirical Schema Validation, Roundtrip & Export Integrity Suite

Covers:
1. Conformance of official BSI and NIST Component Definitions from oscal-reference/.
2. Positive validation of exhaustive Component Definition models containing all standard/custom
   properties, protocols, multi-level control implementations, statements, set-parameters,
   roles, links, capabilities, and import-component-definitions against POST /api/validate/component-definitions.
3. Negative stress testing verifying strict schema rejection of illegal fields ('status' on defined-component/capability),
   invalid transports, invalid port ranges, invalid UUID formats, missing required fields, and empty arrays/values.
4. Format conversion roundtrip integrity: JSON <-> YAML <-> XML serialization and parsing, ensuring
   all Component Definition plural/singular tags and XML attributes round-trip cleanly.
5. Export endpoint draft-isolation: verifying that GET /api/export/component-definitions/{id} exports published data,
   never leaked drafts.
"""

import os
import json
import uuid
import copy
import pytest
from typing import Dict, Any, List
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator

from app.main import app
from app.validation import validate_document, SCHEMAS, OSCALValidationError
from app.format_converter import (
    parse_xml_to_oscal_dict,
    serialize_oscal_dict_to_xml,
    parse_yaml_to_dict,
    serialize_dict_to_yaml,
)
from app.services.profile_service import remove_empty_arrays


# Paths - 4 levels up: reposol/backend/tests/stress -> reposol/backend/tests -> reposol/backend -> reposol -> Security-Management-OSCAL
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
BSI_COMPONENTS_DIR = os.path.join(
    PROJECT_ROOT, "oscal-reference", "Stand-der-Technik-Bibliothek", "implementation_layer"
)

STANDARD_TYPES = [
    "interconnection",
    "software",
    "hardware",
    "service",
    "policy",
    "physical",
    "process-procedure",
    "plan",
    "guidance",
    "standard",
    "validation",
]

CUSTOM_TYPES = [
    "cloud-infrastructure",
    "kubernetes-operator",
    "ai-agent",
    "serverless-microservice",
    "container-image",
]


def make_full_test_component_definition() -> Dict[str, Any]:
    """Generates an exhaustive, fully-populated Component Definition with all standard and custom OSCAL features."""
    cdef_uuid = str(uuid.uuid4())
    comp_software_uuid = str(uuid.uuid4())
    comp_service_uuid = str(uuid.uuid4())
    comp_hardware_uuid = str(uuid.uuid4())
    comp_val_uuid = str(uuid.uuid4())
    party_secops_uuid = str(uuid.uuid4())
    party_admin_uuid = str(uuid.uuid4())
    resource_uuid = str(uuid.uuid4())

    return {
        "component-definition": {
            "uuid": cdef_uuid,
            "metadata": {
                "title": "Comprehensive Enterprise Security Component Definition",
                "last-modified": "2026-09-01T08:00:00Z",
                "version": "2.5.0",
                "oscal-version": "1.1.2",
                "document-ids": [
                    {
                        "scheme": "https://ietf.org/rfc/rfc9562",
                        "identifier": cdef_uuid
                    }
                ],
                "props": [
                    {
                        "name": "asset-type",
                        "value": "software",
                        "ns": "http://csrc.nist.gov/ns/oscal"
                    },
                    {
                        "name": "custom-classification",
                        "value": "enterprise-confidential"
                    }
                ],
                "links": [
                    {
                        "href": f"#{resource_uuid}",
                        "rel": "reference",
                        "text": "Enterprise Component Architecture Reference"
                    }
                ],
                "roles": [
                    {
                        "id": "asset-owner",
                        "title": "Enterprise Asset Owner"
                    },
                    {
                        "id": "security-operations",
                        "title": "SecOps Lead"
                    },
                    {
                        "id": "asset-administrator",
                        "title": "System Administrator"
                    }
                ],
                "parties": [
                    {
                        "uuid": party_secops_uuid,
                        "type": "organization",
                        "name": "Global Cyber Defense Center",
                        "email-addresses": ["secops@enterprise.example.com"],
                        "addresses": [
                            {
                                "addr-lines": ["100 Cyber Security Blvd"],
                                "city": "Frankfurt",
                                "postal-code": "60311",
                                "country": "DE"
                            }
                        ]
                    },
                    {
                        "uuid": party_admin_uuid,
                        "type": "person",
                        "name": "Lead SysAdmin",
                        "email-addresses": ["admin@enterprise.example.com"]
                    }
                ],
                "remarks": "Exhaustive component definition exercising all NIST OSCAL 1.1.2 constructs."
            },
            "import-component-definitions": [
                {
                    "href": "https://raw.githubusercontent.com/usnistgov/oscal-content/master/examples/component-definition/json/example-component-definition.json"
                }
            ],
            "components": [
                {
                    "uuid": comp_software_uuid,
                    "type": "software",
                    "title": "PostgreSQL Database Engine",
                    "description": "Enterprise relational database server with Row Level Security, SCRAM-SHA-256, and TLS encryption.",
                    "purpose": "Stores structured security audit records and application states.",
                    "props": [
                        {"name": "version", "value": "16.4", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "software-name", "value": "PostgreSQL", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "software-version", "value": "16.4", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "software-patch-level", "value": "16.4-1.pgdg120+1", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "release-date", "value": "2026-08-15", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "implementation-point", "value": "internal", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "virtual", "value": "yes", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "public", "value": "no", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "allows-authenticated-scan", "value": "yes", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "model", "value": "RDBMS-HA-Cluster", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "asset-id", "value": "AST-DB-PG16", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "asset-type", "value": "database", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "sort-id", "value": "010-DB-PG", "ns": "http://csrc.nist.gov/ns/oscal"}
                    ],
                    "links": [
                        {
                            "href": f"#{comp_service_uuid}",
                            "rel": "uses-service",
                            "text": "Depends on Auth SSO Service"
                        }
                    ],
                    "responsible-roles": [
                        {
                            "role-id": "asset-owner",
                            "party-uuids": [party_secops_uuid]
                        },
                        {
                            "role-id": "asset-administrator",
                            "party-uuids": [party_admin_uuid]
                        }
                    ],
                    "protocols": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "name": "postgresql",
                            "title": "PostgreSQL Wire Protocol over TLS",
                            "port-ranges": [
                                {
                                    "start": 5432,
                                    "end": 5432,
                                    "transport": "TCP"
                                }
                            ]
                        }
                    ],
                    "control-implementations": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "source": "https://github.com/usnistgov/oscal-content/blob/master/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
                            "description": "NIST SP 800-53 Rev 5 control implementations provided by PostgreSQL 16.",
                            "set-parameters": [
                                {
                                    "param-id": "ac-2_prm_1",
                                    "values": ["30 days", "90 days"],
                                    "remarks": "Inactivity expiration interval configured via connection pooler."
                                }
                            ],
                            "implemented-requirements": [
                                {
                                    "uuid": str(uuid.uuid4()),
                                    "control-id": "ac-2",
                                    "description": "Account management enforced via automated database user provisioning and role expiration.",
                                    "set-parameters": [
                                        {
                                            "param-id": "ac-2_prm_2",
                                            "values": ["15 minutes"],
                                            "remarks": "Session idle timeout."
                                        }
                                    ],
                                    "statements": [
                                        {
                                            "statement-id": "ac-2_smt_a",
                                            "uuid": str(uuid.uuid4()),
                                            "description": "PostgreSQL accounts are synchronized with directory services. Inactive accounts disabled after {{ insert: param, ac-2_prm_1 }}.",
                                            "props": [
                                                {"name": "automated", "value": "true"}
                                            ],
                                            "responsible-roles": [
                                                {
                                                    "role-id": "asset-administrator",
                                                    "party-uuids": [party_admin_uuid]
                                                }
                                            ]
                                        },
                                        {
                                            "statement-id": "ac-2_smt_b",
                                            "uuid": str(uuid.uuid4()),
                                            "description": "Temporary and emergency accounts are automatically dropped after 24 hours."
                                        }
                                    ]
                                },
                                {
                                    "uuid": str(uuid.uuid4()),
                                    "control-id": "sc-8",
                                    "description": "Transmission confidentiality and integrity enforced via mandatory TLSv1.3 ciphers.",
                                    "statements": [
                                        {
                                            "statement-id": "sc-8_smt_a",
                                            "uuid": str(uuid.uuid4()),
                                            "description": "All client connections require sslmode=verify-full with ECDHE-RSA-AES256-GCM-SHA384."
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    "uuid": comp_service_uuid,
                    "type": "service",
                    "title": "Keycloak IAM Authentication Service",
                    "description": "Centralized OAuth2 / OpenID Connect Identity Provider.",
                    "props": [
                        {"name": "version", "value": "26.0.0", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "function", "value": "Single Sign-On and Access Token Minting", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "public", "value": "yes", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "virtual", "value": "yes", "ns": "http://csrc.nist.gov/ns/oscal"}
                    ],
                    "protocols": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "name": "https",
                            "title": "HTTPS Admin and Token Endpoints",
                            "port-ranges": [
                                {"start": 443, "end": 443, "transport": "TCP"},
                                {"start": 8443, "end": 8443, "transport": "TCP"}
                            ]
                        }
                    ]
                },
                {
                    "uuid": comp_hardware_uuid,
                    "type": "hardware",
                    "title": "HSM Security Module",
                    "description": "FIPS 140-3 Level 3 Hardware Security Module.",
                    "props": [
                        {"name": "model", "value": "Luna-Network-HSM-7", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "asset-tag", "value": "HSM-DC1-01", "ns": "http://csrc.nist.gov/ns/oscal"}
                    ]
                },
                {
                    "uuid": comp_val_uuid,
                    "type": "validation",
                    "title": "Cryptographic Module Validation Program (CMVP)",
                    "description": "FIPS 140-3 Cryptographic Validation Certificate.",
                    "props": [
                        {"name": "validation-type", "value": "FIPS-140-3", "ns": "http://csrc.nist.gov/ns/oscal"},
                        {"name": "validation-reference", "value": "Cert #4928", "ns": "http://csrc.nist.gov/ns/oscal"}
                    ]
                }
            ],
            "capabilities": [
                {
                    "uuid": str(uuid.uuid4()),
                    "name": "Zero-Trust Identity and Data Security Capability",
                    "description": "Combines IAM service, database encryption, and hardware cryptographic key protection into a cohesive Zero-Trust baseline.",
                    "incorporates-components": [
                        {
                            "component-uuid": comp_software_uuid,
                            "description": "Provides encrypted persistent storage layer."
                        },
                        {
                            "component-uuid": comp_service_uuid,
                            "description": "Provides user and machine identity verification."
                        },
                        {
                            "component-uuid": comp_hardware_uuid,
                            "description": "Secures root-of-trust master cryptographic keys."
                        }
                    ],
                    "control-implementations": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "source": "https://example.com/catalogs/zero-trust.json",
                            "description": "Capability-level zero-trust control implementations.",
                            "implemented-requirements": [
                                {
                                    "uuid": str(uuid.uuid4()),
                                    "control-id": "zt-1",
                                    "description": "Continuous authentication and micro-segmentation enforced at all entrypoints."
                                }
                            ]
                        }
                    ]
                }
            ],
            "back-matter": {
                "resources": [
                    {
                        "uuid": resource_uuid,
                        "title": "Enterprise Component Architecture Blueprint",
                        "description": "PDF specification for enterprise standard component deployment architectures.",
                        "rlinks": [
                            {
                                "href": "https://docs.enterprise.example.com/arch/component-blueprint.pdf",
                                "media-type": "application/pdf"
                            }
                        ]
                    }
                ]
            }
        }
    }


# =============================================================================
# TEST CLASS 1: BSI & NIST OFFICIAL SAMPLES SCHEMA CONFORMANCE
# =============================================================================

class TestOfficialBsiReferenceSamples:
    """Verifies that real-world official BSI component definitions validate against the schema."""

    def test_all_bsi_component_definitions_validate_cleanly(self):
        assert os.path.exists(BSI_COMPONENTS_DIR), f"BSI implementation_layer dir not found at {BSI_COMPONENTS_DIR}"
        
        found_files = []
        for root, _, files in os.walk(BSI_COMPONENTS_DIR):
            for file in files:
                if file.endswith("-component_definition.json") or file.endswith("component_definition.json"):
                    found_files.append(os.path.join(root, file))

        assert len(found_files) >= 5, f"Expected at least 5 BSI component definitions, found {len(found_files)}"

        validator = Draft7Validator(SCHEMAS["component-definitions"])

        for filepath in found_files:
            filename = os.path.basename(filepath)
            with open(filepath, "r", encoding="utf-8") as f:
                doc = json.load(f)

            # Purge empty arrays if present per DD-014
            cleaned_doc = remove_empty_arrays(doc)
            errors = list(validator.iter_errors(cleaned_doc))
            assert errors == [], f"Official BSI sample '{filename}' failed schema validation: {[e.message for e in errors]}"


# =============================================================================
# TEST CLASS 2: POSITIVE VALIDATION & FASTAPI ROUTE INTEGRATION
# =============================================================================

class TestStep3PositiveAndRouteValidation:
    """Verifies complete component definitions pass both internal validator and FastAPI /api/validate/ endpoint."""

    @pytest.mark.asyncio
    async def test_full_component_definition_passes_internal_validator(self):
        doc = make_full_test_component_definition()
        await validate_document("component-definitions", doc)

    def test_full_component_definition_passes_fastapi_route(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "valid"
        assert data.get("stage") == "component-definitions"

    @pytest.mark.parametrize("comp_type", STANDARD_TYPES)
    def test_all_standard_types_pass_fastapi_route(self, comp_type: str):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["components"][0]["type"] = comp_type
        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code == 200, f"Failed for type {comp_type}: {response.text}"

    @pytest.mark.parametrize("custom_type", CUSTOM_TYPES)
    def test_all_custom_types_pass_fastapi_route(self, custom_type: str):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["components"][0]["type"] = custom_type
        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code == 200, f"Failed for custom type {custom_type}: {response.text}"


# =============================================================================
# TEST CLASS 3: NEGATIVE & ADVERSARIAL STRESS CHALLENGES
# =============================================================================

class TestStep3AdversarialNegativeValidation:
    """Verifies that invalid schema constructs, illegal fields, and format violations are strictly rejected."""

    def test_status_field_on_defined_component_rejected_by_route(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["components"][0]["status"] = "operational"

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code == 422 or response.status_code == 400
        assert "status" in response.text or "Additional properties are not allowed" in response.text

    def test_status_field_on_capability_rejected_by_route(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["capabilities"][0]["status"] = "operational"

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code == 422 or response.status_code == 400
        assert "status" in response.text or "Additional properties are not allowed" in response.text

    def test_status_field_on_root_rejected_by_route(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["status"] = "operational"

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code == 422 or response.status_code == 400

    def test_invalid_transport_enum_rejected(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["components"][0]["protocols"][0]["port-ranges"][0]["transport"] = "HTTP"

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code in (400, 422)
        assert "HTTP" in response.text or "is not one of ['TCP', 'UDP']" in response.text

    def test_invalid_uuid_rejected(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["components"][0]["uuid"] = "not-a-valid-uuid"

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code in (400, 422)

    def test_missing_statement_id_rejected(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        del doc["component-definition"]["components"][0]["control-implementations"][0]["implemented-requirements"][0]["statements"][0]["statement-id"]

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code in (400, 422)
        assert "statement-id" in response.text or "required" in response.text

    def test_missing_implemented_requirement_control_id_rejected(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        del doc["component-definition"]["components"][0]["control-implementations"][0]["implemented-requirements"][0]["control-id"]

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code in (400, 422)

    def test_empty_title_rejected(self):
        client = TestClient(app)
        doc = make_full_test_component_definition()
        doc["component-definition"]["components"][0]["title"] = ""

        response = client.post("/api/validate/component-definitions", json=doc)
        assert response.status_code in (400, 422)


# =============================================================================
# TEST CLASS 4: FORMAT CONVERTER ROUNDTRIP INTEGRITY (JSON <-> YAML <-> XML)
# =============================================================================

class TestStep3FormatConverterRoundtrips:
    """Verifies bidirectional conversions across JSON, YAML, and XML preserve all component definition constructs."""

    def test_json_to_yaml_and_back_roundtrip(self):
        doc = make_full_test_component_definition()
        yaml_str = serialize_dict_to_yaml(doc)
        assert "PostgreSQL Database Engine" in yaml_str
        assert "implemented-requirements" in yaml_str
        assert "capabilities" in yaml_str

        parsed_doc = parse_yaml_to_dict(yaml_str)
        assert parsed_doc["component-definition"]["uuid"] == doc["component-definition"]["uuid"]
        assert len(parsed_doc["component-definition"]["components"]) == len(doc["component-definition"]["components"])
        assert len(parsed_doc["component-definition"]["capabilities"]) == 1

    def test_json_to_xml_serialization_and_attribute_preservation(self):
        doc = make_full_test_component_definition()
        xml_str = serialize_oscal_dict_to_xml(doc)

        # 1. XML Root & Namespace
        assert 'xmlns="http://csrc.nist.gov/ns/oscal/1.0"' in xml_str
        assert f'uuid="{doc["component-definition"]["uuid"]}"' in xml_str

        # 2. XML Attributes (NOT child elements)
        assert 'type="software"' in xml_str
        assert 'type="service"' in xml_str
        assert 'type="hardware"' in xml_str
        assert 'type="validation"' in xml_str
        assert 'transport="TCP"' in xml_str
        assert 'start="5432"' in xml_str
        assert 'end="5432"' in xml_str
        assert 'control-id="ac-2"' in xml_str
        assert 'statement-id="ac-2_smt_a"' in xml_str
        assert 'param-id="ac-2_prm_1"' in xml_str
        assert 'role-id="asset-owner"' in xml_str
        assert 'rel="reference"' in xml_str
        assert 'rel="uses-service"' in xml_str

        # 3. Plural-to-singular XML Tag Checks
        assert "<defined-component " in xml_str or "<component " in xml_str
        assert "<capability " in xml_str
        assert "<incorporates-component " in xml_str
        assert "<control-implementation " in xml_str
        assert "<implemented-requirement " in xml_str
        assert "<statement " in xml_str
        assert "<set-parameter " in xml_str
        assert "<protocol " in xml_str
        assert "<port-range " in xml_str
        assert "<import-component-definition " in xml_str
        assert "<resource " in xml_str
        assert "<rlink " in xml_str

        # Forbidden Plural XML Tags
        assert "<components" not in xml_str
        assert "<capabilities" not in xml_str
        assert "<control-implementations" not in xml_str
        assert "<implemented-requirements" not in xml_str
        assert "<statements" not in xml_str
        assert "<set-parameters" not in xml_str
        assert "<protocols" not in xml_str
        assert "<port-ranges" not in xml_str
        assert "<import-component-definitions" not in xml_str
        assert "<resources" not in xml_str
        assert "<rlinks" not in xml_str

    def test_xml_to_dict_preserves_all_arrays_and_attributes(self):
        doc = make_full_test_component_definition()
        xml_str = serialize_oscal_dict_to_xml(doc)

        reparsed = parse_xml_to_oscal_dict(xml_str)
        cdef = reparsed.get("component-definition")
        assert cdef is not None

        # Verify parsed arrays
        assert isinstance(cdef.get("components"), list)
        assert len(cdef["components"]) == 4

        comp0 = cdef["components"][0]
        assert comp0["type"] == "software"
        assert isinstance(comp0.get("protocols"), list)
        assert len(comp0["protocols"]) == 1
        assert comp0["protocols"][0]["port-ranges"][0]["transport"] == "TCP"
        assert str(comp0["protocols"][0]["port-ranges"][0]["start"]) == "5432"

        assert isinstance(comp0.get("control-implementations"), list)
        impl0 = comp0["control-implementations"][0]
        assert isinstance(impl0.get("set-parameters"), list)
        assert impl0["set-parameters"][0]["param-id"] == "ac-2_prm_1"
        assert impl0["set-parameters"][0]["values"] == ["30 days", "90 days"]

        req0 = impl0["implemented-requirements"][0]
        assert req0["control-id"] == "ac-2"
        assert isinstance(req0.get("statements"), list)
        assert len(req0["statements"]) == 2
        assert req0["statements"][0]["statement-id"] == "ac-2_smt_a"
        assert "{{ insert: param, ac-2_prm_1 }}" in req0["statements"][0]["description"]

        assert isinstance(cdef.get("capabilities"), list)
        cap0 = cdef["capabilities"][0]
        assert len(cap0["incorporates-components"]) == 3

        assert isinstance(cdef.get("import-component-definitions"), list)
        assert len(cdef["import-component-definitions"]) == 1

        assert isinstance(cdef.get("back-matter", {}).get("resources"), list)
        assert len(cdef["back-matter"]["resources"]) == 1


# =============================================================================
# TEST CLASS 5: DRAFT ISOLATION & EXPORT ENDPOINT INTEGRITY
# =============================================================================

class TestStep3ExportDraftIsolation:
    """Verifies that /api/export/component-definitions/{id} exports published documents, not drafts."""

    def test_export_endpoint_returns_published_doc_not_draft(self, client, isolated_data_dir):
        doc = make_full_test_component_definition()
        doc_id = doc["component-definition"]["uuid"]
        doc["component-definition"]["metadata"]["title"] = "Published Component Definition"

        # 1. Save published document via API
        res_save = client.post("/api/documents/component-definitions", json=doc)
        assert res_save.status_code in (200, 201)

        # 2. Save a conflicting draft version via versioning route
        draft_doc = copy.deepcopy(doc)
        draft_doc["component-definition"]["metadata"]["title"] = "DRAFT UNPUBLISHED WORK IN PROGRESS"
        res_draft = client.post(f"/api/documents/component-definitions/{doc_id}/versions?is_draft=true", json=draft_doc)
        assert res_draft.status_code in (200, 201)

        # 3. Call export endpoint
        response = client.get(f"/api/export/component-definitions/{doc_id}?format=json")
        assert response.status_code == 200

        exported = response.json()
        assert exported["component-definition"]["metadata"]["title"] == "Published Component Definition"
        assert exported["component-definition"]["metadata"]["title"] != "DRAFT UNPUBLISHED WORK IN PROGRESS"
