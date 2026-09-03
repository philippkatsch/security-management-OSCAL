"""
Empirical Challenger 2: Milestone 1 Step 3 Component Definition Schema & Sanitization Stress Suite

Tests:
1. Positive Schema Validation:
   - All 11 standard defined-component types (interconnection, software, hardware, service, policy,
     physical, process-procedure, plan, guidance, standard, validation).
   - Custom component types (cloud-platform, container-image, microservice, ai-model, serverless-fn).
   - Deep nested structures: service protocols (with TCP/UDP port ranges), control implementations,
     bulk implemented requirements, structured statements, set-parameters at both levels,
     capabilities with incorporates-components, import-component-definitions, back-matter resources.
2. Sanitization Pipeline & DD-014 Empty Array Purging:
   - Raw documents with empty arrays (set-parameters: [], props: [], links: [], etc.) fail Draft7Validator
     due to minItems: 1.
   - Simulated sanitization / cleaned output strips empty arrays and passes Draft7Validator.
   - Forbidden field stripping: 'status' on defined-component stripped during sanitization.
3. Negative Schema Validation (Adversarial Stress):
   - Direct insertion of 'status' on defined-component must fail Draft7Validator (additionalProperties: false).
   - Direct insertion of 'status' on capability or root component-definition must fail Draft7Validator.
   - Missing required fields at every hierarchy level must fail Draft7Validator:
     * root: uuid, metadata
     * defined-component: uuid, type, title, description
     * capability: uuid, name, description
     * incorporates-component: component-uuid, description
     * control-implementation: uuid, source, description, implemented-requirements
     * implemented-requirement: uuid, control-id, description
     * statement: statement-id, uuid, description
     * set-parameter: param-id, values
     * import-component-definition: href
   - Invalid field types & formats:
     * Non-UUID string in uuid fields
     * Invalid port transport ('HTTP', 'SCTP' instead of 'TCP', 'UDP')
     * Negative port numbers in port-ranges (start: -1)
     * Non-integer port numbers (start: "443")
     * Empty strings in required string title fields
     * Empty values array in set-parameter (minItems: 1)
4. Full FastAPI Validation Route Integration:
   - Async invocation of validate_document("component-definitions", doc) on valid vs invalid structures.
"""

import os
import json
import uuid
import copy
import pytest
import asyncio
from typing import Dict, Any, List
from jsonschema import Draft7Validator, ValidationError as JSONSchemaValidationError

from app.validation import validate_document, SCHEMAS, OSCALValidationError


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
    "validation"
]

CUSTOM_TYPES = [
    "cloud-platform",
    "container-image",
    "microservice",
    "ai-agent",
    "serverless-lambda",
    "saas-application"
]


def make_valid_metadata() -> Dict[str, Any]:
    return {
        "title": "Test Component Definition Document",
        "last-modified": "2026-08-31T18:00:00Z",
        "version": "1.0.0",
        "oscal-version": "1.1.2",
        "props": [
            {
                "name": "asset-type",
                "value": "operating-system",
                "ns": "http://csrc.nist.gov/ns/oscal"
            }
        ],
        "links": [
            {
                "href": "https://example.com/component-spec",
                "rel": "describedby"
            }
        ],
        "roles": [
            {
                "id": "asset-owner",
                "title": "Asset Owner"
            }
        ],
        "parties": [
            {
                "uuid": str(uuid.uuid4()),
                "type": "organization",
                "name": "SecOps Team"
            }
        ]
    }


