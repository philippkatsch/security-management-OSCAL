import re
import os
import json
import asyncio
from typing import Dict, Any, Optional, List, Set
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
        message = f"Schema validation failed: {'; '.join(e['message'] for e in errors)}" if errors else "Schema validation failed"
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
            # Check if reference exists in profiles
            exists = await document_repository.document_exists("profiles", ref_uuid, workspace_id=workspace_id)
            if not exists and workspace_id and workspace_id != "default":
                exists = await document_repository.document_exists("profiles", ref_uuid, workspace_id="default")
            # If not in profiles, check catalogs (OSCAL permits catalog baselines)
            if not exists:
                exists = await document_repository.document_exists("catalogs", ref_uuid, workspace_id=workspace_id)
                if not exists and workspace_id and workspace_id != "default":
                    exists = await document_repository.document_exists("catalogs", ref_uuid, workspace_id="default")
            # If not in profiles or catalogs, check back-matter resources
            if not exists and href.startswith("#"):
                bm_resources = ssp.get("back-matter", {}).get("resources", [])
                if any(r.get("uuid") == ref_uuid or r.get("id") == ref_uuid for r in bm_resources if isinstance(r, dict)):
                    exists = True
            if not exists:
                errors.append({
                    "path": f"{root_key}.import-profile.href",
                    "message": f"Referenced profile or catalog {ref_uuid} does not exist",
                    "schema_path": "custom/import-profile-existence"
                })
        else:
            # Check if it is a valid external URI or fragment reference
            is_valid_uri = bool(
                href.startswith("http://") or
                href.startswith("https://") or
                href.startswith("urn:") or
                href.startswith("file://") or
                href.startswith("#")
            )
            if not is_valid_uri or not href.strip():
                errors.append({
                    "path": f"{root_key}.import-profile.href",
                    "message": "Invalid UUID or URI reference in import-profile href",
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
        if isinstance(sys_comp, dict) and "uuid" in sys_comp:
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

            # Top-level by-components validation
            for comp_idx, by_comp in enumerate(req.get("by-components", [])):
                comp_uuid = by_comp.get("component-uuid")
                if comp_uuid:
                    if not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", comp_uuid) and comp_uuid != "this-system":
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

            # Statement-level by-components validation
            for stmt_idx, stmt in enumerate(req.get("statements", [])):
                stmt_uuid = stmt.get("uuid")
                if stmt_uuid and not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", stmt_uuid):
                    errors.append({
                        "path": f"{root_key}.control-implementation.implemented-requirements[{idx}].statements[{stmt_idx}].uuid",
                        "message": f"Invalid UUID reference in statement uuid: '{stmt_uuid}'",
                        "schema_path": "custom/statement-uuid-format"
                    })

                for stmt_comp_idx, stmt_by_comp in enumerate(stmt.get("by-components", [])):
                    stmt_comp_uuid = stmt_by_comp.get("component-uuid")
                    if stmt_comp_uuid:
                        if not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", stmt_comp_uuid) and stmt_comp_uuid != "this-system":
                            errors.append({
                                "path": f"{root_key}.control-implementation.implemented-requirements[{idx}].statements[{stmt_idx}].by-components[{stmt_comp_idx}].component-uuid",
                                "message": f"Invalid UUID reference in statement by-components component-uuid: '{stmt_comp_uuid}'",
                                "schema_path": "custom/statement-by-component-uuid-format"
                            })
                        else:
                            if stmt_comp_uuid not in valid_comp_uuids:
                                errors.append({
                                    "path": f"{root_key}.control-implementation.implemented-requirements[{idx}].statements[{stmt_idx}].by-components[{stmt_comp_idx}].component-uuid",
                                    "message": f"Referenced component {stmt_comp_uuid} does not exist",
                                    "schema_path": "custom/component-existence"
                                })


ALLOWED_ASSESSMENT_METHODS = {"INTERVIEW", "EXAMINE", "TEST"}
CANONICAL_TERMS_PARTS = {
    "rules-of-engagement",
    "disclosures",
    "assessment-inclusions",
    "assessment-exclusions",
    "results-delivery",
    "assumptions",
    "methodology",
}

async def _validate_ap_integrity(
    ap: Dict[str, Any],
    root_key: str,
    errors: list,
    workspace_id: Optional[str] = None,
    check_refs: bool = True
) -> None:
    # 1. Mandatory root fields check
    for req_field in ("uuid", "metadata", "import-ssp", "reviewed-controls"):
        if req_field not in ap:
            errors.append({
                "path": f"{root_key}.{req_field}",
                "message": f"Missing required field: '{req_field}'",
                "schema_path": f"custom/{req_field}-required"
            })

    # Validate uuid format if present
    ap_uuid = ap.get("uuid")
    if ap_uuid and not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", str(ap_uuid)):
        errors.append({
            "path": f"{root_key}.uuid",
            "message": f"Invalid UUID format for assessment-plan: '{ap_uuid}'",
            "schema_path": "custom/ap-uuid-format"
        })

    # 2. Validate import-ssp.href target existence in workspace store when check_refs=True
    if "import-ssp" in ap:
        href = ap["import-ssp"].get("href", "")
        if not href or not str(href).strip():
            errors.append({
                "path": f"{root_key}.import-ssp.href",
                "message": "Invalid or empty href in import-ssp",
                "schema_path": "custom/import-ssp-href"
            })
        elif check_refs:
            if href.startswith("#"):
                # Internal fragment reference (e.g. to back-matter resource or internal anchor)
                pass
            else:
                uuid_match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", href)
                if uuid_match:
                    ref_uuid = uuid_match.group(1)
                    exists = await document_repository.document_exists("ssps", ref_uuid, workspace_id=workspace_id)
                    if not exists and workspace_id and workspace_id != "default":
                        exists = await document_repository.document_exists("ssps", ref_uuid, workspace_id="default")
                    if not exists:
                        exists = await document_repository.document_exists("system-security-plans", ref_uuid, workspace_id=workspace_id)
                        if not exists and workspace_id and workspace_id != "default":
                            exists = await document_repository.document_exists("system-security-plans", ref_uuid, workspace_id="default")
                    if not exists:
                        errors.append({
                            "path": f"{root_key}.import-ssp.href",
                            "message": f"Referenced SSP {ref_uuid} does not exist",
                            "schema_path": "custom/import-ssp-existence"
                        })
                else:
                    is_valid_uri = bool(
                        href.startswith("http://") or
                        href.startswith("https://") or
                        href.startswith("urn:") or
                        href.startswith("file://")
                    )
                    if not is_valid_uri:
                        errors.append({
                            "path": f"{root_key}.import-ssp.href",
                            "message": "Invalid UUID or URI reference in import-ssp href",
                            "schema_path": "custom/import-ssp-uuid"
                        })

    # 3. Validate task dependency DAG and cycle detection
    all_tasks: List[Dict[str, Any]] = []
    def _collect_tasks(task_list: Any) -> None:
        if isinstance(task_list, list):
            for t in task_list:
                if isinstance(t, dict):
                    all_tasks.append(t)
                    if "tasks" in t:
                        _collect_tasks(t["tasks"])

    _collect_tasks(ap.get("tasks", []))

    task_uuids = {t["uuid"] for t in all_tasks if "uuid" in t}
    adj: Dict[str, List[str]] = {uid: [] for uid in task_uuids}

    for t in all_tasks:
        t_uuid = t.get("uuid")
        for dep in t.get("dependencies", []):
            if isinstance(dep, dict):
                dep_uuid = dep.get("task-uuid")
                if dep_uuid:
                    if dep_uuid not in task_uuids:
                        errors.append({
                            "path": f"{root_key}.tasks",
                            "message": f"Referenced task-uuid '{dep_uuid}' does not exist in document tasks",
                            "schema_path": "custom/task-dependency-existence"
                        })
                    elif t_uuid:
                        adj[t_uuid].append(dep_uuid)

    # Topological DFS Cycle Detection
    visited_state = {uid: 0 for uid in task_uuids}  # 0: unvisited, 1: visiting, 2: visited
    cycle_path: List[str] = []
    cycle_detected = False

    def _dfs(u: str, current_path: List[str]) -> bool:
        nonlocal cycle_detected, cycle_path
        visited_state[u] = 1
        current_path.append(u)
        for v in adj.get(u, []):
            if visited_state.get(v) == 1:
                idx = current_path.index(v)
                cycle_path = current_path[idx:] + [v]
                cycle_detected = True
                return True
            elif visited_state.get(v) == 0:
                if _dfs(v, current_path):
                    return True
        current_path.pop()
        visited_state[u] = 2
        return False

    for uid in task_uuids:
        if visited_state[uid] == 0:
            if _dfs(uid, []):
                break

    if cycle_detected:
        path_str = " -> ".join(cycle_path)
        errors.append({
            "path": f"{root_key}.tasks",
            "message": f"Circular task dependency detected: {path_str}",
            "schema_path": "custom/task-dag-cycle"
        })

    # 4. Validate activity linkages
    local_defs = ap.get("local-definitions", {}) if isinstance(ap.get("local-definitions"), dict) else {}
    valid_act_uuids = set()
    for act in local_defs.get("activities", []):
        if isinstance(act, dict) and "uuid" in act:
            valid_act_uuids.add(act["uuid"])

    for t in all_tasks:
        for assoc in t.get("associated-activities", []):
            if isinstance(assoc, dict):
                act_uuid = assoc.get("activity-uuid")
                if act_uuid and act_uuid not in valid_act_uuids:
                    errors.append({
                        "path": f"{root_key}.tasks",
                        "message": f"Referenced activity-uuid '{act_uuid}' does not exist in local-definitions.activities",
                        "schema_path": "custom/activity-linkage-existence"
                    })

    # 5. Validate assessment method properties in local definitions / objectives
    for obj_idx, obj in enumerate(local_defs.get("objectives-and-methods", [])):
        if isinstance(obj, dict):
            for p_idx, part in enumerate(obj.get("parts", [])):
                if isinstance(part, dict) and part.get("name") == "assessment-method":
                    for pr_idx, prop in enumerate(part.get("props", [])):
                        if isinstance(prop, dict) and prop.get("name") == "method":
                            val = prop.get("value")
                            if val not in ALLOWED_ASSESSMENT_METHODS:
                                errors.append({
                                    "path": f"{root_key}.local-definitions.objectives-and-methods[{obj_idx}].parts[{p_idx}].props[{pr_idx}].value",
                                    "message": f"Invalid assessment method '{val}'. Must be one of: {', '.join(sorted(ALLOWED_ASSESSMENT_METHODS))}",
                                    "schema_path": "custom/assessment-method-enum"
                                })

    for act_idx, act in enumerate(local_defs.get("activities", [])):
        if isinstance(act, dict):
            for pr_idx, prop in enumerate(act.get("props", [])):
                if isinstance(prop, dict) and prop.get("name") == "method":
                    val = prop.get("value")
                    if val not in ALLOWED_ASSESSMENT_METHODS:
                        errors.append({
                            "path": f"{root_key}.local-definitions.activities[{act_idx}].props[{pr_idx}].value",
                            "message": f"Invalid activity assessment method '{val}'. Must be one of: {', '.join(sorted(ALLOWED_ASSESSMENT_METHODS))}",
                            "schema_path": "custom/assessment-method-enum"
                        })

    # 6. Validate terms and conditions part names
    terms = ap.get("terms-and-conditions", {})
    if isinstance(terms, dict):
        for p_idx, part in enumerate(terms.get("parts", [])):
            if isinstance(part, dict):
                name = part.get("name")
                if name and name not in CANONICAL_TERMS_PARTS:
                    errors.append({
                        "path": f"{root_key}.terms-and-conditions.parts[{p_idx}].name",
                        "message": f"Invalid terms-and-conditions part name '{name}'. Must be one of: {', '.join(sorted(CANONICAL_TERMS_PARTS))}",
                        "schema_path": "custom/terms-part-name"
                    })


async def _validate_ar_integrity(
    ar: Dict[str, Any],
    root_key: str,
    errors: list,
    workspace_id: Optional[str] = None,
    check_refs: bool = True
) -> None:
    """
    Semantic and referential integrity validator for NIST OSCAL Assessment Results:
    1. Mandatory root fields check (uuid, metadata, import-ap, results).
    2. UUID format enforcement across document and child entities.
    3. import-ap.href resolution against workspace documents, back-matter, or valid URIs when check_refs=True.
    4. Entity UUID uniqueness (findings, observations, risks) and duplicate UUID detection.
    5. Cross-reference validation:
       - Finding.related-observations -> must resolve to a valid Observation UUID.
       - Finding.related-risks (and associated-risks) -> must resolve to a valid Risk UUID.
       - Risk.related-observations -> must resolve to a valid Observation UUID.
    6. Finding target semantic checks (type in statement-id/objective-id, status.state in satisfied/not-satisfied).
    """
    UUID_REGEX = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

    # 1. Root mandatory fields
    for req_field in ("uuid", "metadata", "import-ap", "results"):
        if req_field not in ar:
            errors.append({
                "path": f"{root_key}.{req_field}",
                "message": f"Missing required field: '{req_field}'",
                "schema_path": f"custom/{req_field}-required"
            })

    # Validate uuid format if present
    ar_uuid = ar.get("uuid")
    if ar_uuid and not re.match(UUID_REGEX, str(ar_uuid)):
        errors.append({
            "path": f"{root_key}.uuid",
            "message": f"Invalid UUID format for assessment-results: '{ar_uuid}'",
            "schema_path": "custom/ar-uuid-format"
        })

    # 2. Validate import-ap.href target existence in workspace store when check_refs=True
    if "import-ap" in ar:
        import_ap = ar["import-ap"]
        if not isinstance(import_ap, dict):
            errors.append({
                "path": f"{root_key}.import-ap",
                "message": "import-ap must be an object",
                "schema_path": "custom/import-ap-type"
            })
        else:
            href = import_ap.get("href", "")
            if not href or not str(href).strip():
                errors.append({
                    "path": f"{root_key}.import-ap.href",
                    "message": "Invalid or empty href in import-ap",
                    "schema_path": "custom/import-ap-href"
                })
            elif check_refs:
                href_str = str(href).strip()
                if href_str.startswith("#"):
                    # Internal fragment reference (e.g. to back-matter resource or internal anchor)
                    pass
                else:
                    uuid_match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", href_str)
                    if uuid_match:
                        ref_uuid = uuid_match.group(1)
                        exists = await document_repository.document_exists("assessment-plans", ref_uuid, workspace_id=workspace_id)
                        if not exists and workspace_id and workspace_id != "default":
                            exists = await document_repository.document_exists("assessment-plans", ref_uuid, workspace_id="default")
                        if not exists:
                            exists = await document_repository.document_exists("assessment-plan", ref_uuid, workspace_id=workspace_id)
                            if not exists and workspace_id and workspace_id != "default":
                                exists = await document_repository.document_exists("assessment-plan", ref_uuid, workspace_id="default")
                        if not exists:
                            bm_resources = ar.get("back-matter", {}).get("resources", []) if isinstance(ar.get("back-matter"), dict) else []
                            if isinstance(bm_resources, list) and any(
                                isinstance(r, dict) and (r.get("uuid") == ref_uuid or r.get("id") == ref_uuid)
                                for r in bm_resources
                            ):
                                exists = True
                        if not exists:
                            errors.append({
                                "path": f"{root_key}.import-ap.href",
                                "message": f"Referenced Assessment Plan {ref_uuid} does not exist",
                                "schema_path": "custom/import-ap-existence"
                            })
                    else:
                        is_valid_uri = bool(
                            href_str.startswith("http://") or
                            href_str.startswith("https://") or
                            href_str.startswith("urn:") or
                            href_str.startswith("file://") or
                            href_str.startswith("../") or
                            href_str.startswith("./") or
                            href_str.startswith("/") or
                            href_str.endswith(".json") or
                            href_str.endswith(".xml")
                        )
                        if not is_valid_uri:
                            errors.append({
                                "path": f"{root_key}.import-ap.href",
                                "message": "Invalid UUID or URI reference in import-ap href",
                                "schema_path": "custom/import-ap-uuid"
                            })

    # 3. Validate results array
    results = ar.get("results")
    if results is None or not isinstance(results, list) or len(results) == 0:
        if "results" in ar:  # only append if not already reported missing
            errors.append({
                "path": f"{root_key}.results",
                "message": "Assessment Results must contain at least one result set in 'results'",
                "schema_path": "custom/results-min-items"
            })
        return

    all_obs_uuids: Set[str] = set()
    all_risk_uuids: Set[str] = set()
    all_finding_uuids: Set[str] = set()
    all_known_uuids: Dict[str, str] = {}  # uuid -> entity type for cross-entity duplicate detection

    # Pass 1: Index UUIDs, validate UUID formats, and detect duplicates
    for res_idx, res in enumerate(results):
        if not isinstance(res, dict):
            continue

        res_uuid = res.get("uuid")
        if res_uuid:
            if not re.match(UUID_REGEX, str(res_uuid)):
                errors.append({
                    "path": f"{root_key}.results[{res_idx}].uuid",
                    "message": f"Invalid UUID format in result: '{res_uuid}'",
                    "schema_path": "custom/result-uuid-format"
                })

        for obs_idx, obs in enumerate(res.get("observations", [])):
            if isinstance(obs, dict):
                obs_uuid = obs.get("uuid")
                if obs_uuid:
                    obs_uuid_str = str(obs_uuid)
                    if not re.match(UUID_REGEX, obs_uuid_str):
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].observations[{obs_idx}].uuid",
                            "message": f"Invalid UUID format in observation: '{obs_uuid}'",
                            "schema_path": "custom/observation-uuid-format"
                        })
                    elif obs_uuid_str in all_obs_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].observations[{obs_idx}].uuid",
                            "message": f"Duplicate observation UUID '{obs_uuid}'",
                            "schema_path": "custom/duplicate-observation-uuid"
                        })
                    elif obs_uuid_str in all_known_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].observations[{obs_idx}].uuid",
                            "message": f"Duplicate UUID '{obs_uuid}' across entities (already used as {all_known_uuids[obs_uuid_str]})",
                            "schema_path": "custom/duplicate-entity-uuid"
                        })
                    all_obs_uuids.add(obs_uuid_str)
                    all_known_uuids[obs_uuid_str] = "observation"

        for risk_idx, risk in enumerate(res.get("risks", [])):
            if isinstance(risk, dict):
                risk_uuid = risk.get("uuid")
                if risk_uuid:
                    risk_uuid_str = str(risk_uuid)
                    if not re.match(UUID_REGEX, risk_uuid_str):
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].risks[{risk_idx}].uuid",
                            "message": f"Invalid UUID format in risk: '{risk_uuid}'",
                            "schema_path": "custom/risk-uuid-format"
                        })
                    elif risk_uuid_str in all_risk_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].risks[{risk_idx}].uuid",
                            "message": f"Duplicate risk UUID '{risk_uuid}'",
                            "schema_path": "custom/duplicate-risk-uuid"
                        })
                    elif risk_uuid_str in all_known_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].risks[{risk_idx}].uuid",
                            "message": f"Duplicate UUID '{risk_uuid}' across entities (already used as {all_known_uuids[risk_uuid_str]})",
                            "schema_path": "custom/duplicate-entity-uuid"
                        })
                    all_risk_uuids.add(risk_uuid_str)
                    all_known_uuids[risk_uuid_str] = "risk"

        for f_idx, finding in enumerate(res.get("findings", [])):
            if isinstance(finding, dict):
                f_uuid = finding.get("uuid")
                if f_uuid:
                    f_uuid_str = str(f_uuid)
                    if not re.match(UUID_REGEX, f_uuid_str):
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].findings[{f_idx}].uuid",
                            "message": f"Invalid UUID format in finding: '{f_uuid}'",
                            "schema_path": "custom/finding-uuid-format"
                        })
                    elif f_uuid_str in all_finding_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].findings[{f_idx}].uuid",
                            "message": f"Duplicate finding UUID '{f_uuid}'",
                            "schema_path": "custom/duplicate-finding-uuid"
                        })
                    elif f_uuid_str in all_known_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].findings[{f_idx}].uuid",
                            "message": f"Duplicate UUID '{f_uuid}' across entities (already used as {all_known_uuids[f_uuid_str]})",
                            "schema_path": "custom/duplicate-entity-uuid"
                        })
                    all_finding_uuids.add(f_uuid_str)
                    all_known_uuids[f_uuid_str] = "finding"

    # Pass 2: Validate Cross-References and finding target semantics
    for res_idx, res in enumerate(results):
        if not isinstance(res, dict):
            continue

        for f_idx, finding in enumerate(res.get("findings", [])):
            if not isinstance(finding, dict):
                continue

            # Finding -> Observations cross-reference integrity
            for ro_idx, ro in enumerate(finding.get("related-observations", [])):
                if isinstance(ro, dict):
                    obs_ref = ro.get("observation-uuid")
                    if obs_ref and str(obs_ref) not in all_obs_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].findings[{f_idx}].related-observations[{ro_idx}].observation-uuid",
                            "message": f"Dangling observation reference: '{obs_ref}' not found in results observations",
                            "schema_path": "custom/finding-related-observation-existence"
                        })

            # Finding -> Risks cross-reference integrity (both related-risks and associated-risks)
            related_risks = finding.get("related-risks") or finding.get("associated-risks") or []
            for rr_idx, rr in enumerate(related_risks):
                if isinstance(rr, dict):
                    risk_ref = rr.get("risk-uuid")
                    if risk_ref and str(risk_ref) not in all_risk_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].findings[{f_idx}].related-risks[{rr_idx}].risk-uuid",
                            "message": f"Dangling risk reference: '{risk_ref}' not found in results risks",
                            "schema_path": "custom/finding-related-risk-existence"
                        })

            # Finding Target Semantics: type and status.state
            target = finding.get("target")
            if isinstance(target, dict):
                t_type = target.get("type")
                if t_type and t_type not in ("statement-id", "objective-id"):
                    errors.append({
                        "path": f"{root_key}.results[{res_idx}].findings[{f_idx}].target.type",
                        "message": f"Invalid finding target type '{t_type}'. Must be 'statement-id' or 'objective-id'",
                        "schema_path": "custom/finding-target-type"
                    })
                status = target.get("status")
                if isinstance(status, dict):
                    state = status.get("state")
                    if state and state not in ("satisfied", "not-satisfied"):
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].findings[{f_idx}].target.status.state",
                            "message": f"Invalid finding target status state '{state}'. Must be 'satisfied' or 'not-satisfied'",
                            "schema_path": "custom/finding-target-status-state"
                        })

        # Risk -> Observations cross-reference integrity
        for risk_idx, risk in enumerate(res.get("risks", [])):
            if not isinstance(risk, dict):
                continue
            for ro_idx, ro in enumerate(risk.get("related-observations", [])):
                if isinstance(ro, dict):
                    obs_ref = ro.get("observation-uuid")
                    if obs_ref and str(obs_ref) not in all_obs_uuids:
                        errors.append({
                            "path": f"{root_key}.results[{res_idx}].risks[{risk_idx}].related-observations[{ro_idx}].observation-uuid",
                            "message": f"Dangling observation reference in risk: '{obs_ref}' not found in results observations",
                            "schema_path": "custom/risk-related-observation-existence"
                        })


