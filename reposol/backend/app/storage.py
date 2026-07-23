import os
import json
import re
import copy
import datetime
import uuid
import shutil
from typing import List, Dict, Any, Optional

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = CURRENT_DIR
BACKEND_DIR = os.path.dirname(APP_DIR)
REPOSOL_DIR = os.path.dirname(BACKEND_DIR)
DATA_DIR = os.path.abspath(os.environ.get("REPOSOL_DATA_DIR", os.path.join(REPOSOL_DIR, "data")))
TEMPLATES_DIR = os.path.abspath(os.path.join(DATA_DIR, "templates"))
TEMPLATES_SEED_DIR = os.environ.get("REPOSOL_TEMPLATES_SEED_DIR")

def sync_master_templates():
    """
    Synchronizes pre-baked master templates into DATA_DIR/templates on persistent volumes.
    Copies seed templates from REPOSOL_TEMPLATES_SEED_DIR (or fallback /app/templates_seed)
    to DATA_DIR/templates. Does NOT touch workspaces or user data.
    """
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return

    data_dir = os.path.abspath(os.environ.get("REPOSOL_DATA_DIR", DATA_DIR))
    templates_dir = os.path.abspath(os.path.join(data_dir, "templates"))
    seed_dir = os.environ.get("REPOSOL_TEMPLATES_SEED_DIR", TEMPLATES_SEED_DIR)

    if not seed_dir:
        candidate_docker = "/app/templates_seed"
        candidate_local = os.path.join(REPOSOL_DIR, "data", "templates")
        if os.path.exists(candidate_docker) and os.path.isdir(candidate_docker):
            seed_dir = candidate_docker
        elif os.path.exists(candidate_local) and os.path.isdir(candidate_local):
            seed_dir = candidate_local

    if seed_dir and os.path.exists(seed_dir) and os.path.isdir(seed_dir):
        # Avoid self-copying if seed_dir is identical to templates_dir
        if os.path.realpath(seed_dir) == os.path.realpath(templates_dir):
            return
        os.makedirs(templates_dir, exist_ok=True)
        for root, dirs, files in os.walk(seed_dir):
            rel_path = os.path.relpath(root, seed_dir)
            target_dir = os.path.abspath(os.path.join(templates_dir, rel_path))
            os.makedirs(target_dir, exist_ok=True)
            for file in files:
                if file.endswith(".json"):
                    src_file = os.path.join(root, file)
                    dst_file = os.path.join(target_dir, file)
                    if not os.path.exists(dst_file) or os.path.getmtime(src_file) > os.path.getmtime(dst_file):
                        shutil.copy2(src_file, dst_file)



