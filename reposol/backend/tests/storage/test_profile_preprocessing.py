"""
Profile preprocessing and postprocessing tests covering:
- _normalize_replacement_part_ids: prevents replacement part ID collisions
- defaultStructure mapping from merge.custom to metadata.props and back
- Mutually exclusive merge keys (flat, custom, as-is) preprocessing
- Stripping UI-specific properties (with-child-controls)
"""
import uuid
import pytest
from app.storage import (
    _normalize_replacement_part_ids,
    preprocess_profile_for_saving,
    postprocess_profile_for_loading
)

def test_normalize_replacement_part_ids():
    profile = {
        "modify": {
            "alters": [
                {
                    "control-id": "ac-1",
                    "removes": [{"by-id": "ac-1_smt"}],
                    "adds": [
                        {
                            "position": "starting",
                            "parts": [
                                {"id": "ac-1_smt", "name": "statement", "prose": "New Prose"}
                            ]
                        }
                    ]
                }
            ]
        }
    }
    _normalize_replacement_part_ids(profile)
    # The added part's ID should be normalized to avoid conflict with the removed ID
    assert profile["modify"]["alters"][0]["adds"][0]["parts"][0]["id"] == "ac-1_smt_modified"


def test_default_structure_lifecycle():
    profile_doc = {
        "profile": {
            "uuid": str(uuid.uuid4()),
            "metadata": {
                "title": "Test",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "merge": {
                "custom": {
                    "defaultStructure": "flat"
                }
            }
        }
    }
    # Preprocess
    saved = preprocess_profile_for_saving(profile_doc, persist_local_catalog=False)
    props = saved["profile"]["metadata"]["props"]
    assert any(p["name"] == "default-structure" and p["value"] == "flat" for p in props)
    # Since merge.custom is empty after popping defaultStructure and has no groups,
    # the entire "custom" key is removed from merge, and merge is set to as-is: True
    assert "custom" not in saved["profile"]["merge"]
    
    # Postprocess
    loaded = postprocess_profile_for_loading(saved)
    assert loaded["profile"]["merge"]["custom"]["defaultStructure"] == "flat"


def test_mutually_exclusive_merge_keys():
    # If "flat" is in merge, it should pop "as-is" and "custom"
    profile_doc_flat = {
        "profile": {
            "uuid": str(uuid.uuid4()),
            "merge": {
                "flat": {},
                "as-is": True,
                "custom": {"groups": [{"id": "grp1"}]}
            }
        }
    }
    saved_flat = preprocess_profile_for_saving(profile_doc_flat, persist_local_catalog=False)
    assert "flat" in saved_flat["profile"]["merge"]
    assert "as-is" not in saved_flat["profile"]["merge"]
    assert "custom" not in saved_flat["profile"]["merge"]

    # If "custom" is in merge (and has groups), pop "as-is" and "flat"
    profile_doc_custom = {
        "profile": {
            "uuid": str(uuid.uuid4()),
            "merge": {
                "custom": {"groups": [{"id": "grp1"}]},
                "as-is": True
            }
        }
    }
    saved_custom = preprocess_profile_for_saving(profile_doc_custom, persist_local_catalog=False)
    assert "custom" in saved_custom["profile"]["merge"]
    assert "as-is" not in saved_custom["profile"]["merge"]
    assert "flat" not in saved_custom["profile"]["merge"]

    # If "custom" is empty, pop custom and default to "as-is": True
    profile_doc_custom_empty = {
        "profile": {
            "uuid": str(uuid.uuid4()),
            "merge": {
                "custom": {},
                "as-is": True
            }
        }
    }
    saved_custom_empty = preprocess_profile_for_saving(profile_doc_custom_empty, persist_local_catalog=False)
    assert "as-is" in saved_custom_empty["profile"]["merge"]
    assert "custom" not in saved_custom_empty["profile"]["merge"]
    assert "flat" not in saved_custom_empty["profile"]["merge"]


def test_strip_with_child_controls():
    profile_doc = {
        "profile": {
            "uuid": str(uuid.uuid4()),
            "imports": [
                {
                    "href": "../catalogs/123.json",
                    "with-child-controls": "yes"
                }
            ]
        }
    }
    saved = preprocess_profile_for_saving(profile_doc, persist_local_catalog=False)
    assert "with-child-controls" not in saved["profile"]["imports"][0]
