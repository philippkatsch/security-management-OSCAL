import asyncio
import re
import copy
from typing import Dict, Any, List, Optional, Tuple, Set
import functools

from app.repositories.document_repository import get_document, document_exists
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

def _resolve_resource_href(href: Optional[str], profile: Dict[str, Any]) -> Optional[str]:
    """
    Resolves an import href that may be a direct catalog UUID URI or a fragment reference (#resource-id)
    pointing to a resource in back-matter.resources or metadata.resources with rlinks.
    """
    if not href or not isinstance(href, str):
        return None

    clean_href = href.strip()

    # 1. Fragment reference (#resource-id or #uuid)
    if clean_href.startswith("#"):
        resource_id = clean_href[1:].strip().lower()
        if not resource_id:
            return None

        # Search in both back-matter.resources and metadata.resources
        resources = []
        back_matter = profile.get("back-matter")
        if isinstance(back_matter, dict):
            bm_resources = back_matter.get("resources", [])
            if isinstance(bm_resources, list):
                resources.extend(bm_resources)

        metadata = profile.get("metadata")
        if isinstance(metadata, dict):
            meta_resources = metadata.get("resources", [])
            if isinstance(meta_resources, list):
                resources.extend(meta_resources)

        # Match resource by uuid or id
        matched_resource = None
        for r in resources:
            if isinstance(r, dict):
                r_uuid = str(r.get("uuid", "")).lower()
                r_id = str(r.get("id", "")).lower()
                if resource_id in (r_uuid, r_id):
                    matched_resource = r
                    break

        if matched_resource:
            # Check rlinks on matched resource
            for rlink in matched_resource.get("rlinks", []):
                if isinstance(rlink, dict):
                    rlink_href = rlink.get("href", "")
                    rlink_uuid = _catalog_uuid_from_href(rlink_href)
                    if rlink_uuid:
                        return rlink_uuid

            # If no rlink provided a UUID, check if the resource uuid itself is a valid document UUID
            r_uuid = matched_resource.get("uuid")
            if r_uuid:
                uuid_match = _catalog_uuid_from_href(r_uuid)
                if uuid_match:
                    return uuid_match

        # If no resource matched in back-matter/metadata, fallback to checking if fragment itself is a UUID
        fragment_uuid = _catalog_uuid_from_href(resource_id)
        if fragment_uuid:
            return fragment_uuid

        return None

    # 2. Direct URI / path with UUID
    return _catalog_uuid_from_href(clean_href)


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

    imported_sources = []

    # === Phase 1: Import ===
    for imp in profile.get("imports", []):
        href = imp.get("href")
        cat_uuid = _resolve_resource_href(href, profile)
        if not cat_uuid:
            continue

        from app.repositories.document_repository import document_exists
        is_profile = await document_exists("profiles", cat_uuid, workspace_id=workspace_id)
        if is_profile:
            prof_res = await resolve_profile(workspace_id, cat_uuid, _resolving_stack=_resolving_stack)
            prof_doc, _ = await get_document("profiles", cat_uuid, include_draft=False, workspace_id=workspace_id)
            prof_meta = prof_doc.get("profile", {}).get("metadata", {})
            cat_title = prof_meta.get("title", "Profile")
            cat_version = prof_meta.get("version")
            cat = {"groups": prof_res.get("groups", []), "controls": prof_res.get("controls", [])}
            source_catalog_ids.add(cat_uuid)
            source_catalog_titles.append(cat_title)
        else:
            try:
                cat_doc, _ = await get_document("catalogs", cat_uuid, include_draft=False, workspace_id=workspace_id)
                cat_meta = cat_doc.get("catalog", {}).get("metadata", {})
                cat_title = cat_meta.get("title", "Unknown Catalog")
                cat_version = cat_meta.get("version")
                source_catalog_ids.add(cat_uuid)
                source_catalog_titles.append(cat_title)
            except FileNotFoundError:
                continue

            cat = cat_doc.get("catalog", {})

        raw_cat_groups = copy.deepcopy(cat.get("groups", []))
        raw_cat_controls = copy.deepcopy(cat.get("controls", []))
        raw_all_groups.extend(copy.deepcopy(raw_cat_groups))
        raw_all_controls.extend(copy.deepcopy(raw_cat_controls))

        include_all = imp.get("include-all", None) is not None
        include_controls = imp.get("include-controls", [])
        exclude_controls = imp.get("exclude-controls", [])

        included_ids = set()
        include_patterns = []
        for inc in include_controls:
            for id in inc.get("with-ids", []):
                included_ids.add(id.lower())
            for match in inc.get("matching", []):
                if isinstance(match, dict) and match.get("pattern"):
                    include_patterns.append(match["pattern"])
                elif isinstance(match, str):
                    include_patterns.append(match)
            for pat in inc.get("matching-patterns", []):
                if pat:
                    include_patterns.append(pat)

        excluded_ids = set()
        exclude_patterns = []
        for exc in exclude_controls:
            if isinstance(exc, str):
                excluded_ids.add(exc.lower())
            elif isinstance(exc, dict):
                for id in exc.get("with-ids", []):
                    excluded_ids.add(id.lower())
                for match in exc.get("matching", []):
                    if isinstance(match, dict) and match.get("pattern"):
                        exclude_patterns.append(match["pattern"])
                    elif isinstance(match, str):
                        exclude_patterns.append(match)
                for pat in exc.get("matching-patterns", []):
                    if pat:
                        exclude_patterns.append(pat)

        # Auto-exclude catalog-level withdrawn controls from profiles.
        # Withdrawn is a catalog concept (NIST retired the control) — profiles should not inherit them.
        withdrawn_ids = _collect_withdrawn_ids(cat)
        excluded_ids |= withdrawn_ids

        filtered_groups = _filter_groups(raw_cat_groups, include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)
        filtered_controls = _filter_controls(raw_cat_controls, include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)

        all_groups.extend(filtered_groups)
        all_controls.extend(filtered_controls)

        imported_sources.append({
            "href": href,
            "id": cat_uuid,
            "title": cat_title,
            "version": cat_version,
            "type": "profile" if is_profile else "catalog",
            "groups": filtered_groups,
            "controls": filtered_controls,
            "all_groups": raw_cat_groups,
            "all_controls": raw_cat_controls
        })

    # Include in-memory local-controls (for live preview resolution before document save)
    local_controls = profile.get("local-controls", [])
    if local_controls:
        raw_local_controls = copy.deepcopy(local_controls)
        raw_all_controls.extend(copy.deepcopy(raw_local_controls))
        all_controls.extend(raw_local_controls)

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
        "imported_sources": imported_sources,
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

    doc, _ = await get_document("profiles", profile_id, include_draft=False, workspace_id=workspace_id)
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

