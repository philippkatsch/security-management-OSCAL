import os
import json
import copy
import uuid
import datetime
import logging
import asyncio
from typing import List, Dict, Any, Optional

from app.repositories.document_repository import is_valid_uuid, _catalog_uuid_from_href
from app.validation import validate_document
from app.utils.oscal_transform_utils import _normalize_replacement_part_ids, remove_empty_arrays
from app.repositories import document_repository

REPOSOL_NAMESPACE = "https://reposol.org/ns"
logger = logging.getLogger(__name__)

async def _is_managed_local_catalog_import(imp: Dict[str, Any], workspace_id: Optional[str] = None) -> bool:
    catalog_uuid = _catalog_uuid_from_href(imp.get("href", ""))
    if not catalog_uuid:
        return False

    try:
        catalog_doc, _ = await document_repository.get_document("catalogs", catalog_uuid, workspace_id=workspace_id)
        catalog = catalog_doc.get("catalog", {})
    except (FileNotFoundError, ValueError):
        return False

    return any(
        prop.get("name") == "type"
        and prop.get("value") == "local-controls"
        and prop.get("ns") == REPOSOL_NAMESPACE
        for prop in catalog.get("metadata", {}).get("props", [])
    )


async def preprocess_profile_for_saving(
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
        version = profile.get("metadata", {}).get("version", "1.0.0")
        local_catalog_uuid = str(uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"reposol-local-controls:{profile_uuid}:{version}",
        ))
        
        new_imports = []
        for imp in profile.get("imports", []):
            if not await _is_managed_local_catalog_import(imp, workspace_id):
                new_imports.append(imp)
                
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

        await validate_document("catalogs", catalog_doc, check_refs=False, workspace_id=workspace_id)

        if persist_local_catalog:
            await document_repository.save_document("catalogs", local_catalog_uuid, catalog_doc, workspace_id=workspace_id)
    else:
        new_imports = []
        for imp in profile.get("imports", []):
            if not await _is_managed_local_catalog_import(imp, workspace_id):
                new_imports.append(imp)
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
            
    await prune_orphaned_alters(profile, workspace_id)
    document = remove_empty_arrays(document)
    return document


async def prune_orphaned_alters(profile: Dict[str, Any], workspace_id: Optional[str] = None) -> None:
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
        if await document_repository.document_exists("profiles", cat_uuid, workspace_id=workspace_id):
            found_any_catalog = True
            try:
                from app.services.resolution_service import resolve_profile
                resolved_prof = await resolve_profile(workspace_id, cat_uuid)
                def collect_ctrls(ctrl_list):
                    for c in ctrl_list:
                        if isinstance(c, dict) and "id" in c:
                            valid_control_ids.add(c["id"].lower())
                            if "controls" in c and isinstance(c["controls"], list):
                                collect_ctrls(c["controls"])

                if "controls" in resolved_prof and isinstance(resolved_prof["controls"], list):
                    collect_ctrls(resolved_prof["controls"])

                def collect_groups(grp_list):
                    for g in grp_list:
                        if isinstance(g, dict):
                            if "controls" in g and isinstance(g["controls"], list):
                                collect_ctrls(g["controls"])
                            if "groups" in g and isinstance(g["groups"], list):
                                collect_groups(g["groups"])

                if "groups" in resolved_prof and isinstance(resolved_prof["groups"], list):
                    collect_groups(resolved_prof["groups"])
            except Exception as e:
                logger.warning("Failed to read profile %s for alter pruning: %s", cat_uuid, str(e))
        elif await document_repository.document_exists("catalogs", cat_uuid, workspace_id=workspace_id):
            found_any_catalog = True
            try:
                cat_doc, _ = await document_repository.get_document("catalogs", cat_uuid, workspace_id=workspace_id)
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
                logger.warning("Failed to read catalog %s for alter pruning: %s", cat_uuid, str(e))

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


async def postprocess_profile_for_loading(document: Dict[str, Any], workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Reconstructs the UI profile format by injecting local controls and defaultStructure properties."""
    document = copy.deepcopy(document)
    if "profile" not in document:
        return document
        
    profile = document["profile"]
    _normalize_replacement_part_ids(profile)
    await prune_orphaned_alters(profile, workspace_id)

    # 1. Reconstruct local-controls
    imports = profile.get("imports", [])
    local_controls = []
    
    for imp in imports:
        ref_uuid = _catalog_uuid_from_href(imp.get("href", ""))
        if not ref_uuid:
            continue
        if await document_repository.document_exists("catalogs", ref_uuid, workspace_id=workspace_id):
            try:
                cat_doc, _ = await document_repository.get_document("catalogs", ref_uuid, workspace_id=workspace_id)
                if await _is_managed_local_catalog_import(imp, workspace_id):
                    local_controls = cat_doc.get("catalog", {}).get("controls", [])
                    break
            except Exception:
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


async def cleanup_local_catalogs(workspace_id: Optional[str] = None) -> None:
    """Deletes local-controls catalogs that are no longer referenced by any profile or profile version."""
    referenced_uuids = set()
    
    profiles = await document_repository.list_documents_by_stage("profiles", workspace_id=workspace_id)
    for doc in profiles:
        if "profile" in doc:
            for imp in doc["profile"].get("imports", []):
                catalog_uuid = _catalog_uuid_from_href(imp.get("href", ""))
                if catalog_uuid:
                    referenced_uuids.add(catalog_uuid)
                    
    catalogs = await document_repository.list_documents_by_stage("catalogs", workspace_id=workspace_id)
    for cat_doc in catalogs:
        if "catalog" in cat_doc:
            cat_meta = cat_doc["catalog"].get("metadata", {})
            is_local = False
            for prop in cat_meta.get("props", []):
                if prop.get("name") == "type" and prop.get("value") == "local-controls":
                    is_local = True
                    break
            
            if is_local:
                doc_uuid = cat_doc["catalog"].get("uuid")
                if doc_uuid and doc_uuid.lower() not in referenced_uuids:
                    try:
                        await document_repository.delete_document("catalogs", doc_uuid, workspace_id=workspace_id)
                    except Exception:
                        logger.warning("Failed to clean up local catalog %s", doc_uuid, exc_info=True)
