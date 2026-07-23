"""
Shared test factories for generating valid OSCAL documents.

Usage:
    from tests.factories import CatalogFactory, ProfileFactory

    catalog = CatalogFactory.build(title="My Catalog")
    catalog_with_groups = CatalogFactory.with_groups()
    catalog_with_controls = CatalogFactory.with_controls()
    profile = ProfileFactory.build(title="My Profile")
    profile_importing = ProfileFactory.importing(catalog_uuid="...")
"""
import uuid
from typing import Any, Dict, List, Optional


def generate_uuid() -> str:
    """Generates a valid UUIDv4 string."""
    return str(uuid.uuid4())


class CatalogFactory:
    """Factory for generating valid OSCAL Catalog documents."""

    @staticmethod
    def build(
        *,
        doc_id: Optional[str] = None,
        title: str = "Test Catalog",
        version: str = "1.0.0",
        oscal_version: str = "1.1.2",
        last_modified: str = "2026-07-19T10:00:00Z",
        groups: Optional[List[Dict[str, Any]]] = None,
        controls: Optional[List[Dict[str, Any]]] = None,
        params: Optional[List[Dict[str, Any]]] = None,
        back_matter: Optional[Dict[str, Any]] = None,
        metadata_extras: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Build a minimal valid OSCAL catalog document."""
        if doc_id is None:
            doc_id = generate_uuid()

        metadata = {
            "title": title,
            "last-modified": last_modified,
            "version": version,
            "oscal-version": oscal_version,
        }
        if metadata_extras:
            metadata.update(metadata_extras)

        catalog: Dict[str, Any] = {
            "uuid": doc_id,
            "metadata": metadata,
        }
        if groups is not None:
            catalog["groups"] = groups
        if controls is not None:
            catalog["controls"] = controls
        if params is not None:
            catalog["params"] = params
        if back_matter is not None:
            catalog["back-matter"] = back_matter

        return {"catalog": catalog}

    @staticmethod
    def with_groups(
        *,
        doc_id: Optional[str] = None,
        title: str = "Test Catalog with Groups",
    ) -> Dict[str, Any]:
        """Build a catalog with a nested group hierarchy."""
        return CatalogFactory.build(
            doc_id=doc_id,
            title=title,
            groups=[
                {
                    "id": "ac",
                    "title": "Access Control",
                    "groups": [
                        {
                            "id": "ac-ia",
                            "title": "Identification and Authentication",
                        }
                    ],
                    "controls": [
                        {
                            "id": "ac-1",
                            "title": "Policy and Procedures",
                            "parts": [
                                {
                                    "id": "ac-1_smt",
                                    "name": "statement",
                                    "prose": "Develop access control policy.",
                                }
                            ],
                        }
                    ],
                },
                {
                    "id": "au",
                    "title": "Audit and Accountability",
                },
            ],
        )

    @staticmethod
    def with_controls(
        *,
        doc_id: Optional[str] = None,
        title: str = "Test Catalog with Controls",
    ) -> Dict[str, Any]:
        """Build a catalog with controls containing statements, parts, params, and enhancements."""
        return CatalogFactory.build(
            doc_id=doc_id,
            title=title,
            groups=[
                {
                    "id": "ac",
                    "title": "Access Control",
                    "controls": [
                        {
                            "id": "ac-1",
                            "title": "Policy and Procedures",
                            "params": [
                                {
                                    "id": "ac-1_prm_1",
                                    "label": "organization-defined frequency",
                                    "select": {
                                        "how-many": "one",
                                        "choice": ["annually", "semi-annually", "quarterly"],
                                    },
                                }
                            ],
                            "parts": [
                                {
                                    "id": "ac-1_smt",
                                    "name": "statement",
                                    "prose": "Develop, document, and disseminate access control policy.",
                                    "parts": [
                                        {
                                            "id": "ac-1_smt.a",
                                            "name": "item",
                                            "prose": "Develop and document access control policy.",
                                        },
                                        {
                                            "id": "ac-1_smt.b",
                                            "name": "item",
                                            "prose": "Disseminate access control policy.",
                                        },
                                    ],
                                },
                                {
                                    "id": "ac-1_gdn",
                                    "name": "guidance",
                                    "prose": "Access control policy guidance text.",
                                },
                            ],
                            "controls": [
                                {
                                    "id": "ac-1.1",
                                    "title": "Automated Policy Management",
                                    "parts": [
                                        {
                                            "id": "ac-1.1_smt",
                                            "name": "statement",
                                            "prose": "Implement automated mechanisms.",
                                        }
                                    ],
                                }
                            ],
                        },
                        {
                            "id": "ac-2",
                            "title": "Account Management",
                            "params": [
                                {
                                    "id": "ac-2_prm_1",
                                    "label": "review frequency",
                                    "values": ["90 days"],
                                    "constraints": [
                                        {
                                            "tests": [
                                                {
                                                    "expression": "^[0-9]+ (days|months)$",
                                                    "remarks": "Must be in format: number + unit",
                                                }
                                            ]
                                        }
                                    ],
                                    "guidelines": [
                                        {
                                            "prose": "Enter the review frequency in days or months.",
                                        }
                                    ],
                                },
                                {
                                    "id": "ac-2_prm_2",
                                    "label": "inactivity action",
                                    "select": {
                                        "how-many": "one",
                                        "choice": ["disable", "delete", "warn"],
                                    },
                                },
                                {
                                    "id": "ac-2_prm_3",
                                    "label": "MFA methods",
                                    "select": {
                                        "how-many": "one-or-more",
                                        "choice": ["token", "biometric", "sms", "email"],
                                    },
                                },
                            ],
                            "parts": [
                                {
                                    "id": "ac-2_smt",
                                    "name": "statement",
                                    "prose": "Manage system accounts.",
                                }
                            ],
                            "props": [
                                {
                                    "name": "sort-id",
                                    "value": "ac-02",
                                },
                                {
                                    "name": "label",
                                    "value": "AC-2",
                                },
                            ],
                        },
                    ],
                }
            ],
        )

    @staticmethod
    def minimal(*, doc_id: Optional[str] = None) -> Dict[str, Any]:
        """Build the absolute minimum valid catalog."""
        return CatalogFactory.build(doc_id=doc_id, title="Minimal Catalog")

    @staticmethod
    def with_metadata(
        *,
        doc_id: Optional[str] = None,
        title: str = "Catalog with Full Metadata",
    ) -> Dict[str, Any]:
        """Build a catalog with comprehensive metadata (roles, parties, locations)."""
        return CatalogFactory.build(
            doc_id=doc_id,
            title=title,
            metadata_extras={
                "published": "2026-01-01T00:00:00Z",
                "remarks": "Full metadata catalog for testing",
                "roles": [
                    {"id": "admin", "title": "Administrator"},
                    {"id": "auditor", "title": "Auditor"},
                ],
                "parties": [
                    {
                        "uuid": generate_uuid(),
                        "type": "organization",
                        "name": "Test Organization",
                        "email-addresses": ["admin@test.org"],
                    }
                ],
                "responsible-parties": [
                    {
                        "role-id": "admin",
                        "party-uuids": [],  # Would reference party UUIDs
                    }
                ],
            },
        )

    @staticmethod
    def with_back_matter(
        *,
        doc_id: Optional[str] = None,
        title: str = "Catalog with Back Matter",
    ) -> Dict[str, Any]:
        """Build a catalog with back-matter resources."""
        resource_uuid = generate_uuid()
        return CatalogFactory.build(
            doc_id=doc_id,
            title=title,
            back_matter={
                "resources": [
                    {
                        "uuid": resource_uuid,
                        "title": "Reference Document",
                        "description": "A test reference document",
                        "rlinks": [
                            {
                                "href": "https://example.com/doc.pdf",
                                "media-type": "application/pdf",
                            }
                        ],
                    }
                ]
            },
        )


class ProfileFactory:
    """Factory for generating valid OSCAL Profile documents."""

    @staticmethod
    def build(
        *,
        doc_id: Optional[str] = None,
        title: str = "Test Profile",
        version: str = "1.0.0",
        oscal_version: str = "1.1.2",
        last_modified: str = "2026-07-19T10:00:00Z",
        imports: Optional[List[Dict[str, Any]]] = None,
        merge: Optional[Dict[str, Any]] = None,
        modify: Optional[Dict[str, Any]] = None,
        back_matter: Optional[Dict[str, Any]] = None,
        metadata_extras: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Build a minimal valid OSCAL profile document."""
        if doc_id is None:
            doc_id = generate_uuid()

        metadata = {
            "title": title,
            "last-modified": last_modified,
            "version": version,
            "oscal-version": oscal_version,
        }
        if metadata_extras:
            metadata.update(metadata_extras)

        profile: Dict[str, Any] = {
            "uuid": doc_id,
            "metadata": metadata,
        }

        if imports is not None:
            profile["imports"] = imports
        else:
            # Default empty imports
            profile["imports"] = []

        if merge is not None:
            profile["merge"] = merge
        if modify is not None:
            profile["modify"] = modify
        if back_matter is not None:
            profile["back-matter"] = back_matter

        return {"profile": profile}

    @staticmethod
    def importing(
        *,
        catalog_uuid: str,
        doc_id: Optional[str] = None,
        title: str = "Test Profile with Import",
        include_all: bool = True,
        include_controls: Optional[List[str]] = None,
        exclude_controls: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Build a profile that imports a specific catalog."""
        imp: Dict[str, Any] = {
            "href": f"../catalogs/{catalog_uuid}.json",
        }

        if include_controls:
            imp["include-controls"] = [{"with-ids": include_controls}]
        elif include_all:
            imp["include-all"] = {}

        if exclude_controls:
            imp["exclude-controls"] = [{"with-ids": exclude_controls}]

        return ProfileFactory.build(
            doc_id=doc_id,
            title=title,
            imports=[imp],
        )

    @staticmethod
    def with_set_parameters(
        *,
        catalog_uuid: str,
        doc_id: Optional[str] = None,
        title: str = "Profile with Parameter Overrides",
        set_parameters: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build a profile with parameter overrides."""
        if set_parameters is None:
            set_parameters = [
                {
                    "param-id": "ac-1_prm_1",
                    "values": ["annually"],
                }
            ]
        return ProfileFactory.build(
            doc_id=doc_id,
            title=title,
            imports=[{"href": f"../catalogs/{catalog_uuid}.json", "include-all": {}}],
            modify={"set-parameters": set_parameters},
        )

    @staticmethod
    def with_alters(
        *,
        catalog_uuid: str,
        doc_id: Optional[str] = None,
        title: str = "Profile with Alterations",
        alters: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build a profile with control modifications (adds/removes)."""
        if alters is None:
            alters = [
                {
                    "control-id": "ac-1",
                    "adds": [
                        {
                            "position": "starting",
                            "parts": [
                                {
                                    "id": "ac-1_org_smt",
                                    "name": "statement",
                                    "prose": "Organization-specific requirement.",
                                }
                            ],
                        }
                    ],
                }
            ]
        return ProfileFactory.build(
            doc_id=doc_id,
            title=title,
            imports=[{"href": f"../catalogs/{catalog_uuid}.json", "include-all": {}}],
            modify={"alters": alters},
        )

    @staticmethod
    def with_local_controls(
        *,
        catalog_uuid: str,
        doc_id: Optional[str] = None,
        title: str = "Profile with Local Controls",
        local_controls: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build a profile with local controls (UI format, needs preprocessing)."""
        if local_controls is None:
            local_controls = [
                {
                    "id": "corp-sec-1",
                    "title": "Corporate Security Training",
                    "parts": [
                        {
                            "id": "corp-sec-1_smt",
                            "name": "statement",
                            "prose": "All employees must complete security training.",
                        }
                    ],
                }
            ]
        doc = ProfileFactory.importing(
            catalog_uuid=catalog_uuid,
            doc_id=doc_id,
            title=title,
        )
        doc["profile"]["local-controls"] = local_controls
        return doc

    @staticmethod
    def with_merge(
        *,
        catalog_uuid: str,
        doc_id: Optional[str] = None,
        title: str = "Profile with Merge Directive",
        merge_type: str = "as-is",
        custom_groups: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build a profile with a merge directive."""
        merge: Dict[str, Any] = {}
        if merge_type == "flat":
            merge["flat"] = {}
        elif merge_type == "custom":
            custom: Dict[str, Any] = {}
            if custom_groups:
                custom["groups"] = custom_groups
            merge["custom"] = custom
        else:
            merge["as-is"] = True

        return ProfileFactory.build(
            doc_id=doc_id,
            title=title,
            imports=[{"href": f"../catalogs/{catalog_uuid}.json", "include-all": {}}],
            merge=merge,
        )

    @staticmethod
    def with_matching(
        *,
        catalog_uuid: str,
        doc_id: Optional[str] = None,
        title: str = "Profile with Pattern Matching",
        patterns: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Build a profile with pattern-based import matching."""
        if patterns is None:
            patterns = ["ac-*"]
        return ProfileFactory.build(
            doc_id=doc_id,
            title=title,
            imports=[
                {
                    "href": f"../catalogs/{catalog_uuid}.json",
                    "include-controls": [{"matching": [{"pattern": p} for p in patterns]}],
                }
            ],
        )

    @staticmethod
    def minimal(*, doc_id: Optional[str] = None) -> Dict[str, Any]:
        """Build the absolute minimum valid profile (with empty imports)."""
        return ProfileFactory.build(doc_id=doc_id, title="Minimal Profile")


class GenericDocumentFactory:
    """Factory for generating valid OSCAL documents of any stage."""

    STAGE_ROOT_KEYS = {
        "catalog": "catalog",
        "profile": "profile",
        "ssp": "system-security-plan",
        "component": "component-definition",
        "assessment-plan": "assessment-plan",
        "assessment-results": "assessment-results",
        "poam": "plan-of-action-and-milestones",
    }

    @staticmethod
    def build(
        stage: str,
        *,
        doc_id: Optional[str] = None,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build a minimal valid OSCAL document for any stage."""
        if doc_id is None:
            doc_id = generate_uuid()
        if title is None:
            title = f"Test {stage.capitalize()}"

        root_key = GenericDocumentFactory.STAGE_ROOT_KEYS.get(stage)
        if not root_key:
            raise ValueError(f"Unknown stage: {stage}")

        return {
            root_key: {
                "uuid": doc_id,
                "metadata": {
                    "title": title,
                    "last-modified": "2026-07-19T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
            }
        }
