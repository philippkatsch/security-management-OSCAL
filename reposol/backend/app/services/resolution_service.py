import asyncio
import re
import copy
from typing import Dict, Any, List, Optional
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
            alter = alter_map[cid]
            if "removes" in alter:
                for remove in alter["removes"]:
                    if "by-name" in remove:
                        ctrl["props"] = [p for p in ctrl.get("props", []) if p.get("name") != remove["by-name"]]
                    if "by-id" in remove:
                        ctrl["params"] = [p for p in ctrl.get("params", []) if p.get("id") != remove["by-id"]]
                        ctrl["links"] = [l for l in ctrl.get("links", []) if l.get("href") != remove["by-id"] and l.get("id") != remove["by-id"]]
                        ctrl["controls"] = [c for c in ctrl.get("controls", []) if c.get("id") != remove["by-id"]]
                    if remove.get("by-item-name") == "link":
                        ctrl["links"] = []
                    if remove.get("by-item-name") == "prop":
                        ctrl["props"] = []
                        
            if "adds" in alter:
                for add in alter["adds"]:
                    if "props" in add:
                        props = ctrl.get("props", [])
                        for new_prop in add["props"]:
                            idx = next((i for i, p in enumerate(props) if p.get("name") == new_prop.get("name")), -1)
                            if idx >= 0:
                                props[idx] = new_prop
                            else:
                                props.append(new_prop)
                        ctrl["props"] = props
                    if "params" in add:
                        params = ctrl.get("params", [])
                        for new_param in add["params"]:
                            idx = next((i for i, p in enumerate(params) if p.get("id") == new_param.get("id")), -1)
                            if idx >= 0:
                                params[idx] = new_param
                            else:
                                params.append(new_param)
                        ctrl["params"] = params
                    
        if ctrl.get("controls"):
            for sub in ctrl["controls"]:
                traverse_control(sub)
                
    def traverse_group(group):
        if group.get("params"):
            group["params"] = apply_param_overrides(group["params"])
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
            if "include-all" in d:
                for cid, c in ctrl_map.items():
                    if cid.lower() not in used_ids:
                        res_ctrls.append(copy.deepcopy(c))
                        used_ids.add(cid.lower())
            elif "include-controls" in d:
                for inc in d.get("include-controls", []):
                    for cid in inc.get("with-ids", []):
                        cid_l = cid.lower()
                        if cid_l in ctrl_map and cid_l not in used_ids:
                            res_ctrls.append(copy.deepcopy(ctrl_map[cid_l]))
                            used_ids.add(cid_l)
                    for match in inc.get("matching", []):
                        pat = match.get("pattern")
                        if pat:
                            for cid, c in ctrl_map.items():
                                if cid.lower() not in used_ids and _matches_pattern(cid, [pat]):
                                    res_ctrls.append(copy.deepcopy(c))
                                    used_ids.add(cid.lower())
            elif "exclude-controls" in d:
                for exc in d.get("exclude-controls", []):
                    for cid in exc.get("with-ids", []):
                        used_ids.add(cid.lower())
            
            order = d.get("order", "keep")
            if order == "ascending":
                res_ctrls.sort(key=lambda x: x.get("id", "").lower())
            elif order == "descending":
                res_ctrls.sort(key=lambda x: x.get("id", "").lower(), reverse=True)
                
        return res_ctrls

    def build_group(g):
        new_g = copy.deepcopy(g)
        if "insert-controls" in new_g:
            new_g["controls"] = process_insert(new_g["insert-controls"])
            new_g.pop("insert-controls")
        if "groups" in new_g:
            new_g["groups"] = [build_group(sub_g) for sub_g in new_g["groups"]]
        return new_g

    res_groups = [build_group(g) for g in custom_groups]
    res_controls = process_insert(custom_insert_controls) if custom_insert_controls else []
    
    return res_controls, res_groups

