import os
import json
import copy
import uuid
import datetime
import logging
from typing import List, Dict, Any, Optional

from app.repositories.workspace_repository import get_stage_dir
from app.repositories.document_repository import is_valid_uuid, _catalog_uuid_from_href
from app.validation import validate_document

REPOSOL_NAMESPACE = "https://reposol.org/ns"
logger = logging.getLogger(__name__)

def _is_managed_local_catalog_import(imp: Dict[str, Any], workspace_id: Optional[str] = None) -> bool:
    catalog_uuid = _catalog_uuid_from_href(imp.get("href", ""))
    if not catalog_uuid:
        return False

    catalog_path = os.path.join(get_stage_dir("catalogs", workspace_id), f"{catalog_uuid}.json")
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog = json.load(f).get("catalog", {})
    except (OSError, json.JSONDecodeError):
        return False

    return any(
        prop.get("name") == "type"
        and prop.get("value") == "local-controls"
        and prop.get("ns") == REPOSOL_NAMESPACE
        for prop in catalog.get("metadata", {}).get("props", [])
    )


def _normalize_replacement_part_ids(profile: Dict[str, Any]) -> None:
    """Give replacement parts a distinct ID so `remove` cannot remove the new part."""
    for alter in profile.get("modify", {}).get("alters", []):
        removed_ids = {
            remove.get("by-id")
            for remove in alter.get("removes", [])
            if remove.get("by-id")
        }
        used_ids = {
            part.get("id")
            for add in alter.get("adds", [])
            for part in add.get("parts", [])
            if part.get("id")
        }
        for add in alter.get("adds", []):
            for part in add.get("parts", []):
                original_id = part.get("id")
                if not original_id or original_id not in removed_ids:
                    continue
                candidate = f"{original_id}_modified"
                suffix = 2
                while candidate in used_ids:
                    candidate = f"{original_id}_modified_{suffix}"
                    suffix += 1
                used_ids.discard(original_id)
                used_ids.add(candidate)
                part["id"] = candidate


def remove_empty_arrays(obj: Any) -> Any:
    """Recursively traverses a JSON-like object and removes any keys that map to empty lists/arrays [] or empty strings."""
    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            if isinstance(v, list) and not v:
                # Omit empty list
                continue
            elif isinstance(v, str) and not v.strip() and k not in {"title", "uuid", "id"}:
                # Omit empty or whitespace-only strings (OSCAL regex validation fails on these, but preserve required fields like title)
                continue
            else:
                cleaned = remove_empty_arrays(v)
                if isinstance(cleaned, list) and not cleaned:
                    continue
                new_dict[k] = cleaned
        return new_dict
    elif isinstance(obj, list):
        cleaned_list = []
        for x in obj:
            if isinstance(x, str) and not x.strip():
                continue
            cleaned_x = remove_empty_arrays(x)
            if isinstance(cleaned_x, (dict, list)) and not cleaned_x:
                continue
            cleaned_list.append(cleaned_x)
        return cleaned_list
    return obj


