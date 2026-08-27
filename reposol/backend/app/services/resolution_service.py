import asyncio
import re
import copy
from typing import Dict, Any, List, Optional, Tuple, Set
import functools

from app.repositories.document_repository import get_document
from app.repositories.document_repository import _catalog_uuid_from_href
from app.constants import normalize_stage

# Simple memory cache for resolved documents
# Key: (workspace_id, stage, doc_id)
_resolution_cache = {}

def clear_resolution_cache(doc_id: str = None):
    global _resolution_cache
    if doc_id:
        _resolution_cache = {k: v for k, v in _resolution_cache.items() if k[2] != doc_id}
    else:
        _resolution_cache.clear()

def _matches_pattern(control_id: str, patterns: List[str]) -> bool:
    if not patterns:
        return False
    id_lower = control_id.lower()
    for pat in patterns:
        regex_str = '^' + pat.lower().replace('*', '.*').replace('?', '.') + '$'
        try:
            if re.match(regex_str, id_lower):
                return True
        except re.error:
            pass
    return False

def _collect_withdrawn_ids(cat: Dict[str, Any]) -> Set[str]:
    """Collects IDs of all controls with prop status=withdrawn from a catalog.
    These are catalog-level deprecated controls that should be auto-excluded from profiles."""
    withdrawn = set()
    def _check_control(ctrl):
        props = ctrl.get("props", [])
        for p in props:
            name = (p.get("name") or "").lower()
            value = (p.get("value") or "").lower()
            if name in ("status", "state") and value == "withdrawn":
                cid = ctrl.get("id", "")
                if cid:
                    withdrawn.add(cid.lower())
                break
        for sub in ctrl.get("controls", []):
            _check_control(sub)
    def _check_group(grp):
        for c in grp.get("controls", []):
            _check_control(c)
        for g in grp.get("groups", []):
            _check_group(g)
    for g in cat.get("groups", []):
        _check_group(g)
    for c in cat.get("controls", []):
        _check_control(c)
    return withdrawn

def _filter_controls(controls: List[Dict], include_all: bool, included_ids: set, include_patterns: List[str], excluded_ids: set, exclude_patterns: List[str]) -> List[Dict]:
    if not controls:
        return []
    result = []
    has_inclusions = bool(included_ids or include_patterns)
    
    for c in controls:
        c_id = c.get("id", "").lower()
        
        # Check if included
        is_included = include_all or not has_inclusions
        if not is_included:
            is_included = (c_id in included_ids) or _matches_pattern(c_id, include_patterns)
            # Also check if any child is included
            def has_included_child(ctrl):
                if ctrl.get("id", "").lower() in included_ids:
                    return True
                if _matches_pattern(ctrl.get("id", ""), include_patterns):
                    return True
                for sub in ctrl.get("controls", []):
                    if has_included_child(sub):
                        return True
                return False
            if not is_included and has_included_child(c):
                is_included = True

        is_excluded = (c_id in excluded_ids) or _matches_pattern(c_id, exclude_patterns)
        
        if is_included and not is_excluded:
            new_c = copy.deepcopy(c)
            sub_controls = new_c.get("controls", [])
            if sub_controls:
                filtered_sub = _filter_controls(sub_controls, include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)
                if filtered_sub:
                    new_c["controls"] = filtered_sub
                else:
                    new_c.pop("controls", None)
            result.append(new_c)
            
    return result

def _filter_groups(groups: List[Dict], include_all: bool, included_ids: set, include_patterns: List[str], excluded_ids: set, exclude_patterns: List[str]) -> List[Dict]:
    if not groups:
        return []
    result = []
    for g in groups:
        new_g = copy.deepcopy(g)
        
        filtered_sub = _filter_groups(new_g.get("groups", []), include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)
        if filtered_sub:
            new_g["groups"] = filtered_sub
        else:
            new_g.pop("groups", None)
            
        filtered_ctrls = _filter_controls(new_g.get("controls", []), include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)
        if filtered_ctrls:
            new_g["controls"] = filtered_ctrls
        else:
            new_g.pop("controls", None)
            
        if filtered_sub or filtered_ctrls:
            result.append(new_g)
            
    return result

