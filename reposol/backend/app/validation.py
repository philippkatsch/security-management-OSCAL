import re
import os
import json
from typing import Dict, Any, Optional
from jsonschema import validate as jsonschema_validate, ValidationError, Draft7Validator
from app.repositories.workspace_repository import get_stage_dir

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

class OSCALValidationError(ValidationError):
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

def validate_document(stage: str, document: Dict[str, Any], check_refs: bool = True, workspace_id: Optional[str] = None) -> None:
    """Validates a document against the schema for the given normalized stage.
    
    Raises:
        ValidationError: If schema validation fails.
        ValueError: If the stage is unknown or the root key is missing.
    """
    if stage not in SCHEMAS:
        raise ValueError(f"Unknown stage: {stage}")
    
    root_key = STAGE_ROOT_KEYS[stage]
    if root_key not in document:
        raise ValidationError(f"Missing required root key: '{root_key}'")
        
    validator = Draft7Validator(SCHEMAS[stage])
    
    errors = []
    # Collect all schema errors
    for err in validator.iter_errors(document):
        path = "$"
        if err.absolute_path:
            path = ".".join(str(p) for p in err.absolute_path)
        errors.append({
            "path": path,
            "message": err.message,
            "schema_path": ".".join(str(p) for p in err.absolute_schema_path)
        })

    # Custom semantic constraint for Profiles (only run if schema is valid)
    if stage == "profiles":
        profile = document[root_key]
        if "merge" in profile:
            merge = profile["merge"]
            choices = [k for k in ["flat", "as-is", "custom"] if k in merge]
            if len(choices) > 1:
                errors.append({
                    "path": f"{root_key}.merge",
                    "message": "Profile merge must specify only one of flat, as-is, or custom (is valid under each of)",
                    "schema_path": "custom/merge"
                })

    # Custom cross-reference and structural validation for SSPs (only run if schema is valid)
    if stage == "ssps" and check_refs:
        ssp = document[root_key]
        
        # 1. Profile existence check
        if "import-profile" in ssp:
            href = ssp["import-profile"].get("href", "")
            uuid_match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", href)
            if uuid_match:
                ref_uuid = uuid_match.group(1)
                profile_path = os.path.join(get_stage_dir("profiles", workspace_id), f"{ref_uuid}.json")
                if not os.path.exists(profile_path) and workspace_id and workspace_id != "default":
                    default_profile_path = os.path.join(get_stage_dir("profiles", "default"), f"{ref_uuid}.json")
                    if os.path.exists(default_profile_path):
                        profile_path = default_profile_path
                if not os.path.exists(profile_path):
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
                
        # 2. Component existence & duplicate checks
        valid_comp_uuids = {"this-system"}
        for comp in ssp.get("system-implementation", {}).get("components", []):
            if "uuid" in comp:
                valid_comp_uuids.add(comp["uuid"])

        for ws in ([workspace_id] if workspace_id == "default" else [workspace_id, "default"]):
            if not ws:
                continue
            cdef_dir = get_stage_dir("component-definitions", ws)
            if os.path.exists(cdef_dir):
                for fname in os.listdir(cdef_dir):
                    if fname.endswith(".json"):
                        cdef_uuid = fname[:-5]
                        valid_comp_uuids.add(cdef_uuid)
                        try:
                            with open(os.path.join(cdef_dir, fname), "r", encoding="utf-8") as f:
                                cdata = json.load(f)
                                cdef_obj = cdata.get("component-definition", {})
                                for c_item in cdef_obj.get("components", []):
                                    if "uuid" in c_item:
                                        valid_comp_uuids.add(c_item["uuid"])
                        except Exception:
                            pass


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

    if errors:
        raise OSCALValidationError(errors)