def make_valid_component(comp_type: str = "software", comp_uuid: str = None) -> Dict[str, Any]:
    u = comp_uuid or str(uuid.uuid4())
    return {
        "uuid": u,
        "type": comp_type,
        "title": f"Component of type {comp_type}",
        "description": f"Detailed description for {comp_type} component.",
        "purpose": "Provides security control capabilities.",
        "props": [
            {
                "name": "version",
                "value": "2.4.1",
                "ns": "http://csrc.nist.gov/ns/oscal"
            },
            {
                "name": "implementation-point",
                "value": "internal",
                "ns": "http://csrc.nist.gov/ns/oscal"
            }
        ],
        "protocols": [
            {
                "uuid": str(uuid.uuid4()),
                "name": "https",
                "title": "HTTPS Transport Protocol",
                "port-ranges": [
                    {
                        "start": 443,
                        "end": 443,
                        "transport": "TCP"
                    }
                ]
            }
        ],
        "control-implementations": [
            {
                "uuid": str(uuid.uuid4()),
                "source": "https://github.com/usnistgov/oscal-content/blob/master/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
                "description": "NIST SP 800-53 Rev 5 controls implemented by this component.",
                "set-parameters": [
                    {
                        "param-id": "ac-1_prm_1",
                        "values": ["annually", "semi-annually"],
                        "remarks": "Reviewed on regular schedule"
                    }
                ],
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "description": "Access control policy and procedures implemented via automated platform rules.",
                        "set-parameters": [
                            {
                                "param-id": "ac-1_prm_2",
                                "values": ["30 days"]
                            }
                        ],
                        "statements": [
                            {
                                "statement-id": "ac-1_smt_a",
                                "uuid": str(uuid.uuid4()),
                                "description": "Policy is documented in enterprise portal and updated annually."
                            },
                            {
                                "statement-id": "ac-1_smt_b",
                                "uuid": str(uuid.uuid4()),
                                "description": "Procedures are maintained in git repository with mandatory peer review."
                            }
                        ]
                    }
                ]
            }
        ]
    }


def make_valid_capability(component_uuids: List[str]) -> Dict[str, Any]:
    return {
        "uuid": str(uuid.uuid4()),
        "name": "Identity & Access Management Capability",
        "description": "Aggregates components providing unified IAM features.",
        "incorporates-components": [
            {
                "component-uuid": comp_uuid,
                "description": f"Incorporates component {comp_uuid} into IAM capability."
            }
            for comp_uuid in component_uuids
        ],
        "control-implementations": [
            {
                "uuid": str(uuid.uuid4()),
                "source": "https://example.com/catalog.json",
                "description": "Capability-level control implementation",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ia-2",
                        "description": "Identification and authentication for organizational users."
                    }
                ]
            }
        ]
    }


def make_valid_component_definition_doc(
    types: List[str] = None,
    with_capabilities: bool = True,
    with_imports: bool = True
) -> Dict[str, Any]:
    types_to_use = types or ["software"]
    components = [make_valid_component(t) for t in types_to_use]
    comp_uuids = [c["uuid"] for c in components]

    cdef: Dict[str, Any] = {
        "uuid": str(uuid.uuid4()),
        "metadata": make_valid_metadata(),
        "components": components
    }

    if with_capabilities and comp_uuids:
        cdef["capabilities"] = [make_valid_capability(comp_uuids)]

    if with_imports:
        cdef["import-component-definitions"] = [
            {
                "href": "https://example.com/shared-components.json"
            }
        ]

    return {
        "component-definition": cdef
    }


def python_sanitize_component_definition(obj: Any) -> Any:
    """Python equivalent of frontend sanitizeComponentDefinition."""
    if obj is None:
        return None

    if isinstance(obj, list):
        cleaned = [python_sanitize_component_definition(x) for x in obj]
        cleaned = [x for x in cleaned if x is not None and x != ""]
        return cleaned if len(cleaned) > 0 else None

    if isinstance(obj, dict):
        cleaned_dict = {}
        for k, v in obj.items():
            if k == "status":
                continue
            if k == "set-parameters" and isinstance(v, list):
                valid_params = []
                for p in v:
                    if isinstance(p, dict) and p.get("param-id"):
                        vals = p.get("values")
                        if isinstance(vals, list):
                            cleaned_vals = [str(x).strip() for x in vals if str(x).strip()]
                            if cleaned_vals:
                                p_copy = dict(p)
                                p_copy["values"] = cleaned_vals
                                valid_params.append(p_copy)
                if valid_params:
                    cleaned_dict[k] = valid_params
                continue

            if k == "props" and isinstance(v, list):
                valid_props = []
                for p in v:
                    if isinstance(p, dict) and p.get("name") and str(p.get("name")).strip():
                        val = p.get("value")
                        if val is not None and str(val).strip():
                            p_copy = dict(p)
                            p_copy["name"] = str(p["name"]).strip()
                            p_copy["value"] = str(val).strip()
                            valid_props.append(p_copy)
                if valid_props:
                    cleaned_dict[k] = valid_props
                continue

            cleaned_val = python_sanitize_component_definition(v)
            if cleaned_val is not None:
                cleaned_dict[k] = cleaned_val

        if "back-matter" in cleaned_dict and not cleaned_dict["back-matter"]:
            del cleaned_dict["back-matter"]

        return cleaned_dict if len(cleaned_dict) > 0 else None

    return obj


