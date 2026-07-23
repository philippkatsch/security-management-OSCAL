"""
Unit tests for UUID utilities in app/storage.py covering:
- is_valid_uuid format checks
- _catalog_uuid_from_href URI extraction
"""
import uuid
import pytest
from app.storage import is_valid_uuid, _catalog_uuid_from_href

def test_is_valid_uuid_true():
    assert is_valid_uuid(str(uuid.uuid4()))
    assert is_valid_uuid("00000000-0000-0000-0000-000000000000")
    assert is_valid_uuid("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")

def test_is_valid_uuid_false():
    assert not is_valid_uuid("not-a-uuid")
    assert not is_valid_uuid("")
    assert not is_valid_uuid("aaaaaaaa-bbbb-cccc-dddd")
    assert not is_valid_uuid("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeeeXXXX")
    assert not is_valid_uuid("aaaaaaaabbbbccccddddeeeeeeeeeeee")

def test_catalog_uuid_from_href():
    valid_uuid = str(uuid.uuid4())
    href_relative = f"../catalogs/{valid_uuid}.json"
    href_api = f"/api/documents/catalogs/{valid_uuid}"
    
    assert _catalog_uuid_from_href(href_relative) == valid_uuid
    assert _catalog_uuid_from_href(href_api) == valid_uuid
    
    # Test case insensitivity or normalization
    upper_uuid = valid_uuid.upper()
    assert _catalog_uuid_from_href(f"../catalogs/{upper_uuid}.json") == valid_uuid.lower()
    
    # Test invalid href
    assert _catalog_uuid_from_href("http://example.com/no-uuid") is None
    assert _catalog_uuid_from_href("") is None
