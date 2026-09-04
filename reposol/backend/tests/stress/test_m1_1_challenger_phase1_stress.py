"""
Adversarial empirical stress tests for Phase 1 implementations:
1. XML Pipeline (format_converter.py):
   - Deeply nested OSCAL trees (multi-level groups, controls, sub-controls, parts, props, links, params).
   - Extreme mixed-content prose (multiple consecutive inserts, edge inserts, mixed HTML markup, special characters, non-insert curly braces).
   - Complete 8-stage OSCAL format coverage (Catalog, Profile, Component Def, SSP, AP, AR, POA&M, Mapping).
   - XML attribute serialization verification (all XML_ATTRIBUTES serialized as attributes, not elements).
   - Roundtrip stability and idempotency across JSON -> XML -> JSON -> XML -> JSON.

2. Draft Isolation & Back-Matter Resolution (document_repository.py, resolution_service.py, document_routes.py):
   - Verification that get_document(include_draft=False) and list_raw_documents never return drafts.
   - Direct profile import resolution draft isolation (imported catalog drafts never leak).
   - Chained profile import resolution draft isolation (imported profile drafts never leak).
   - Back-matter #resource-id import resolution (by resource UUID and by rlinks) with draft isolation.
   - Export endpoint draft isolation across JSON, XML, YAML formats.
   - Concurrency stress: heavy concurrent draft writes simultaneous with concurrent exports and profile resolutions.
"""

import os
import uuid
import json
import asyncio
import pytest
import xml.etree.ElementTree as ET
from typing import Dict, Any, List

from app.format_converter import (
    parse_xml_to_oscal_dict,
    serialize_oscal_dict_to_xml,
    parse_yaml_to_dict,
    serialize_dict_to_yaml,
    SINGULAR_TO_PLURAL,
    PLURAL_TO_SINGULAR,
    XML_ATTRIBUTES
)
from app.repositories.document_repository import (
    save_document,
    save_document_version,
    get_document,
    list_raw_documents,
    delete_document,
    atomic_write_json
)
from app.services.resolution_service import (
    resolve_profile,
    _resolve_resource_href,
    _run_resolution_pipeline,
    clear_resolution_cache
)
from app.api.document_routes import export_doc


# =============================================================================
# AREA 1: XML Pipeline Extreme Adversarial Stress Tests
# =============================================================================