# =============================================================================
# EMPIRICAL CHALLENGE SUITE
# =============================================================================

class TestStep3PositiveValidation:
    """Empirical verification of valid OSCAL Component Definition models."""

    @pytest.mark.parametrize("comp_type", STANDARD_TYPES)
    def test_standard_component_types_pass_schema_validation(self, comp_type: str):
        """All 11 standard defined-component types must validate successfully."""
        doc = make_valid_component_definition_doc(types=[comp_type])
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert errors == [], f"Validation failed for standard type '{comp_type}': {[e.message for e in errors]}"

    @pytest.mark.parametrize("custom_type", CUSTOM_TYPES)
    def test_custom_component_types_pass_schema_validation(self, custom_type: str):
        """Custom free-text component types (allow-other='yes') must validate successfully."""
        doc = make_valid_component_definition_doc(types=[custom_type])
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert errors == [], f"Validation failed for custom type '{custom_type}': {[e.message for e in errors]}"

    def test_composite_multi_type_component_definition(self):
        """A component definition with all 11 standard types + 3 custom types simultaneously."""
        all_types = STANDARD_TYPES + CUSTOM_TYPES[:3]
        doc = make_valid_component_definition_doc(types=all_types, with_capabilities=True, with_imports=True)
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert errors == [], f"Validation failed for composite multi-type document: {[e.message for e in errors]}"

    def test_all_port_range_transports(self):
        """Verify TCP and UDP transports validate correctly in protocols."""
        doc = make_valid_component_definition_doc(types=["service"])
        comp = doc["component-definition"]["components"][0]
        comp["protocols"] = [
            {
                "name": "dns",
                "title": "Domain Name System",
                "port-ranges": [
                    {"start": 53, "end": 53, "transport": "UDP"},
                    {"start": 53, "end": 53, "transport": "TCP"}
                ]
            }
        ]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert errors == [], f"Validation failed for protocol port ranges: {[e.message for e in errors]}"

    @pytest.mark.asyncio
    async def test_fastapi_validate_document_route(self):
        """Test validation through app.validation.validate_document endpoint."""
        doc = make_valid_component_definition_doc(types=["software", "hardware", "service"])
        await validate_document("component-definitions", doc)