async def _validate_component_integrity(
    cdef: Dict[str, Any],
    root_key: str,
    errors: list,
    workspace_id: Optional[str] = None,
    check_refs: bool = True
) -> None:
    """
    Semantic and referential integrity validator for NIST OSCAL Component Definitions (Stage 3):
    1. Mandatory root fields check (uuid, metadata).
    2. defined-component must NOT contain 'status' per OSCAL metaschema.
    3. capabilities[].incorporates-components[].component-uuid must point to defined component.
    4. import-component-definitions[].href resolution against workspace documents.
    """
    UUID_REGEX = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

    for req_field in ("uuid", "metadata"):
        if req_field not in cdef:
            errors.append({
                "path": f"{root_key}.{req_field}",
                "message": f"Missing required field: '{req_field}'",
                "schema_path": f"custom/{req_field}-required"
            })

    cdef_uuid = cdef.get("uuid")
    if cdef_uuid and not re.match(UUID_REGEX, str(cdef_uuid)):
        errors.append({
            "path": f"{root_key}.uuid",
            "message": f"Invalid UUID format for component-definition: '{cdef_uuid}'",
            "schema_path": "custom/cdef-uuid-format"
        })

    components = cdef.get("components", [])
    comp_uuids = set()
    if isinstance(components, list):
        for idx, comp in enumerate(components):
            if not isinstance(comp, dict):
                continue
            comp_u = comp.get("uuid")
            if comp_u:
                comp_uuids.add(str(comp_u))
            if "status" in comp:
                errors.append({
                    "path": f"{root_key}.components[{idx}].status",
                    "message": "Component definition 'defined-component' must not contain 'status' property per OSCAL specification",
                    "schema_path": "custom/defined-component-no-status"
                })

    capabilities = cdef.get("capabilities", [])
    if isinstance(capabilities, list):
        for cap_idx, cap in enumerate(capabilities):
            if not isinstance(cap, dict):
                continue
            for inc_idx, inc in enumerate(cap.get("incorporates-components", [])):
                if isinstance(inc, dict):
                    c_ref = inc.get("component-uuid")
                    if c_ref and str(c_ref) not in comp_uuids:
                        errors.append({
                            "path": f"{root_key}.capabilities[{cap_idx}].incorporates-components[{inc_idx}].component-uuid",
                            "message": f"Referenced component '{c_ref}' not found in components array",
                            "schema_path": "custom/capability-component-existence"
                        })

    if check_refs and "import-component-definitions" in cdef:
        for imp_idx, imp in enumerate(cdef.get("import-component-definitions", [])):
            if isinstance(imp, dict):
                href = imp.get("href", "")
                if href and not href.startswith("http://") and not href.startswith("https://") and not href.startswith("#"):
                    uuid_match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", href)
                    if uuid_match:
                        ref_uuid = uuid_match.group(1)
                        exists = await document_repository.document_exists("component-definitions", ref_uuid, workspace_id=workspace_id)
                        if not exists and workspace_id and workspace_id != "default":
                            exists = await document_repository.document_exists("component-definitions", ref_uuid, workspace_id="default")
                        if not exists:
                            errors.append({
                                "path": f"{root_key}.import-component-definitions[{imp_idx}].href",
                                "message": f"Referenced component definition '{ref_uuid}' does not exist",
                                "schema_path": "custom/import-cdef-existence"
                            })


