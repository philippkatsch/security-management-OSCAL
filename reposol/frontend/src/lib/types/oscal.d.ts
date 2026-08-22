export type OscalStage = 'catalog' | 'profile' | 'component-definition' | 'ssp' | 'assessment-plan' | 'assessment-results' | 'poam' | 'mapping' | 'catalogs' | 'profiles' | 'component-definitions' | 'ssps' | 'assessment-plans' | 'poams' | 'mappings' | 'control-mappings';

export interface Property {
  name: string;
  value: string;
  ns?: string;
  class?: string;
  uuid?: string;
}

export interface Link {
  href: string;
  rel?: string;
  'media-type'?: string;
  text?: string;
}

export interface Metadata {
  title: string;
  version: string;
  'oscal-version': string;
  'last-modified'?: string;
  props?: Property[];
  links?: Link[];
  roles?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  parties?: Record<string, unknown>[];
  'responsible-parties'?: Record<string, unknown>[];
  remarks?: string;
}

export interface Parameter {
  id: string;
  class?: string;
  label?: string;
  usage?: string;
  constraints?: Record<string, unknown>[];
  guidelines?: Record<string, unknown>[];
  values?: string[];
  select?: Record<string, unknown>;
  remarks?: string;
}

export interface Part {
  id?: string;
  name: string;
  ns?: string;
  class?: string;
  title?: string;
  props?: Property[];
  prose?: string;
  parts?: Part[];
  links?: Link[];
}

export interface Control {
  id: string;
  class?: string;
  title: string;
  params?: Parameter[];
  props?: Property[];
  parts?: Part[];
  links?: Link[];
  controls?: Control[];
}

export interface Group {
  id?: string;
  class?: string;
  title: string;
  params?: Parameter[];
  props?: Property[];
  parts?: Part[];
  controls?: Control[];
  groups?: Group[];
}

export interface Resource {
  uuid: string;
  title?: string;
  description?: string;
  props?: Property[];
  'document-ids'?: Record<string, unknown>[];
  citation?: Record<string, unknown>;
  rlinks?: Record<string, unknown>[];
  base64?: Record<string, unknown>;
}

export interface BackMatter {
  resources?: Resource[];
}

export interface Catalog {
  uuid: string;
  metadata: Metadata;
  groups?: Group[];
  controls?: Control[];
  params?: Parameter[];
  'back-matter'?: BackMatter;
}

export interface ProfileImport {
  href: string;
  'include-all'?: Record<string, unknown>;
  'include-controls'?: Record<string, unknown>[];
  'exclude-controls'?: Record<string, unknown>[];
}

export interface Merge {
  combine?: Record<string, unknown>;
  flat?: Record<string, unknown>;
  custom?: Record<string, unknown>;
  'as-is'?: Record<string, unknown>;
}

export interface SetParameter {
  'param-id': string;
  values?: string[];
  label?: string;
  usage?: string;
  constraints?: Record<string, unknown>[];
}

export interface Addition {
  position?: 'before' | 'after' | 'starting' | 'ending';
  'by-id'?: string;
  title?: string;
  params?: Parameter[];
  props?: Property[];
  parts?: Part[];
  links?: Link[];
}

export interface Removal {
  'by-name'?: string;
  'by-class'?: string;
  'by-id'?: string;
  'by-ns'?: string;
  'by-item-name'?: string;
}

export interface ProfileAlter {
  id?: string;
  'control-id': string;
  adds?: Addition[];
  removes?: Removal[];
}

export interface Modify {
  'set-parameters'?: SetParameter[];
  alters?: ProfileAlter[];
}

export interface Profile {
  uuid: string;
  metadata: Metadata;
  imports: ProfileImport[];
  merge?: Merge;
  modify?: Modify;
  'back-matter'?: BackMatter;
}

export interface ComponentDefinition {
  uuid: string;
  metadata: Metadata;
  components?: Record<string, unknown>[];
}

export interface SystemCharacteristics {
  'system-name': string;
  description: string;
  'security-sensitivity-level': string;
  'system-information': Record<string, unknown>;
  'security-impact-level'?: Record<string, unknown>;
  'authorization-boundary'?: Record<string, unknown>;
}

export interface SystemImplementation {
  users?: Record<string, unknown>[];
  components?: Record<string, unknown>[];
  'inventory-items'?: Record<string, unknown>[];
}

export interface ImplementedRequirement {
  uuid: string;
  'control-id': string;
  description: string;
  props?: Property[];
  'responsible-roles'?: Record<string, unknown>[];
  statements?: Record<string, unknown>[];
  'by-components'?: Record<string, unknown>[];
}