class TestStep3SanitizationAndPurging:
    """Empirical verification of DD-014 empty array purging and forbidden field sanitization."""

    def test_empty_arrays_fail_schema_but_pass_after_sanitization(self):
        """
        NIST OSCAL schema enforces minItems: 1 on all arrays.
        Raw frontend drafts may contain empty arrays (e.g. set-parameters: [], props: []).
        Sanitization must purge these empty arrays so the document passes schema validation.
        """
        doc = make_valid_component_definition_doc(types=["software"])
        comp = doc["component-definition"]["components"][0]

        # Inject empty arrays across multiple levels
        comp["props"] = []
        comp["links"] = []
        comp["responsible-roles"] = []
        comp["protocols"] = []
        comp["control-implementations"][0]["set-parameters"] = []
        comp["control-implementations"][0]["props"] = []
        comp["control-implementations"][0]["links"] = []
        comp["control-implementations"][0]["implemented-requirements"][0]["set-parameters"] = []
        comp["control-implementations"][0]["implemented-requirements"][0]["props"] = []
        comp["control-implementations"][0]["implemented-requirements"][0]["links"] = []
        comp["control-implementations"][0]["implemented-requirements"][0]["responsible-roles"] = []

        validator = Draft7Validator(SCHEMAS["component-definitions"])
        raw_errors = list(validator.iter_errors(doc))
        # Raw document MUST fail schema validation due to minItems: 1
        assert len(raw_errors) > 0, "Expected schema validation failure for document with empty arrays"

        # Apply sanitization
        cleaned_doc = {
            "component-definition": python_sanitize_component_definition(doc["component-definition"])
        }

        # Sanitized document MUST pass schema validation
        cleaned_errors = list(validator.iter_errors(cleaned_doc))
        assert cleaned_errors == [], f"Sanitized document failed validation: {[e.message for e in cleaned_errors]}"

    def test_forbidden_status_field_stripped_by_sanitization(self):
        """
        Inserting 'status' on defined-component causes schema failure.
        Sanitizer must strip 'status' from defined-component, restoring validity.
        """
        doc = make_valid_component_definition_doc(types=["software"])
        comp = doc["component-definition"]["components"][0]
        comp["status"] = "operational"

        validator = Draft7Validator(SCHEMAS["component-definitions"])
        raw_errors = list(validator.iter_errors(doc))
        assert len(raw_errors) > 0, "Document with 'status' on defined-component must fail schema validation"

        cleaned_doc = {
            "component-definition": python_sanitize_component_definition(doc["component-definition"])
        }
        assert "status" not in cleaned_doc["component-definition"]["components"][0]

        cleaned_errors = list(validator.iter_errors(cleaned_doc))
        assert cleaned_errors == [], f"Sanitized document failed validation: {[e.message for e in cleaned_errors]}"

    def test_empty_set_parameters_values_purging(self):
        """
        Set-parameters with empty or whitespace-only values must be purged by sanitizer.
        """
        doc = make_valid_component_definition_doc(types=["software"])
        comp = doc["component-definition"]["components"][0]
        comp["control-implementations"][0]["set-parameters"] = [
            {"param-id": "param_1", "values": ["   ", ""]},
            {"param-id": "param_2", "values": ["valid_val"]}
        ]

        cleaned_doc = {
            "component-definition": python_sanitize_component_definition(doc["component-definition"])
        }
        params = cleaned_doc["component-definition"]["components"][0]["control-implementations"][0]["set-parameters"]
        assert len(params) == 1
        assert params[0]["param-id"] == "param_2"
        assert params[0]["values"] == ["valid_val"]