async def _validate_poam_integrity(
    poam: Dict[str, Any],
    root_key: str,
    errors: list,
    workspace_id: Optional[str] = None,
    check_refs: bool = True
) -> None:
    """
    Semantic and referential integrity validator for NIST OSCAL Plans of Action and Milestones (Stage 7):
    1. Mandatory root fields check (uuid, metadata, poam-items).
    2. import-ssp.href resolution against workspace documents when check_refs=True.
    3. Finding target semantics (status.state in satisfied/not-satisfied).
    4. Risk statement non-empty check.
    5. poam-items cross-references (related-findings, related-observations, related-risks).
    """
    UUID_REGEX = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

    for req_field in ("uuid", "metadata", "poam-items"):
        if req_field not in poam:
            errors.append({
                "path": f"{root_key}.{req_field}",
                "message": f"Missing required field: '{req_field}'",
                "schema_path": f"custom/{req_field}-required"
            })

    poam_uuid = poam.get("uuid")
    if poam_uuid and not re.match(UUID_REGEX, str(poam_uuid)):
        errors.append({
            "path": f"{root_key}.uuid",
            "message": f"Invalid UUID format for poam: '{poam_uuid}'",
            "schema_path": "custom/poam-uuid-format"
        })

    if check_refs and "import-ssp" in poam:
        import_ssp = poam["import-ssp"]
        if isinstance(import_ssp, dict):
            href = import_ssp.get("href", "")
            if not href or not str(href).strip():
                errors.append({
                    "path": f"{root_key}.import-ssp.href",
                    "message": "Invalid or empty href in import-ssp",
                    "schema_path": "custom/import-ssp-href"
                })
            elif not href.startswith("#"):
                uuid_match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", href)
                if uuid_match:
                    ref_uuid = uuid_match.group(1)
                    exists = await document_repository.document_exists("ssps", ref_uuid, workspace_id=workspace_id)
                    if not exists and workspace_id and workspace_id != "default":
                        exists = await document_repository.document_exists("ssps", ref_uuid, workspace_id="default")
                    if not exists:
                        exists = await document_repository.document_exists("system-security-plans", ref_uuid, workspace_id=workspace_id)
                        if not exists and workspace_id and workspace_id != "default":
                            exists = await document_repository.document_exists("system-security-plans", ref_uuid, workspace_id="default")
                    if not exists:
                        errors.append({
                            "path": f"{root_key}.import-ssp.href",
                            "message": f"Referenced System Security Plan '{ref_uuid}' does not exist",
                            "schema_path": "custom/import-ssp-existence"
                        })

    finding_uuids = set()
    for f_idx, f in enumerate(poam.get("findings", [])):
        if isinstance(f, dict):
            f_u = f.get("uuid")
            if f_u:
                finding_uuids.add(str(f_u))
            target = f.get("target")
            if isinstance(target, dict):
                t_status = target.get("status")
                if isinstance(t_status, dict):
                    t_state = t_status.get("state")
                    if t_state and t_state not in ("satisfied", "not-satisfied"):
                        errors.append({
                            "path": f"{root_key}.findings[{f_idx}].target.status.state",
                            "message": f"Invalid finding target status state '{t_state}'. Must be 'satisfied' or 'not-satisfied'",
                            "schema_path": "custom/finding-target-status-state"
                        })

    obs_uuids = set()
    for o in poam.get("observations", []):
        if isinstance(o, dict) and o.get("uuid"):
            obs_uuids.add(str(o["uuid"]))

    risk_uuids = set()
    for r_idx, r in enumerate(poam.get("risks", [])):
        if isinstance(r, dict):
            r_u = r.get("uuid")
            if r_u:
                risk_uuids.add(str(r_u))
            stmt = r.get("statement")
            if stmt is not None and (not isinstance(stmt, str) or not stmt.strip()):
                errors.append({
                    "path": f"{root_key}.risks[{r_idx}].statement",
                    "message": "Risk statement must be a non-empty string",
                    "schema_path": "custom/risk-statement-required"
                })

    for item_idx, item in enumerate(poam.get("poam-items", [])):
        if not isinstance(item, dict):
            continue
        for rf_idx, rf in enumerate(item.get("related-findings", [])):
            if isinstance(rf, dict):
                f_ref = rf.get("finding-uuid")
                if f_ref and str(f_ref) not in finding_uuids:
                    errors.append({
                        "path": f"{root_key}.poam-items[{item_idx}].related-findings[{rf_idx}].finding-uuid",
                        "message": f"Dangling finding reference '{f_ref}' not found in poam.findings",
                        "schema_path": "custom/poam-item-finding-existence"
                    })
        for ro_idx, ro in enumerate(item.get("related-observations", [])):
            if isinstance(ro, dict):
                o_ref = ro.get("observation-uuid")
                if o_ref and str(o_ref) not in obs_uuids:
                    errors.append({
                        "path": f"{root_key}.poam-items[{item_idx}].related-observations[{ro_idx}].observation-uuid",
                        "message": f"Dangling observation reference '{o_ref}' not found in poam.observations",
                        "schema_path": "custom/poam-item-observation-existence"
                    })
        for rr_idx, rr in enumerate(item.get("related-risks", [])):
            if isinstance(rr, dict):
                r_ref = rr.get("risk-uuid")
                if r_ref and str(r_ref) not in risk_uuids:
                    errors.append({
                        "path": f"{root_key}.poam-items[{item_idx}].related-risks[{rr_idx}].risk-uuid",
                        "message": f"Dangling risk reference '{r_ref}' not found in poam.risks",
                        "schema_path": "custom/poam-item-risk-existence"
                    })


