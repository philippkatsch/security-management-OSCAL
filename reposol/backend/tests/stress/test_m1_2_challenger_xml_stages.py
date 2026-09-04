"""
Adversarial Stress Test Suite for XML Serialization across ALL 8 OSCAL Stages (Challenger M1_2).

Stages covered:
1. Catalog (catalog)
2. Profile (profile)
3. Component Definition (component-definition)
4. System Security Plan (system-security-plan)
5. Assessment Plan (assessment-plan)
6. Assessment Results (assessment-results)
7. Plan of Action and Milestones (plan-of-action-and-milestones)
8. Mapping Collection (mapping-collection)
"""
import pytest
from app.format_converter import (
    parse_xml_to_oscal_dict,
    serialize_oscal_dict_to_xml,
    SINGULAR_TO_PLURAL,
    PLURAL_TO_SINGULAR,
    XML_ATTRIBUTES
)


class TestAdversarialXMLAllStages:
    """Empirical verification of XML conversion across all 8 OSCAL stages."""

    def test_stage_1_catalog_complex_xml_roundtrip(self):
        """Test Catalog model with groups, controls, parameters, parts, and mixed prose."""
        catalog_dict = {
            "catalog": {
                "uuid": "11111111-1111-1111-1111-111111111111",
                "metadata": {
                    "title": "Stage 1 Catalog",
                    "last-modified": "2026-08-31T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.0.0",
                    "revisions": [
                        {"title": "Initial Draft", "version": "0.1"}
                    ],
                    "roles": [
                        {"id": "author", "title": "Author"}
                    ],
                    "parties": [
                        {"uuid": "22222222-2222-2222-2222-222222222222", "type": "person", "name": "Alice"}
                    ]
                },
                "params": [
                    {
                        "id": "global_prm_1",
                        "values": ["30"],
                        "select": {"how-many": "one", "choice": ["15", "30", "60"]}
                    }
                ],
                "groups": [
                    {
                        "id": "grp-ac",
                        "title": "Access Control",
                        "controls": [
                            {
                                "id": "ac-1",
                                "title": "Access Control Policy",
                                "params": [
                                    {"id": "ac-1_prm_1", "values": ["annual"]}
                                ],
                                "props": [
                                    {"name": "status", "value": "operational"}
                                ],
                                "links": [
                                    {"href": "https://standards.org/ac-1", "rel": "reference"}
                                ],
                                "parts": [
                                    {
                                        "id": "ac-1_smt",
                                        "name": "statement",
                                        "prose": "The organization develops policy every {{ insert: param, ac-1_prm_1 }}."
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "back-matter": {
                    "resources": [
                        {
                            "uuid": "33333333-3333-3333-3333-333333333333",
                            "title": "Reference Guide",
                            "rlinks": [{"href": "https://example.com/guide.pdf"}]
                        }
                    ]
                }
            }
        }

        xml_str = serialize_oscal_dict_to_xml(catalog_dict)
        assert "<catalog " in xml_str
        assert 'id="ac-1"' in xml_str
        assert '<insert param-id="ac-1_prm_1"' in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        cat = parsed["catalog"]
        assert cat["uuid"] == "11111111-1111-1111-1111-111111111111"
        assert len(cat["groups"]) == 1
        assert cat["groups"][0]["controls"][0]["id"] == "ac-1"
        assert "{{ insert: param, ac-1_prm_1 }}" in cat["groups"][0]["controls"][0]["parts"][0]["prose"]

    def test_stage_2_profile_alters_and_set_params(self):
        """Test Profile model with set-parameters, alters (adds/removes), and imports."""
        profile_dict = {
            "profile": {
                "uuid": "44444444-4444-4444-4444-444444444444",
                "metadata": {"title": "Stage 2 Profile"},
                "imports": [
                    {
                        "href": "../catalogs/11111111-1111-1111-1111-111111111111.json",
                        "include-controls": [{"with-ids": ["ac-1", "ac-2"]}]
                    }
                ],
                "modify": {
                    "set-parameters": [
                        {"param-id": "ac-1_prm_1", "values": ["semi-annually"]}
                    ],
                    "alters": [
                        {
                            "control-id": "ac-1",
                            "adds": [
                                {"position": "ending", "by-id": "ac-1_smt", "props": [{"name": "reviewed", "value": "true"}]}
                            ],
                            "removes": [
                                {"by-name": "legacy-prop"}
                            ]
                        }
                    ]
                }
            }
        }

        xml_str = serialize_oscal_dict_to_xml(profile_dict)
        assert 'control-id="ac-1"' in xml_str
        assert 'param-id="ac-1_prm_1"' in xml_str
        assert 'by-id="ac-1_smt"' in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        prof = parsed["profile"]
        assert len(prof["imports"]) == 1
        assert len(prof["modify"]["set-parameters"]) == 1
        assert prof["modify"]["set-parameters"][0]["param-id"] == "ac-1_prm_1"
        assert len(prof["modify"]["alters"]) == 1
        assert prof["modify"]["alters"][0]["control-id"] == "ac-1"

    def test_stage_3_component_definition(self):
        """Test Component Definition with defined-components, capabilities, control-implementations, protocols."""
        comp_dict = {
            "component-definition": {
                "uuid": "55555555-5555-5555-5555-555555555555",
                "metadata": {"title": "Stage 3 Component Definition"},
                "components": [
                    {
                        "uuid": "66666666-6666-6666-6666-666666666666",
                        "type": "software",
                        "title": "PostgreSQL Database Engine",
                        "description": "Relational database server",
                        "protocols": [
                            {"name": "postgres", "title": "PostgreSQL Protocol", "port-ranges": [{"start": 5432, "end": 5432, "transport": "tcp"}]}
                        ],
                        "control-implementations": [
                            {
                                "uuid": "77777777-7777-7777-7777-777777777777",
                                "source": "https://example.com/catalog.json",
                                "description": "DB Access controls",
                                "implemented-requirements": [
                                    {
                                        "uuid": "88888888-8888-8888-8888-888888888888",
                                        "control-id": "ac-1",
                                        "description": "Implements DB authentication",
                                        "statements": [
                                            {
                                                "statement-id": "ac-1_smt.a",
                                                "uuid": "99999999-9999-9999-9999-999999999999",
                                                "description": "Statement narrative"
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

        xml_str = serialize_oscal_dict_to_xml(comp_dict)
        assert "<component-definition " in xml_str
        assert 'transport="tcp"' in xml_str
        assert 'statement-id="ac-1_smt.a"' in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        comp_def = parsed["component-definition"]
        assert len(comp_def["components"]) == 1
        comp = comp_def["components"][0]
        assert comp["type"] == "software"
        assert len(comp["protocols"]) == 1
        assert comp["protocols"][0]["port-ranges"][0]["transport"] == "tcp"
        assert len(comp["control-implementations"][0]["implemented-requirements"][0]["statements"]) == 1

    def test_stage_4_system_security_plan_ssp_structural_parsing(self):
        """Test System Security Plan (SSP) with system-characteristics, users, inventory-items, and control-implementation."""
        ssp_dict = {
            "system-security-plan": {
                "uuid": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "metadata": {"title": "Stage 4 System Security Plan"},
                "import-profile": {"href": "../profiles/prod-profile.json"},
                "system-characteristics": {
                    "system-name": "Production Enterprise Cloud",
                    "system-ids": [{"id": "sys-01"}],
                    "security-sensitivity-level": "moderate",
                    "status": {"state": "operational"}
                },
                "system-implementation": {
                    "users": [
                        {"uuid": "cccccccc-cccc-cccc-cccc-cccccccccccc", "title": "Admin User", "role-ids": ["admin"]}
                    ],
                    "components": [
                        {
                            "uuid": "dddddddd-dddd-dddd-dddd-dddddddddddd",
                            "type": "service",
                            "title": "Web Service",
                            "status": {"state": "operational"}
                        }
                    ],
                    "inventory-items": [
                        {
                            "uuid": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
                            "description": "Primary Web Server Node",
                            "implemented-components": [{"component-uuid": "dddddddd-dddd-dddd-dddd-dddddddddddd"}]
                        }
                    ]
                }
            }
        }

        xml_str = serialize_oscal_dict_to_xml(ssp_dict)
        assert "<system-security-plan " in xml_str
        assert 'component-uuid="dddddddd-dddd-dddd-dddd-dddddddddddd"' in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        ssp = parsed["system-security-plan"]
        assert ssp["system-characteristics"]["system-name"] == "Production Enterprise Cloud"
        assert len(ssp["system-implementation"]["users"]) == 1
        assert len(ssp["system-implementation"]["inventory-items"]) == 1

    def test_stage_5_assessment_plan(self):
        """Test Assessment Plan model with tasks, activities, subjects, and attestations."""
        ap_dict = {
            "assessment-plan": {
                "uuid": "12121212-1212-1212-1212-121212121212",
                "metadata": {"title": "Stage 5 Assessment Plan"},
                "import-ssp": {"href": "../ssp/system-ssp.json"},
                "tasks": [
                    {
                        "uuid": "23232323-2323-2323-2323-232323232323",
                        "type": "assessment",
                        "title": "Access Control Audit Task",
                        "activities": [
                            {"uuid": "34343434-3434-3434-3434-343434343434", "title": "Inspect RBAC configs"}
                        ],
                        "subjects": [
                            {"type": "component", "subject-uuid": "dddddddd-dddd-dddd-dddd-dddddddddddd"}
                        ]
                    }
                ]
            }
        }

        xml_str = serialize_oscal_dict_to_xml(ap_dict)
        assert "<assessment-plan " in xml_str
        assert 'subject-uuid="dddddddd-dddd-dddd-dddd-dddddddddddd"' in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        ap = parsed["assessment-plan"]
        assert len(ap["tasks"]) == 1
        assert len(ap["tasks"][0]["activities"]) == 1
        assert len(ap["tasks"][0]["subjects"]) == 1

    def test_stage_6_assessment_results(self):
        """Test Assessment Results with observations, risks, and findings."""
        ar_dict = {
            "assessment-results": {
                "uuid": "45454545-4545-4545-4545-454545454545",
                "metadata": {"title": "Stage 6 Assessment Results"},
                "import-ap": {"href": "../ap/plan.json"},
                "results": [
                    {
                        "uuid": "56565656-5656-5656-5656-565656565656",
                        "title": "Audit Run 1",
                        "start": "2026-08-31T09:00:00Z",
                        "observations": [
                            {
                                "uuid": "67676767-6767-6767-6767-676767676767",
                                "description": "Observed missing MFA for SSH",
                                "methods": ["examine", "test"]
                            }
                        ],
                        "risks": [
                            {
                                "uuid": "78787878-7878-7878-7878-787878787878",
                                "title": "Unauthorized SSH Access",
                                "characterizations": [{"facet": "likelihood", "value": "high"}]
                            }
                        ],
                        "findings": [
                            {
                                "uuid": "89898989-8989-8989-8989-898989898989",
                                "title": "IA-2 Non-compliance",
                                "target": {"target-id": "ia-2", "status": {"state": "not-satisfied"}},
                                "related-observations": [{"observation-uuid": "67676767-6767-6767-6767-676767676767"}],
                                "associated-risks": [{"risk-uuid": "78787878-7878-7878-7878-787878787878"}]
                            }
                        ]
                    }
                ]
            }
        }

        xml_str = serialize_oscal_dict_to_xml(ar_dict)
        assert "<assessment-results " in xml_str
        assert 'observation-uuid="67676767-6767-6767-6767-676767676767"' in xml_str
        assert 'risk-uuid="78787878-7878-7878-7878-787878787878"' in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        ar = parsed["assessment-results"]
        assert len(ar["results"]) == 1
        res = ar["results"][0]
        assert len(res["observations"]) == 1
        assert len(res["risks"]) == 1
        assert len(res["findings"]) == 1
        assert res["findings"][0]["related-observations"][0]["observation-uuid"] == "67676767-6767-6767-6767-676767676767"

    def test_stage_7_plan_of_action_and_milestones_poam(self):
        """Test POA&M model with poam-items, milestones, and responses."""
        poam_dict = {
            "plan-of-action-and-milestones": {
                "uuid": "90909090-9090-9090-9090-909090909090",
                "metadata": {"title": "Stage 7 POA&M"},
                "import-ssp": {"href": "../ssp/system-ssp.json"},
                "poam-items": [
                    {
                        "uuid": "01010101-0101-0101-0101-010101010101",
                        "title": "Remediate SSH MFA Requirement",
                        "description": "Deploy MFA plugin across all Linux nodes",
                        "milestones": [
                            {"uuid": "02020202-0202-0202-0202-020202020202", "title": "Procure hardware tokens"},
                            {"uuid": "03030303-0303-0303-0303-030303030303", "title": "Configure PAM modules"}
                        ],
                        "responses": [
                            {"uuid": "04040404-0404-0404-0404-040404040404", "title": "MFA rollout response"}
                        ]
                    }
                ]
            }
        }

        xml_str = serialize_oscal_dict_to_xml(poam_dict)
        assert "<plan-of-action-and-milestones " in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        poam = parsed["plan-of-action-and-milestones"]
        assert len(poam["poam-items"]) == 1
        assert len(poam["poam-items"][0]["milestones"]) == 2
        assert len(poam["poam-items"][0]["responses"]) == 1

    def test_stage_8_mapping_collection(self):
        """Test Mapping Collection model with maps, mappings, sources, and targets."""
        mapping_dict = {
            "mapping-collection": {
                "uuid": "abcdef12-3456-7890-abcd-ef1234567890",
                "metadata": {"title": "Stage 8 Mapping Collection (NIST 800-53 to ISO 27001)"},
                "maps": [
                    {
                        "uuid": "fedcba98-7654-3210-fedc-ba9876543210",
                        "title": "NIST to ISO Mapping",
                        "mappings": [
                            {
                                "sources": [{"id": "ac-1"}],
                                "targets": [{"id": "A.5.1"}],
                                "props": [{"name": "relationship", "value": "equivalent"}]
                            }
                        ]
                    }
                ]
            }
        }

        xml_str = serialize_oscal_dict_to_xml(mapping_dict)
        assert "<mapping-collection " in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        mc = parsed["mapping-collection"]
        assert len(mc["maps"]) == 1
        assert len(mc["maps"][0]["mappings"]) == 1
        assert mc["maps"][0]["mappings"][0]["sources"][0]["id"] == "ac-1"
        assert mc["maps"][0]["mappings"][0]["targets"][0]["id"] == "A.5.1"