async def resolve_profile(workspace_id: str, profile_id: str, _resolving_stack: set = None) -> Dict[str, Any]:
    if _resolving_stack is None:
        _resolving_stack = set()
    if profile_id in _resolving_stack:
        raise ValueError("Circular profile reference detected")
    _resolving_stack = _resolving_stack | {profile_id}

    doc, _ = await get_document("profiles", profile_id, workspace_id=workspace_id)
    profile = doc.get("profile", {})
    
    all_controls = []
    all_groups = []
    source_catalog_ids = set()
    source_catalog_titles = []
    
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
                    
        filtered_groups = _filter_groups(cat.get("groups", []), include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)
        filtered_controls = _filter_controls(cat.get("controls", []), include_all, included_ids, include_patterns, excluded_ids, exclude_patterns)
        
        all_groups.extend(filtered_groups)
        all_controls.extend(filtered_controls)

    merge = profile.get("merge", {})
    combine_method = merge.get("combine", {}).get("method", "use-first")
    
    if combine_method == "use-first":
        all_controls, all_groups = _deduplicate_use_first(all_controls, all_groups)
        
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
    
    _apply_modify(resolved, profile.get("modify", {}))
    
    return {
        "controls": resolved.get("controls", []),
        "groups": resolved.get("groups", []),
        "source_catalog_id": list(source_catalog_ids)[0] if source_catalog_ids else None,
        "source_catalog_title": ", ".join(source_catalog_titles),
        "parameter_overrides": profile.get("modify", {}).get("set-parameters", []),
        "alterations_applied": len(profile.get("modify", {}).get("alters", []))
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
    res = {}
    def traverse_c(ctrl):
        cid = ctrl.get("id")
        if cid:
            res[cid] = ctrl
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

async def get_profile_baseline_diff(workspace_id: str, profile_id: str, catalog_id: str) -> Dict[str, Any]:
    cat_doc, _ = await get_document("catalogs", catalog_id, workspace_id=workspace_id)
    catalog = cat_doc.get("catalog", {})
    cat_map = _collect_controls_map(catalog.get("controls", []), catalog.get("groups", []))
    
    resolved_profile = await resolve_profile(workspace_id, profile_id)
    prof_map = _collect_controls_map(resolved_profile.get("controls", []), resolved_profile.get("groups", []))
    
    cat_lower_map = {k.lower(): (k, v) for k, v in cat_map.items()}
    prof_lower_map = {k.lower(): (k, v) for k, v in prof_map.items()}
    
    all_keys_lower = []
    seen = set()
    for k in cat_map.keys():
        kl = k.lower()
        if kl not in seen:
            seen.add(kl)
            all_keys_lower.append(kl)
    for k in prof_map.keys():
        kl = k.lower()
        if kl not in seen:
            seen.add(kl)
            all_keys_lower.append(kl)
            
    deltas = []
    added_count = 0
    removed_count = 0
    modified_count = 0
    untouched_count = 0
    
    for kl in all_keys_lower:
        cat_pair = cat_lower_map.get(kl)
        prof_pair = prof_lower_map.get(kl)
        
        orig_id = cat_pair[0] if cat_pair else prof_pair[0]
        cat_ctrl = cat_pair[1] if cat_pair else None
        prof_ctrl = prof_pair[1] if prof_pair else None
        
        if cat_ctrl and prof_ctrl:
            if cat_ctrl == prof_ctrl:
                status = "untouched"
                untouched_count += 1
            else:
                status = "modified"
                modified_count += 1
        elif cat_ctrl and not prof_ctrl:
            status = "removed"
            removed_count += 1
        else:
            status = "added"
            added_count += 1
            
        title = (prof_ctrl or cat_ctrl or {}).get("title", "")
        deltas.append({
            "id": orig_id,
            "status": status,
            "title": title,
            "baseline_control": cat_ctrl,
            "profile_control": prof_ctrl
        })
        
    return {
        "summary": {
            "added_count": added_count,
            "removed_count": removed_count,
            "modified_count": modified_count,
            "untouched_count": untouched_count,
            "total_baseline_controls": len(cat_map)
        },
        "deltas": deltas
    }

