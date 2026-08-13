import copy
from typing import Any, Dict

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
                continue
            elif isinstance(v, str) and not v.strip() and k not in {"title", "uuid", "id"}:
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
