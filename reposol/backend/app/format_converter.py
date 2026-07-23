import xml.etree.ElementTree as ET
import json
import yaml
from typing import Dict, Any

NS = "http://csrc.nist.gov/ns/oscal/1.0"

SINGULAR_TO_PLURAL = {
    "group": "groups",
    "control": "controls",
    "param": "params",
    "prop": "props",
    "link": "links",
    "part": "parts",
    "role": "roles",
    "party": "parties",
    "location": "locations",
    "mapping": "mappings",
    "map": "maps",
    "source": "sources",
    "target": "targets",
    "component": "components",
    "by-component": "by-components",
    "implemented-requirement": "implemented-requirements",
    "action": "actions",
    "user": "users",
    "asset": "assets",
    "subject": "subjects",
    "activity": "activities",
    "associated-activity": "associated-activities",
    "observation": "observations",
    "risk": "risks",
    "finding": "findings",
    "poam-item": "poam-items",
    "milestone": "milestones",
    "select-control": "select-controls",
    "objective": "objectives",
    "log-entry": "log-entries",
    "step": "steps",
    "response": "responses",
    "threat": "threats",
    "characterization": "characterizations",
    "mitigating-factor": "mitigating-factors",
    "origin": "origins",
    "related-observation": "related-observations",
    "associated-risk": "associated-risks",
    "relevant-evidence": "relevant-evidence",
    "select-objective": "select-objectives",
    "incorporates-component": "incorporates-components",
    "set-parameter": "set-parameters"
}

PLURAL_TO_SINGULAR = {v: k for k, v in SINGULAR_TO_PLURAL.items()}

# Common attributes in OSCAL XML that should be represented as XML attributes
XML_ATTRIBUTES = {
    "uuid", "id", "name", "type", "class", "href", "rel", "ns", "value", "as-of",
    "system-id", "component-type", "status", "method", "matching-rationale", "relationship",
    "param-id"
}

def strip_ns(tag: str) -> str:
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag

def xml_to_dict(element: ET.Element) -> Any:
    tag = strip_ns(element.tag)
    attribs = {strip_ns(k): v for k, v in element.attrib.items()}
    children = list(element)

    if not children and not attribs:
        val = element.text or ""
        return val.strip() if val else ""

    res = {}
    for k, v in attribs.items():
        res[k] = v

    for child in children:
        child_tag = strip_ns(child.tag)
        child_val = xml_to_dict(child)

        if child_tag in SINGULAR_TO_PLURAL:
            plural_key = SINGULAR_TO_PLURAL[child_tag]
            if plural_key not in res:
                res[plural_key] = []
            res[plural_key].append(child_val)
        else:
            res[child_tag] = child_val

    if not children and attribs and element.text and element.text.strip():
        res["text"] = element.text.strip()

    if tag in PLURAL_TO_SINGULAR and list(res.keys()) == [tag]:
        return res[tag]

    return res

def parse_xml_to_oscal_dict(xml_text: str) -> Dict[str, Any]:
    root = ET.fromstring(xml_text)
    root_tag = strip_ns(root.tag)
    return {root_tag: xml_to_dict(root)}

def dict_to_xml_element(tag: str, val: Any) -> ET.Element:
    element = ET.Element(tag)

    if isinstance(val, dict):
        for k, v in val.items():
            if k in XML_ATTRIBUTES and not isinstance(v, (dict, list)):
                element.set(k, str(v))

        for k, v in val.items():
            if k in XML_ATTRIBUTES:
                continue
            if k == "text":
                element.text = str(v)
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