def _substitute_prose_params(text: str, param_values: Dict[str, List[str]]) -> str:
    """Substitutes parameter placeholders with resolved values in prose."""
    if not text or not isinstance(text, str):
        return text

    def repl_mustache(m):
        pid = m.group(1).strip().lower()
        for k, v in param_values.items():
            if k.lower() == pid and v:
                return ", ".join(str(x) for x in v)
        return m.group(0)

    def repl_xml(m):
        pid = m.group(1).strip().lower()
        for k, v in param_values.items():
            if k.lower() == pid and v:
                return ", ".join(str(x) for x in v)
        return m.group(0)

    res = re.sub(r'\{\{\s*insert:\s*param\s*,\s*([a-zA-Z0-9_\.\-]+)\s*\}\}', repl_mustache, text)
    res = re.sub(r'<insert\s+type=[\'"]param[\'"]\s+id-ref=[\'"]([a-zA-Z0-9_\.\-]+)[\'"]\s*(?:/>|>\s*</insert>)', repl_xml, res)
    return res


def _substitute_parts_prose(parts: List[Dict[str, Any]], param_values: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    if not parts or not isinstance(parts, list):
        return parts
    res = []
    for p in parts:
        new_p = copy.deepcopy(p)
        if "prose" in new_p and isinstance(new_p["prose"], str):
            new_p["prose"] = _substitute_prose_params(new_p["prose"], param_values)
        if "parts" in new_p and isinstance(new_p["parts"], list):
            new_p["parts"] = _substitute_parts_prose(new_p["parts"], param_values)
        res.append(new_p)
    return res


async def _run_ssp_resolution_pipeline(workspace_id: str, ssp: Dict[str, Any]) -> Dict[str, Any]:
    """
    Core SSP resolution pipeline:
    1. Resolves baseline controls from Profile or Catalog (BE-SSP-03)
    2. Computes 4-tier parameter cascade (BE-SSP-04)
    3. Resolves prose parameter placeholders ({{ insert: param, id }})
    4. Annotates implementation statuses and aggregates summary metrics
    """
    profile_href = ssp.get("import-profile", {}).get("href")
    profile_id = _resolve_resource_href(profile_href, ssp) if profile_href else None

    baseline_type = "none"
    baseline_title = "No Baseline"
    raw_controls: List[Dict[str, Any]] = []
    raw_groups: List[Dict[str, Any]] = []
    baseline_params: List[Dict[str, Any]] = []

    if profile_id:
        # Check if profile_id exists as a Profile in current or default workspace
        is_profile = await document_exists("profiles", profile_id, workspace_id=workspace_id)
        if not is_profile and workspace_id and workspace_id != "default":
            is_profile = await document_exists("profiles", profile_id, workspace_id="default")

        if is_profile:
            try:
                resolved_profile = await resolve_profile(workspace_id, profile_id)
                raw_controls = resolved_profile.get("controls", [])
                raw_groups = resolved_profile.get("groups", [])
                baseline_params = resolved_profile.get("parameter_overrides", [])
                baseline_type = "profile"
                baseline_title = resolved_profile.get("source_catalog_title") or "Imported Profile"
            except Exception:
                raw_controls = []
                raw_groups = []
        else:
            # Check if profile_id exists as a Catalog in current or default workspace
            is_catalog = await document_exists("catalogs", profile_id, workspace_id=workspace_id)
            if not is_catalog and workspace_id and workspace_id != "default":
                is_catalog = await document_exists("catalogs", profile_id, workspace_id="default")

            if is_catalog:
                try:
                    cat_doc, _ = await get_document("catalogs", profile_id, include_draft=False, workspace_id=workspace_id)
                    cat = cat_doc.get("catalog", {})
                    cat_meta = cat.get("metadata", {})
                    baseline_title = cat_meta.get("title", "Imported Catalog")
                    baseline_type = "catalog"
                    raw_controls = copy.deepcopy(cat.get("controls", []))
                    raw_groups = copy.deepcopy(cat.get("groups", []))
                    baseline_params = copy.deepcopy(cat.get("params", []))
                    withdrawn_ids = _collect_withdrawn_ids(cat)
                    raw_controls = _filter_controls(raw_controls, True, set(), [], withdrawn_ids, [])
                    raw_groups = _filter_groups(raw_groups, True, set(), [], withdrawn_ids, [])
                except Exception:
                    raw_controls = []
                    raw_groups = []

    # ─────────────────────────────────────────────────────────────────────────────
    # 4-Tier Parameter Cascade Hierarchy:
    # Tier 1: Component Override (by-components[].set-parameters)
    # Tier 2: Control Override (implemented-requirements[].set-parameters)
    # Tier 3: SSP Global Default (control-implementation.set-parameters)
    # Tier 4: Baseline Default (Profile modify.set-parameters / Catalog param.values)
    # ─────────────────────────────────────────────────────────────────────────────

    # Tier 4: Baseline default parameters
    baseline_default_params: Dict[str, Dict[str, Any]] = {}
    for p in baseline_params:
        pid = p.get("param-id") or p.get("id")
        if pid:
            baseline_default_params[pid.lower()] = {
                "param-id": pid,
                "values": p.get("values", []),
                "label": p.get("label"),
                "remarks": p.get("remarks"),
                "origin": "baseline-default"
            }

    def collect_baseline_ctrl_params(ctrls):
        for c in ctrls:
            cid = c.get("id", "").lower()
            for p in c.get("params", []):
                pid = p.get("id") or p.get("param-id")
                if pid and pid.lower() not in baseline_default_params:
                    baseline_default_params[pid.lower()] = {
                        "param-id": pid,
                        "control-id": cid,
                        "values": p.get("values", []),
                        "label": p.get("label"),
                        "remarks": p.get("remarks"),
                        "select": p.get("select"),
                        "origin": "catalog-default"
                    }
            for sub in c.get("controls", []):
                collect_baseline_ctrl_params([sub])

    def collect_baseline_grp_params(grps):
        for g in grps:
            for p in g.get("params", []):
                pid = p.get("id") or p.get("param-id")
                if pid and pid.lower() not in baseline_default_params:
                    baseline_default_params[pid.lower()] = {
                        "param-id": pid,
                        "values": p.get("values", []),
                        "label": p.get("label"),
                        "remarks": p.get("remarks"),
                        "origin": "catalog-default"
                    }
            if g.get("controls"):
                collect_baseline_ctrl_params(g["controls"])
            if g.get("groups"):
                collect_baseline_grp_params(g["groups"])

    collect_baseline_ctrl_params(raw_controls)
    collect_baseline_grp_params(raw_groups)

    # Tier 3: SSP Global set-parameters
    ssp_global_params: Dict[str, Dict[str, Any]] = {}
    control_impl = ssp.get("control-implementation", {})
    for sp in control_impl.get("set-parameters", []):
        pid = sp.get("param-id")
        if pid:
            ssp_global_params[pid.lower()] = {
                "param-id": pid,
                "values": sp.get("values", []),
                "remarks": sp.get("remarks"),
                "origin": "ssp-global"
            }

    # Tier 2 & Tier 1: Control-Level and Component-Level set-parameters
    control_level_params: Dict[str, Dict[str, Dict[str, Any]]] = {}
    component_level_params: Dict[str, Dict[str, Dict[str, Any]]] = {}

    impl_reqs = control_impl.get("implemented-requirements", [])
    impl_map = {req.get("control-id", "").lower(): req for req in impl_reqs if req.get("control-id")}

    for req in impl_reqs:
        cid = req.get("control-id", "").lower()
        if not cid:
            continue

        # Tier 2: Control level set-parameters
        control_level_params[cid] = {}
        for sp in req.get("set-parameters", []):
            pid = sp.get("param-id")
            if pid:
                control_level_params[cid][pid.lower()] = {
                    "param-id": pid,
                    "control-id": cid,
                    "values": sp.get("values", []),
                    "remarks": sp.get("remarks"),
                    "origin": "control-override"
                }

        # Tier 1: Component level set-parameters
        component_level_params[cid] = {}
        for by_comp in req.get("by-components", []):
            comp_uuid = by_comp.get("component-uuid", "").lower()
            for sp in by_comp.get("set-parameters", []):
                pid = sp.get("param-id")
                if pid:
                    component_level_params[cid][f"{comp_uuid}:{pid.lower()}"] = {
                        "param-id": pid,
                        "control-id": cid,
                        "component-uuid": comp_uuid,
                        "values": sp.get("values", []),
                        "remarks": sp.get("remarks"),
                        "origin": "component-override"
                    }

        for stmt in req.get("statements", []):
            stmt_id = stmt.get("statement-id", "").lower()
            for stmt_by_comp in stmt.get("by-components", []):
                comp_uuid = stmt_by_comp.get("component-uuid", "").lower()
                for sp in stmt_by_comp.get("set-parameters", []):
                    pid = sp.get("param-id")
                    if pid:
                        component_level_params[cid][f"{comp_uuid}:{stmt_id}:{pid.lower()}"] = {
                            "param-id": pid,
                            "control-id": cid,
                            "statement-id": stmt_id,
                            "component-uuid": comp_uuid,
                            "values": sp.get("values", []),
                            "remarks": sp.get("remarks"),
                            "origin": "component-override"
                        }

    def resolve_effective_param_for_control(cid: str, param_id: str) -> Dict[str, Any]:
        """Resolves effective parameter value following the 4-tier precedence cascade."""
        pid_l = param_id.lower()
        cid_l = cid.lower()

        # Tier 2: Control level override
        if cid_l in control_level_params and pid_l in control_level_params[cid_l]:
            res = dict(control_level_params[cid_l][pid_l])
            res["effective_values"] = res.get("values", [])
            return res

        # Tier 3: SSP Global default
        if pid_l in ssp_global_params:
            res = dict(ssp_global_params[pid_l])
            res["effective_values"] = res.get("values", [])
            return res

        # Tier 4: Baseline default
        if pid_l in baseline_default_params:
            res = dict(baseline_default_params[pid_l])
            res["effective_values"] = res.get("values", [])
            return res

        return {"param-id": param_id, "values": [], "effective_values": [], "origin": "none"}

    # Aggregate summary metrics
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

            # Build parameter map for this control for prose substitution and annotation
            ctrl_param_map = {}
            resolved_params_list = []

            relevant_pids = set()
            for p in new_c.get("params", []):
                pid = p.get("id") or p.get("param-id")
                if pid:
                    relevant_pids.add(pid)
            if cid in control_level_params:
                for pid_l, p_obj in control_level_params[cid].items():
                    relevant_pids.add(p_obj.get("param-id", pid_l))

            for pid in relevant_pids:
                eff = resolve_effective_param_for_control(cid, pid)
                ctrl_param_map[pid] = eff.get("effective_values", [])
                resolved_params_list.append(eff)

            # Substitute prose placeholders in parts and prose fields
            if "parts" in new_c and isinstance(new_c["parts"], list):
                new_c["parts"] = _substitute_parts_prose(new_c["parts"], ctrl_param_map)
            if "prose" in new_c and isinstance(new_c["prose"], str):
                new_c["prose"] = _substitute_prose_params(new_c["prose"], ctrl_param_map)

            # Enrich control params
            if new_c.get("params"):
                enriched_params = []
                for p in new_c["params"]:
                    new_p = copy.deepcopy(p)
                    pid = new_p.get("id") or new_p.get("param-id")
                    if pid:
                        eff = resolve_effective_param_for_control(cid, pid)
                        if eff.get("effective_values"):
                            new_p["values"] = eff["effective_values"]
                        new_p["origin"] = eff.get("origin")
                    enriched_params.append(new_p)
                new_c["params"] = enriched_params

            new_c["resolved_parameters"] = resolved_params_list

            # Implementation status annotation
            if cid in impl_map:
                req = impl_map[cid]
                raw_state = None
                by_comps = req.get("by-components", [])
                if by_comps:
                    for bc in by_comps:
                        st = bc.get("implementation-status", {}).get("state")
                        if st:
                            raw_state = st
                            break

                if not raw_state:
                    raw_state = req.get("implementation-status", {}).get("state")

                if not raw_state and req.get("props"):
                    for pr in req["props"]:
                        if pr.get("name") in ("implementation-status", "status", "state"):
                            raw_state = pr.get("value")
                            break

                if not raw_state:
                    raw_state = "planned"

                raw_state_l = raw_state.lower().replace("_", "-")
                if raw_state_l == "implemented":
                    summary["implemented"] += 1
                    norm_state = "implemented"
                elif raw_state_l in ("partial", "partially-implemented"):
                    summary["partially_implemented"] += 1
                    norm_state = "partially-implemented"
                elif raw_state_l in ("not-applicable", "notapplicable"):
                    summary["not_applicable"] += 1
                    norm_state = "not-applicable"
                else:
                    summary["planned"] += 1
                    norm_state = "planned"

                new_c["implementation_status"] = norm_state
                new_c["implemented_requirement"] = req
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

    annotated_controls = annotate_controls(raw_controls)
    annotated_groups = annotate_groups(raw_groups)

    return {
        "control_tree": {
            "controls": annotated_controls,
            "groups": annotated_groups
        },
        "implementation_summary": summary,
        "components": ssp.get("system-implementation", {}).get("components", []),
        "users": ssp.get("system-implementation", {}).get("users", []),
        "inventory-items": ssp.get("system-implementation", {}).get("inventory-items", []),
        "roles": ssp.get("metadata", {}).get("roles", []),
        "parties": ssp.get("metadata", {}).get("parties", []),
        "system-characteristics": ssp.get("system-characteristics", {}),
        "parameters": {
            "global": ssp_global_params,
            "control_level": control_level_params,
            "component_level": component_level_params,
            "baseline_defaults": baseline_default_params
        },
        "source_baseline": {
            "href": profile_href,
            "id": profile_id,
            "type": baseline_type,
            "title": baseline_title
        }
    }


async def resolve_ssp(workspace_id: str, ssp_id: str) -> Dict[str, Any]:
    """Resolves an SSP document from disk."""
    try:
        doc, _ = await get_document("ssps", ssp_id, include_draft=False, workspace_id=workspace_id)
    except FileNotFoundError:
        # Fallback to system-security-plans in case document was written with legacy stage name
        doc, _ = await get_document("system-security-plans", ssp_id, include_draft=False, workspace_id=workspace_id)
    ssp = doc.get("system-security-plan", {})
    return await _run_ssp_resolution_pipeline(workspace_id, ssp)


async def resolve_ssp_inline(workspace_id: str, ssp: Dict[str, Any]) -> Dict[str, Any]:
    """
    Resolves an in-memory SSP document for live preview during editing.
    """
    ssp_obj = ssp.get("system-security-plan", ssp) if isinstance(ssp, dict) else {}
    while isinstance(ssp_obj, dict) and "system-security-plan" in ssp_obj and len(ssp_obj) == 1:
        ssp_obj = ssp_obj["system-security-plan"]
    return await _run_ssp_resolution_pipeline(workspace_id, ssp_obj)


async def _run_ap_resolution_pipeline(
    workspace_id: str,
    ap: Dict[str, Any],
    ssp: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Core Assessment Plan resolution pipeline:
    1. Resolves target SSP from workspace or inline document.
    2. Computes 3D scoping matrix (reviewed controls, statements, subjects, assets & platforms).
    3. Resolves local definitions, evaluation methods, and procedural activities.
    4. Computes scheduled task timeline and Gantt model.
    """
    ap_obj = ap.get("assessment-plan", ap) if isinstance(ap, dict) else {}
    while isinstance(ap_obj, dict) and "assessment-plan" in ap_obj and len(ap_obj) == 1:
        ap_obj = ap_obj["assessment-plan"]

    # 1. Target SSP resolution
    import_ssp = ap_obj.get("import-ssp", {}) if isinstance(ap_obj.get("import-ssp"), dict) else {}
    ssp_href = import_ssp.get("href", "")
    ssp_uuid = None
    if ssp_href:
        ssp_uuid = _resolve_resource_href(ssp_href, ap_obj)
        if not ssp_uuid:
            uuid_m = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", ssp_href)
            if uuid_m:
                ssp_uuid = uuid_m.group(1)

    ssp_data = None
    resolved_ssp_data = None

    if ssp:
        ssp_data = ssp.get("system-security-plan", ssp) if isinstance(ssp, dict) else {}
        while isinstance(ssp_data, dict) and "system-security-plan" in ssp_data and len(ssp_data) == 1:
            ssp_data = ssp_data["system-security-plan"]
        resolved_ssp_data = await _run_ssp_resolution_pipeline(workspace_id, ssp_data)
    elif ssp_uuid:
        try:
            ssp_doc, _ = await get_document("ssps", ssp_uuid, include_draft=False, workspace_id=workspace_id)
            ssp_data = ssp_doc.get("system-security-plan", {})
            resolved_ssp_data = await _run_ssp_resolution_pipeline(workspace_id, ssp_data)
        except Exception:
            try:
                ssp_doc, _ = await get_document("system-security-plans", ssp_uuid, include_draft=False, workspace_id=workspace_id)
                ssp_data = ssp_doc.get("system-security-plan", {})
                resolved_ssp_data = await _run_ssp_resolution_pipeline(workspace_id, ssp_data)
            except Exception:
                ssp_data = None
                resolved_ssp_data = None

    system_name = "No Target SSP Linked"
    security_impact_level = {}
    status = {}
    ssp_baseline_href = None
    candidate_controls_map: Dict[str, Dict[str, Any]] = {}
    ssp_components = []
    ssp_inventory = []
    ssp_users = []
    ssp_locations = []

    if ssp_data:
        system_chars = ssp_data.get("system-characteristics", {})
        system_name = system_chars.get("system-name", "Unnamed System")
        security_impact_level = system_chars.get("security-impact-level", {})
        status = system_chars.get("status", {})
        ssp_baseline_href = ssp_data.get("import-profile", {}).get("href")
        ssp_impl_reqs = ssp_data.get("control-implementation", {}).get("implemented-requirements", [])
        for req in ssp_impl_reqs:
            cid = req.get("control-id")
            if cid:
                candidate_controls_map[cid.lower()] = {
                    "control-id": cid,
                    "title": req.get("description") or cid,
                    "by-components": req.get("by-components", []),
                    "statements": req.get("statements", []),
                    "implemented_requirement": req
                }

        if resolved_ssp_data:
            for c in resolved_ssp_data.get("control_tree", {}).get("controls", []):
                cid = c.get("id")
                if cid and cid.lower() not in candidate_controls_map:
                    candidate_controls_map[cid.lower()] = c
            for g in resolved_ssp_data.get("control_tree", {}).get("groups", []):
                for c in g.get("controls", []):
                    cid = c.get("id")
                    if cid and cid.lower() not in candidate_controls_map:
                        candidate_controls_map[cid.lower()] = c

        ssp_components = ssp_data.get("system-implementation", {}).get("components", [])
        ssp_inventory = ssp_data.get("system-implementation", {}).get("inventory-items", [])
        ssp_users = ssp_data.get("system-implementation", {}).get("users", [])
        ssp_locations = ssp_data.get("system-implementation", {}).get("locations", [])

    # 2. Scoping Resolution (Reviewed Controls & Statement Parts)
    reviewed_controls = ap_obj.get("reviewed-controls", {}) if isinstance(ap_obj.get("reviewed-controls"), dict) else {}
    control_selections = reviewed_controls.get("control-selections", [])

    include_all = any("include-all" in cs for cs in control_selections if isinstance(cs, dict))
    included_ctrl_ids: Set[str] = set()
    excluded_ctrl_ids: Set[str] = set()
    statement_ids_map: Dict[str, List[str]] = {}

    for cs in control_selections:
        if not isinstance(cs, dict):
            continue
        for inc in cs.get("include-controls", []):
            if isinstance(inc, dict):
                cid = inc.get("control-id")
                if cid:
                    cid_lower = cid.lower()
                    included_ctrl_ids.add(cid_lower)
                    if "statement-ids" in inc and inc["statement-ids"]:
                        statement_ids_map[cid_lower] = inc["statement-ids"]
        for exc in cs.get("exclude-controls", []):
            if isinstance(exc, dict):
                cid = exc.get("control-id")
                if cid:
                    excluded_ctrl_ids.add(cid.lower())

    if include_all:
        final_in_scope_ids = (set(candidate_controls_map.keys()) | included_ctrl_ids) - excluded_ctrl_ids
    else:
        final_in_scope_ids = included_ctrl_ids - excluded_ctrl_ids

    total_ssp_controls = len(candidate_controls_map)
    in_scope_count = len(final_in_scope_ids)
    matching_ssp_controls_count = len(final_in_scope_ids & set(candidate_controls_map.keys()))
    excluded_count = max(0, total_ssp_controls - matching_ssp_controls_count)
    coverage_pct = round((matching_ssp_controls_count / total_ssp_controls * 100), 1) if total_ssp_controls > 0 else 100.0

    in_scope_controls_details = []
    for cid_l in sorted(final_in_scope_ids):
        candidate = candidate_controls_map.get(cid_l, {})
        cid_orig = candidate.get("control-id") or candidate.get("id") or cid_l
        title = candidate.get("title") or candidate.get("description", "")
        comp_count = len(candidate.get("by-components", [])) if "by-components" in candidate else 0
        in_scope_controls_details.append({
            "control_id": cid_orig,
            "title": title,
            "component_count": comp_count,
            "statement_ids": statement_ids_map.get(cid_l, []),
            "is_custom": cid_l not in candidate_controls_map
        })

    # 3. Assessment Subjects & Local Definitions
    local_defs = ap_obj.get("local-definitions", {}) if isinstance(ap_obj.get("local-definitions"), dict) else {}
    assessment_subjects = ap_obj.get("assessment-subjects", [])
    resolved_subjects_list = []
    placeholders_list = []

    for subj_group in assessment_subjects:
        if not isinstance(subj_group, dict):
            continue
        stype = subj_group.get("type", "component")
        is_inc_all = "include-all" in subj_group
        inc_subjs = subj_group.get("include-subjects", [])
        exc_subjs = {s.get("subject-uuid") for s in subj_group.get("exclude-subjects", []) if isinstance(s, dict) and s.get("subject-uuid")}

        for ph in subj_group.get("assessment-subject-placeholder", []):
            if isinstance(ph, dict):
                placeholders_list.append(ph)

        ssp_entities = []
        if stype == "component":
            ssp_entities = ssp_components
        elif stype == "inventory-item":
            ssp_entities = ssp_inventory
        elif stype == "user":
            ssp_entities = ssp_users
        elif stype == "location":
            ssp_entities = ssp_locations

        if is_inc_all:
            for ent in ssp_entities:
                e_uuid = ent.get("uuid")
                if e_uuid and e_uuid not in exc_subjs:
                    resolved_subjects_list.append({
                        "subject_uuid": e_uuid,
                        "type": stype,
                        "title": ent.get("title") or ent.get("description") or ent.get("name", "Untitled"),
                        "source": "ssp"
                    })
        else:
            for s in inc_subjs:
                if isinstance(s, dict):
                    s_uuid = s.get("subject-uuid")
                    if s_uuid and s_uuid not in exc_subjs:
                        matching_ent = next((e for e in ssp_entities if e.get("uuid") == s_uuid), None)
                        title = "Unknown Subject"
                        source = "ssp"
                        if matching_ent:
                            title = matching_ent.get("title") or matching_ent.get("description") or matching_ent.get("name", "")
                        else:
                            local_list_key = "inventory-items" if stype == "inventory-item" else f"{stype}s"
                            local_entities = local_defs.get(local_list_key, [])
                            loc_match = next((e for e in local_entities if isinstance(e, dict) and e.get("uuid") == s_uuid), None)
                            if loc_match:
                                title = loc_match.get("title") or loc_match.get("description", "")
                                source = "local"
                        resolved_subjects_list.append({
                            "subject_uuid": s_uuid,
                            "type": stype,
                            "title": title,
                            "source": source
                        })

    # 4. Tasks & Scheduled Timeline
    def extract_timeline_tasks(task_list: Any) -> List[Dict[str, Any]]:
        res = []
        if not isinstance(task_list, list):
            return res
        for t in task_list:
            if not isinstance(t, dict):
                continue
            timing = t.get("timing", {}) if isinstance(t.get("timing"), dict) else {}
            on_date = timing.get("on-date", {}).get("date") if "on-date" in timing and isinstance(timing["on-date"], dict) else None
            range_start = timing.get("within-date-range", {}).get("start") if "within-date-range" in timing and isinstance(timing["within-date-range"], dict) else None
            range_end = timing.get("within-date-range", {}).get("end") if "within-date-range" in timing and isinstance(timing["within-date-range"], dict) else None
            freq = timing.get("at-frequency") if "at-frequency" in timing and isinstance(timing["at-frequency"], dict) else None

            start = on_date or range_start
            end = on_date or range_end

            deps = [d.get("task-uuid") for d in t.get("dependencies", []) if isinstance(d, dict) and d.get("task-uuid")]

            res.append({
                "uuid": t.get("uuid"),
                "title": t.get("title", "Untitled Task"),
                "type": t.get("type", "action"),
                "description": t.get("description", ""),
                "timing_type": "on-date" if on_date else ("within-date-range" if range_start else ("at-frequency" if freq else "unscheduled")),
                "start": start,
                "end": end,
                "frequency": freq,
                "dependencies": deps,
                "associated_activities": t.get("associated-activities", []),
                "subjects": t.get("subjects", []),
                "responsible_roles": t.get("responsible-roles", [])
            })
            if "tasks" in t and isinstance(t["tasks"], list):
                res.extend(extract_timeline_tasks(t["tasks"]))
        return res

    resolved_timeline_tasks = extract_timeline_tasks(ap_obj.get("tasks", []))

    return {
        "assessment_plan_uuid": ap_obj.get("uuid"),
        "title": ap_obj.get("metadata", {}).get("title", "Untitled Assessment Plan"),
        "target_ssp": {
            "href": ssp_href,
            "uuid": ssp_uuid,
            "system_name": system_name,
            "security_impact_level": security_impact_level,
            "status": status,
            "baseline_profile": ssp_baseline_href,
            "total_implemented_controls": len(candidate_controls_map),
            "total_components": len(ssp_components)
        },
        "scoping": {
            "total_ssp_controls": total_ssp_controls,
            "in_scope_controls": in_scope_controls_details,
            "in_scope_count": in_scope_count,
            "excluded_count": excluded_count,
            "coverage_percentage": coverage_pct,
            "statement_ids": statement_ids_map,
            "reviewed_controls": reviewed_controls
        },
        "subjects": {
            "resolved_subjects": resolved_subjects_list,
            "placeholders": placeholders_list,
            "ssp_components": ssp_components,
            "ssp_inventory": ssp_inventory,
            "ssp_users": ssp_users,
            "local_components": local_defs.get("components", []),
            "local_inventory": local_defs.get("inventory-items", []),
            "local_users": local_defs.get("users", [])
        },
        "assets_and_platforms": ap_obj.get("assessment-assets", {}),
        "local_definitions": local_defs,
        "tasks": ap_obj.get("tasks", []),
        "timeline": resolved_timeline_tasks,
        "terms_and_conditions": ap_obj.get("terms-and-conditions", {})
    }


async def resolve_assessment_plan(workspace_id: str, ap_id: str) -> Dict[str, Any]:
    """Resolves a saved Assessment Plan document from disk."""
    try:
        doc, _ = await get_document("assessment-plans", ap_id, include_draft=False, workspace_id=workspace_id)
    except FileNotFoundError:
        doc, _ = await get_document("assessment-plan", ap_id, include_draft=False, workspace_id=workspace_id)
    ap = doc.get("assessment-plan", {})
    return await _run_ap_resolution_pipeline(workspace_id, ap)


async def resolve_assessment_plan_inline(
    workspace_id: str,
    ap: Dict[str, Any],
    ssp: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Resolves an in-memory Assessment Plan document for live preview."""
    return await _run_ap_resolution_pipeline(workspace_id, ap, ssp)


preview_ap_resolution = resolve_assessment_plan_inline


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
        doc, _ = await get_document("catalogs", doc_id, include_draft=False, workspace_id=workspace_id)
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
    elif stage in ("ssps", "system-security-plans", "ssp"):
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
    elif stage in ("assessment-plans", "assessment-plan", "ap"):
        resolved = await resolve_assessment_plan(workspace_id, doc_id)
        in_scope = resolved.get("scoping", {}).get("in_scope_controls", [])
        flat = [{
            "id": c.get("control_id"),
            "title": c.get("title", ""),
            "depth": 0,
            "type": "control",
            "is_custom": c.get("is_custom", False),
            "statement_ids": c.get("statement_ids", [])
        } for c in in_scope]
        res = {
            "nodes": flat,
            "groups": [],
            "flat_list": flat,
            "total_controls": len(flat)
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

