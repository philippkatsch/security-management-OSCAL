import os
import sys
import shutil
import uuid

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
sys.path.insert(0, os.path.dirname(__file__))

from app.storage import get_stage_dir, save_document, DATA_DIR
from app.routes import STAGE_MAPPING, normalize_stage
from app.validation import STAGE_ROOT_KEYS

def run_path_traversal_check():
    print("Running Path Traversal Check...")
    stage_bypass = "..\\data_extra"
    doc_id = str(uuid.uuid4())
    
    valid_doc = {
        "catalog": {
            "uuid": doc_id,
            "metadata": {
                "title": "Bypass Test",
                "last-modified": "2026-06-24T18:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2"
            }
        }
    }
    
    parent_dir = os.path.dirname(DATA_DIR)
    bypass_dir = os.path.abspath(os.path.join(parent_dir, "data_extra"))
    bypass_file = os.path.join(bypass_dir, f"{doc_id}.json")
    
    if os.path.exists(bypass_dir):
        shutil.rmtree(bypass_dir)
        
    try:
        save_document(stage_bypass, doc_id, valid_doc)
        if os.path.exists(bypass_file):
            print(f"  [FAIL] VULNERABILITY CONFIRMED: Path traversal allowed writing outside DATA_DIR to {bypass_file}")
            print(f"         Reason: 'data_extra'.startswith('data') is True. The check is bypassed.")
            return False
        else:
            print("  [PASS] Path traversal check did not write the file.")
            return True
    except ValueError as e:
        print(f"  [PASS] Path traversal attempt blocked correctly with ValueError: {e}")
        return True
    except Exception as e:
        print(f"  [FAIL] Unexpected error: {e}")
        return False
    finally:
        if os.path.exists(bypass_dir):
            shutil.rmtree(bypass_dir)

def run_route_stage_check():
    print("Running Route Stage Validation Check...")
    test_inputs = [
        ("catalogs", True),
        ("catalog", True),
        ("..\\data_extra", False),
        ("profiles/../catalogs", False),
        ("invalid_stage", False)
    ]
    
    all_passed = True
    for stage, should_succeed in test_inputs:
        try:
            normalized = normalize_stage(stage)
            if should_succeed:
                print(f"  [PASS] Stage '{stage}' normalized to '{normalized}' as expected.")
            else:
                print(f"  [FAIL] Stage '{stage}' normalized to '{normalized}' but should have been blocked.")
                all_passed = False
        except Exception as e:
            if not should_succeed:
                print(f"  [PASS] Invalid stage '{stage}' correctly blocked: {e}")
            else:
                print(f"  [FAIL] Valid stage '{stage}' blocked unexpectedly: {e}")
                all_passed = False
    return all_passed

if __name__ == "__main__":
    print("==================================================")
    print("Reposol Backend Security & Correctness Check")
    print("==================================================")
    
    traversal_ok = run_path_traversal_check()
    routes_ok = run_route_stage_check()
    
    print("==================================================")
    print("Summary:")
    print(f"Path Traversal: {'SAFE' if traversal_ok else 'VULNERABLE'}")
    print(f"API Routes Stage Validation: {'SAFE' if routes_ok else 'VULNERABLE'}")
    print("==================================================")
    if not traversal_ok or not routes_ok:
        sys.exit(1)
    sys.exit(0)
