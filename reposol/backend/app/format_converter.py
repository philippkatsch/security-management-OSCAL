import xml.etree.ElementTree as ET
import json
import yaml
import re
from typing import Dict, Any, List, Union

NS = "http://csrc.nist.gov/ns/oscal/1.0"

# Comprehensive OSCAL XML Tag to JSON Array Key mapping (Singular XML -> Plural JSON)
# Covers all 8 OSCAL stages: Catalog, Profile, Component Def, SSP, Assessment Plan, Results, POA&M, Mapping
SINGULAR_TO_PLURAL = {
    # Step 1 & 2: Catalog & Profile
    "group": "groups",
    "control": "controls",
    "param": "params",
    "parameter": "params",
    "prop": "props",
    "property": "props",
    "link": "links",
    "part": "parts",
    "assessment-part": "parts",
    "role": "roles",
    "party": "parties",
    "location": "locations",
    "mapping": "mappings",
    "map": "maps",
    "source": "sources",
    "target": "targets",
    "mapping-item": "targets",
    "set-parameter": "set-parameters",
    "import": "imports",
    "alter": "alters",
    "add": "adds",
    "remove": "removes",
    "resource": "resources",
    "revision": "revisions",
    "responsible-party": "responsible-parties",
    "responsible-role": "responsible-roles",
    "with-id": "with-ids",
    "rlink": "rlinks",
    "document-id": "document-ids",
    "address": "addresses",
    "addr-line": "addr-lines",
    "email-address": "email-addresses",
    "telephone-number": "telephone-numbers",
    "external-id": "external-ids",
    "hash": "hashes",
    "url": "urls",
    
    # Step 3 & 4: Component Definition & SSP
    "component": "components",
    "defined-component": "components",
    "system-component": "components",
    "capability": "capabilities",
    "by-component": "by-components",
    "control-implementation": "control-implementations",
    "implemented-requirement": "implemented-requirements",
    "implemented-component": "implemented-components",
    "statement": "statements",
    "statement-id": "statement-ids",
    "protocol": "protocols",
    "port-range": "port-ranges",
    "import-component-definition": "import-component-definitions",
    "inventory-item": "inventory-items",
    "user": "users",
    "system-user": "users",
    "action": "actions",
    "asset": "assets",
    "required-asset": "required-assets",
    "service": "services",
    "diagram": "diagrams",
    "information-type": "information-types",
    "information-type-id": "information-type-ids",
    "authorized-privilege": "authorized-privileges",
    "leveraged-authorization": "leveraged-authorizations",
    "function-performed": "functions-performed",
    
    # Step 5 - 8: Assessment Plan, Results, POA&M
    "subject": "subjects",
    "assessment-subject": "subjects",
    "subject-reference": "subjects",
    "activity": "activities",
    "associated-activity": "associated-activities",
    "observation": "observations",
    "risk": "risks",
    "finding": "findings",
    "poam-item": "poam-items",
    "milestone": "milestones",
    "select-control": "select-controls",
    "select-control-by-id": "include-controls",
    "objective": "objectives",
    "select-objective": "select-objectives",
    "select-objective-by-id": "include-objectives",
    "select-subject-by-id": "include-subjects",
    "log-entry": "log-entries",
    "step": "steps",
    "response": "responses",
    "threat": "threats",
    "threat-id": "threat-ids",
    "characterization": "characterizations",
    "mitigating-factor": "mitigating-factors",
    "origin": "origins",
    "origin-actor": "actors",
    "related-observation": "related-observations",
    "associated-risk": "associated-risks",
    "related-risk": "associated-risks",
    "relevant-evidence": "relevant-evidence",
    "incorporates-component": "incorporates-components",
    "task": "tasks",
    "related-task": "related-tasks",
    "result": "results",
    "assessment-platform": "assessment-platforms",
    "attestation": "attestations",
    "categorization": "categorizations",
    "control-objective-selection": "control-objective-selections",
    "control-selection": "control-selections",
    "dependency": "dependencies",
    "entry": "entries",
    "facet": "facets",
    "inherited": "inherited",
    "insert-controls": "insert-controls",
    "location-uuid": "location-uuids",
    "logged-by": "logged-by",
    "matching": "matching",
    "member-of-organization": "member-of-organizations",
    "method": "methods",
    "parameter-constraint": "constraints",
    "parameter-guideline": "guidelines",
    "parameter-value": "values",
    "value": "values",
    "party-uuid": "party-uuids",
    "provided": "provided",
    "qualifier-item": "qualifiers",
    "related-finding": "related-findings",
    "related-response": "related-responses",
    "responsibility": "responsibilities",
    "role-id": "role-ids",
    "satisfied": "satisfied",
    "system-id": "system-ids",
    "test": "tests",
    "uses-component": "uses-components"
}

