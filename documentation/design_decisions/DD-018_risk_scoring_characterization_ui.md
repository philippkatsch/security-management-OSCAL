# DD-018: Risk Scoring, CVSS Characterization & Threat Identification UI

**Status:** Accepted  
**Date:** 2026-07-27  
**Applies to:** Stage 6 (AR), Stage 7 (POA&M)

---

## Context

OSCAL's `risk` assembly includes a sophisticated scoring and characterization system that goes far beyond simple severity labels. The `characterizations[]` assembly supports multiple scoring systems (CVSS v2/v3.1/v4, FedRAMP, CVE), each with structured `facets[]` that carry `name`, `system` (URI), and `value` triples. Additionally, `threat-ids[]` reference external threat catalogs.

This scoring data is critical for risk prioritization and triage, but the nested structure is complex. We need a clear UI strategy.

## Decision

### 1. Characterization Facet Rendering

Each `characterization` contains an `origin` (who scored it) and `facets[]` (the actual scores). The UI renders facets in a **scoring card** layout:

```
┌─────────────────────────────────────────────────────┐
│ 🎯 Characterization                                │
│ Origin: Nessus Scanner v10.7                        │
│                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌────────────────┐ │
│ │ CVSS v3.1   │ │ CVE         │ │ FedRAMP        │ │
│ │ Score: 8.1  │ │ CVE-2024-   │ │ Risk: HIGH     │ │
│ │ ■■■■■■■■□□  │ │ 12345       │ │                │ │
│ └─────────────┘ └─────────────┘ └────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 2. Recognized Scoring Systems

The `facet.system` URI identifies the scoring framework. The UI recognizes these standard systems and provides enhanced rendering:

| System URI | Display Name | Value Format | UI Enhancement |
|---|---|---|---|
| `http://www.first.org/cvss/v2.0` | CVSS v2.0 | Decimal 0.0–10.0 | Color-coded score bar |
| `http://www.first.org/cvss/v3.0` | CVSS v3.0 | Decimal 0.0–10.0 | Color-coded score bar |
| `http://www.first.org/cvss/v3.1` | CVSS v3.1 | Decimal 0.0–10.0 | Color-coded score bar |
| `http://www.first.org/cvss/v4.0` | CVSS v4.0 | Decimal 0.0–10.0 | Color-coded score bar |
| `http://fedramp.gov/ns/oscal` | FedRAMP | `high` / `moderate` / `low` | Badge with severity color |
| `http://csrc.nist.gov/ns/oscal` | OSCAL Standard | String | Plain text |
| `http://cve.mitre.org` | CVE | CVE-YYYY-NNNNN | External link to CVE entry |
| Custom URI | Custom | String | Plain text with URI tooltip |

**CVSS Score Color Mapping:**
- 0.0 = ⬜ None (gray)
- 0.1–3.9 = 🟢 Low (green)
- 4.0–6.9 = 🟡 Medium (yellow)
- 7.0–8.9 = 🟠 High (orange)
- 9.0–10.0 = 🔴 Critical (red)

### 3. Facet Data Model in Editor

The `CharacterizationEditor.jsx` component (from DD-017) manages facets as a table:

| Column | Source | Required | Input Type |
|---|---|---|---|
| **Name** | `facet.name` | Required (token) | Text input with autocomplete for common names (`score`, `vector-string`, `base-score`, `attack-vector`, `severity`) |
| **System** | `facet.system` | Required (uri) | Dropdown with recognized systems + custom URI input |
| **Value** | `facet.value` | Required (string) | Context-sensitive: decimal input for CVSS, dropdown for FedRAMP severity, free text for custom |
| **Props** | `facet.props[]` | Optional | Expandable props editor |
| **Links** | `facet.links[]` | Optional | Expandable links editor |

### 4. Threat ID Management

`threat-ids[]` are external references to threat catalogs:

```json
{
  "system": "http://cve.mitre.org",
  "href": "https://nvd.nist.gov/vuln/detail/CVE-2024-12345",
  "id": "CVE-2024-12345"
}
```

**UI Behavior:**
- Render as clickable badges: `🔗 CVE-2024-12345`
- The `system` URI determines the icon/prefix (CVE, CWE, CAPEC, etc.)
- When `href` is present, the badge is a clickable external link
- Auto-complete for known systems: `http://cve.mitre.org`, `http://cwe.mitre.org`, `http://capec.mitre.org`

### 5. Mitigating Factors Rendering

`mitigating-factors[]` document existing controls or conditions that reduce risk:

- Each factor has a `uuid`, `description` (required), optional `implementation-uuid` (linking to an SSP `by-component` implementation), and `subjects[]`.
- The UI renders mitigating factors as a collapsible list below the characterization scores.
- When `implementation-uuid` is present, the UI resolves it against the imported SSP and displays the linked component/control implementation as a read-only reference card.

### 6. Risk Priority & Sorting

- The `priority` property (integer) enables user-defined risk ranking.
- The Risk List view (in both AR and POA&M editors) supports sorting by:
  1. Priority (ascending, lower = more urgent)
  2. Status (open first, closed last)
  3. CVSS score (highest first, extracted from `characterizations[].facets[name="score"]`)
  4. Deadline (soonest first)

## Consequences

- Complex CVSS/FedRAMP scoring is rendered in an accessible, visual card layout.
- Recognized scoring systems get enhanced rendering; unknown systems get plain text fallback.
- Threat IDs are rendered as clickable external references.
- Risk sorting supports both automated scoring and manual prioritization.
- The `CharacterizationEditor` is a reusable component shared between AR and POA&M editors (via DD-017 shared library).