export interface ControlImplementation {
  description: string;
  'implemented-requirements': ImplementedRequirement[];
}

export interface SystemSecurityPlan {
  uuid: string;
  metadata: Metadata;
  'import-profile': Record<string, unknown>;
  'system-characteristics': SystemCharacteristics;
  'system-implementation': SystemImplementation;
  'control-implementation': ControlImplementation;
  'back-matter'?: BackMatter;
}

export interface Result {
  uuid: string;
  title: string;
  description: string;
  start: string;
  end?: string;
  props?: Property[];
  'reviewed-controls'?: Record<string, unknown>[];
  'assessment-subjects'?: Record<string, unknown>[];
  attestations?: Record<string, unknown>[];
  'assessment-log'?: Record<string, unknown>;
  observations?: Observation[];
  risks?: Risk[];
  findings?: Finding[];
}

export interface AssessmentPlan {
  uuid: string;
  metadata: Metadata;
  'import-ssp'?: Record<string, unknown>;
  'local-definitions'?: Record<string, unknown>;
  'terms-and-conditions'?: Record<string, unknown>;
  'reviewed-controls'?: Record<string, unknown>;
  'assessment-subjects'?: Record<string, unknown>[];
  'assessment-assets'?: Record<string, unknown>;
  tasks?: Task[];
}

export interface AssessmentResults {
  uuid: string;
  metadata: Metadata;
  'import-ap'?: Record<string, unknown>;
  'local-definitions'?: Record<string, unknown>;
  results: Result[];
}

export interface POAMItem {
  uuid: string;
  title: string;
  description: string;
  props?: Property[];
  'related-observations'?: Record<string, unknown>[];
  'related-risks'?: Record<string, unknown>[];
  remarks?: string;
}

export interface Finding {
  uuid: string;
  title: string;
  description: string;
  props?: Property[];
  target?: Record<string, unknown>;
  'related-observations'?: Record<string, unknown>[];
  'related-risks'?: Record<string, unknown>[];
  remarks?: string;
}

export interface Observation {
  uuid: string;
  title?: string;
  description: string;
  props?: Property[];
  methods: string[];
  types?: string[];
  subjects?: Record<string, unknown>[];
  'relevant-evidence'?: Record<string, unknown>[];
  collected?: string;
  expires?: string;
  remarks?: string;
}

export interface Risk {
  uuid: string;
  title: string;
  description: string;
  props?: Property[];
  status?: string;
  origins?: Record<string, unknown>[];
  'threat-ids'?: Record<string, unknown>[];
  characterizations?: Record<string, unknown>[];
  'mitigating-factors'?: Record<string, unknown>[];
  remediations?: Record<string, unknown>[];
  'risk-log'?: Record<string, unknown>;
  remarks?: string;
}

export interface Activity {
  uuid: string;
  title?: string;
  description: string;
  props?: Property[];
  'related-controls'?: Record<string, unknown>[];
  'responsible-roles'?: Record<string, unknown>[];
  steps?: Record<string, unknown>[];
}

export interface Task {
  uuid: string;
  type: string;
  title: string;
  description?: string;
  props?: Property[];
  timing?: Record<string, unknown>;
  dependencies?: Record<string, unknown>[];
  activities?: Activity[];
  'associated-activities'?: Record<string, unknown>[];
  subjects?: Record<string, unknown>[];
  'responsible-roles'?: Record<string, unknown>[];
  remarks?: string;
}

export interface PlanOfActionAndMilestones {
  uuid: string;
  metadata: Metadata;
  'import-ssp'?: Record<string, unknown>;
  'system-id'?: Record<string, unknown>;
  'local-definitions'?: Record<string, unknown>;
  'poam-items': POAMItem[];
}

export interface MappingCollection {
  uuid: string;
  metadata: Metadata;
  'import-ssp'?: Record<string, unknown>;
  'local-definitions'?: Record<string, unknown>;
  mappings?: Record<string, unknown>[];
}

export interface OscalDocument {
  catalog?: Catalog;
  profile?: Profile;
  'component-definition'?: ComponentDefinition;
  'system-security-plan'?: SystemSecurityPlan;
  'assessment-plan'?: AssessmentPlan;
  'assessment-results'?: AssessmentResults;
  'plan-of-action-and-milestones'?: PlanOfActionAndMilestones;
  'mapping-collection'?: MappingCollection;
}