def preprocess_profile_for_saving(
    document: Dict[str, Any], *, persist_local_catalog: bool = True, workspace_id: Optional[str] = None
) -> Dict[str, Any]:
    """Converts the UI profile format into standard strict OSCAL profile format before saving."""
    document = copy.deepcopy(document)
    if "profile" not in document:
        return document

    profile = document["profile"]
    profile_uuid = profile.get("uuid")
    _normalize_replacement_part_ids(profile)
    
    # 1. Handle local-controls (extract and save as a separate OSCAL Catalog document)
    local_controls = profile.pop("local-controls", None)
    if local_controls:
        # Keep each profile version bound to its own generated source catalog. This
        # preserves historic profile versions while avoiding duplicate imports.
        version = profile.get("metadata", {}).get("version", "1.0.0")
        local_catalog_uuid = str(uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"reposol-local-controls:{profile_uuid}:{version}",
        ))
        new_imports = [
            imp for imp in profile.get("imports", [])
            if not _is_managed_local_catalog_import(imp, workspace_id)
        ]
        new_imports.append({
            "href": f"../catalogs/{local_catalog_uuid}.json",
            "include-all": {}
        })
        profile["imports"] = new_imports

        meta = profile.get("metadata", {})
        current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
        catalog_doc = {
            "catalog": {
                "uuid": local_catalog_uuid,
                "metadata": {
                    "title": f"Local Controls for {meta.get('title', 'Profile')}",
                    "last-modified": current_time,
                    "version": meta.get("version", "1.0.0"),
                    "oscal-version": meta.get("oscal-version", "1.1.2"),
                    "props": [
                        {
                            "name": "type",
                            "value": "local-controls",
                            "ns": REPOSOL_NAMESPACE
                        }
                    ]
                },
                "controls": local_controls
            }
        }

        validate_document("catalogs", catalog_doc, check_refs=False)

        if persist_local_catalog:
            local_catalog_path = os.path.join(get_stage_dir("catalogs", workspace_id), f"{local_catalog_uuid}.json")
            with open(local_catalog_path, "w", encoding="utf-8") as f:
                json.dump(catalog_doc, f, indent=2, ensure_ascii=False)
    else:
        # A UI document without local controls removes only managed local imports.
        new_imports = [
            imp for imp in profile.get("imports", [])
            if not _is_managed_local_catalog_import(imp, workspace_id)
        ]
        profile["imports"] = new_imports
        if not profile["imports"]:
            profile.pop("imports", None)
            
    # Strip UI-specific with-child-controls from imports to prevent validation errors
    if "imports" in profile and isinstance(profile["imports"], list):
        for imp in profile["imports"]:
            if isinstance(imp, dict):
                imp.pop("with-child-controls", None)

    # 2. Extract defaultStructure and custom metadata props
    merge = profile.get("merge", {})
    custom = merge.get("custom", {}) if isinstance(merge, dict) else None
    default_structure = custom.pop("defaultStructure", None) if isinstance(custom, dict) else None
    
    if default_structure:
        if "metadata" not in profile:
            profile["metadata"] = {}
        if "props" not in profile["metadata"]:
            profile["metadata"]["props"] = []
            
        profile["metadata"]["props"] = [
            p for p in profile["metadata"]["props"]
            if not (p.get("name") == "default-structure" and p.get("ns") == REPOSOL_NAMESPACE)
        ]
        profile["metadata"]["props"].append({
            "name": "default-structure",
            "value": default_structure,
            "ns": REPOSOL_NAMESPACE
        })
        
    # 3. Clean up mutually exclusive keys in merge
    if merge and isinstance(merge, dict):
        if "flat" in merge:
            merge.pop("as-is", None)
            merge.pop("custom", None)
        elif "custom" in merge:
            merge.pop("as-is", None)
            merge.pop("flat", None)
            if isinstance(custom, dict) and not custom.get("groups"):
                merge.pop("custom", None)
                merge["as-is"] = True
        else:
            merge["as-is"] = True
            merge.pop("flat", None)
            merge.pop("custom", None)
            
    prune_orphaned_alters(profile, workspace_id)
    document = remove_empty_arrays(document)
    return document


def prune_orphaned_alters(profile: Dict[str, Any], workspace_id: Optional[str] = None) -> None:
    """Removes alters from profile.modify.alters if their control-id is not present in any imported catalog."""
    modify = profile.get("modify")
    if not modify or "alters" not in modify or not isinstance(modify.get("alters"), list):
        return

    imports = profile.get("imports", [])
    if not imports:
        modify.pop("alters", None)
        if not modify:
            profile.pop("modify", None)
        return

    valid_control_ids = set()
    catalogs_dir = get_stage_dir("catalogs", workspace_id)

    # 1. Include local-controls if present
    for ctrl in profile.get("local-controls", []):
        if isinstance(ctrl, dict) and "id" in ctrl:
            valid_control_ids.add(ctrl["id"].lower())

    # 2. Collect controls from all imported catalogs
    found_any_catalog = False
    for imp in imports:
        if not isinstance(imp, dict):
            continue
        href = imp.get("href", "")
        cat_uuid = _catalog_uuid_from_href(href)
        if not cat_uuid:
            continue
        cat_path = os.path.join(catalogs_dir, f"{cat_uuid}.json")
        if os.path.exists(cat_path):
            found_any_catalog = True
            try:
                with open(cat_path, "r", encoding="utf-8") as f:
                    cat_doc = json.load(f)
                    cat_obj = cat_doc.get("catalog", {})

                    def collect_ctrls(ctrl_list):
                        for c in ctrl_list:
                            if isinstance(c, dict) and "id" in c:
                                valid_control_ids.add(c["id"].lower())
                                if "controls" in c and isinstance(c["controls"], list):
                                    collect_ctrls(c["controls"])

                    if "controls" in cat_obj and isinstance(cat_obj["controls"], list):
                        collect_ctrls(cat_obj["controls"])

                    def collect_groups(grp_list):
                        for g in grp_list:
                            if isinstance(g, dict):
                                if "controls" in g and isinstance(g["controls"], list):
                                    collect_ctrls(g["controls"])
                                if "groups" in g and isinstance(g["groups"], list):
                                    collect_groups(g["groups"])

                    if "groups" in cat_obj and isinstance(cat_obj["groups"], list):
                        collect_groups(cat_obj["groups"])
            except Exception as e:
                logger.warning("Failed to read catalog %s for alter pruning: %s", cat_path, str(e))

    if not found_any_catalog and not profile.get("local-controls"):
        # If no imported catalog file exists locally yet, avoid wiping alters prematurely
        return

    new_alters = [
        alt for alt in modify["alters"]
        if isinstance(alt, dict) and alt.get("control-id") and alt.get("control-id").lower() in valid_control_ids
    ]

    if new_alters:
        modify["alters"] = new_alters
    else:
        modify.pop("alters", None)
        if not modify:
            profile.pop("modify", None)