# Canonical Plural JSON property -> Singular XML Tag mapping for Export
PLURAL_TO_SINGULAR = {
    "groups": "group",
    "controls": "control",
    "params": "param",
    "props": "prop",
    "links": "link",
    "parts": "part",
    "roles": "role",
    "parties": "party",
    "locations": "location",
    "mappings": "mapping",
    "maps": "map",
    "sources": "source",
    "targets": "target",
    "components": "component",
    "capabilities": "capability",
    "by-components": "by-component",
    "control-implementations": "control-implementation",
    "implemented-requirements": "implemented-requirement",
    "implemented-components": "implemented-component",
    "statements": "statement",
    "statement-ids": "statement-id",
    "actions": "action",
    "users": "user",
    "assets": "asset",
    "required-assets": "required-asset",
    "subjects": "subject",
    "activities": "activity",
    "associated-activities": "associated-activity",
    "observations": "observation",
    "risks": "risk",
    "findings": "finding",
    "poam-items": "poam-item",
    "milestones": "milestone",
    "select-controls": "select-control",
    "include-controls": "select-control-by-id",
    "objectives": "objective",
    "select-objectives": "select-objective",
    "include-objectives": "select-objective-by-id",
    "include-subjects": "select-subject-by-id",
    "log-entries": "log-entry",
    "steps": "step",
    "responses": "response",
    "remediations": "response",
    "threats": "threat",
    "threat-ids": "threat-id",
    "characterizations": "characterization",
    "mitigating-factors": "mitigating-factor",
    "origins": "origin",
    "actors": "origin-actor",
    "related-observations": "related-observation",
    "associated-risks": "associated-risk",
    "relevant-evidence": "relevant-evidence",
    "incorporates-components": "incorporates-component",
    "set-parameters": "set-parameter",
    "imports": "import",
    "import-component-definitions": "import-component-definition",
    "alters": "alter",
    "adds": "add",
    "removes": "remove",
    "resources": "resource",
    "revisions": "revision",
    "responsible-parties": "responsible-party",
    "responsible-roles": "responsible-role",
    "with-ids": "with-id",
    "rlinks": "rlink",
    "document-ids": "document-id",
    "addresses": "address",
    "addr-lines": "addr-line",
    "email-addresses": "email-address",
    "telephone-numbers": "telephone-number",
    "external-ids": "external-id",
    "hashes": "hash",
    "urls": "url",
    "protocols": "protocol",
    "port-ranges": "port-range",
    "inventory-items": "inventory-item",
    "tasks": "task",
    "related-tasks": "related-task",
    "results": "result",
    "assessment-platforms": "assessment-platform",
    "attestations": "attestation",
    "authorized-privileges": "authorized-privilege",
    "categorizations": "categorization",
    "control-objective-selections": "control-objective-selection",
    "control-selections": "control-selection",
    "dependencies": "dependency",
    "diagrams": "diagram",
    "entries": "entry",
    "facets": "facet",
    "functions-performed": "function-performed",
    "information-types": "information-type",
    "information-type-ids": "information-type-id",
    "inherited": "inherited",
    "insert-controls": "insert-controls",
    "leveraged-authorizations": "leveraged-authorization",
    "location-uuids": "location-uuid",
    "logged-by": "logged-by",
    "matching": "matching",
    "member-of-organizations": "member-of-organization",
    "methods": "method",
    "constraints": "parameter-constraint",
    "guidelines": "parameter-guideline",
    "values": "value",
    "party-uuids": "party-uuid",
    "provided": "provided",
    "qualifiers": "qualifier-item",
    "related-findings": "related-finding",
    "related-responses": "related-response",
    "responsibilities": "responsibility",
    "role-ids": "role-id",
    "satisfied": "satisfied",
    "system-ids": "system-id",
    "tests": "test",
    "uses-components": "uses-component"
}