def _normalize_remove_criteria(remove_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts and normalizes remove criteria supporting both kebab-case and snake_case."""
    return {
        "by_id": remove_dict.get("by-id") or remove_dict.get("by_id"),
        "by_name": remove_dict.get("by-name") or remove_dict.get("by_name"),
        "by_class": remove_dict.get("by-class") or remove_dict.get("by_class"),
        "by_ns": remove_dict.get("by-ns") or remove_dict.get("by_ns"),
        "by_item_name": remove_dict.get("by-item-name") or remove_dict.get("by_item_name"),
    }

def _matches_removal(obj: Dict[str, Any], item_name: str, criteria: Dict[str, Any]) -> bool:
    """
    Evaluates whether an object matches ALL specified criteria in a remove directive (AND logic).
    """
    if not any(criteria.values()):
        return False

    req_item = criteria.get("by_item_name")
    if req_item and req_item.lower() != item_name.lower():
        return False

    req_id = criteria.get("by_id")
    if req_id:
        obj_id = obj.get("id") or obj.get("param-id") or obj.get("uuid") or (obj.get("href") if item_name == "link" else None)
        if not obj_id or str(obj_id).lower() != str(req_id).lower():
            return False

    req_name = criteria.get("by_name")
    if req_name:
        obj_name = obj.get("name")
        if not obj_name or str(obj_name).lower() != str(req_name).lower():
            return False

    req_class = criteria.get("by_class")
    if req_class:
        obj_class = obj.get("class")
        if not obj_class or str(obj_class).lower() != str(req_class).lower():
            return False

    req_ns = criteria.get("by_ns")
    if req_ns:
        obj_ns = obj.get("ns")
        if not obj_ns or str(obj_ns).lower() != str(req_ns).lower():
            return False

    return True

def _replace_part_by_id(parts: List[Dict[str, Any]], target_id: str, replacement: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Recursively finds a part by ID and updates it in-place."""
    if not parts or not isinstance(parts, list):
        return []
    target_id_lower = str(target_id).lower()
    result = []
    for p in parts:
        new_p = copy.deepcopy(p)
        if str(new_p.get("id", "")).lower() == target_id_lower:
            existing_subparts = new_p.get("parts")
            new_p.update(copy.deepcopy(replacement))
            if "parts" not in replacement and existing_subparts:
                new_p["parts"] = existing_subparts
        else:
            if "parts" in new_p and isinstance(new_p["parts"], list):
                new_p["parts"] = _replace_part_by_id(new_p["parts"], target_id, replacement)
        result.append(new_p)
    return result

def _apply_removes_to_parts(parts: List[Dict[str, Any]], criteria_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Recursively removes parts, part props, and part links matching removal criteria."""
    if not parts or not isinstance(parts, list):
        return []
    result = []
    for part in parts:
        # Check if part itself matches any removal criteria
        if any(_matches_removal(part, "part", crit) for crit in criteria_list):
            continue

        new_part = copy.deepcopy(part)

        # Filter nested properties
        if "props" in new_part and isinstance(new_part["props"], list):
            filtered_props = [
                pr for pr in new_part["props"]
                if not any(_matches_removal(pr, "prop", crit) for crit in criteria_list)
            ]
            if filtered_props:
                new_part["props"] = filtered_props
            else:
                new_part.pop("props", None)

        # Filter nested links
        if "links" in new_part and isinstance(new_part["links"], list):
            filtered_links = [
                l for l in new_part["links"]
                if not any(_matches_removal(l, "link", crit) for crit in criteria_list)
            ]
            if filtered_links:
                new_part["links"] = filtered_links
            else:
                new_part.pop("links", None)

        # Filter nested parts recursively
        if "parts" in new_part and isinstance(new_part["parts"], list):
            filtered_subparts = _apply_removes_to_parts(new_part["parts"], criteria_list)
            if filtered_subparts:
                new_part["parts"] = filtered_subparts
            else:
                new_part.pop("parts", None)

        result.append(new_part)
    return result

def _apply_explicit_add_to_parts(
    parts: List[Dict[str, Any]],
    by_id: str,
    position: str,
    new_parts: List[Dict[str, Any]],
    new_props: Optional[List[Dict[str, Any]]] = None,
    new_links: Optional[List[Dict[str, Any]]] = None
) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Recursively searches for by_id and applies sibling insertion (before/after)
    or child insertion (starting/ending).
    """
    if not parts or not isinstance(parts, list):
        return parts, False

    by_id_lower = str(by_id).lower()
    target_idx = -1
    for i, p in enumerate(parts):
        if str(p.get("id", "")).lower() == by_id_lower:
            target_idx = i
            break

    if target_idx >= 0:
        target_part = parts[target_idx]
        if position == "before":
            res = list(parts[:target_idx]) + [copy.deepcopy(p) for p in new_parts] + list(parts[target_idx:])
            return res, True
        elif position == "after":
            res = list(parts[:target_idx + 1]) + [copy.deepcopy(p) for p in new_parts] + list(parts[target_idx + 1:])
            return res, True
        elif position == "starting":
            updated_part = copy.deepcopy(target_part)
            if new_parts:
                updated_part["parts"] = [copy.deepcopy(p) for p in new_parts] + updated_part.get("parts", [])
            if new_props:
                updated_part["props"] = [copy.deepcopy(pr) for pr in new_props] + updated_part.get("props", [])
            if new_links:
                updated_part["links"] = [copy.deepcopy(l) for l in new_links] + updated_part.get("links", [])
            res = list(parts)
            res[target_idx] = updated_part
            return res, True
        else:  # "ending" or default
            updated_part = copy.deepcopy(target_part)
            if new_parts:
                updated_part["parts"] = updated_part.get("parts", []) + [copy.deepcopy(p) for p in new_parts]
            if new_props:
                updated_part["props"] = [copy.deepcopy(pr) for pr in new_props] + updated_part.get("props", [])
            if new_links:
                updated_part["links"] = updated_part.get("links", []) + [copy.deepcopy(l) for l in new_links]
            res = list(parts)
            res[target_idx] = updated_part
            return res, True

    # Search recursively in subparts
    found = False
    res = []
    for p in parts:
        if "parts" in p and isinstance(p["parts"], list):
            subparts, sub_found = _apply_explicit_add_to_parts(
                p["parts"], by_id, position, new_parts, new_props, new_links
            )
            if sub_found:
                found = True
                new_p = copy.deepcopy(p)
                new_p["parts"] = subparts
                res.append(new_p)
                continue
        res.append(p)

    return res, found

def _apply_modify_to_single_control(ctrl: Dict[str, Any], alter: Dict[str, Any]) -> None:
    """Applies adds and removes directives to a single control object."""
    adds = alter.get("adds", [])
    removes = alter.get("removes", [])

    raw_removal_criteria = [_normalize_remove_criteria(r) for r in removes] if removes else []

    # 1. Identify atomic in-place replacement parts
    replaced_ids: Set[str] = set()
    for add in adds:
        by_id = add.get("by-id") or add.get("by_id")
        if by_id:
            for p in add.get("parts", []):
                pid = p.get("id")
                if pid and str(pid).lower() == str(by_id).lower():
                    if any(str(c.get("by_id", "")).lower() == str(by_id).lower() for c in raw_removal_criteria):
                        replaced_ids.add(str(by_id).lower())

    # 2. Perform in-place part replacements
    if replaced_ids and ctrl.get("parts"):
        for add in adds:
            by_id = add.get("by-id") or add.get("by_id")
            if by_id and str(by_id).lower() in replaced_ids:
                replacement_parts = [p for p in add.get("parts", []) if str(p.get("id", "")).lower() == str(by_id).lower()]
                if replacement_parts:
                    ctrl["parts"] = _replace_part_by_id(ctrl["parts"], by_id, replacement_parts[0])

    # 3. Active removals (excluding already replaced parts)
    active_removal_criteria = [
        crit for crit in raw_removal_criteria
        if not (crit.get("by_id") and str(crit.get("by_id")).lower() in replaced_ids)
    ]

    # 4. Apply non-replacement additions to parts
    for add in adds:
        by_id = add.get("by-id") or add.get("by_id")
        position = add.get("position", "ending")
        add_parts = add.get("parts", [])

        parts_to_add = [
            p for p in add_parts
            if not (by_id and str(by_id).lower() in replaced_ids and str(p.get("id", "")).lower() == str(by_id).lower())
        ]
        add_props = add.get("props", [])
        add_links = add.get("links", [])

        if by_id:
            if ctrl.get("parts"):
                ctrl["parts"], _ = _apply_explicit_add_to_parts(
                    ctrl["parts"], by_id, position, parts_to_add, add_props, add_links
                )
        else:
            if parts_to_add:
                existing_parts = ctrl.get("parts", [])
                if position in ["starting", "before"]:
                    ctrl["parts"] = [copy.deepcopy(p) for p in parts_to_add] + existing_parts
                else:
                    ctrl["parts"] = existing_parts + [copy.deepcopy(p) for p in parts_to_add]

    # 5. Apply removals to parts
    if active_removal_criteria and ctrl.get("parts"):
        ctrl["parts"] = _apply_removes_to_parts(ctrl["parts"], active_removal_criteria)
        if not ctrl["parts"]:
            ctrl.pop("parts", None)

    # 6. Apply non-part alterations (props, params, links, controls, title)
    for crit in active_removal_criteria:
        req_item = crit.get("by_item_name")
        if "props" in ctrl and (not req_item or req_item.lower() == "prop"):
            ctrl["props"] = [p for p in ctrl["props"] if not _matches_removal(p, "prop", crit)]
            if not ctrl["props"]:
                ctrl.pop("props", None)
        if "params" in ctrl and (not req_item or req_item.lower() == "param"):
            ctrl["params"] = [p for p in ctrl["params"] if not _matches_removal(p, "param", crit)]
            if not ctrl["params"]:
                ctrl.pop("params", None)
        if "links" in ctrl and (not req_item or req_item.lower() == "link"):
            ctrl["links"] = [l for l in ctrl["links"] if not _matches_removal(l, "link", crit)]
            if not ctrl["links"]:
                ctrl.pop("links", None)
        if "controls" in ctrl and (not req_item or req_item.lower() == "control"):
            ctrl["controls"] = [c for c in ctrl["controls"] if not _matches_removal(c, "control", crit)]
            if not ctrl["controls"]:
                ctrl.pop("controls", None)

    for add in adds:
        by_id = add.get("by-id") or add.get("by_id")
        position = add.get("position", "ending")
        if "title" in add:
            ctrl["title"] = add["title"]

        if not by_id:
            if "props" in add and isinstance(add["props"], list):
                props = ctrl.get("props", [])
                for new_prop in add["props"]:
                    idx = next((i for i, p in enumerate(props) if p.get("name") == new_prop.get("name")), -1)
                    if idx >= 0:
                        props[idx] = new_prop
                    else:
                        if position in ["starting", "before"]:
                            props.insert(0, new_prop)
                        else:
                            props.append(new_prop)
                    
                    if new_prop.get("name") == "title-override" and new_prop.get("value"):
                        ctrl["title"] = new_prop["value"]
                    elif new_prop.get("name") == "id-override" and new_prop.get("value"):
                        if "originalId" not in ctrl:
                            ctrl["originalId"] = ctrl.get("id")
                        ctrl["id"] = new_prop["value"]
                ctrl["props"] = props

            if "params" in add and isinstance(add["params"], list):
                params = ctrl.get("params", [])
                for new_param in add["params"]:
                    idx = next((i for i, p in enumerate(params) if (p.get("id") or p.get("param-id")) == (new_param.get("id") or new_param.get("param-id"))), -1)
                    if idx >= 0:
                        params[idx] = new_param
                    else:
                        if position in ["starting", "before"]:
                            params.insert(0, new_param)
                        else:
                            params.append(new_param)
                ctrl["params"] = params

            if "links" in add and isinstance(add["links"], list):
                links = ctrl.get("links", [])
                for new_link in add["links"]:
                    idx = next((i for i, l in enumerate(links) if l.get("href") == new_link.get("href")), -1)
                    if idx >= 0:
                        links[idx] = new_link
                    else:
                        if position in ["starting", "before"]:
                            links.insert(0, new_link)
                        else:
                            links.append(new_link)
                ctrl["links"] = links

            if "controls" in add and isinstance(add["controls"], list):
                sub_ctrls = ctrl.get("controls", [])
                for new_c in add["controls"]:
                    idx = next((i for i, c in enumerate(sub_ctrls) if c.get("id") == new_c.get("id")), -1)
                    if idx >= 0:
                        sub_ctrls[idx] = new_c
                    else:
                        if position in ["starting", "before"]:
                            sub_ctrls.insert(0, new_c)
                        else:
                            sub_ctrls.append(new_c)
                ctrl["controls"] = sub_ctrls

    # Respect title-override and id-override props
    if ctrl.get("props"):
        title_override = next((p.get("value") for p in ctrl["props"] if p.get("name") == "title-override"), None)
        if title_override is not None:
            ctrl["title"] = title_override
        id_override = next((p.get("value") for p in ctrl["props"] if p.get("name") == "id-override"), None)
        if id_override is not None:
            if "originalId" not in ctrl:
                ctrl["originalId"] = ctrl.get("id")
            ctrl["id"] = id_override


def _apply_modify(catalog: Dict, modify: Dict):
    if not modify:
        return

    set_params = modify.get("set-parameters", [])
    alters = modify.get("alters", [])

    param_map = {}
    for p in set_params:
        pid = (p.get("param-id") or p.get("id"))
        if pid:
            param_map[pid.lower()] = p

    alter_map = {}
    for a in alters:
        cid = a.get("control-id")
        if cid:
            alter_map[cid.lower()] = a

    def apply_param_overrides(params_list):
        if not params_list or not isinstance(params_list, list):
            return params_list
        res = []
        for param in params_list:
            pid = (param.get("id") or param.get("param-id"))
            if pid and pid.lower() in param_map:
                override = param_map[pid.lower()]
                merged = copy.deepcopy(param)
                for field in ['values', 'label', 'select', 'constraints', 'guidelines', 'class', 'props', 'links', 'usage', 'remarks']:
                    if field in override:
                        merged[field] = override[field]
                res.append(merged)
            else:
                res.append(param)
        return res

    def traverse_control(ctrl):
        if ctrl.get("params"):
            ctrl["params"] = apply_param_overrides(ctrl["params"])

        cid = ctrl.get("id", "").lower()
        if cid in alter_map:
            _apply_modify_to_single_control(ctrl, alter_map[cid])

        if ctrl.get("controls"):
            for sub in ctrl["controls"]:
                traverse_control(sub)

    def traverse_group(group):
        if group.get("params"):
            group["params"] = apply_param_overrides(group["params"])

        # Apply alters to groups too — a profile may target a group ID with alters
        gid = group.get("id", "").lower()
        if gid in alter_map:
            _apply_modify_to_single_control(group, alter_map[gid])

        if group.get("controls"):
            for c in group["controls"]:
                traverse_control(c)
        if group.get("groups"):
            for g in group["groups"]:
                traverse_group(g)

    if catalog.get("params"):
        catalog["params"] = apply_param_overrides(catalog["params"])
    if catalog.get("controls"):
        for c in catalog["controls"]:
            traverse_control(c)
    if catalog.get("groups"):
        for g in catalog["groups"]:
            traverse_group(g)

def _deduplicate_use_first(controls, groups):
    seen = set()
    def dedup_c(ctrls):
        res = []
        for c in ctrls:
            cid = c.get("id", "").lower()
            if cid not in seen:
                seen.add(cid)
                new_c = copy.deepcopy(c)
                if new_c.get("controls"):
                    new_c["controls"] = dedup_c(new_c["controls"])
                res.append(new_c)
        return res
        
    def dedup_g(grps):
        res = []
        for g in grps:
            new_g = copy.deepcopy(g)
            if new_g.get("controls"):
                new_g["controls"] = dedup_c(new_g["controls"])
            if new_g.get("groups"):
                new_g["groups"] = dedup_g(new_g["groups"])
            res.append(new_g)
        return res
        
    return dedup_c(controls), dedup_g(groups)

def _flatten_all(controls, groups):
    result = []
    def extract_ctrl(ctrl):
        c_copy = copy.deepcopy(ctrl)
        c_copy.pop("controls", None)
        result.append(c_copy)
        for sub in ctrl.get("controls", []):
            extract_ctrl(sub)
    def extract_grp(grp):
        for c in grp.get("controls", []):
            extract_ctrl(c)
        for g in grp.get("groups", []):
            extract_grp(g)
    for c in controls:
        extract_ctrl(c)
    for g in groups:
        extract_grp(g)
    return result

def _apply_custom_structure(custom_groups, custom_insert_controls, all_controls, all_groups):
    ctrl_map = _collect_controls_map(all_controls, all_groups)
    used_ids = set()
    
    def process_insert(insert_directives):
        res_ctrls = []
        for d in insert_directives:
            if not isinstance(d, dict):
                continue
            if "include-all" in d:
                for cid_k, c in ctrl_map.items():
                    if cid_k not in used_ids:
                        res_ctrls.append(copy.deepcopy(c))
                        used_ids.add(cid_k)
            elif "include-controls" in d:
                for inc in d.get("include-controls", []):
                    if not isinstance(inc, dict):
                        continue
                    for cid in inc.get("with-ids", []):
                        cid_l = str(cid).lower()
                        if cid_l in ctrl_map and cid_l not in used_ids:
                            res_ctrls.append(copy.deepcopy(ctrl_map[cid_l]))
                            used_ids.add(cid_l)
                    for match in inc.get("matching", []):
                        if isinstance(match, dict):
                            pat = match.get("pattern")
                            if pat:
                                for cid_k, c in ctrl_map.items():
                                    if cid_k not in used_ids and _matches_pattern(c.get("id", cid_k), [pat]):
                                        res_ctrls.append(copy.deepcopy(c))
                                        used_ids.add(cid_k)
            elif "exclude-controls" in d:
                for exc in d.get("exclude-controls", []):
                    if isinstance(exc, str):
                        used_ids.add(exc.lower())
                    elif isinstance(exc, dict):
                        for cid in exc.get("with-ids", []):
                            used_ids.add(str(cid).lower())
                        for match in exc.get("matching", []):
                            if isinstance(match, dict):
                                pat = match.get("pattern")
                                if pat:
                                    for cid_k, c in ctrl_map.items():
                                        if _matches_pattern(c.get("id", cid_k), [pat]):
                                            used_ids.add(cid_k)
            
            order = d.get("order", "keep")
            if order == "ascending":
                res_ctrls.sort(key=lambda x: str(x.get("id", "")).lower())
            elif order == "descending":
                res_ctrls.sort(key=lambda x: str(x.get("id", "")).lower(), reverse=True)
                
        return res_ctrls

    def build_group(g):
        if not isinstance(g, dict):
            return g
        new_g = copy.deepcopy(g)
        if "insert-controls" in new_g and isinstance(new_g["insert-controls"], list):
            ctrls = process_insert(new_g["insert-controls"])
            if ctrls:
                new_g["controls"] = ctrls
            new_g.pop("insert-controls", None)
        if "groups" in new_g and isinstance(new_g["groups"], list):
            subgroups = [build_group(sub_g) for sub_g in new_g["groups"] if isinstance(sub_g, dict)]
            if subgroups:
                new_g["groups"] = subgroups
            else:
                new_g.pop("groups", None)
        return new_g

    res_groups = [build_group(g) for g in custom_groups if isinstance(g, dict)]
    res_controls = process_insert(custom_insert_controls) if custom_insert_controls else []
    
    return res_controls, res_groups

async def _run_resolution_pipeline(
    workspace_id: str,
    profile: Dict[str, Any],
    _resolving_stack: set = None
) -> Dict[str, Any]:
    """
    Core 3-phase OSCAL profile resolution pipeline (Import → Merge → Modify).
    Accepts a profile dict (not a document wrapper) and returns the resolved catalog.
    Shared by resolve_profile() and resolve_profile_inline().
    """
    if _resolving_stack is None:
        _resolving_stack = set()

    all_controls = []
    all_groups = []
    raw_all_controls = []
    raw_all_groups = []
    source_catalog_ids = set()
    source_catalog_titles = []

    # === Phase 1: Import ===
    for imp in profile.get("imports", []):
        href = imp.get("href")
        cat_uuid = _catalog_uuid_from_href(href)
        if not cat_uuid:
            continue

        from app.repositories.document_repository import document_exists
        is_profile = await document_exists("profiles", cat_uuid, workspace_id=workspace_id)
        if is_profile:
            prof_res = await resolve_profile(workspace_id, cat_uuid, _resolving_stack=_resolving_stack)
            cat = {"groups": prof_res.get("groups", []), "controls": prof_res.get("controls", [])}
            source_catalog_ids.add(cat_uuid)
            source_catalog_titles.append("Profile")
        else:
            try:
                cat_doc, _ = await get_document("catalogs", cat_uuid, workspace_id=workspace_id)
                source_catalog_ids.add(cat_uuid)
                source_catalog_titles.append(cat_doc.get("catalog", {}).get("metadata", {}).get("title", "Unknown Catalog"))
            except FileNotFoundError:
                continue

            cat = cat_doc.get("catalog", {})

        raw_all_groups.extend(copy.deepcopy(cat.get("groups", [])))
        raw_all_controls.extend(copy.deepcopy(cat.get("controls", [])))

        include_all = imp.get("include-all", None) is not None
        include_controls = imp.get("include-controls", [])
        exclude_controls = imp.get("exclude-controls", [])

        included_ids = set()
        include_patterns = []
        for inc in include_controls:
            for id in inc.get("with-ids", []):
                included_ids.add(id.lower())
            for match in inc.get("matching", []):
                if match.get("pattern"):
                    include_patterns.append(match["pattern"])

        excluded_ids = set()
        exclude_patterns = []
        for exc in exclude_controls:
            if isinstance(exc, str):
                excluded_ids.add(exc.lower())
            if isinstance(exc, dict):
                for id in exc.get("with-ids", []):
                    excluded_ids.add(id.lower())

        # Auto-exclude catalog-level withdrawn controls from profiles.
        # Withdrawn is a catalog concept (NIST retired the control) — profiles should not inherit them.
        withdrawn_ids = _collect_withdrawn_ids(cat)
        excluded_ids |= withdrawn_ids

        filtered_groups = _filter_groups(cat.get("groups", []), include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)
        filtered_controls = _filter_controls(cat.get("controls", []), include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)

        all_groups.extend(filtered_groups)
        all_controls.extend(filtered_controls)

    # === Phase 2: Merge ===
    merge = profile.get("merge", {})
    combine_method = merge.get("combine", {}).get("method", "use-first")

    if combine_method == "use-first":
        all_controls, all_groups = _deduplicate_use_first(all_controls, all_groups)
        raw_all_controls, raw_all_groups = _deduplicate_use_first(raw_all_controls, raw_all_groups)

    if "flat" in merge:
        all_controls = _flatten_all(all_controls, all_groups)
        all_groups = []
    elif "custom" in merge:
        custom_groups = merge["custom"].get("groups", [])
        custom_insert = merge["custom"].get("insert-controls", [])
        all_controls, all_groups = _apply_custom_structure(custom_groups, custom_insert, all_controls, all_groups)

    resolved = {
        "uuid": profile.get("uuid"),
        "metadata": profile.get("metadata", {}),
        "groups": all_groups,
        "controls": all_controls
    }

    # === Phase 3: Modify ===
    _apply_modify(resolved, profile.get("modify", {}))

    all_raw_ctrl_ids = _collect_all_control_ids({"controls": raw_all_controls, "groups": raw_all_groups})
    resolved_ctrl_ids = _collect_all_control_ids(resolved)
    excluded_control_ids = all_raw_ctrl_ids - resolved_ctrl_ids
    resolved_param_ids = _collect_all_param_ids(resolved)
    conflicts = detect_modify_conflicts(profile, resolved_ctrl_ids, resolved_param_ids, all_raw_ctrl_ids)

    return {
        "controls": resolved.get("controls", []),
        "groups": resolved.get("groups", []),
        "all_controls": raw_all_controls,
        "all_groups": raw_all_groups,
        "excluded_control_ids": sorted(list(excluded_control_ids)),
        "source_catalog_id": list(source_catalog_ids)[0] if source_catalog_ids else None,
        "source_catalog_title": ", ".join(source_catalog_titles),
        "parameter_overrides": profile.get("modify", {}).get("set-parameters", []),
        "alterations_applied": len(profile.get("modify", {}).get("alters", [])),
        "conflicts": conflicts
    }


async def resolve_profile(workspace_id: str, profile_id: str, _resolving_stack: set = None) -> Dict[str, Any]:
    """Resolves a saved profile from disk using the 3-phase pipeline."""
    if _resolving_stack is None:
        _resolving_stack = set()
    if profile_id in _resolving_stack:
        raise ValueError("Circular profile reference detected")
    _resolving_stack = _resolving_stack | {profile_id}

    doc, _ = await get_document("profiles", profile_id, workspace_id=workspace_id)
    profile = doc.get("profile", {})

    return await _run_resolution_pipeline(workspace_id, profile, _resolving_stack)


async def resolve_profile_inline(workspace_id: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Resolves an inline (unsaved) profile document using the 3-phase pipeline.
    Used for live preview during editing — does NOT read from disk.
    """
    return await _run_resolution_pipeline(workspace_id, profile)


def _collect_all_control_ids(resolved: Dict[str, Any]) -> Set[str]:
    """Collects all control IDs from a resolved catalog result, including original IDs."""
    ids = set()
    def traverse_ctrl(ctrl):
        cid = ctrl.get("id", "")
        if cid:
            ids.add(cid.lower())
        orig_id = ctrl.get("originalId") or ctrl.get("original_id")
        if orig_id:
            ids.add(str(orig_id).lower())
        for sub in ctrl.get("controls", []):
            traverse_ctrl(sub)
    def traverse_grp(grp):
        for c in grp.get("controls", []):
            traverse_ctrl(c)
        for g in grp.get("groups", []):
            traverse_grp(g)
    for c in resolved.get("controls", []):
        traverse_ctrl(c)
    for g in resolved.get("groups", []):
        traverse_grp(g)
    return ids


def _collect_all_param_ids(resolved: Dict[str, Any]) -> Set[str]:
    """Collects all parameter IDs from a resolved catalog result."""
    ids = set()
    def extract_params(obj):
        for p in obj.get("params", []):
            pid = p.get("id") or p.get("param-id")
            if pid:
                ids.add(pid.lower())
    def traverse_ctrl(ctrl):
        extract_params(ctrl)
        for sub in ctrl.get("controls", []):
            traverse_ctrl(sub)
    def traverse_grp(grp):
        extract_params(grp)
        for c in grp.get("controls", []):
            traverse_ctrl(c)
        for g in grp.get("groups", []):
            traverse_grp(g)
    extract_params(resolved)
    for c in resolved.get("controls", []):
        traverse_ctrl(c)
    for g in resolved.get("groups", []):
        traverse_grp(g)
    for c in resolved.get("all_controls", []):
        traverse_ctrl(c)
    for g in resolved.get("all_groups", []):
        traverse_grp(g)
    return ids



def detect_modify_conflicts(
    profile: Dict[str, Any],
    resolved_control_ids: Set[str],
    resolved_param_ids: Set[str],
    all_imported_control_ids: Optional[Set[str]] = None
) -> Dict[str, Any]:
    """
    Detects conflicts between modify directives, custom group selections, and the resolved control set.

    Per NIST OSCAL spec: orphaned alters are inoperative (not errors).
    We detect them so the UI can display warnings.
    """
    modify = profile.get("modify", {})
    pool_control_ids = all_imported_control_ids if all_imported_control_ids is not None else resolved_control_ids

    # 1. Orphaned alters (control-id not in resolved set)
    orphaned_alters = []
    for alter in modify.get("alters", []):
        if isinstance(alter, dict):
            cid = alter.get("control-id", "")
            if cid and str(cid).lower() not in resolved_control_ids:
                orphaned_alters.append({
                    "control-id": cid,
                    "adds_count": len(alter.get("adds", [])),
                    "removes_count": len(alter.get("removes", []))
                })

    # 2. Orphaned set-parameters (param-id not in resolved set)
    orphaned_params = []
    for sp in modify.get("set-parameters", []):
        if isinstance(sp, dict):
            pid = sp.get("param-id", "")
            if pid and str(pid).lower() not in resolved_param_ids:
                orphaned_params.append({"param-id": pid})

    # 3. Orphaned custom group references (referenced control not in imported catalog pool)
    orphaned_custom_refs = []
    merge = profile.get("merge", {})
    custom = merge.get("custom", {}) if isinstance(merge, dict) else {}

    def scan_insert_controls(group_id: Optional[str], insert_controls: List[Dict[str, Any]]) -> None:
        for ic in insert_controls:
            if not isinstance(ic, dict):
                continue
            for inc in ic.get("include-controls", []):
                if not isinstance(inc, dict):
                    continue
                for wid in inc.get("with-ids", []):
                    if wid and str(wid).lower() not in pool_control_ids:
                        orphaned_custom_refs.append({
                            "group-id": group_id,
                            "control-id": wid
                        })

    def scan_group(group: Dict[str, Any]) -> None:
        if not isinstance(group, dict):
            return
        grp_id = group.get("id")
        if "insert-controls" in group and isinstance(group["insert-controls"], list):
            scan_insert_controls(grp_id, group["insert-controls"])
        for sub_grp in group.get("groups", []):
            scan_group(sub_grp)

    if isinstance(custom, dict):
        for group in custom.get("groups", []):
            scan_group(group)
        if "insert-controls" in custom and isinstance(custom["insert-controls"], list):
            scan_insert_controls(None, custom["insert-controls"])

    return {
        "has_conflicts": bool(orphaned_alters or orphaned_params or orphaned_custom_refs),
        "orphaned_alters": orphaned_alters,
        "orphaned_params": orphaned_params,
        "orphaned_custom_refs": orphaned_custom_refs
    }

async def resolve_ssp(workspace_id: str, ssp_id: str) -> Dict[str, Any]:
    doc, _ = await get_document("system-security-plans", ssp_id, workspace_id=workspace_id)
    ssp = doc.get("system-security-plan", {})
    
    profile_href = ssp.get("import-profile", {}).get("href")
    profile_id = _catalog_uuid_from_href(profile_href)
    
    if profile_id:
        try:
            resolved_profile = await resolve_profile(workspace_id, profile_id)
        except Exception:
            resolved_profile = {"controls": [], "groups": []}
    else:
        resolved_profile = {"controls": [], "groups": []}
        
    impl_reqs = ssp.get("control-implementation", {}).get("implemented-requirements", [])
    impl_map = {req.get("control-id", "").lower(): req for req in impl_reqs}
    
    # Simple summary counting
    summary = {
        "total": 0,
        "implemented": 0,
        "partially_implemented": 0,
        "planned": 0,
        "not_applicable": 0
    }
    
    def annotate_controls(controls):
        annotated = []
        for c in controls:
            new_c = copy.deepcopy(c)
            summary["total"] += 1
            cid = new_c.get("id", "").lower()
            if cid in impl_map:
                req = impl_map[cid]
                # Default logic for summary (simplified)
                state = req.get("props", [{}])[0].get("value", "planned") if req.get("props") else "planned"
                if state == "implemented":
                    summary["implemented"] += 1
                elif state == "partial":
                    summary["partially_implemented"] += 1
                elif state == "not-applicable":
                    summary["not_applicable"] += 1
                else:
                    summary["planned"] += 1
                new_c["implementation_status"] = state
            else:
                summary["planned"] += 1
                new_c["implementation_status"] = "none"
                
            if new_c.get("controls"):
                new_c["controls"] = annotate_controls(new_c["controls"])
            annotated.append(new_c)
        return annotated
        
    def annotate_groups(groups):
        annotated = []
        for g in groups:
            new_g = copy.deepcopy(g)
            if new_g.get("controls"):
                new_g["controls"] = annotate_controls(new_g["controls"])
            if new_g.get("groups"):
                new_g["groups"] = annotate_groups(new_g["groups"])
            annotated.append(new_g)
        return annotated
        
    control_tree = {
        "controls": annotate_controls(resolved_profile.get("controls", [])),
        "groups": annotate_groups(resolved_profile.get("groups", []))
    }
    
    return {
        "control_tree": control_tree,
        "implementation_summary": summary,
        "components": ssp.get("system-implementation", {}).get("components", [])
    }

def _flatten_tree(groups, controls):
    flat = []
    def traverse_c(ctrl, depth):
        flat.append({**ctrl, "depth": depth, "type": "control"})
        for sub in ctrl.get("controls", []):
            traverse_c(sub, depth + 1)
    def traverse_g(group, depth):
        for c in group.get("controls", []):
            traverse_c(c, depth + 1)
        for g in group.get("groups", []):
            traverse_g(g, depth + 1)
            
    for c in controls:
        traverse_c(c, 0)
    for g in groups:
        traverse_g(g, 0)
    return flat

async def get_control_tree(workspace_id: str, stage: str, doc_id: str) -> Dict[str, Any]:
    cache_key = (workspace_id, stage, doc_id)
    if cache_key in _resolution_cache:
        return _resolution_cache[cache_key]

    if stage == "catalogs":
        doc, _ = await get_document("catalogs", doc_id, workspace_id=workspace_id)
        cat = doc.get("catalog", {})
        groups = cat.get("groups", [])
        controls = cat.get("controls", [])
        flat = _flatten_tree(groups, controls)
        res = {
            "nodes": controls,
            "groups": groups,
            "flat_list": flat,
            "total_controls": len([c for c in flat if c["type"] == "control"])
        }
    elif stage == "profiles":
        resolved = await resolve_profile(workspace_id, doc_id)
        groups = resolved.get("groups", [])
        controls = resolved.get("controls", [])
        flat = _flatten_tree(groups, controls)
        res = {
            "nodes": controls,
            "groups": groups,
            "flat_list": flat,
            "total_controls": len([c for c in flat if c["type"] == "control"])
        }
    elif stage == "system-security-plans":
        resolved = await resolve_ssp(workspace_id, doc_id)
        groups = resolved.get("control_tree", {}).get("groups", [])
        controls = resolved.get("control_tree", {}).get("controls", [])
        flat = _flatten_tree(groups, controls)
        res = {
            "nodes": controls,
            "groups": groups,
            "flat_list": flat,
            "total_controls": len([c for c in flat if c["type"] == "control"])
        }
    else:
        res = {"nodes": [], "groups": [], "flat_list": [], "total_controls": 0}
        
    _resolution_cache[cache_key] = res
    return res

def _collect_controls_map(controls: Optional[List[Dict]] = None, groups: Optional[List[Dict]] = None) -> Dict[str, Dict]:
    """
    Collects all controls from controls and groups hierarchies into a dictionary
    keyed by lowercase control ID to support case-insensitive lookups during resolution.
    """
    res = {}
    def traverse_c(ctrl):
        cid = ctrl.get("id")
        if cid:
            res[str(cid).lower()] = ctrl
        for sub in ctrl.get("controls", []):
            traverse_c(sub)
            
    def traverse_g(group):
        for c in group.get("controls", []):
            traverse_c(c)
        for g in group.get("groups", []):
            traverse_g(g)
            
    if controls:
        for c in controls:
            traverse_c(c)
    if groups:
        for g in groups:
            traverse_g(g)
    return res

