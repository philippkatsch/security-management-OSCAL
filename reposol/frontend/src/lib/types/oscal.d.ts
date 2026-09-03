export type OscalStage = 'catalog' | 'profile' | 'component-definition' | 'ssp' | 'assessment-plan' | 'assessment-results' | 'poam' | 'mapping' | 'catalogs' | 'profiles' | 'component-definitions' | 'ssps' | 'assessment-plans' | 'poams' | 'mappings' | 'control-mappings';

export interface Property {
  name: string;
  value: string;
  ns?: string;
  class?: string;
  uuid?: string;
  group?: string;
  remarks?: string;
}

export interface Link {
  href: string;
  rel?: string;
  'media-type'?: string;
  text?: string;
  'resource-fragment'?: string;
}

export interface Metadata {
  title: string;
  version: string;
  'oscal-version': string;
  'last-modified'?: string;
  published?: string;
  props?: Property[];
  links?: Link[];
  roles?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  parties?: Record<string, unknown>[];
  'responsible-parties'?: Record<string, unknown>[];
  'document-ids'?: Record<string, unknown>[];
  revisions?: Record<string, unknown>[];
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
  props?: Property[];
  links?: Link[];
  'depends-on'?: string;
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

export interface Hash {
  algorithm: string;
  value: string;
}

export interface Rlink {
  href: string;
  'media-type'?: string;
  hashes?: Hash[];
}

export interface Base64Attachment {
  filename?: string;
  'media-type'?: string;
  value: string;
}

export interface Resource {
  uuid: string;
  title?: string;
  description?: string;
  props?: Property[];
  'document-ids'?: Record<string, unknown>[];
  citation?: Record<string, unknown>;
  rlinks?: Rlink[];
  base64?: Base64Attachment;
  remarks?: string;
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
  'as-is'?: boolean;
}

export interface ResponsibleRole {
  'role-id': string;
  props?: Property[];
  links?: Link[];
  'party-uuids'?: string[];
  remarks?: string;
}

export interface ResponsibleParty {
  'role-id': string;
  'party-uuids': string[];
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface SetParameter {
  'param-id': string;
  values?: string[];
  remarks?: string;
  label?: string;
  usage?: string;
  constraints?: Record<string, unknown>[];
  guidelines?: Record<string, unknown>[];
  select?: Record<string, unknown>;
  props?: Property[];
  links?: Link[];
  class?: string;
  'depends-on'?: string;
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

// ==========================================
// Step 3: Component Definition Subsystem
// ==========================================

export interface ServicePortRange {
  start: number;
  end: number;
  transport?: 'TCP' | 'UDP';
}

export type PortRange = ServicePortRange;

export interface ServiceProtocol {
  uuid?: string;
  name: string;
  title?: string;
  'port-ranges'?: PortRange[];
}

export interface ComponentStatement {
  'statement-id': string;
  uuid: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export interface ComponentImplementedRequirement {
  uuid: string;
  'control-id': string;
  description: string;
  props?: Property[];
  links?: Link[];
  'set-parameters'?: SetParameter[];
  'responsible-roles'?: ResponsibleRole[];
  statements?: ComponentStatement[];
  remarks?: string;
}

export interface ComponentControlImplementation {
  uuid: string;
  source: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'set-parameters'?: SetParameter[];
  'implemented-requirements': ComponentImplementedRequirement[];
}

export interface IncorporatesComponent {
  'component-uuid': string;
  description: string;
}

export interface Capability {
  uuid: string;
  name: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'incorporates-components'?: IncorporatesComponent[];
  'control-implementations'?: ComponentControlImplementation[];
  remarks?: string;
}

export type DefinedComponentType =
  | 'interconnection'
  | 'software'
  | 'hardware'
  | 'service'
  | 'policy'
  | 'physical'
  | 'process-procedure'
  | 'plan'
  | 'guidance'
  | 'standard'
  | 'validation'
  | string;

export interface DefinedComponent {
  uuid: string;
  type: DefinedComponentType;
  title: string;
  description: string;
  purpose?: string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
  protocols?: ServiceProtocol[];
  'control-implementations'?: ComponentControlImplementation[];
  remarks?: string;
}

export interface ImportComponentDefinition {
  href: string;
  remarks?: string;
}

export interface ComponentDefinition {
  uuid: string;
  metadata: Metadata;
  'import-component-definitions'?: ImportComponentDefinition[];
  components?: DefinedComponent[];
  capabilities?: Capability[];
  'back-matter'?: BackMatter;
}

// ==========================================
// Step 4: SSP Subsystem (NIST OSCAL SSP v1.2.2)
// ==========================================

export interface ImportProfile {
  href: string;
  remarks?: string;
}

export interface SystemId {
  id: string;
  'identifier-type'?: string;
}

export type SystemStatusState =
  | 'operational'
  | 'under-development'
  | 'under-major-modification'
  | 'disposition'
  | 'other'
  | string;

export interface SystemStatus {
  state: SystemStatusState;
  remarks?: string;
}

export interface ImpactLevel {
  props?: Property[];
  links?: Link[];
  base: string;
  selected?: string;
  'adjustment-justification'?: string;
}

export interface InformationTypeCategorization {
  system: string;
  'information-type-ids'?: string[];
}

export interface InformationType {
  uuid?: string;
  title: string;
  description: string;
  categorizations?: InformationTypeCategorization[];
  props?: Property[];
  links?: Link[];
  'confidentiality-impact'?: ImpactLevel;
  'integrity-impact'?: ImpactLevel;
  'availability-impact'?: ImpactLevel;
}

export interface SystemInformation {
  props?: Property[];
  links?: Link[];
  'information-types': InformationType[];
}

export interface SecurityImpactLevel {
  'security-objective-confidentiality': string;
  'security-objective-integrity': string;
  'security-objective-availability': string;
}

export interface Diagram {
  uuid: string;
  description?: string;
  props?: Property[];
  links?: Link[];
  caption?: string;
  remarks?: string;
}

export interface AuthorizationBoundary {
  description: string;
  props?: Property[];
  links?: Link[];
  diagrams?: Diagram[];
  remarks?: string;
}

export interface NetworkArchitecture {
  description: string;
  props?: Property[];
  links?: Link[];
  diagrams?: Diagram[];
  remarks?: string;
}

export interface DataFlow {
  description: string;
  props?: Property[];
  links?: Link[];
  diagrams?: Diagram[];
  remarks?: string;
}

export interface SystemCharacteristics {
  'system-ids': SystemId[];
  'system-name': string;
  'system-name-short'?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'date-authorized'?: string;
  'security-sensitivity-level': string;
  'system-information': SystemInformation;
  'security-impact-level'?: SecurityImpactLevel;
  status: SystemStatus;
  'authorization-boundary': AuthorizationBoundary;
  'network-architecture'?: NetworkArchitecture;
  'data-flow'?: DataFlow;
  'responsible-parties'?: ResponsibleParty[];
  remarks?: string;
}

export interface AuthorizedPrivilege {
  title: string;
  description?: string;
  'functions-performed': string[];
}

export interface SystemUser {
  uuid: string;
  title?: string;
  'short-name'?: string;
  description?: string;
  props?: Property[];
  links?: Link[];
  'role-ids'?: string[];
  'authorized-privileges'?: AuthorizedPrivilege[];
  remarks?: string;
}

export type SystemComponentType =
  | 'this-system'
  | 'system'
  | 'interconnection'
  | 'software'
  | 'hardware'
  | 'service'
  | 'policy'
  | 'physical'
  | 'process-procedure'
  | 'plan'
  | 'guidance'
  | 'standard'
  | 'validation'
  | 'network'
  | string;

export interface SystemComponentStatus {
  state: 'under-development' | 'operational' | 'disposition' | 'other' | string;
  remarks?: string;
}

export interface SystemComponent {
  uuid: string;
  type: SystemComponentType;
  title: string;
  description: string;
  purpose?: string;
  props?: Property[];
  links?: Link[];
  status: SystemComponentStatus;
  'responsible-roles'?: ResponsibleRole[];
  protocols?: ServiceProtocol[];
  remarks?: string;
}

export interface LeveragedAuthorization {
  uuid: string;
  title: string;
  props?: Property[];
  links?: Link[];
  'party-uuid': string;
  'date-authorized': string;
  remarks?: string;
}

export interface ImplementedComponent {
  'component-uuid': string;
  props?: Property[];
  links?: Link[];
  'responsible-parties'?: ResponsibleParty[];
  remarks?: string;
}

export interface InventoryItem {
  uuid: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'responsible-parties'?: ResponsibleParty[];
  'implemented-components'?: ImplementedComponent[];
  remarks?: string;
}

export interface SystemImplementation {
  props?: Property[];
  links?: Link[];
  'leveraged-authorizations'?: LeveragedAuthorization[];
  users?: SystemUser[];
  components?: SystemComponent[];
  'inventory-items'?: InventoryItem[];
  remarks?: string;
}

export interface ProvidedControlImplementation {
  uuid: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export interface ResponsibilityControlImplementation {
  uuid: string;
  'provided-uuid'?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export interface ExportControlImplementation {
  description?: string;
  props?: Property[];
  links?: Link[];
  provided?: ProvidedControlImplementation[];
  responsibilities?: ResponsibilityControlImplementation[];
  remarks?: string;
}

export interface InheritedControlImplementation {
  uuid: string;
  'provided-uuid'?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
}

export interface SatisfiedControlImplementation {
  uuid: string;
  'responsibility-uuid'?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export type ImplementationStatusState =
  | 'implemented'
  | 'partial'
  | 'planned'
  | 'alternative'
  | 'not-applicable'
  | string;

export interface ImplementationStatus {
  state: ImplementationStatusState;
  remarks?: string;
}

export interface ByComponent {
  'component-uuid': string;
  uuid: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'set-parameters'?: SetParameter[];
  'implementation-status'?: ImplementationStatus;
  export?: ExportControlImplementation;
  inherited?: InheritedControlImplementation[];
  satisfied?: SatisfiedControlImplementation[];
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export interface StatementImplementation {
  'statement-id': string;
  uuid: string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
  'by-components'?: ByComponent[];
  remarks?: string;
}

export interface ImplementedRequirement {
  uuid: string;
  'control-id': string;
  description?: string;
  props?: Property[];
  links?: Link[];
  'set-parameters'?: SetParameter[];
  'responsible-roles'?: ResponsibleRole[];
  statements?: StatementImplementation[];
  'by-components'?: ByComponent[];
  remarks?: string;
}

export interface ControlImplementation {
  description: string;
  'set-parameters'?: SetParameter[];
  'implemented-requirements': ImplementedRequirement[];
}

export interface SystemSecurityPlan {
  uuid: string;
  metadata: Metadata;
  'import-profile': ImportProfile;
  'system-characteristics': SystemCharacteristics;
  'system-implementation': SystemImplementation;
  'control-implementation': ControlImplementation;
  'back-matter'?: BackMatter;
}

// ==========================================
// Step 5: Assessment Plan Subsystem (NIST OSCAL AP v1.2.2)
// ==========================================

export interface ImportSSP {
  href: string;
  remarks?: string;
}

export interface SelectControlById {
  'control-id': string;
  'statement-ids'?: string[];
}

export interface ControlSelection {
  description?: string;
  props?: Property[];
  links?: Link[];
  'include-all'?: Record<string, unknown>;
  'include-controls'?: SelectControlById[];
  'exclude-controls'?: SelectControlById[];
  remarks?: string;
}

export interface SelectObjectiveById {
  'objective-id': string;
}

export interface ControlObjectiveSelection {
  description?: string;
  props?: Property[];
  links?: Link[];
  'include-all'?: Record<string, unknown>;
  'include-objectives'?: SelectObjectiveById[];
  'exclude-objectives'?: SelectObjectiveById[];
  remarks?: string;
}

export interface ReviewedControls {
  description?: string;
  props?: Property[];
  links?: Link[];
  'control-selections': ControlSelection[];
  'control-objective-selections'?: ControlObjectiveSelection[];
  remarks?: string;
}

export type AssessmentSubjectType =
  | 'component'
  | 'inventory-item'
  | 'location'
  | 'party'
  | 'user'
  | 'resource'
  | string;

export interface SelectSubjectById {
  'subject-uuid': string;
  type: AssessmentSubjectType;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface SubjectReference {
  'subject-uuid': string;
  type: AssessmentSubjectType;
  title?: string;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface AssessmentSubject {
  type: AssessmentSubjectType;
  description?: string;
  props?: Property[];
  links?: Link[];
  'include-all'?: Record<string, unknown>;
  'include-subjects'?: SelectSubjectById[];
  'exclude-subjects'?: SelectSubjectById[];
  remarks?: string;
}

export interface AssessmentSubjectPlaceholderSource {
  'task-uuid': string;
}

export interface AssessmentSubjectPlaceholder {
  uuid: string;
  description?: string;
  sources: AssessmentSubjectPlaceholderSource[];
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface UsesComponent {
  'component-uuid': string;
  props?: Property[];
  links?: Link[];
  'responsible-parties'?: ResponsibleParty[];
  remarks?: string;
}

export interface AssessmentPlatform {
  uuid: string;
  title?: string;
  props?: Property[];
  links?: Link[];
  'uses-components'?: UsesComponent[];
  remarks?: string;
}

export interface AssessmentAssets {
  components?: SystemComponent[];
  'assessment-platforms': AssessmentPlatform[];
}

export interface AssessmentPart {
  uuid?: string;
  name: string;
  ns?: string;
  class?: string;
  title?: string;
  props?: Property[];
  prose?: string;
  parts?: AssessmentPart[];
  links?: Link[];
}

export type AssessmentMethodEnum = 'INTERVIEW' | 'EXAMINE' | 'TEST';

export interface LocalObjective {
  'control-id': string;
  description?: string;
  props?: Property[];
  links?: Link[];
  parts: (Part | AssessmentPart)[];
  remarks?: string;
}

export interface ActivityStep {
  uuid: string;
  title?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  'reviewed-controls'?: ReviewedControls;
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export interface LocalActivity {
  uuid: string;
  title?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  steps?: ActivityStep[];
  'related-controls'?: ReviewedControls;
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export type Activity = LocalActivity;

export interface LocalDefinitions {
  components?: SystemComponent[];
  'inventory-items'?: InventoryItem[];
  users?: SystemUser[];
  'objectives-and-methods'?: LocalObjective[];
  activities?: LocalActivity[];
  remarks?: string;
}

export type TermsPartNameEnum =
  | 'rules-of-engagement'
  | 'disclosures'
  | 'assessment-inclusions'
  | 'assessment-exclusions'
  | 'results-delivery'
  | 'assumptions'
  | 'methodology'
  | string;

export interface TermsPart extends AssessmentPart {
  name: TermsPartNameEnum;
}

export interface TermsAndConditions {
  parts: (TermsPart | AssessmentPart)[];
}

export type TaskTimeUnitEnum =
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'months'
  | 'years';

export interface TaskTimingOnDate {
  'on-date': {
    date: string;
  };
}

export interface TaskTimingWithinDateRange {
  'within-date-range': {
    start: string;
    end: string;
  };
}

export interface TaskTimingAtFrequency {
  'at-frequency': {
    period: number;
    unit: TaskTimeUnitEnum;
  };
}

export type TaskTiming =
  | TaskTimingOnDate
  | TaskTimingWithinDateRange
  | TaskTimingAtFrequency;

export interface TaskDependency {
  'task-uuid': string;
  remarks?: string;
}

export interface AssociatedActivity {
  'activity-uuid': string;
  props?: Property[];
  links?: Link[];
  'responsible-roles'?: ResponsibleRole[];
  subjects: AssessmentSubject[];
  remarks?: string;
}

export type TaskTypeEnum = 'milestone' | 'action' | string;

export interface Task {
  uuid: string;
  type: TaskTypeEnum;
  title: string;
  description?: string;
  props?: Property[];
  links?: Link[];
  timing?: TaskTiming;
  dependencies?: TaskDependency[];
  tasks?: Task[];
  activities?: LocalActivity[];
  'associated-activities'?: AssociatedActivity[];
  subjects?: AssessmentSubject[];
  'responsible-roles'?: ResponsibleRole[];
  remarks?: string;
}

export interface AssessmentPlan {
  uuid: string;
  metadata: Metadata;
  'import-ssp': ImportSSP;
  'local-definitions'?: LocalDefinitions;
  'terms-and-conditions'?: TermsAndConditions;
  'reviewed-controls': ReviewedControls;
  'assessment-subjects'?: AssessmentSubject[];
  'assessment-assets'?: AssessmentAssets;
  tasks?: Task[];
  'back-matter'?: BackMatter;
}

// ==========================================
// Step 6-8: Assessment Results, POA&M & Assurance
// ==========================================

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

export interface AssessmentResults {
  uuid: string;
  metadata: Metadata;
  'import-ap'?: Record<string, unknown>;
  'local-definitions'?: LocalDefinitions;
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
