import re
import os
import json
import asyncio
from typing import Dict, Any, Optional
from jsonschema import validate as jsonschema_validate, ValidationError as JSONSchemaValidationError, Draft7Validator
from app.repositories import document_repository

# Mapping of normalized stage name to its root OSCAL key
STAGE_ROOT_KEYS = {
    "catalogs": "catalog",
    "profiles": "profile",
    "ssps": "system-security-plan",
    "component-definitions": "component-definition",
    "assessment-plans": "assessment-plan",
    "assessment-results": "assessment-results",
    "poams": "plan-of-action-and-milestones",
    "control-mappings": "mapping-collection"
}

SCHEMAS = {}
current_dir = os.path.dirname(os.path.abspath(__file__))
schemas_dir = os.path.join(current_dir, "schemas")

SCHEMA_FILE_MAPPING = {
    "catalogs": "oscal_catalog_schema.json",
    "profiles": "oscal_profile_schema.json",
    "ssps": "oscal_ssp_schema.json",
    "component-definitions": "oscal_component_schema.json",
    "assessment-plans": "oscal_assessment-plan_schema.json",
    "assessment-results": "oscal_assessment-results_schema.json",
    "poams": "oscal_poam_schema.json",
    "control-mappings": "oscal_mapping_schema.json"
}

def sanitize_patterns(obj: Any) -> Any:
    """Recursively crawls a JSON Schema object and:
    1. Replaces XML-style regexes (containing '\\p') with python-compatible regexes.
    2. Relaxes strict UUID v4/v5 patterns to accept any standard UUID format.
    3. Enforces 'minLength': 1 on string title fields.
    """
    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            if k == "pattern" and isinstance(v, str):
                if "\\p" in v:
                    new_dict[k] = ".*"
                elif "[45]" in v and "[89ABab" in v:
                    new_dict[k] = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
                else:
                    new_dict[k] = v
            elif k == "title" and isinstance(v, dict) and v.get("type") == "string":
                v = v.copy()
                v["minLength"] = 1
                new_dict[k] = sanitize_patterns(v)
            else:
                new_dict[k] = sanitize_patterns(v)
        return new_dict
    elif isinstance(obj, list):
        return [sanitize_patterns(x) for x in obj]
    return obj

class OSCALValidationError(JSONSchemaValidationError):
    def __init__(self, errors: list):
        self.errors = errors
        message = f"Schema validation failed: {errors[0]['message']}" if errors else "Schema validation failed"
        super().__init__(message)

def format_validation_path(path_deque) -> str:
    path_list = list(path_deque)
    if not path_list:
        return ""
    result = []
    for item in path_list:
        if isinstance(item, int):
            result.append(f"[{item}]")
        else:
            if result:
                result.append(f".{item}")
            else:
                result.append(item)
    return "".join(result)

# Load the official schemas directly from the files and sanitize python-incompatible patterns
for stage, file_name in SCHEMA_FILE_MAPPING.items():
    schema_path = os.path.join(schemas_dir, file_name)
    with open(schema_path, "r", encoding="utf-8") as f:
        raw_schema = json.load(f)
        SCHEMAS[stage] = sanitize_patterns(raw_schema)


_VALIDATOR_CACHE: Dict[str, Draft7Validator] = {}

def _get_validator(stage: str) -> Draft7Validator:
    if stage not in _VALIDATOR_CACHE:
        _VALIDATOR_CACHE[stage] = Draft7Validator(SCHEMAS[stage])
    return _VALIDATOR_CACHE[stage]

def _validate_profile_integrity(profile: Dict[str, Any], root_key: str, errors: list) -> None:
    if "merge" in profile:
        merge = profile["merge"]
        choices = [k for k in ["flat", "as-is", "custom"] if k in merge]
        if len(choices) > 1:
            errors.append({
                "path": f"{root_key}.merge",
                "message": "Profile merge must specify only one of flat, as-is, or custom (is valid under each of)",
                "schema_path": "custom/merge"
            })

