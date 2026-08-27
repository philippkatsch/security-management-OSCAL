/**
 * OSCAL Knowledge Base Action Comparison Matrix Data
 * 
 * Detailed cross-stage comparison of common user and authoring actions across
 * Catalogs (Direct Mutation), Profiles (Non-Destructive Overlay), and System Security Plans (System Implementation).
 */

export type ActionCategory =
  | 'control'
  | 'text'
  | 'param'
  | 'structure'
  | 'status'
  | 'evidence'
  | 'content'
  | 'hierarchy'
  | 'parameters';

export interface ActionComparisonItem {
  id: string;
  action: string;
  category: ActionCategory;
  icon: string;
  catalogBehavior: string;
  catalogJson: string;
  profileBehavior: string;
  profileJson: string;
  sspBehavior?: string;
  sspJson?: string;
  oscalMechanism: string;
  practicalTip: string;
  tip: string; // Alias for backward compatibility
}

export const ACTION_COMPARISONS: ActionComparisonItem[] = [
  {
    id: 'control-remove',
    action: 'Exclude / Remove Control from Baseline',
    category: 'control',
    icon: '❌',
    catalogBehavior:
      'Permanent deletion from the catalog JSON structure; child controls and parameters are erased.',
    catalogJson: 'delete catalog.groups[].controls[id]',
    profileBehavior:
      'Non-destructive exclusion directive (`exclude-controls`). The source catalog is completely untouched.',
    profileJson: 'imports[].exclude-controls: [{ "with-ids": ["ac-1"] }]',
    sspBehavior:
      'Controls are bound to the resolved profile. To omit an unneeded control, tailor it in the profile or mark it as not applicable in SSP.',
    sspJson: 'implemented-requirements[].props: [{ "name": "not-applicable", "value": "true" }]',
    oscalMechanism: 'Import Filtering (`exclude-controls` vs JSON Object Deletion)',
    practicalTip:
      'NIST Spec: exclude-controls strictly takes precedence over include-controls during Profile resolution.',
    tip: 'NIST Spec: exclude-controls strictly takes precedence over include-controls during Profile resolution.'
  },
  {
    id: 'control-withdraw',
    action: 'Withdraw / Deprecate Control',
    category: 'status',
    icon: '⛔',
    catalogBehavior:
      'Sets property status to "withdrawn" directly on the control definition while retaining the object.',
    catalogJson: 'control.props: [{ "name": "status", "value": "withdrawn" }]',
    profileBehavior:
      'OSCAL Profiles have no native "withdrawn" property; the compliant equivalent is excluding it from the baseline import.',
    profileJson: 'imports[].exclude-controls: [{ "with-ids": ["ac-1"] }]',
    sspBehavior:
      'Withdrawn controls from catalogs are excluded from the profile baseline and do not appear in the SSP implementation matrix.',
    sspJson: '/* Excluded upstream in Profile */',
    oscalMechanism: 'Property Tagging (`props.status`) vs Import Exclusion',
    practicalTip:
      'In Profiles, a control is either active in the baseline or excluded. Use catalog deprecation for standard evolution.',
    tip: 'In Profiles, a control is either active in the baseline or excluded. Use catalog deprecation for standard evolution.'
  },
  {
    id: 'control-add',
    action: 'Add New Custom Control / Requirement',
    category: 'control',
    icon: '➕',
    catalogBehavior:
      'Instantiates a brand new Control object inside catalog groups or root hierarchy.',
    catalogJson: 'catalog.groups[].controls.push({ "id": "custom-1", ... })',
    profileBehavior:
      'Controls can only be imported from source catalogs. Profiles cannot invent new top-level controls out of thin air.',
    profileJson: 'imports[].include-controls: [{ "with-ids": ["custom-1"] }]',
    sspBehavior:
      'SSPs can document system-specific procedural controls under custom implemented-requirements if mapped to an authorized baseline.',
    sspJson: 'control-implementation.implemented-requirements.push({ "control-id": "custom-1", ... })',
    oscalMechanism: 'Direct Instantiation vs Managed Import Catalog',
    practicalTip:
      'Custom baseline controls should be authored in a companion custom Catalog and imported into your Profile.',
    tip: 'Custom baseline controls should be authored in a companion custom Catalog and imported into your Profile.'
  },
  {
    id: 'text-modify',
    action: 'Modify Statement / Prose Text',
    category: 'text',
    icon: '✏️',
    catalogBehavior:
      'Direct in-place overwrite of the prose string in the target statement part.',
    catalogJson: 'control.parts[].prose = "New requirement text..."',
    profileBehavior:
      'Non-destructive Alteration overlay via `removes` + `adds` targeting the original statement part ID.',
    profileJson: 'modify.alters: [{ "control-id": "ac-1", "removes": [{ "by-id": "ac-1_smt" }], "adds": [{ "position": "starting", "by-id": "ac-1_smt", "parts": [...] }] }]',
    sspBehavior:
      'SSPs do not alter the baseline statement prose; instead, they provide narrative implementation responses in `by-components`.',
    sspJson: 'implemented-requirements[].by-components[].description = "System implements requirement by..."',
    oscalMechanism: 'In-Place String Overwrite vs OSCAL Alters (`modify.alters`)',
    practicalTip:
      'Original catalog prose is preserved. In Profile Edit Mode, removed text shows with strikethrough for audit traceability.',
    tip: 'Original catalog prose is preserved. In Profile Edit Mode, removed text shows with strikethrough for audit traceability.'
  },
  {
    id: 'param-set',
    action: 'Assign / Override Parameter Value',
    category: 'param',
    icon: '🏷️',
    catalogBehavior:
      'Direct edit of the default parameter values in the catalog parameter definition.',
    catalogJson: 'control.params[].values = ["30 days"]',
    profileBehavior:
      'Tailoring override via `modify.set-parameters`. Overrides catalog defaults across the organizational baseline.',
    profileJson: 'modify.set-parameters: [{ "param-id": "ac-1_prm_1", "values": ["30 days"] }]',
    sspBehavior:
      'Final runtime parameter binding in SSP implemented-requirements, providing system-specific operational values.',
    sspJson: 'implemented-requirements[].set-parameters: [{ "param-id": "ac-1_prm_1", "values": ["14 days"] }]',
    oscalMechanism: 'Parameter Cascading (Catalog Default ➔ Profile Override ➔ SSP Runtime Value)',
    practicalTip:
      'Unset parameters render as [Label] chips; assigned parameters render with green badges and hover inspection tooltips.',
    tip: 'Unset parameters render as [Label] chips; assigned parameters render with green badges and hover inspection tooltips.'
  },
  {
    id: 'guidance-add',
    action: 'Add Supplemental Guidance / Statement Part',
    category: 'text',
    icon: '📄',
    catalogBehavior:
      'Directly appends a new part object (`name="guidance"`) to `control.parts[]`.',
    catalogJson: 'control.parts.push({ "id": "ac-1_gdn_2", "name": "guidance", "prose": "..." })',
    profileBehavior:
      'Generates an alter addition targeting the control with positioning (`starting`, `ending`, `before`, `after`).',
    profileJson: 'modify.alters: [{ "control-id": "ac-1", "adds": [{ "position": "ending", "parts": [{ "name": "guidance", "prose": "..." }] }] }]',
    sspBehavior:
      'SSPs attach implementation remarks and operator guidance directly within component implementation descriptions.',
    sspJson: 'implemented-requirements[].remarks = "Supplemental operator guidance..."',
    oscalMechanism: 'Part Array Appending vs Positional Alter Injection',
    practicalTip:
      'Positional alters can be placed at `starting`, `ending`, `before`, or `after` relative to existing part IDs.',
    tip: 'Positional alters can be placed at `starting`, `ending`, `before`, or `after` relative to existing part IDs.'
  },
  {
    id: 'structure-merge',
    action: 'Organize Groups & Folder Hierarchy',
    category: 'structure',
    icon: '📁',
    catalogBehavior:
      'Directly create, move, and recursively nest groups in `catalog.groups[]`.',
    catalogJson: 'catalog.groups = [{ "id": "ac", "title": "Access Control", "groups": [...] }]',
    profileBehavior:
      'Controlled by `profile.merge`: `as-is` (mirror source catalogs), `flat` (unstructured), or `custom` (custom groups + `insert-controls`).',
    profileJson: 'profile.merge = { "custom": { "groups": [{ "id": "iam", "title": "IAM", "insert-controls": [...] }] } }',
    sspBehavior:
      'Inherits group hierarchy from resolved profile; organizes implementation views by control family or component allocation.',
    sspJson: '/* Group structure inherited from resolved profile */',
    oscalMechanism: 'Direct JSON Hierarchy vs Merge Resolution Modes (`as-is` | `flat` | `custom`)',
    practicalTip:
      'Reposol defaults to `as-is` to preserve standard catalog folder structure automatically.',
    tip: 'Reposol defaults to `as-is` to preserve standard catalog folder structure automatically.'
  },
  {
    id: 'enhancement-toggle',
    action: 'Toggle Control Enhancements',
    category: 'control',
    icon: '🌳',
    catalogBehavior:
      'Directly add or delete sub-control enhancement objects inside `control.controls[]`.',
    catalogJson: 'control.controls.push({ "id": "ac-2.1", "title": "Enhancement 1", ... })',
    profileBehavior:
      'Configured via `with-child-controls: "yes" | "no"` or explicit inclusion/exclusion of enhancement IDs in `include-controls`.',
    profileJson: 'imports[].include-controls: [{ "with-ids": ["ac-2"], "with-child-controls": "no" }]',
    sspBehavior:
      'Each enhancement present in the resolved baseline requires its own implemented-requirement response.',
    sspJson: 'implemented-requirements: [{ "control-id": "ac-2.1", ... }]',
    oscalMechanism: 'Nested Control Objects vs Child Control Ingestion Flags',
    practicalTip:
      'Setting `with-child-controls: "yes"` automatically pulls in all enhancements when importing a parent control.',
    tip: 'Setting `with-child-controls: "yes"` automatically pulls in all enhancements when importing a parent control.'
  },
  {
    id: 'component-allocate',
    action: 'Allocate Implementation Responsibility to Components',
    category: 'status',
    icon: '🧱',
    catalogBehavior:
      'Not applicable at Catalog stage. Catalogs define abstract standard requirements without architectural bindings.',
    catalogJson: '/* Not applicable in Catalog model */',
    profileBehavior:
      'Profiles define policy baselines; component allocation occurs downstream in Component Definitions or SSPs.',
    profileJson: '/* Not applicable in Profile baseline */',
    sspBehavior:
      'Binds control implementation statements to specific software, hardware, or service components in `by-components[]`.',
    sspJson: 'implemented-requirements[].by-components: [{ "component-uuid": "comp-db", "implementation-status": { "state": "implemented" } }]',
    oscalMechanism: 'System Implementation By-Components Mapping (`by-components[].component-uuid`)',
    practicalTip:
      'Assigning components creates a traceable allocation matrix mapping every requirement to responsible IT assets.',
    tip: 'Assigning components creates a traceable allocation matrix mapping every requirement to responsible IT assets.'
  },
  {
    id: 'diagram-attach',
    action: 'Attach Architectural Boundary / Evidence Diagram',
    category: 'evidence',
    icon: '🖼️',
    catalogBehavior:
      'Embeds reference images in `catalog.back-matter.resources` referenced by guidance links.',
    catalogJson: 'catalog.back-matter.resources.push({ "uuid": "res-diag", "base64": { ... } })',
    profileBehavior:
      'Attaches tailoring evidence documents or baseline architectural guidance in profile back-matter.',
    profileJson: 'profile.back-matter.resources.push({ "uuid": "res-arch", "base64": { ... } })',
    sspBehavior:
      'Attaches formal Authorization Boundary Diagrams and Data Flow Diagrams linked to `system-characteristics.authorization-boundary`.',
    sspJson: 'authorization-boundary.diagrams: [{ "links": [{ "href": "#res-boundary-png", "rel": "diagram" }] }]',
    oscalMechanism: 'Back-Matter Resource Embedding (`back-matter.resources[].base64`)',
    practicalTip:
      'Reposol provides an in-browser Base64 diagram converter with instant preview and automatic back-matter synchronization.',
    tip: 'Reposol provides an in-browser Base64 diagram converter with instant preview and automatic back-matter synchronization.'
  },
  {
    id: 'finding-evaluate',
    action: 'Evaluate Control Assessment Finding',
    category: 'status',
    icon: '✅',
    catalogBehavior:
      'Defines structured determination objectives (`parts[name="objective"]`) used as evaluation criteria.',
    catalogJson: 'control.parts.push({ "name": "objective", "parts": [...] })',
    profileBehavior:
      'Can alter or refine assessment objective statements for organizational baseline context.',
    profileJson: 'modify.alters: [{ "adds": [{ "parts": [{ "name": "objective", ... }] }] }]',
    sspBehavior:
      'Documents system compliance claims and implementation narratives evaluated during audits.',
    sspJson: 'implemented-requirements[].by-components[].description = "..."',
    oscalMechanism: 'Assessment Results Findings Ledger (`results[].findings[].target.status.state`)',
    practicalTip:
      'Findings evaluate statements as `satisfied` or `not-satisfied`. Unsatisfied findings automatically generate linked risks.',
    tip: 'Findings evaluate statements as `satisfied` or `not-satisfied`. Unsatisfied findings automatically generate linked risks.'
  },
  {
    id: 'risk-exception',
    action: 'Record Risk Deviation / False Positive / Accepted Risk',
    category: 'status',
    icon: '⚠️',
    catalogBehavior:
      'Not applicable at standard specification level.',
    catalogJson: '/* Not applicable in Catalog model */',
    profileBehavior:
      'Not applicable at baseline definition level.',
    profileJson: '/* Not applicable in Profile baseline */',
    sspBehavior:
      'SSPs can tag specific control implementations with approved deviation justification properties.',
    sspJson: 'implemented-requirements[].props: [{ "name": "accepted-risk", "value": "true" }]',
    oscalMechanism: 'POA&M Risk Governance State Machine (`risks[].status` & `risk-log`)',
    practicalTip:
      'POA&Ms track deviations through a formal workflow: `open` ➔ `deviation-requested` ➔ `deviation-approved` ➔ `closed`.',
    tip: 'POA&Ms track deviations through a formal workflow: `open` ➔ `deviation-requested` ➔ `deviation-approved` ➔ `closed`.'
  },
  {
    id: 'crosswalk-map',
    action: 'Map Control Across Frameworks (Crosswalk)',
    category: 'structure',
    icon: '🔗',
    catalogBehavior:
      'Controls declare standard requirements independently without knowledge of external frameworks.',
    catalogJson: '/* Pure standard requirement */',
    profileBehavior:
      'Profiles tailor within a catalog ecosystem but do not define cross-standard equivalence matrices.',
    profileJson: '/* Framework-specific tailoring */',
    sspBehavior:
      'Leverages crosswalk mappings to satisfy multiple compliance standard audits from a single system implementation.',
    sspJson: '/* Inherits cross-framework coverage */',
    oscalMechanism: 'OSCAL Mapping Collection (`mappings[].maps[].relationship`)',
    practicalTip:
      'Uses 6 formal NIST relationship tokens: `equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`.',
    tip: 'Uses 6 formal NIST relationship tokens: `equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`.'
  }
];

/**
 * Filter action comparisons by category or search term.
 */
export function filterActionComparisons(
  items: ActionComparisonItem[],
  query?: string,
  category?: ActionCategory | 'all'
): ActionComparisonItem[] {
  let result = items;
  if (category && category !== 'all') {
    result = result.filter((item) => item.category === category);
  }
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    result = result.filter(
      (item) =>
        item.action.toLowerCase().includes(q) ||
        item.catalogBehavior.toLowerCase().includes(q) ||
        item.profileBehavior.toLowerCase().includes(q) ||
        (item.sspBehavior && item.sspBehavior.toLowerCase().includes(q)) ||
        item.catalogJson.toLowerCase().includes(q) ||
        item.profileJson.toLowerCase().includes(q) ||
        (item.sspJson && item.sspJson.toLowerCase().includes(q)) ||
        item.oscalMechanism.toLowerCase().includes(q) ||
        item.practicalTip.toLowerCase().includes(q) ||
        item.tip.toLowerCase().includes(q)
    );
  }
  return result;
}