UUID_PATTERN = re.compile(r"^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$")
UUID_SEARCH_PATTERN = re.compile(r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")
REPOSOL_NAMESPACE = "https://reposol.org/ns"

def is_valid_uuid(uuid_str: str) -> bool:
    """Verifies that uuid_str strictly matches the UUIDv4 format."""
    if not uuid_str or not isinstance(uuid_str, str):
        return False
    return bool(UUID_PATTERN.match(uuid_str.strip()))

def is_safe_subdir(parent_dir: str, child_path: str) -> bool:
    """
    Verifies that child_path is strictly contained within parent_dir,
    properly resolving symbolic links.
    """
    try:
        parent_real = os.path.realpath(parent_dir)
        child_real = os.path.realpath(child_path)
        common = os.path.commonpath([parent_real, child_real])
        return common == parent_real and child_real != parent_real
    except ValueError:
        return False

def _seed_stage_templates(stage_dir: str, stage: str):
    """Seed sample master templates into a workspace stage directory if it's empty (bypassed in Pytest)."""
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return
    templates_dir = os.path.abspath(os.path.join(DATA_DIR, "templates"))
    template_stage_dir = os.path.join(templates_dir, stage)
    if os.path.exists(template_stage_dir) and os.path.isdir(template_stage_dir):
        existing_json = [f for f in os.listdir(stage_dir) if f.endswith(".json")]
        if not existing_json:
            for item in os.listdir(template_stage_dir):
                if item.endswith(".json"):
                    src = os.path.join(template_stage_dir, item)
                    dst = os.path.join(stage_dir, item)
                    if os.path.isfile(src) and not os.path.exists(dst):
                        shutil.copy2(src, dst)

def get_stage_dir(stage: str, workspace_id: Optional[str] = None) -> str:
    """Gets and creates the directory for a stage safely, seeding templates for anonymous session workspaces."""
    if ".." in stage or (workspace_id and ".." in workspace_id):
        raise ValueError("Directory traversal attempt detected via stage path.")

    if workspace_id:
        safe_ws_id = re.sub(r'[^a-zA-Z0-9_-]', '', workspace_id)
        if safe_ws_id in ("master", "templates"):
            stage_dir = os.path.abspath(os.path.join(DATA_DIR, "templates", stage))
            os.makedirs(stage_dir, exist_ok=True)
            return stage_dir

        if safe_ws_id:
            stage_dir = os.path.abspath(os.path.join(DATA_DIR, "workspaces", safe_ws_id, stage))
            is_new = not os.path.exists(stage_dir)
            os.makedirs(stage_dir, exist_ok=True)
            if is_new or not [f for f in os.listdir(stage_dir) if f.endswith(".json")]:
                _seed_stage_templates(stage_dir, stage)
            return stage_dir

    stage_dir = os.path.abspath(os.path.join(DATA_DIR, stage))

    if not is_safe_subdir(DATA_DIR, stage_dir):
        raise ValueError("Directory traversal attempt detected via stage path.")

    os.makedirs(stage_dir, exist_ok=True)
    return stage_dir

def _catalog_uuid_from_href(href: str) -> str | None:
    """Extract a catalog UUID from an OSCAL URI reference used by this workspace."""
    match = UUID_SEARCH_PATTERN.search(href or "")
    return match.group(0).lower() if match else None


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

        from app.validation import validate_document
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
            except Exception:
                pass

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

def postprocess_profile_for_loading(document: Dict[str, Any]) -> Dict[str, Any]:
    """Reconstructs the UI profile format by injecting local controls and defaultStructure properties."""
    document = copy.deepcopy(document)
    if "profile" not in document:
        return document
        
    profile = document["profile"]
    _normalize_replacement_part_ids(profile)
    prune_orphaned_alters(profile)

    
    # 1. Reconstruct local-controls
    imports = profile.get("imports", [])
    local_controls = []
    
    for imp in imports:
        ref_uuid = _catalog_uuid_from_href(imp.get("href", ""))
        if not ref_uuid:
            continue
        catalog_path = os.path.join(get_stage_dir("catalogs"), f"{ref_uuid}.json")
        if os.path.exists(catalog_path):
            try:
                with open(catalog_path, "r", encoding="utf-8") as f:
                    cat_doc = json.load(f)
                    if _is_managed_local_catalog_import(imp):
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
                continue

def _prune_doc_for_listing(doc: Dict[str, Any], stage: str) -> Dict[str, Any]:
    """Returns a lightweight summary of an OSCAL document for list endpoints to prevent multi-megabyte JSON responses."""
    from app.validation import STAGE_ROOT_KEYS
    root_key = STAGE_ROOT_KEYS.get(stage)
    if not root_key or root_key not in doc:
        return doc
    root = doc[root_key]
    summary_root = {
        "uuid": root.get("uuid"),
        "metadata": root.get("metadata", {}),
    }
    for k in ("id", "type", "href", "remarks", "import-profile", "imports"):
        if k in root:
            summary_root[k] = root[k]
    return {root_key: summary_root}

def list_documents(stage: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all saved documents for a specific normalized stage."""
    stage_dir = get_stage_dir(stage, workspace_id)
    seen_ids = set()
    documents = []

    def load_from_dir(target_dir):
        if not os.path.exists(target_dir):
            return
        for filename in os.listdir(target_dir):
            if filename.endswith(".json") and not filename.endswith("_draft.json"):
                doc_id = filename[:-5]
                if not is_valid_uuid(doc_id) or doc_id in seen_ids:
                    continue
                file_path = os.path.join(target_dir, filename)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        doc = json.load(f)
                        if stage == "profiles":
                            doc = postprocess_profile_for_loading(doc)
                        documents.append(_prune_doc_for_listing(doc, stage))
                        seen_ids.add(doc_id)
                except (json.JSONDecodeError, OSError):
                    continue

    load_from_dir(stage_dir)
    return documents

def get_document(stage: str, doc_id: str, *, for_ui: bool = True, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves details of a specific document.
    
    Raises:
        ValueError: If UUID format is invalid.
        FileNotFoundError: If the document does not exist.
    """
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")
        
    stage_dir = get_stage_dir(stage, workspace_id)
    
    # Check if a backend draft file exists and load it instead of the main document
    draft_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    if os.path.isfile(draft_file_path):
        file_path = draft_file_path
    else:
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    # If document is not found in the workspace directory, check root stage directory
    if not os.path.isfile(file_path) and workspace_id:
        root_stage_dir = get_stage_dir(stage, workspace_id=None)
        root_draft = os.path.abspath(os.path.join(root_stage_dir, f"{doc_id}_draft.json"))
        root_main = os.path.abspath(os.path.join(root_stage_dir, f"{doc_id}.json"))
        if os.path.isfile(root_draft):
            file_path = root_draft
            stage_dir = root_stage_dir
        elif os.path.isfile(root_main):
            file_path = root_main
            stage_dir = root_stage_dir
    
    # Security check: ensure path is inside the stage directory
    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")
        
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Document {doc_id} not found in stage {stage}")
        
    with open(file_path, "r", encoding="utf-8") as f:
        doc = json.load(f)
        if stage == "profiles" and for_ui:
            doc = postprocess_profile_for_loading(doc)
        return doc

def save_document(stage: str, doc_id: str, document: Dict[str, Any], workspace_id: Optional[str] = None) -> bool:
    """Saves or updates a document.
    
    Returns:
        bool: True if the document already existed (update), False if it is new (created).
    """
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")
        
    stage_dir = get_stage_dir(stage, workspace_id)
    file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
    
    # Security check: ensure path is inside the stage directory
    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")
        
    existed = os.path.isfile(file_path)
    
    if stage == "profiles":
        document = preprocess_profile_for_saving(document, workspace_id=workspace_id)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)
        
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(document, f, indent=2, ensure_ascii=False)
        
    cleanup_local_catalogs(workspace_id=workspace_id)
    return existed

def delete_document(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a document and all of its saved versions."""
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")
        
    stage_dir = get_stage_dir(stage, workspace_id)
    file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
    
    # Security check: ensure path is inside the stage directory
    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")
        
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Document {doc_id} not found in stage {stage}")
        
    os.remove(file_path)

    # Clean up all version files (doc_id_v*.json)
    import glob
    pattern = os.path.join(stage_dir, f"{doc_id}_v*.json")
    for filepath in glob.glob(pattern):
        if is_safe_subdir(stage_dir, filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass

    cleanup_local_catalogs(workspace_id=workspace_id)


def get_document_versions(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all versions of a document by looking for {doc_id}_v*.json in stage directory."""
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")
    
    from app.validation import STAGE_ROOT_KEYS
    stage_dir = get_stage_dir(stage, workspace_id)
    versions = []
    
    if not os.path.exists(stage_dir):
        return []
        
    # First check for a draft file: {doc_id}_draft.json
    draft_path = os.path.join(stage_dir, f"{doc_id}_draft.json")
    if os.path.isfile(draft_path):
        if is_safe_subdir(stage_dir, draft_path):
            try:
                with open(draft_path, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    root_key = STAGE_ROOT_KEYS[stage]
                    metadata = doc.get(root_key, {}).get("metadata", {})
                    version_str = metadata.get("version", "")
                    last_mod = metadata.get("last-modified", "")
                    title = metadata.get("title", "")
                    
                    # Ensure draft version has -draft suffix
                    if not version_str.endswith("-draft"):
                        version_str = f"{version_str}-draft"
                        
                    versions.append({
                        "version": version_str,
                        "last-modified": last_mod,
                        "title": title,
                        "remarks": "Temporarily saved (Draft)",
                        "is_draft": True,
                        "filename": os.path.basename(draft_path)
                    })
            except Exception:
                pass

    # We look for pattern: doc_id_v*.json
    import glob
    pattern = os.path.join(stage_dir, f"{doc_id}_v*.json")
    for filepath in glob.glob(pattern):
        if not is_safe_subdir(stage_dir, filepath):
            continue
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                doc = json.load(f)
                root_key = STAGE_ROOT_KEYS[stage]
                metadata = doc.get(root_key, {}).get("metadata", {})
                version_str = metadata.get("version", "")
                last_mod = metadata.get("last-modified", "")
                title = metadata.get("title", "")
                
                # Check for remarks in revisions if present
                remarks = "No remarks"
                revisions = metadata.get("revisions", [])
                if revisions and isinstance(revisions, list):
                    for rev in revisions:
                        if rev.get("version") == version_str:
                            remarks = rev.get("remarks", remarks)
                            break
                
                versions.append({
                    "version": version_str,
                    "last-modified": last_mod,
                    "title": title,
                    "remarks": remarks,
                    "filename": os.path.basename(filepath)
                })
        except Exception:
            continue
            
    # Also read the active document to make sure it's included, or to get its details if it has no version files yet
    active_path = os.path.join(stage_dir, f"{doc_id}.json")
    if os.path.isfile(active_path):
        try:
            with open(active_path, "r", encoding="utf-8") as f:
                doc = json.load(f)
                root_key = STAGE_ROOT_KEYS[stage]
                metadata = doc.get(root_key, {}).get("metadata", {})
                active_version = metadata.get("version", "")
                # If this active version is not already in the version list, add it
                if not any(v["version"] == active_version for v in versions):
                    versions.append({
                        "version": active_version,
                        "last-modified": metadata.get("last-modified", ""),
                        "title": metadata.get("title", ""),
                        "remarks": "Active version",
                        "filename": f"{doc_id}.json"
                    })
        except Exception:
            pass

    # Sort versions. We sort by last-modified descending so the newest version is first
    versions.sort(key=lambda x: x["last-modified"], reverse=True)
    return versions


def get_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves a specific version JSON of a document."""
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")
        
    from app.validation import STAGE_ROOT_KEYS
    stage_dir = get_stage_dir(stage, workspace_id)
    
    # If version specifies draft, load draft file
    if version.endswith("-draft") or "draft" in version.lower():
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    else:
        # Safe naming: version should only contain alphanumeric, dots, hyphens to prevent traversal
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v{safe_version}.json"))
    
    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via version name.")
        
    if not os.path.isfile(file_path):
        # Fallback: if they ask for a version and it's the active version, return the active file
        active_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
        if os.path.isfile(active_path):
            with open(active_path, "r", encoding="utf-8") as f:
                doc = json.load(f)
                root_key = STAGE_ROOT_KEYS[stage]
                if doc.get(root_key, {}).get("metadata", {}).get("version") == version:
                    if stage == "profiles":
                        doc = postprocess_profile_for_loading(doc)
                    return doc
        raise FileNotFoundError(f"Version {version} of document {doc_id} not found.")
        
    with open(file_path, "r", encoding="utf-8") as f:
        doc = json.load(f)
        if stage == "profiles":
            doc = postprocess_profile_for_loading(doc)
        return doc


def save_document_version(stage: str, doc_id: str, version: str, document: Dict[str, Any], is_draft: bool = False, workspace_id: Optional[str] = None) -> None:
    """Saves a document version, and also updates the main active file unless it's a draft."""
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")
        
    stage_dir = get_stage_dir(stage, workspace_id)
    
    if is_draft:
        version_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        version_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v{safe_version}.json"))
        active_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
    
    if not is_safe_subdir(stage_dir, version_file_path):
        raise ValueError("Directory traversal attempt detected.")
        
    if stage == "profiles":
        document = preprocess_profile_for_saving(document)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)
        
    # Write version file
    with open(version_file_path, "w", encoding="utf-8") as f:
        json.dump(document, f, indent=2, ensure_ascii=False)
        
    if not is_draft:
        # Write active file (always overwrite active file as well, since this represents the latest updated state)
        if not is_safe_subdir(stage_dir, active_file_path):
            raise ValueError("Directory traversal attempt detected.")
        with open(active_file_path, "w", encoding="utf-8") as f:
            json.dump(document, f, indent=2, ensure_ascii=False)
            
        # Delete draft if we are saving a release version
        draft_path = os.path.join(stage_dir, f"{doc_id}_draft.json")
        if os.path.isfile(draft_path):
            try:
                os.remove(draft_path)
            except Exception:
                pass

    cleanup_local_catalogs(workspace_id=workspace_id)


def delete_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a specific saved version of a document.
    
    Raises:
        ValueError: If UUID format is invalid or version name is unsafe.
        FileNotFoundError: If the version file does not exist.
    """
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")
        
    stage_dir = get_stage_dir(stage, workspace_id)
    if version.endswith("-draft") or "draft" in version.lower():
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v{safe_version}.json"))
    
    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected.")
        
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Version {version} of document {doc_id} not found.")
        
    os.remove(file_path)
    cleanup_local_catalogs(workspace_id=workspace_id)