# Exhaustive set of OSCAL XML attributes / flags (R1-08)
XML_ATTRIBUTES = {
    # Identifiers & types
    "uuid", "id", "name", "type", "class", "href", "rel", "ns", "value", "as-of",
    "system-id", "component-type", "status", "method", "matching-rationale", "relationship",
    "param-id", "control-id", "statement-id", "target-id", "objective-id", "threat-id",
    "role-id", "party-uuid", "location-type", "location-uuid", "actor-uuid", "activity-uuid",
    "component-uuid", "finding-uuid", "observation-uuid", "response-uuid", "risk-uuid",
    "task-uuid", "implementation-uuid", "provided-uuid", "responsibility-uuid", "subject-uuid",
    "subject-placeholder-uuid", "subject-type", "id-ref",
    
    # Profile Alteration & Inclusion attributes
    "position", "by-id", "by-name", "by-class", "by-item-name", "by-ns",
    "order", "pattern", "with-child-controls", "match-pattern", "match-with-child-controls",
    
    # Back-matter & links
    "media-type", "filename", "how-many", "scheme", "group", "algorithm", "resource-fragment",
    
    # Protocol, Unit, State & Time
    "transport", "unit", "state", "reason", "start", "end", "date", "period",
    "lifecycle", "predicate", "generation-method", "system", "system-component-type",
    "defined-component-type", "identifier-type"
}

# Markup / Mixed-content tags that should be converted to inline markdown / string
MIXED_CONTENT_TAGS = {
    "p", "insert", "strong", "b", "em", "i", "code", "a", "q", "br", "sub", "sup",
    "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6", "hr"
}

INSERT_REGEX = re.compile(r'\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}')

def strip_ns(tag: str) -> str:
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag

def xml_mixed_to_string(element: ET.Element) -> str:
    """Recursively serializes mixed-content XML (markup and inline tags like <insert>) into prose string."""
    tag = strip_ns(element.tag)
    children = list(element)
    
    # If this is <description> or <remarks> with only child <p> tags
    if children and all(strip_ns(c.tag) == "p" for c in children):
        paragraphs = [xml_mixed_to_string(c) for c in children]
        return "\n\n".join(p for p in paragraphs if p)

    text = element.text or ""
    for child in children:
        ctag = strip_ns(child.tag)
        if ctag == "insert":
            param_id = child.attrib.get("param-id") or child.attrib.get("id-ref") or ""
            text += f"{{{{ insert: param, {param_id} }}}}"
        elif ctag in ("strong", "b"):
            text += f"**{xml_mixed_to_string(child)}**"
        elif ctag in ("em", "i"):
            text += f"*{xml_mixed_to_string(child)}*"
        elif ctag == "code":
            text += f"`{xml_mixed_to_string(child)}`"
        elif ctag == "a":
            href = child.attrib.get("href", "")
            ctext = xml_mixed_to_string(child)
            text += f"[{ctext}]({href})" if href else ctext
        elif ctag == "q":
            text += f'"{xml_mixed_to_string(child)}"'
        elif ctag == "br":
            text += "\n"
        elif ctag == "li":
            text += f"\n- {xml_mixed_to_string(child)}"
        elif ctag == "p":
            ctext = xml_mixed_to_string(child)
            text += f"{ctext}\n\n"
        else:
            text += xml_mixed_to_string(child)

        if child.tail:
            text += child.tail

    return text.strip()