def preprocess_catalog_for_saving(document: Dict[str, Any]) -> Dict[str, Any]:
    """Preprocesses a catalog document before saving, removing empty arrays."""
    document = copy.deepcopy(document)
    if "catalog" in document:
        document = remove_empty_arrays(document)
    return document


def postprocess_profile_for_loading(document: Dict[str, Any], workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Reconstructs the UI profile format by injecting local controls and defaultStructure properties."""
    document = copy.deepcopy(document)
    if "profile" not in document:
        return document
        
    profile = document["profile"]
    _normalize_replacement_part_ids(profile)
    prune_orphaned_alters(profile, workspace_id)

    # 1. Reconstruct local-controls
    imports = profile.get("imports", [])
    local_controls = []
    
    for imp in imports:
        ref_uuid = _catalog_uuid_from_href(imp.get("href", ""))
        if not ref_uuid:
            continue
        catalog_path = os.path.join(get_stage_dir("catalogs", workspace_id), f"{ref_uuid}.json")
        if os.path.exists(catalog_path):
            try:
                with open(catalog_path, "r", encoding="utf-8") as f:
                    cat_doc = json.load(f)
                    if _is_managed_local_catalog_import(imp, workspace_id):
                        local_controls = cat_doc["catalog"].get("controls", [])
                        break
            except (OSError, json.JSONDecodeError, KeyError):
                pass
                    
    if local_controls:
        profile["local-controls"] = local_controls
        
    # 2. Reconstruct defaultStructure inside merge.custom
    props = profile.get("metadata", {}).get("props", [])
    default_structure = None
    for prop in props:
        if prop.get("name") == "default-structure" and prop.get("ns") == REPOSOL_NAMESPACE:
            default_structure = prop.get("value")
            break
            
    if default_structure:
        if "merge" not in profile:
            profile["merge"] = {}
        if "custom" not in profile["merge"] or not isinstance(profile["merge"]["custom"], dict):
            profile["merge"]["custom"] = {}
        profile["merge"]["custom"]["defaultStructure"] = default_structure
        
    return document


def cleanup_local_catalogs(workspace_id: Optional[str] = None) -> None:
    """Deletes local-controls catalogs that are no longer referenced by any profile or profile version."""
    catalogs_dir = get_stage_dir("catalogs", workspace_id)
    profiles_dir = get_stage_dir("profiles", workspace_id)
    
    if not os.path.exists(catalogs_dir) or not os.path.exists(profiles_dir):
        return
        
    referenced_uuids = set()
    
    # Collect referenced UUIDs from active profiles and version profiles
    for filename in os.listdir(profiles_dir):
        if filename.endswith(".json"):
            file_path = os.path.join(profiles_dir, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    if "profile" in doc:
                        for imp in doc["profile"].get("imports", []):
                            catalog_uuid = _catalog_uuid_from_href(imp.get("href", ""))
                            if catalog_uuid:
                                referenced_uuids.add(catalog_uuid)
            except Exception:
                logger.warning("Failed to read profile %s during local catalog cleanup", file_path, exc_info=True)
                continue
                
    # Scan and delete unreferenced local-controls catalogs
    for filename in os.listdir(catalogs_dir):
        if filename.endswith(".json"):
            doc_id = filename[:-5]
            if not is_valid_uuid(doc_id):
                continue
            if doc_id.lower() in referenced_uuids:
                continue
                
            file_path = os.path.join(catalogs_dir, filename)
            try:
                is_local = False
                with open(file_path, "r", encoding="utf-8") as f:
                    cat_doc = json.load(f)
                    if "catalog" in cat_doc:
                        cat_meta = cat_doc["catalog"].get("metadata", {})
                        for prop in cat_meta.get("props", []):
                            if prop.get("name") == "type" and prop.get("value") == "local-controls":
                                is_local = True
                                break
                if is_local:
                    os.remove(file_path)
            except Exception:
                logger.warning("Failed to clean up local catalog %s", file_path, exc_info=True)
                continue