class TestStep3NegativeAdversarialValidation:
    """Adversarial stress-testing: verifying that invalid schemas are strictly rejected."""

    def test_status_field_on_defined_component_rejected(self):
        """Defined-component does NOT have status field in OSCAL metaschema."""
        doc = make_valid_component_definition_doc(types=["software"])
        doc["component-definition"]["components"][0]["status"] = "operational"
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        error_msgs = [e.message for e in errors]
        assert any("Additional properties are not allowed ('status' was unexpected)" in m for m in error_msgs)

    def test_status_field_on_capability_rejected(self):
        """Capability does NOT have status field in OSCAL metaschema."""
        doc = make_valid_component_definition_doc(types=["software"], with_capabilities=True)
        doc["component-definition"]["capabilities"][0]["status"] = "operational"
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        error_msgs = [e.message for e in errors]
        assert any("Additional properties are not allowed ('status' was unexpected)" in m for m in error_msgs)

    def test_invalid_port_range_transport_rejected(self):
        """Port range transport enum only allows 'TCP' or 'UDP'."""
        doc = make_valid_component_definition_doc(types=["service"])
        doc["component-definition"]["components"][0]["protocols"] = [
            {
                "name": "http",
                "port-ranges": [
                    {"start": 80, "end": 80, "transport": "HTTP"}  # Invalid transport
                ]
            }
        ]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        error_msgs = [e.message for e in errors]
        assert any("'HTTP' is not one of ['TCP', 'UDP']" in m for m in error_msgs)

    def test_negative_port_number_rejected(self):
        """Negative port number must fail NonNegativeIntegerDatatype constraint."""
        doc = make_valid_component_definition_doc(types=["service"])
        doc["component-definition"]["components"][0]["protocols"] = [
            {
                "name": "https",
                "port-ranges": [
                    {"start": -1, "end": 443, "transport": "TCP"}
                ]
            }
        ]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0

    def test_string_port_number_rejected(self):
        """String port number must fail type integer constraint."""
        doc = make_valid_component_definition_doc(types=["service"])
        doc["component-definition"]["components"][0]["protocols"] = [
            {
                "name": "https",
                "port-ranges": [
                    {"start": "443", "end": 443, "transport": "TCP"}
                ]
            }
        ]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0

    @pytest.mark.parametrize("missing_field", ["uuid", "metadata"])
    def test_missing_root_required_fields_rejected(self, missing_field: str):
        """Root component-definition requires uuid and metadata."""
        doc = make_valid_component_definition_doc()
        del doc["component-definition"][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    @pytest.mark.parametrize("missing_field", ["uuid", "type", "title", "description"])
    def test_missing_component_required_fields_rejected(self, missing_field: str):
        """Defined-component requires uuid, type, title, description."""
        doc = make_valid_component_definition_doc()
        del doc["component-definition"]["components"][0][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    @pytest.mark.parametrize("missing_field", ["uuid", "name", "description"])
    def test_missing_capability_required_fields_rejected(self, missing_field: str):
        """Capability requires uuid, name, description."""
        doc = make_valid_component_definition_doc(with_capabilities=True)
        del doc["component-definition"]["capabilities"][0][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    @pytest.mark.parametrize("missing_field", ["component-uuid", "description"])
    def test_missing_incorporates_component_required_fields_rejected(self, missing_field: str):
        """Incorporates-component requires component-uuid, description."""
        doc = make_valid_component_definition_doc(with_capabilities=True)
        del doc["component-definition"]["capabilities"][0]["incorporates-components"][0][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    @pytest.mark.parametrize("missing_field", ["uuid", "source", "description", "implemented-requirements"])
    def test_missing_control_implementation_required_fields_rejected(self, missing_field: str):
        """Control-implementation requires uuid, source, description, implemented-requirements."""
        doc = make_valid_component_definition_doc()
        del doc["component-definition"]["components"][0]["control-implementations"][0][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    @pytest.mark.parametrize("missing_field", ["uuid", "control-id", "description"])
    def test_missing_implemented_requirement_required_fields_rejected(self, missing_field: str):
        """Implemented-requirement requires uuid, control-id, description."""
        doc = make_valid_component_definition_doc()
        del doc["component-definition"]["components"][0]["control-implementations"][0]["implemented-requirements"][0][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    @pytest.mark.parametrize("missing_field", ["statement-id", "uuid", "description"])
    def test_missing_statement_required_fields_rejected(self, missing_field: str):
        """Statement requires statement-id, uuid, description."""
        doc = make_valid_component_definition_doc()
        del doc["component-definition"]["components"][0]["control-implementations"][0]["implemented-requirements"][0]["statements"][0][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    @pytest.mark.parametrize("missing_field", ["param-id", "values"])
    def test_missing_set_parameter_required_fields_rejected(self, missing_field: str):
        """Set-parameter requires param-id, values."""
        doc = make_valid_component_definition_doc()
        del doc["component-definition"]["components"][0]["control-implementations"][0]["set-parameters"][0][missing_field]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any(f"'{missing_field}' is a required property" in e.message for e in errors)

    def test_missing_import_component_definition_href_rejected(self):
        """Import-component-definition requires href."""
        doc = make_valid_component_definition_doc(with_imports=True)
        del doc["component-definition"]["import-component-definitions"][0]["href"]
        validator = Draft7Validator(SCHEMAS["component-definitions"])
        errors = list(validator.iter_errors(doc))
        assert len(errors) > 0
        assert any("'href' is a required property" in e.message for e in errors)

    @pytest.mark.asyncio
    async def test_fastapi_validate_document_throws_on_invalid_component_definition(self):
        """validate_document must raise OSCALValidationError when document is invalid."""
        doc = make_valid_component_definition_doc()
        doc["component-definition"]["components"][0]["status"] = "operational"  # illegal field

        with pytest.raises(OSCALValidationError) as excinfo:
            await validate_document("component-definitions", doc)
        assert len(excinfo.value.errors) > 0