def xml_to_dict(element: ET.Element) -> Any:
    tag = strip_ns(element.tag)
    attribs = {strip_ns(k): v for k, v in element.attrib.items()}
    children = list(element)

    # 1. Pure text node without children and attributes
    if not children and not attribs:
        val = element.text or ""
        return val.strip() if val else ""

    # 2. Mixed content prose elements (<p>, <prose>)
    if tag in ("p", "prose") or (children and all(strip_ns(c.tag) in MIXED_CONTENT_TAGS for c in children) and not any(k in ("id", "name", "uuid", "control-id") for k in attribs)):
        return xml_mixed_to_string(element)

    res: Dict[str, Any] = {}
    for k, v in attribs.items():
        res[k] = v

    # 3. Special handling for <description> or <remarks> containing mixed content / <p>
    if tag in ("description", "remarks", "rationale", "justification") and children:
        if all(strip_ns(c.tag) in MIXED_CONTENT_TAGS for c in children):
            prose_str = xml_mixed_to_string(element)
            if not attribs:
                return prose_str
            res["text"] = prose_str
            return res

    # 4. Standard assembly / field child traversal
    for child in children:
        child_tag = strip_ns(child.tag)
        
        # In <part>, child <p> or mixed prose maps to "prose" property per OSCAL JSON schema
        if tag == "part" and child_tag in ("p", "prose"):
            prose_content = xml_mixed_to_string(child)
            if "prose" in res:
                res["prose"] = f"{res['prose']}\n\n{prose_content}"
            else:
                res["prose"] = prose_content
            continue

        child_val = xml_to_dict(child)

        if child_tag in SINGULAR_TO_PLURAL:
            plural_key = SINGULAR_TO_PLURAL[child_tag]
            if plural_key not in res:
                res[plural_key] = []
            res[plural_key].append(child_val)
        else:
            res[child_tag] = child_val

    # Direct text on element with attributes (e.g. <title>...)
    if not children and attribs and element.text and element.text.strip():
        res["text"] = element.text.strip()

    if tag in PLURAL_TO_SINGULAR and list(res.keys()) == [tag]:
        return res[tag]

    return res

def parse_xml_to_oscal_dict(xml_text: str) -> Dict[str, Any]:
    root = ET.fromstring(xml_text)
    root_tag = strip_ns(root.tag)
    return {root_tag: xml_to_dict(root)}

def parse_prose_to_xml_elements(prose_text: str, parent_elem: ET.Element):
    """Encodes markdown prose with {{ insert: param, param_id }} into OSCAL XML <p> and <insert> elements."""
    paragraphs = [p.strip() for p in prose_text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [prose_text] if prose_text else []

    for para in paragraphs:
        p_elem = ET.SubElement(parent_elem, "p")
        chunks = INSERT_REGEX.split(para)
        last_elem = None
        for i, chunk in enumerate(chunks):
            if i % 2 == 1:
                # Param ID captured by regex
                param_id = chunk.strip()
                insert_elem = ET.SubElement(p_elem, "insert")
                insert_elem.set("param-id", param_id)
                last_elem = insert_elem
            else:
                if not chunk:
                    continue
                if last_elem is None:
                    p_elem.text = (p_elem.text or "") + chunk
                else:
                    last_elem.tail = (last_elem.tail or "") + chunk

def dict_to_xml_element(tag: str, val: Any) -> ET.Element:
    element = ET.Element(tag)

    if isinstance(val, dict):
        # 1. XML Attributes first
        for k, v in val.items():
            if k in XML_ATTRIBUTES and not isinstance(v, (dict, list)):
                element.set(k, str(v))

        # 2. Child nodes
        for k, v in val.items():
            if k in XML_ATTRIBUTES:
                continue
            if k == "text":
                element.text = str(v)
                continue
            if k == "prose" and tag == "part" and isinstance(v, str):
                parse_prose_to_xml_elements(v, element)
                continue

            singular = PLURAL_TO_SINGULAR.get(k)
            if singular and isinstance(v, list):
                for item in v:
                    child = dict_to_xml_element(singular, item)
                    element.append(child)
            elif isinstance(v, list):
                for item in v:
                    child = dict_to_xml_element(k, item)
                    element.append(child)
            else:
                child = dict_to_xml_element(k, v)
                element.append(child)
    elif isinstance(val, str) and tag in ("p", "prose"):
        parse_prose_to_xml_elements(val, element)
    else:
        element.text = str(val)

    return element

def serialize_oscal_dict_to_xml(oscal_dict: Dict[str, Any]) -> str:
    if not oscal_dict:
        raise ValueError("Empty dictionary")
    root_key = list(oscal_dict.keys())[0]
    root_val = oscal_dict[root_key]

    ET.register_namespace("", NS)
    root_element = dict_to_xml_element(f"{{{NS}}}{root_key}", root_val)

    from xml.dom import minidom
    xml_bytes = ET.tostring(root_element, encoding="utf-8")
    parsed = minidom.parseString(xml_bytes)
    return parsed.toprettyxml(indent="  ")

# YAML Helpers
def parse_yaml_to_dict(yaml_text: str) -> Dict[str, Any]:
    return yaml.safe_load(yaml_text)

def serialize_dict_to_yaml(data: Dict[str, Any]) -> str:
    return yaml.dump(data, sort_keys=False, default_flow_style=False, allow_unicode=True)