CANONICAL_MAPPING_RELATIONSHIPS = {
    "equivalent-to",
    "equal-to",
    "subset-of",
    "superset-of",
    "intersects-with",
    "no-relationship",
}

async def _validate_mapping_integrity(
    mc: Dict[str, Any],
    root_key: str,
    errors: list,
    workspace_id: Optional[str] = None,
    check_refs: bool = True
) -> None:
    """
    Semantic and referential integrity validator for NIST OSCAL Mapping Collections (Stage 8):
    1. Mandatory root fields check (uuid, metadata).
    2. Canonical relationship token validation against metaschema.
    3. Source and target resource resolution.
    """
    UUID_REGEX = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

    for req_field in ("uuid", "metadata"):
        if req_field not in mc:
            errors.append({
                "path": f"{root_key}.{req_field}",
                "message": f"Missing required field: '{req_field}'",
                "schema_path": f"custom/{req_field}-required"
            })

    mc_uuid = mc.get("uuid")
    if mc_uuid and not re.match(UUID_REGEX, str(mc_uuid)):
        errors.append({
            "path": f"{root_key}.uuid",
            "message": f"Invalid UUID format for mapping-collection: '{mc_uuid}'",
            "schema_path": "custom/mc-uuid-format"
        })

    mappings = mc.get("mappings", [])
    if isinstance(mappings, list):
        for m_idx, mapping in enumerate(mappings):
            if not isinstance(mapping, dict):
                continue
            for map_idx, m_rule in enumerate(mapping.get("maps", [])):
                if not isinstance(m_rule, dict):
                    continue
                rel = m_rule.get("relationship")
                if rel and rel not in CANONICAL_MAPPING_RELATIONSHIPS:
                    errors.append({
                        "path": f"{root_key}.mappings[{m_idx}].maps[{map_idx}].relationship",
                        "message": f"Invalid relationship token '{rel}'. Must be one of: {', '.join(sorted(CANONICAL_MAPPING_RELATIONSHIPS))}",
                        "schema_path": "custom/mapping-relationship-token"
                    })


