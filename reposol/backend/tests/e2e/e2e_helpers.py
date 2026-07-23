"""
E2E Test Helpers for Parameter Value Assignment.
Provides parameter extraction, profile resolution, prose rendering, and validation utilities.
"""

import copy
import re
from typing import Any, Dict, List, Optional, Set, Tuple


def extract_all_params(catalog_dict: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Extracts all parameter objects from an OSCAL catalog document
    (catalog root, groups, nested groups, controls, sub-controls).
    Returns a dictionary mapping param_id -> param_dict.
    """
    params_map: Dict[str, Dict[str, Any]] = {}
    cat = catalog_dict.get("catalog", catalog_dict)

    def _extract_list(params_list: List[Dict[str, Any]]) -> None:
        for p in params_list:
            if isinstance(p, dict) and "id" in p:
                params_map[p["id"]] = copy.deepcopy(p)

    # 1. Catalog root level params
    if "params" in cat and isinstance(cat["params"], list):
        _extract_list(cat["params"])

    # 2. Helper for controls
    def _extract_from_controls(controls: List[Dict[str, Any]]) -> None:
        for ctrl in controls:
            if not isinstance(ctrl, dict):
                continue
            if "params" in ctrl and isinstance(ctrl["params"], list):
                _extract_list(ctrl["params"])
            if "controls" in ctrl and isinstance(ctrl["controls"], list):
                _extract_from_controls(ctrl["controls"])

    # 3. Helper for groups
    def _extract_from_groups(groups: List[Dict[str, Any]]) -> None:
        for grp in groups:
            if not isinstance(grp, dict):
                continue
            if "params" in grp and isinstance(grp["params"], list):
                _extract_list(grp["params"])
            if "controls" in grp and isinstance(grp["controls"], list):
                _extract_from_controls(grp["controls"])
            if "groups" in grp and isinstance(grp["groups"], list):
                _extract_from_groups(grp["groups"])

    if "groups" in cat and isinstance(cat["groups"], list):
        _extract_from_groups(cat["groups"])

    if "controls" in cat and isinstance(cat["controls"], list):
        _extract_from_controls(cat["controls"])

    return params_map


def resolve_parameters(
    catalog_dict: Dict[str, Any], profile_dict: Optional[Dict[str, Any]] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Resolves parameter values by merging catalog base parameters with profile `set-parameters` overrides.
    Implements DD-012 override rules:
    - Profile `values` replaces catalog `values`.
    - Empty `values: []` in override reverts `values` to catalog default or removes it if catalog had none.
    - Last override entry in profile `set-parameters[]` wins on duplicate param-ids.
    """
    cat_params = extract_all_params(catalog_dict)
    resolved_map: Dict[str, Dict[str, Any]] = {}

    for pid, pdata in cat_params.items():
        resolved_map[pid] = copy.deepcopy(pdata)

    if not profile_dict:
        return resolved_map

    prof = profile_dict.get("profile", profile_dict)
    set_params = prof.get("modify", {}).get("set-parameters", [])

    for override in set_params:
        if not isinstance(override, dict):
            continue
        pid = override.get("param-id")
        if not pid:
            continue

        base_param = resolved_map.get(pid, {"id": pid})

        if "values" in override:
            vals = override["values"]
            if isinstance(vals, list) and len(vals) == 0:
                # Revert to catalog default value
                if pid in cat_params and "values" in cat_params[pid]:
                    base_param["values"] = copy.deepcopy(cat_params[pid]["values"])
                else:
                    base_param.pop("values", None)
            else:
                base_param["values"] = copy.deepcopy(vals)

        if "select" in override:
            base_param["select"] = copy.deepcopy(override["select"])
        if "label" in override:
            base_param["label"] = override["label"]
        if "usage" in override:
            base_param["usage"] = override["usage"]
        if "constraints" in override:
            base_param["constraints"] = copy.deepcopy(override["constraints"])
        if "guidelines" in override:
            base_param["guidelines"] = copy.deepcopy(override["guidelines"])

        resolved_map[pid] = base_param

    return resolved_map


def render_control_prose(
    prose: str, resolved_params: Dict[str, Dict[str, Any]], visited: Optional[Set[str]] = None
) -> str:
    """
    Renders control prose containing {{ insert: param, param_id }} or <insert type="param" id-ref="param_id"/> placeholders.
    Handles fallbacks [label], whitespace trimming, multi-value joining with ', ', malformed inserts, and circular references.
    """
    if visited is None:
        visited = set()

    pattern_curly = re.compile(r"\{\{\s*insert:\s*param\s*,\s*([\w\.\-]+)\s*\}\}")
    pattern_malformed = re.compile(r"\{\{\s*insert:\s*(?:param\s*,?\s*)?\}\}")
    pattern_xml = re.compile(r"<insert\s+type=['\"]param['\"]\s+id-ref=['\"]([\w\.\-]+)['\"]\s*/?>")

    def _replace_curly(match: re.Match) -> str:
        param_id = match.group(1).strip()
        if param_id in visited:
            return f"[{param_id}]"

        visited.add(param_id)
        param_obj = resolved_params.get(param_id)
        if not param_obj:
            visited.remove(param_id)
            return f"[{param_id}]"

        vals = param_obj.get("values")
        label = param_obj.get("label") or param_id

        if vals and isinstance(vals, list) and len(vals) > 0:
            cleaned_vals = [str(v).strip() for v in vals if str(v).strip()]
            if cleaned_vals:
                res = ", ".join(cleaned_vals)
                if "{{" in res or "<insert" in res:
                    res = render_control_prose(res, resolved_params, visited)
                visited.remove(param_id)
                return res

        visited.remove(param_id)
        return f"[{label}]"

    rendered = pattern_curly.sub(_replace_curly, prose)

    def _replace_xml(match: re.Match) -> str:
        param_id = match.group(1).strip()
        if param_id in visited:
            return f"[{param_id}]"

        visited.add(param_id)
        param_obj = resolved_params.get(param_id)
        if not param_obj:
            visited.remove(param_id)
            return f"[{param_id}]"

        vals = param_obj.get("values")
        label = param_obj.get("label") or param_id

        if vals and isinstance(vals, list) and len(vals) > 0:
            cleaned_vals = [str(v).strip() for v in vals if str(v).strip()]
            if cleaned_vals:
                visited.remove(param_id)
                return ", ".join(cleaned_vals)

        visited.remove(param_id)
        return f"[{label}]"

    rendered = pattern_xml.sub(_replace_xml, rendered)
    rendered = pattern_malformed.sub("[ERROR: malformed insert]", rendered)

    return rendered