async def _validate_ssp_integrity(ssp: Dict[str, Any], root_key: str, errors: list, workspace_id: Optional[str] = None) -> None:
    if "import-profile" in ssp:
        href = ssp["import-profile"].get("href", "")
        uuid_match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", href)
        if uuid_match:
            ref_uuid = uuid_match.group(1)
            exists = await document_repository.document_exists("profiles", ref_uuid, workspace_id=workspace_id)
            if not exists and workspace_id and workspace_id != "default":
                exists = await document_repository.document_exists("profiles", ref_uuid, workspace_id="default")
            if not exists:
                errors.append({
                    "path": f"{root_key}.import-profile.href",
                    "message": f"Referenced profile {ref_uuid} does not exist",
                    "schema_path": "custom/import-profile-existence"
                })
        else:
            errors.append({
                "path": f"{root_key}.import-profile.href",
                "message": "Invalid UUID reference in import-profile href",
                "schema_path": "custom/import-profile-uuid"
            })
            
    valid_comp_uuids = {"this-system"}
    for ws in ([workspace_id] if workspace_id == "default" else [workspace_id, "default"]):
        if not ws:
            continue
        cdefs = await document_repository.list_documents_by_stage("component-definitions", workspace_id=ws)
        for cdata in cdefs:
            cdef_obj = cdata.get("component-definition", {})
            cdef_uuid = cdef_obj.get("uuid")
            if cdef_uuid:
                valid_comp_uuids.add(cdef_uuid)
            for c_item in cdef_obj.get("components", []):
                if "uuid" in c_item:
                    valid_comp_uuids.add(c_item["uuid"])

    for sys_comp in ssp.get("system-implementation", {}).get("components", []):
        if "uuid" in sys_comp:
            valid_comp_uuids.add(sys_comp["uuid"])

    control_impl = ssp.get("control-implementation")
    if control_impl and "implemented-requirements" in control_impl:
        control_ids = []
        for idx, req in enumerate(control_impl["implemented-requirements"]):
            control_id = req.get("control-id")
            if control_id:
                if control_id in control_ids:
                    errors.append({
                        "path": f"{root_key}.control-implementation.implemented-requirements[{idx}].control-id",
                        "message": f"Duplicate control-id '{control_id}' in implemented-requirements",
                        "schema_path": "custom/duplicate-control-id"
                    })
                control_ids.append(control_id)
            
            req_uuid = req.get("uuid")
            if req_uuid and not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", req_uuid):
                errors.append({
                    "path": f"{root_key}.control-implementation.implemented-requirements[{idx}].uuid",
                    "message": f"Invalid UUID reference in implemented-requirements: '{req_uuid}'",
                    "schema_path": "custom/implemented-requirement-uuid"
                })
            
            for comp_idx, by_comp in enumerate(req.get("by-components", [])):
                comp_uuid = by_comp.get("component-uuid")
                if comp_uuid:
                    if not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", comp_uuid):
                        errors.append({
                            "path": f"{root_key}.control-implementation.implemented-requirements[{idx}].by-components[{comp_idx}].component-uuid",
                            "message": f"Invalid UUID reference in by-components component-uuid: '{comp_uuid}'",
                            "schema_path": "custom/by-component-uuid-format"
                        })
                    else:
                        if comp_uuid not in valid_comp_uuids:
                            errors.append({
                                "path": f"{root_key}.control-implementation.implemented-requirements[{idx}].by-components[{comp_idx}].component-uuid",
                                "message": f"Referenced component {comp_uuid} does not exist",
                                "schema_path": "custom/component-existence"
                            })


async def validate_document(stage: str, document: Dict[str, Any], check_refs: bool = True, workspace_id: Optional[str] = None) -> None:
    """Validates a document against the schema for the given normalized stage."""
    if stage not in SCHEMAS:
        raise ValueError(f"Unknown stage: {stage}")
    
    root_key = STAGE_ROOT_KEYS[stage]
    if root_key not in document:
        raise JSONSchemaValidationError(f"Missing required root key: '{root_key}'")
        
    validator = _get_validator(stage)
    
    errors = []
    for err in validator.iter_errors(document):
        path = "$"
        if err.absolute_path:
            path = ".".join(str(p) for p in err.absolute_path)
        errors.append({
            "path": path,
            "message": err.message,
            "schema_path": ".".join(str(p) for p in err.absolute_schema_path)
        })

    if stage == "profiles":
        _validate_profile_integrity(document[root_key], root_key, errors)

    if stage == "ssps" and check_refs:
        await _validate_ssp_integrity(document[root_key], root_key, errors, workspace_id)

    if errors:
        raise OSCALValidationError(errors)