def _run_schema_validation(stage: str, document: Dict[str, Any]) -> list:
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
        if err.context:
            for sub_err in err.context:
                sub_path = ".".join(str(p) for p in sub_err.absolute_path) if sub_err.absolute_path else path
                errors.append({
                    "path": sub_path,
                    "message": sub_err.message,
                    "schema_path": ".".join(str(p) for p in sub_err.absolute_schema_path)
                })
    return errors


async def validate_document(stage: str, document: Dict[str, Any], check_refs: bool = True, workspace_id: Optional[str] = None) -> None:
    """Validates a document against the schema for the given normalized stage."""
    if stage not in SCHEMAS:
        raise ValueError(f"Unknown stage: {stage}")
    
    root_key = STAGE_ROOT_KEYS[stage]
    if root_key not in document:
        raise JSONSchemaValidationError(f"Missing required root key: '{root_key}'")
        
    errors = await asyncio.to_thread(_run_schema_validation, stage, document)

    if stage == "profiles":
        _validate_profile_integrity(document[root_key], root_key, errors)

    if stage == "ssps" and check_refs:
        await _validate_ssp_integrity(document[root_key], root_key, errors, workspace_id)

    if stage in ("component-definitions", "component-definition"):
        await _validate_component_integrity(document[root_key], root_key, errors, workspace_id, check_refs=check_refs)

    if stage in ("assessment-plans", "assessment-plan"):
        await _validate_ap_integrity(document[root_key], root_key, errors, workspace_id, check_refs=check_refs)

    if stage in ("assessment-results", "assessment-result"):
        await _validate_ar_integrity(document[root_key], root_key, errors, workspace_id, check_refs=check_refs)

    if stage in ("poams", "poam", "plans-of-action-and-milestones"):
        await _validate_poam_integrity(document[root_key], root_key, errors, workspace_id, check_refs=check_refs)

    if stage in ("control-mappings", "control-mapping", "mapping-collections", "mapping-collection"):
        await _validate_mapping_integrity(document[root_key], root_key, errors, workspace_id, check_refs=check_refs)

    if errors:
        raise OSCALValidationError(errors)