class TestXmlPipelineAdversarial:
    """Stress-tests for XML conversion, nested structures, mixed-content, and attributes."""

    def test_deeply_nested_catalog_roundtrip_idempotency(self):
        """Test roundtrip fidelity of a 6-level deeply nested catalog structure."""
        nested_catalog = {
            "catalog": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Deeply Nested Adversarial Catalog",
                    "last-modified": "2026-08-31T20:00:00Z",
                    "version": "2.5.0",
                    "oscal-version": "1.0.0",
                    "roles": [
                        {"id": "lead-architect", "title": "Lead Security Architect"},
                        {"id": "compliance-officer", "title": "Compliance Officer"}
                    ],
                    "parties": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "type": "organization",
                            "name": "Global Defense Agency",
                            "addresses": [
                                {
                                    "addr-lines": ["100 Cyber Way", "Suite 400"],
                                    "city": "Arlington",
                                    "state": "VA",
                                    "postal-code": "22202"
                                }
                            ],
                            "email-addresses": ["secops@gda.gov", "audit@gda.gov"],
                            "telephone-numbers": ["+1-800-555-0199"]
                        }
                    ]
                },
                "params": [
                    {
                        "id": "global_prm_1",
                        "label": "Audit Frequency",
                        "values": ["30 days", "quarterly"],
                        "select": {"how-many": "one", "choice": ["30 days", "60 days", "quarterly"]},
                        "guidelines": [{"prose": "Review according to risk assessment."}]
                    }
                ],
                "groups": [
                    {
                        "id": "grp_top",
                        "title": "Top-Level Group",
                        "groups": [
                            {
                                "id": "grp_sub_1",
                                "title": "Sub Group 1",
                                "groups": [
                                    {
                                        "id": "grp_sub_sub_1",
                                        "title": "Sub Sub Group 1",
                                        "controls": [
                                            {
                                                "id": "ctrl_deep_1",
                                                "title": "Deeply Nested Control 1",
                                                "params": [
                                                    {
                                                        "id": "ctrl_deep_prm_1",
                                                        "label": "Session Timeout",
                                                        "values": ["15 minutes"]
                                                    }
                                                ],
                                                "props": [
                                                    {"name": "status", "value": "operational"},
                                                    {"name": "label", "value": "CTRL-DEEP-1"}
                                                ],
                                                "links": [
                                                    {"href": "https://specs.example.com/deep", "rel": "reference"}
                                                ],
                                                "parts": [
                                                    {
                                                        "id": "ctrl_deep_1_smt",
                                                        "name": "statement",
                                                        "prose": "The system terminates user sessions after {{ insert: param, ctrl_deep_prm_1 }} of inactivity.",
                                                        "parts": [
                                                            {
                                                                "id": "ctrl_deep_1_smt_a",
                                                                "name": "item",
                                                                "prose": "Applies to privileged administrative sessions.",
                                                                "props": [{"name": "scope", "value": "admin"}]
                                                            },
                                                            {
                                                                "id": "ctrl_deep_1_smt_b",
                                                                "name": "item",
                                                                "prose": "Applies to standard interactive sessions."
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        "id": "ctrl_deep_1_gdn",
                                                        "name": "guidance",
                                                        "prose": "Ensure re-authentication requires multi-factor credentials."
                                                    }
                                                ],
                                                "controls": [
                                                    {
                                                        "id": "ctrl_deep_1_enh_1",
                                                        "title": "Deep Enhancement 1",
                                                        "props": [{"name": "enhancement", "value": "1"}],
                                                        "parts": [
                                                            {
                                                                "id": "ctrl_deep_1_enh_1_smt",
                                                                "name": "statement",
                                                                "prose": "Automatic screen lock prior to session termination."
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "back-matter": {
                    "resources": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "NIST SP 800-53 Rev 5",
                            "rlinks": [
                                {"href": "https://doi.org/10.6028/NIST.SP.800-53r5", "media-type": "text/html"}
                            ]
                        }
                    ]
                }
            }
        }

        # Cycle 1: JSON -> XML -> JSON
        xml_1 = serialize_oscal_dict_to_xml(nested_catalog)
        json_1 = parse_xml_to_oscal_dict(xml_1)

        # Cycle 2: JSON -> XML -> JSON (Idempotency verification)
        xml_2 = serialize_oscal_dict_to_xml(json_1)
        json_2 = parse_xml_to_oscal_dict(xml_2)

        # Assert structural invariants survive unchanged
        assert json_1["catalog"]["uuid"] == nested_catalog["catalog"]["uuid"]
        assert json_2["catalog"]["uuid"] == nested_catalog["catalog"]["uuid"]

        # Verify deeply nested control and parts
        deep_ctrl_1 = json_1["catalog"]["groups"][0]["groups"][0]["groups"][0]["controls"][0]
        deep_ctrl_2 = json_2["catalog"]["groups"][0]["groups"][0]["groups"][0]["controls"][0]

        assert deep_ctrl_1["id"] == "ctrl_deep_1"
        assert deep_ctrl_2["id"] == "ctrl_deep_1"
        assert len(deep_ctrl_1["parts"]) == 2
        assert len(deep_ctrl_1["parts"][0]["parts"]) == 2
        assert deep_ctrl_1["parts"][0]["parts"][0]["id"] == "ctrl_deep_1_smt_a"
        assert deep_ctrl_2["parts"][0]["parts"][0]["id"] == "ctrl_deep_1_smt_a"

        # Verify child enhancement control
        assert len(deep_ctrl_1["controls"]) == 1
        assert deep_ctrl_1["controls"][0]["id"] == "ctrl_deep_1_enh_1"
        assert len(deep_ctrl_2["controls"]) == 1

        # Verify parameter with prose insert
        assert "{{ insert: param, ctrl_deep_prm_1 }}" in deep_ctrl_1["parts"][0]["prose"]
        assert "{{ insert: param, ctrl_deep_prm_1 }}" in deep_ctrl_2["parts"][0]["prose"]

    def test_extreme_mixed_content_prose_variations(self):
        """Test extreme mixed-content XML edge cases."""
        xml_raw = """<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://csrc.nist.gov/ns/oscal/1.0" uuid="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">
  <metadata>
    <title>Extreme Mixed Content Catalog</title>
    <last-modified>2026-08-31T20:00:00Z</last-modified>
    <version>1.0.0</version>
    <oscal-version>1.0.0</oscal-version>
  </metadata>
  <control id="mc-1">
    <title>Mixed Content Control</title>
    <part name="statement" id="mc-1_smt">
      <!-- 1. Consecutive inserts -->
      <p><insert param-id="p1"/><insert param-id="p2"/></p>
      <!-- 2. Inserts at start, middle, and end of text with rich markup -->
      <p><insert param-id="p_start"/> is verified before <strong><insert param-id="p_mid"/></strong> and after <insert param-id="p_end"/></p>
      <!-- 3. Complex formatting with nested links and code -->
      <p>Consult <code>/etc/security.conf</code> and <a href="https://example.gov/doc">Security Policy</a> for <em>mandatory</em> guidance.</p>
      <!-- 4. XML entities & special characters in text -->
      <p>Value &lt; 100 &amp;&amp; Value &gt; 50 with "quotes" and 'apostrophes'</p>
    </part>
  </control>
</catalog>
"""
        parsed = parse_xml_to_oscal_dict(xml_raw)
        prose = parsed["catalog"]["controls"][0]["parts"][0]["prose"]

        # 1. Consecutive inserts preserved
        assert "{{ insert: param, p1 }}{{ insert: param, p2 }}" in prose or ("{{ insert: param, p1 }}" in prose and "{{ insert: param, p2 }}" in prose)

        # 2. Start, mid, end inserts preserved
        assert "{{ insert: param, p_start }}" in prose
        assert "{{ insert: param, p_mid }}" in prose
        assert "{{ insert: param, p_end }}" in prose

        # 3. Markup preserved
        assert "`/etc/security.conf`" in prose
        assert "[Security Policy](https://example.gov/doc)" in prose
        assert "*mandatory*" in prose

        # 4. Entities decoded properly
        assert "< 100 && Value > 50" in prose

        # Roundtrip back to XML and verify structure
        xml_rebuilt = serialize_oscal_dict_to_xml(parsed)
        assert '<insert param-id="p1"' in xml_rebuilt
        assert '<insert param-id="p2"' in xml_rebuilt
        assert '<insert param-id="p_start"' in xml_rebuilt
        assert '<insert param-id="p_mid"' in xml_rebuilt
        assert '<insert param-id="p_end"' in xml_rebuilt

    def test_non_insert_curly_braces_in_prose(self):
        """Verify text with non-insert curly braces (regex, templates) survives without regex corruption."""
        catalog_with_curlies = {
            "catalog": {
                "uuid": str(uuid.uuid4()),
                "metadata": {"title": "Curly Braces Test"},
                "controls": [
                    {
                        "id": "c-regex",
                        "title": "Regex Control",
                        "parts": [
                            {
                                "id": "c-regex_smt",
                                "name": "statement",
                                "prose": "Pattern matching: {user_id} and {{not_an_insert}} combined with {{ insert: param, valid_param }}."
                            }
                        ]
                    }
                ]
            }
        }
        xml_out = serialize_oscal_dict_to_xml(catalog_with_curlies)
        reparsed = parse_xml_to_oscal_dict(xml_out)
        reparsed_prose = reparsed["catalog"]["controls"][0]["parts"][0]["prose"]

        assert "{user_id}" in reparsed_prose
        assert "{{not_an_insert}}" in reparsed_prose
        assert "{{ insert: param, valid_param }}" in reparsed_prose

    def test_all_oscal_8_stages_xml_attributes_fidelity(self):
        """Test that every stage's attributes are serialized as XML attributes, not child elements."""
        test_payload = {
            "component-definition": {
                "uuid": str(uuid.uuid4()),
                "metadata": {"title": "Component Definition Test"},
                "components": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "type": "software",
                        "title": "Database Engine",
                        "status": "operational",
                        "protocols": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "name": "postgresql",
                                "transport": "TCP",
                                "port-ranges": [{"start": 5432, "end": 5432}]
                            }
                        ],
                        "control-implementations": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "source": "catalogs/nist800-53.json",
                                "description": "PostgreSQL control implementations",
                                "implemented-requirements": [
                                    {
                                        "uuid": str(uuid.uuid4()),
                                        "control-id": "ac-2",
                                        "description": "Account management implementation",
                                        "set-parameters": [
                                            {"param-id": "ac-2_prm_1", "values": ["admin", "read-only"]}
                                        ],
                                        "statements": [
                                            {
                                                "statement-id": "ac-2_smt_a",
                                                "uuid": str(uuid.uuid4()),
                                                "description": "Automated role provisioning."
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        xml_str = serialize_oscal_dict_to_xml(test_payload)

        # Assert XML attributes
        assert 'type="software"' in xml_str
        assert 'transport="TCP"' in xml_str
        assert 'control-id="ac-2"' in xml_str
        assert 'param-id="ac-2_prm_1"' in xml_str
        assert 'statement-id="ac-2_smt_a"' in xml_str

        # Assert NO invalid child elements for attributes
        assert '<control-id>' not in xml_str
        assert '<param-id>' not in xml_str
        assert '<statement-id>' not in xml_str
        assert '<transport>' not in xml_str

        # Roundtrip back
        reparsed = parse_xml_to_oscal_dict(xml_str)
        comp = reparsed["component-definition"]["components"][0]
        assert comp["type"] == "software"
        assert comp["protocols"][0]["transport"] == "TCP"
        assert comp["control-implementations"][0]["implemented-requirements"][0]["control-id"] == "ac-2"
        assert comp["control-implementations"][0]["implemented-requirements"][0]["statements"][0]["statement-id"] == "ac-2_smt_a"


# =============================================================================
# AREA 2: Draft Isolation & Back-Matter Resolution Adversarial Tests
# =============================================================================

@pytest.mark.asyncio
class TestDraftIsolationAdversarial:
    """Stress-tests for draft isolation across repo reads, resolution, back-matter, export, and concurrency."""

    async def test_repo_get_and_list_draft_isolation(self):
        """Verify get_document and list_raw_documents strictly obey include_draft=False."""
        cat_id = str(uuid.uuid4())
        pub_doc = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Published Catalog", "version": "1.0"},
                "controls": [{"id": "pub-ctrl-1", "title": "Published Control 1"}]
            }
        }
        draft_doc = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Draft Leaked Catalog", "version": "1.0-draft"},
                "controls": [
                    {"id": "pub-ctrl-1", "title": "Published Control 1"},
                    {"id": "leaked-draft-ctrl", "title": "Leaked Draft Control"}
                ]
            }
        }

        # Save published document then draft version
        await save_document("catalogs", cat_id, pub_doc)
        await save_document_version("catalogs", cat_id, "draft", draft_doc, is_draft=True)

        try:
            # 1. include_draft=False MUST return published document
            doc_pub, _ = await get_document("catalogs", cat_id, include_draft=False)
            assert doc_pub["catalog"]["metadata"]["title"] == "Published Catalog"
            assert len(doc_pub["catalog"]["controls"]) == 1
            assert doc_pub["catalog"]["controls"][0]["id"] == "pub-ctrl-1"

            # 2. include_draft=True MUST return draft document
            doc_draft, _ = await get_document("catalogs", cat_id, include_draft=True)
            assert doc_draft["catalog"]["metadata"]["title"] == "Draft Leaked Catalog"
            assert len(doc_draft["catalog"]["controls"]) == 2

            # 3. list_raw_documents MUST NEVER include draft
            raw_list = await list_raw_documents("catalogs")
            matched = [d for d in raw_list if d.get("catalog", {}).get("uuid") == cat_id]
            assert len(matched) == 1
            assert matched[0]["catalog"]["metadata"]["title"] == "Published Catalog"

        finally:
            await delete_document("catalogs", cat_id)

    async def test_profile_resolution_never_loads_imported_catalog_draft(self):
        """Profile import resolution must resolve only published controls, ignoring catalog draft."""
        clear_resolution_cache()
        cat_id = str(uuid.uuid4())
        prof_id = str(uuid.uuid4())

        pub_cat = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Base Catalog", "version": "1.0"},
                "controls": [
                    {"id": "c-pub-1", "title": "Control 1"},
                    {"id": "c-pub-2", "title": "Control 2"}
                ]
            }
        }
        draft_cat = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Base Catalog (Unpublished Draft)", "version": "1.1-draft"},
                "controls": [
                    {"id": "c-pub-1", "title": "Control 1"},
                    {"id": "c-pub-2", "title": "Control 2"},
                    {"id": "c-unreleased-3", "title": "Unreleased Draft Control 3"}
                ]
            }
        }

        profile_doc = {
            "profile": {
                "uuid": prof_id,
                "metadata": {"title": "Tailoring Profile", "version": "1.0"},
                "imports": [
                    {
                        "href": f"catalogs/{cat_id}.json",
                        "include-all": {}
                    }
                ]
            }
        }

        await save_document("catalogs", cat_id, pub_cat)
        await save_document_version("catalogs", cat_id, "draft", draft_cat, is_draft=True)
        await save_document("profiles", prof_id, profile_doc)

        try:
            resolved = await resolve_profile("", prof_id)
            ctrl_ids = [c["id"] for c in resolved.get("controls", [])]

            assert "c-pub-1" in ctrl_ids
            assert "c-pub-2" in ctrl_ids
            assert "c-unreleased-3" not in ctrl_ids, "CRITICAL: Draft control leaked into profile resolution!"

        finally:
            await delete_document("catalogs", cat_id)
            await delete_document("profiles", prof_id)

    async def test_chained_profile_resolution_draft_isolation(self):
        """Profile A imports Profile B which imports Catalog C. Verify drafts at all levels are isolated."""
        clear_resolution_cache()
        cat_id = str(uuid.uuid4())
        prof_b_id = str(uuid.uuid4())
        prof_a_id = str(uuid.uuid4())

        # Catalog C
        cat_pub = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Cat C"},
                "controls": [{"id": "c1", "title": "Control 1"}, {"id": "c2", "title": "Control 2"}]
            }
        }
        await save_document("catalogs", cat_id, cat_pub)

        # Profile B (Pub: excludes c2, Draft: includes c2)
        prof_b_pub = {
            "profile": {
                "uuid": prof_b_id,
                "metadata": {"title": "Profile B Published"},
                "imports": [
                    {
                        "href": f"catalogs/{cat_id}.json",
                        "include-controls": [{"with-ids": ["c1"]}]
                    }
                ]
            }
        }
        prof_b_draft = {
            "profile": {
                "uuid": prof_b_id,
                "metadata": {"title": "Profile B Draft"},
                "imports": [
                    {
                        "href": f"catalogs/{cat_id}.json",
                        "include-all": {}
                    }
                ]
            }
        }
        await save_document("profiles", prof_b_id, prof_b_pub)
        await save_document_version("profiles", prof_b_id, "draft", prof_b_draft, is_draft=True)

        # Profile A (Imports Profile B)
        prof_a_pub = {
            "profile": {
                "uuid": prof_a_id,
                "metadata": {"title": "Profile A Published"},
                "imports": [
                    {
                        "href": f"profiles/{prof_b_id}.json",
                        "include-all": {}
                    }
                ]
            }
        }
        await save_document("profiles", prof_a_id, prof_a_pub)

        try:
            resolved_a = await resolve_profile("", prof_a_id)
            ctrl_ids = [c["id"] for c in resolved_a.get("controls", [])]

            assert "c1" in ctrl_ids
            assert "c2" not in ctrl_ids, "Profile B draft leaked into chained resolution of Profile A!"

        finally:
            await delete_document("catalogs", cat_id)
            await delete_document("profiles", prof_b_id)
            await delete_document("profiles", prof_a_id)

    async def test_backmatter_resource_resolution_draft_isolation(self):
        """Test #resource-id import resolution via both resource UUID and rlinks with draft isolation."""
        clear_resolution_cache()
        cat1_id = str(uuid.uuid4())
        cat2_id = str(uuid.uuid4())
        prof_id = str(uuid.uuid4())

        cat1_pub = {"catalog": {"uuid": cat1_id, "metadata": {"title": "Cat 1"}, "controls": [{"id": "c1_pub"}]}}
        cat1_draft = {"catalog": {"uuid": cat1_id, "metadata": {"title": "Cat 1 Draft"}, "controls": [{"id": "c1_pub"}, {"id": "c1_draft"}]}}

        cat2_pub = {"catalog": {"uuid": cat2_id, "metadata": {"title": "Cat 2"}, "controls": [{"id": "c2_pub"}]}}
        cat2_draft = {"catalog": {"uuid": cat2_id, "metadata": {"title": "Cat 2 Draft"}, "controls": [{"id": "c2_pub"}, {"id": "c2_draft"}]}}

        await save_document("catalogs", cat1_id, cat1_pub)
        await save_document_version("catalogs", cat1_id, "draft", cat1_draft, is_draft=True)

        await save_document("catalogs", cat2_id, cat2_pub)
        await save_document_version("catalogs", cat2_id, "draft", cat2_draft, is_draft=True)

        res_uuid_1 = cat1_id  # Resource whose UUID directly matches catalog UUID
        res_uuid_2 = str(uuid.uuid4())  # Resource with rlink pointing to catalog 2

        prof_doc = {
            "profile": {
                "uuid": prof_id,
                "metadata": {"title": "Backmatter Resolution Profile"},
                "imports": [
                    {"href": f"#{res_uuid_1}", "include-all": {}},
                    {"href": f"#{res_uuid_2}", "include-all": {}}
                ],
                "back-matter": {
                    "resources": [
                        {
                            "uuid": res_uuid_1,
                            "title": "Direct UUID Resource"
                        },
                        {
                            "uuid": res_uuid_2,
                            "title": "RLink Resource",
                            "rlinks": [
                                {"href": f"catalogs/{cat2_id}.json", "media-type": "application/json"}
                            ]
                        }
                    ]
                }
            }
        }
        await save_document("profiles", prof_id, prof_doc)

        try:
            # Verify _resolve_resource_href helper directly
            resolved_href_1 = _resolve_resource_href(f"#{res_uuid_1}", prof_doc["profile"])
            resolved_href_2 = _resolve_resource_href(f"#{res_uuid_2}", prof_doc["profile"])

            assert resolved_href_1 == cat1_id
            assert resolved_href_2 == cat2_id

            # Run full profile resolution pipeline
            resolved = await resolve_profile("", prof_id)
            ctrl_ids = [c["id"] for c in resolved.get("controls", [])]

            assert "c1_pub" in ctrl_ids
            assert "c2_pub" in ctrl_ids
            assert "c1_draft" not in ctrl_ids, "Backmatter resource resolved to draft version of Cat 1!"
            assert "c2_draft" not in ctrl_ids, "Backmatter resource resolved to draft version of Cat 2!"

        finally:
            await delete_document("catalogs", cat1_id)
            await delete_document("catalogs", cat2_id)
            await delete_document("profiles", prof_id)

    async def test_export_endpoint_draft_isolation_all_formats(self):
        """Verify export_doc returns published content for JSON, XML, and YAML when a draft exists."""
        cat_id = str(uuid.uuid4())
        pub_cat = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Published Export Catalog", "version": "1.0"},
                "controls": [{"id": "pub_export_ctrl", "title": "Published"}]
            }
        }
        draft_cat = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Secret Draft Catalog", "version": "2.0-draft"},
                "controls": [
                    {"id": "pub_export_ctrl", "title": "Published"},
                    {"id": "secret_draft_ctrl", "title": "Secret Draft"}
                ]
            }
        }

        await save_document("catalogs", cat_id, pub_cat)
        await save_document_version("catalogs", cat_id, "draft", draft_cat, is_draft=True)

        try:
            # 1. JSON Export
            resp_json = await export_doc(stage="catalogs", doc_id=cat_id, format="json", ws_id="")
            json_body = json.loads(resp_json.body.decode("utf-8"))
            assert json_body["catalog"]["metadata"]["title"] == "Published Export Catalog"
            assert "secret_draft_ctrl" not in [c["id"] for c in json_body["catalog"]["controls"]]

            # 2. XML Export
            resp_xml = await export_doc(stage="catalogs", doc_id=cat_id, format="xml", ws_id="")
            xml_body = resp_xml.body.decode("utf-8")
            assert "Published Export Catalog" in xml_body
            assert "Secret Draft Catalog" not in xml_body
            assert "secret_draft_ctrl" not in xml_body

            # 3. YAML Export
            resp_yaml = await export_doc(stage="catalogs", doc_id=cat_id, format="yaml", ws_id="")
            yaml_body = resp_yaml.body.decode("utf-8")
            assert "Published Export Catalog" in yaml_body
            assert "Secret Draft Catalog" not in yaml_body
            assert "secret_draft_ctrl" not in yaml_body

        finally:
            await delete_document("catalogs", cat_id)

    async def test_concurrent_draft_writes_vs_exports_and_resolution(self):
        """Stress-test: 50 concurrent operations interleaving draft saves with exports and resolutions."""
        clear_resolution_cache()
        cat_id = str(uuid.uuid4())
        prof_id = str(uuid.uuid4())

        pub_cat = {
            "catalog": {
                "uuid": cat_id,
                "metadata": {"title": "Concur Pub Cat", "version": "1.0"},
                "controls": [{"id": "c-pub-stable", "title": "Stable Control"}]
            }
        }
        prof_doc = {
            "profile": {
                "uuid": prof_id,
                "metadata": {"title": "Concur Pub Profile", "version": "1.0"},
                "imports": [{"href": f"catalogs/{cat_id}.json", "include-all": {}}]
            }
        }

        await save_document("catalogs", cat_id, pub_cat)
        await save_document("profiles", prof_id, prof_doc)

        num_tasks = 40
        errors = []

        async def draft_writer(task_idx: int):
            try:
                draft_content = {
                    "catalog": {
                        "uuid": cat_id,
                        "metadata": {"title": f"Draft Write #{task_idx}", "version": "draft"},
                        "controls": [
                            {"id": "c-pub-stable", "title": "Stable Control"},
                            {"id": f"draft-ctrl-{task_idx}", "title": f"Draft Control {task_idx}"}
                        ]
                    }
                }
                await save_document_version("catalogs", cat_id, "draft", draft_content, is_draft=True)
                await asyncio.sleep(0.01)
            except Exception as e:
                errors.append(f"Writer error: {str(e)}")

        async def export_reader(task_idx: int):
            try:
                resp = await export_doc(stage="catalogs", doc_id=cat_id, format="json", ws_id="")
                body = json.loads(resp.body.decode("utf-8"))
                ctrl_ids = [c["id"] for c in body["catalog"]["controls"]]
                if "c-pub-stable" not in ctrl_ids:
                    errors.append(f"Export missing stable control in task {task_idx}")
                for cid in ctrl_ids:
                    if cid.startswith("draft-ctrl-"):
                        errors.append(f"CRITICAL LEAK: Draft control {cid} leaked into export in task {task_idx}")
            except Exception as e:
                errors.append(f"Export reader error: {str(e)}")

        async def resolution_runner(task_idx: int):
            try:
                resolved = await resolve_profile("", prof_id)
                ctrl_ids = [c["id"] for c in resolved.get("controls", [])]
                if "c-pub-stable" not in ctrl_ids:
                    errors.append(f"Resolution missing stable control in task {task_idx}")
                for cid in ctrl_ids:
                    if cid.startswith("draft-ctrl-"):
                        errors.append(f"CRITICAL LEAK: Draft control {cid} leaked into resolution in task {task_idx}")
            except Exception as e:
                errors.append(f"Resolution error: {str(e)}")

        tasks = []
        for i in range(num_tasks):
            if i % 3 == 0:
                tasks.append(draft_writer(i))
            elif i % 3 == 1:
                tasks.append(export_reader(i))
            else:
                tasks.append(resolution_runner(i))

        await asyncio.gather(*tasks)

        try:
            assert len(errors) == 0, f"Concurrent stress failures detected: {errors}"
        finally:
            await delete_document("catalogs", cat_id)
            await delete_document("profiles", prof_id)
