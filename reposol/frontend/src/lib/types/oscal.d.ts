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

export interface Role {
  id: string;
  title: string;
  'short-name'?: string;
  description?: string;
  props?: Property[];
  links?: Link[];
  remarks?: string;
  [key: string]: unknown;
}

export interface Party {
  uuid: string;
  type: 'person' | 'organization' | string;
  name?: string;
  'short-name'?: string;
  'email-addresses'?: string[];
  'telephone-numbers'?: Array<{ type?: string; number: string }>;
  addresses?: Array<Record<string, unknown>>;
  props?: Property[];
  links?: Link[];
  remarks?: string;
  [key: string]: unknown;
}

export interface Metadata {
  title: string;
  version: string;
  'oscal-version': string;
  'last-modified'?: string;
  published?: string;
  props?: Property[];
  links?: Link[];
  roles?: (Role | Record<string, unknown>)[];
  locations?: Record<string, unknown>[];
  parties?: (Party | Record<string, unknown>)[];
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

export interface ImportAP {
  href: string;
  remarks?: string;
}

export interface OriginActor {
  type: 'tool' | 'assessment-platform' | 'party' | string;
  'actor-uuid': string;
  'role-id'?: string;
  props?: Property[];
  links?: Link[];
}

export interface Origin {
  actors: OriginActor[];
  'related-tasks'?: Array<{ 'task-uuid': string; remarks?: string }>;
}

export interface RelevantEvidence {
  href?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface FindingTarget {
  type: 'statement-id' | 'objective-id' | string;
  'target-id': string;
  title?: string;
  description?: string;
  props?: Property[];
  links?: Link[];
  status: {
    state: 'satisfied' | 'not-satisfied' | string;
    reason?: 'pass' | 'fail' | 'other' | string;
    remarks?: string;
  };
  'implementation-status'?: {
    state: 'implemented' | 'partial' | 'planned' | 'alternative' | 'not-applicable' | string;
    remarks?: string;
  };
  remarks?: string;
}

export interface RelatedObservation {
  'observation-uuid': string;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface RelatedRisk {
  'risk-uuid': string;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface Finding {
  uuid: string;
  title: string;
  description: string;
  props?: Property[];
  links?: Link[];
  origins?: Origin[];
  target: FindingTarget;
  'implementation-statement-uuid'?: string;
  'related-observations'?: RelatedObservation[];
  'related-risks'?: RelatedRisk[];
  'related-response'?: Record<string, unknown>[];
  risks?: Risk[];
  remarks?: string;
}

export interface Observation {
  uuid: string;
  title?: string;
  description: string;
  props?: Property[];
  links?: Link[];
  methods: ('EXAMINE' | 'INTERVIEW' | 'TEST' | 'UNKNOWN' | string)[];
  types?: ('ssp-statement-issue' | 'control-objective' | 'mitigation' | 'finding' | 'discovery' | 'historic' | string)[];
  origins?: Origin[];
  subjects?: SubjectReference[];
  'relevant-evidence'?: RelevantEvidence[];
  collected: string;
  expires?: string;
  remarks?: string;
}

export interface RiskFacet {
  name: string;
  system: string;
  value: string;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface RiskCharacterization {
  origin?: Origin;
  date?: string;
  facets: RiskFacet[];
  props?: Property[];
  links?: Link[];
}

export interface RiskMitigatingFactor {
  uuid: string;
  description: string;
  'implementation-uuid'?: string;
  props?: Property[];
  links?: Link[];
  subjects?: SubjectReference[];
}

export interface RiskThreatID {
  system: string;
  id: string;
  href?: string;
}

export interface RiskResponse {
  uuid: string;
  lifecycle: 'recommendation' | 'planned' | 'completed' | string;
  title: string;
  description: string;
  props?: Property[];
  links?: Link[];
  origins?: Origin[];
  'required-assets'?: Array<{ uuid: string; description: string }>;
  tasks?: Task[];
  remarks?: string;
}

export interface RiskLogEntry {
  uuid: string;
  title?: string;
  description?: string;
  start: string;
  end?: string;
  props?: Property[];
  links?: Link[];
  'logged-by'?: Array<{ 'party-uuid': string; 'role-id'?: string; remarks?: string }>;
  'status-change'?: 'open' | 'investigating' | 'remediating' | 'deviation-requested' | 'deviation-approved' | 'closed' | string;
  'related-responses'?: Array<{
    'response-uuid': string;
    props?: Property[];
    links?: Link[];
    'related-tasks'?: Array<{ 'task-uuid': string; remarks?: string }>;
    remarks?: string;
  }>;
  remarks?: string;
}

export interface RiskLog {
  entries: RiskLogEntry[];
}

export interface Risk {
  uuid: string;
  title: string;
  description: string;
  statement: string;
  props?: Property[];
  links?: Link[];
  status: 'open' | 'investigating' | 'remediating' | 'deviation-requested' | 'deviation-approved' | 'closed' | string;
  origins?: Origin[];
  'threat-ids'?: RiskThreatID[];
  characterizations?: RiskCharacterization[];
  'mitigating-factors'?: RiskMitigatingFactor[];
  deadline?: string;
  remediations?: RiskResponse[];
  'risk-log'?: RiskLog;
  'related-observations'?: RelatedObservation[];
  remarks?: string;
}

export interface AssessmentLogEntry {
  uuid: string;
  title?: string;
  description?: string;
  start: string;
  end?: string;
  props?: Property[];
  links?: Link[];
  'logged-by'?: Array<{ 'party-uuid': string; 'role-id'?: string; remarks?: string }>;
  'related-tasks'?: Array<{ 'task-uuid': string; remarks?: string }>;
  remarks?: string;
}

export interface AssessmentLog {
  entries: AssessmentLogEntry[];
}

export interface Attestation {
  'responsible-parties'?: ResponsibleParty[];
  parts: AssessmentPart[];
}

export interface ResultLocalDefinitions {
  components?: SystemComponent[];
  'inventory-items'?: InventoryItem[];
  users?: SystemUser[];
  'assessment-assets'?: AssessmentAssets;
  tasks?: Task[];
  remarks?: string;
}

export interface Result {
  uuid: string;
  title: string;
  description: string;
  start: string;
  end?: string;
  props?: Property[];
  links?: Link[];
  'local-definitions'?: ResultLocalDefinitions;
  'reviewed-controls': ReviewedControls;
  attestations?: Attestation[];
  'assessment-log'?: AssessmentLog;
  observations?: Observation[];
  risks?: Risk[];
  findings?: Finding[];
  remarks?: string;
}

export interface AssessmentResults {
  uuid: string;
  metadata: Metadata;
  'import-ap'?: ImportAP;
  'local-definitions'?: LocalDefinitions;
  results: Result[];
  'back-matter'?: BackMatter;
}

export interface AssessmentResultsDocument {
  'assessment-results': AssessmentResults;
}

export interface POAMItem {
  uuid: string;
  title: string;
  description: string;
  props?: Property[];
  'related-observations'?: Record<string, unknown>[];
  'related-risks'?: Record<string, unknown>[];
  'related-findings'?: Record<string, unknown>[];
  remarks?: string;
}

export interface PlanOfActionAndMilestones {
  uuid: string;
  metadata: Metadata;
  'import-ssp'?: { href: string; remarks?: string };
  'system-id'?: SystemId;
  'local-definitions'?: {
    components?: DefinedComponent[];
    users?: SystemUser[];
    remarks?: string;
  };
  'poam-items': POAMItem[];
  findings?: Finding[];
  observations?: Observation[];
  risks?: Risk[];
  'back-matter'?: BackMatter;
}

export type MappingMethod = 'human' | 'automation' | 'hybrid';
export type MappingMatchingRationale = 'syntactic' | 'semantic' | 'functional';
export type MappingStatus = 'complete' | 'not-complete' | 'draft' | 'deprecated' | 'superseded';
export type MappingRelationship = 'equivalent-to' | 'equal-to' | 'subset-of' | 'superset-of' | 'intersects-with' | 'no-relationship';

export interface MappingResourceReference {
  href: string;
  type: 'catalog' | 'profile';
  uuid?: string;
  title?: string;
}

export interface MappingItem {
  'id-ref': string;
  type: 'control' | 'statement';
}

export interface MapEntry {
  uuid: string;
  relationship: MappingRelationship;
  sources: MappingItem[];
  targets: MappingItem[];
  'matching-rationale'?: MappingMatchingRationale;
  'confidence-score'?: number;
  coverage?: number;
  remarks?: string;
  props?: Property[];
  links?: Link[];
}

export interface MappingProvenance {
  method: MappingMethod;
  'matching-rationale': MappingMatchingRationale;
  status: MappingStatus;
  'mapping-description': string;
  'responsible-parties'?: ResponsibleParty[];
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface Mapping {
  uuid: string;
  'source-resource': MappingResourceReference;
  'target-resource': MappingResourceReference;
  maps: MapEntry[];
  method?: MappingMethod;
  'matching-rationale'?: MappingMatchingRationale;
  status?: MappingStatus;
  'mapping-description'?: string;
  'confidence-score'?: number;
  coverage?: number;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}

export interface MappingCollection {
  uuid: string;
  metadata: Metadata;
  provenance?: MappingProvenance;
  mappings?: Mapping[];
  'back-matter'?: BackMatter;
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

