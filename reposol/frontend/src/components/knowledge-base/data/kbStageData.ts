/**
 * OSCAL Knowledge Base - User-Friendly 8-Stage Domain Data
 * 
 * Clean, practitioner-focused documentation covering all 8 stages of the NIST OSCAL lifecycle:
 * 1. Catalogs (Standard Control Rulebooks)
 * 2. Profiles (Organizational Baseline Tailoring)
 * 3. Component Definitions (Architecture & IT Inventory)
 * 4. System Security Plans (System Implementation)
 * 5. Assessment Plans (Audit Planning & Scoping)
 * 6. Assessment Results (Audit Execution & Findings)
 * 7. Plan of Action and Milestones (Remediation & Vulnerability Tracking)
 * 8. Control Mappings (Cross-Framework Crosswalk & Gap Analysis)
 */

export type OscalStageId =
  | 'catalogs'
  | 'profiles'
  | 'component-definitions'
  | 'ssps'
  | 'assessment-plans'
  | 'assessment-results'
  | 'poams'
  | 'control-mappings';

export interface StageWorkflowPhase {
  phaseNumber: number;
  title: string;
  subtitle: string;
  description: string;
  whatYouDo: string[];
}

export interface StageFeatureHighlight {
  title: string;
  description: string;
  icon: string;
}

export interface OscalStageGuide {
  id: OscalStageId;
  stepNumber: number;
  title: string;
  shortTitle: string;
  label: string;
  icon: string;
  category: 'Design & Baseline' | 'Implementation' | 'Assessment & Audit' | 'Cross-Framework';
  badgeLabel: string;
  tagline: string;
  whyItExists: {
    overview: string;
    whoCreatesIt: string;
    howItIsReused: string;
    realWorldExamples: string[];
  };
  workflowSequence: {
    startHereAdvice: string;
    prerequisites: string;
    whatYouProduce: string;
    nextStep: {
      stageId?: OscalStageId;
      label: string;
      description: string;
    };
  };
  keyPhases: StageWorkflowPhase[];
  reposolCapabilities: StageFeatureHighlight[];
}

export const STAGE_IDS: OscalStageId[] = [
  'catalogs',
  'profiles',
  'component-definitions',
  'ssps',
  'assessment-plans',
  'assessment-results',
  'poams',
  'control-mappings'
];

export const OSCAL_STAGE_GUIDES: OscalStageGuide[] = [
  // -------------------------------------------------------------------------
  // STEP 1: CATALOGS
  // -------------------------------------------------------------------------
  {
    id: 'catalogs',
    stepNumber: 1,
    title: 'Step 1: Security Control Catalogs',
    shortTitle: 'Control Catalogs',
    label: 'Catalogs',
    icon: '📖',
    category: 'Design & Baseline',
    badgeLabel: 'Step 1 in Lifecycle',
    tagline: 'The authoritative source rulebooks authored by regulatory bodies and security frameworks.',
    whyItExists: {
      overview:
        'A Control Catalog is the master library of security requirements and best practices. Instead of every company writing its own security rules from scratch, standard bodies publish complete, structured catalogs of controls that define what good security looks like.',
      whoCreatesIt:
        'Standardization bodies (such as NIST in the United States, BSI in Germany, ISO internationally) or industry consortiums (CIS). Organizations can also create internal custom catalogs for proprietary policies.',
      howItIsReused:
        'Catalogs are the foundational building blocks. They are never modified directly when applying them to a company; instead, you import them into Profiles (Step 2) to select and customize the controls you actually need.',
      realWorldExamples: [
        'NIST SP 800-53 Rev. 5 (Security and Privacy Controls for Information Systems)',
        'BSI IT-Grundschutz Kompendium (German Federal Office for Information Security standard)',
        'ISO/IEC 27001:2022 Annex A (Information Security Management Controls)',
        'CIS Critical Security Controls v8'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'Start here if you need to create a new proprietary control framework or want to inspect standard rulebooks. If you already use NIST SP 800-53 or BSI Grundschutz, you can jump straight to Step 2 (Profiles) and import them.',
      prerequisites: 'None. Catalogs are completely independent and stand on their own as authoritative sources.',
      whatYouProduce: 'An authoritative Catalog containing organized groups of security controls, requirements, guidance, and configurable parameters.',
      nextStep: {
        stageId: 'profiles',
        label: 'Step 2: Profile Tailoring',
        description: 'Import your catalog into a Profile to tailor an organizational baseline for your specific risk level.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'Structure & Categorization',
        subtitle: 'Organize controls into logical domains and families',
        description: 'Group related controls into families (e.g. Access Control, Incident Response, Cryptography) to keep large catalogs easy to navigate.',
        whatYouDo: [
          'Create top-level groups and nested sub-groups representing security domains.',
          'Assign descriptive identifiers (e.g. AC for Access Control, IA for Identification & Authentication).'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Control Authoring & Guidance',
        subtitle: 'Define statements, objectives, and implementation guidance',
        description: 'Write the exact normative requirements that systems must satisfy, along with clarifying background explanations.',
        whatYouDo: [
          'Add control titles and structured requirement statements (e.g. "The organization must enforce...").',
          'Include official guidance and supplemental rationale to assist implementers and auditors.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Parameterization',
        subtitle: 'Define configurable variables and placeholder values',
        description: 'Allow requirements to be flexible by defining parameters (e.g. [assignment: password length], [selection: weekly | monthly]).',
        whatYouDo: [
          'Insert parameter placeholders inside control statements.',
          'Define default options or allowable value constraints for downstream tailoring.'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'Pre-Loaded Standard Catalogs',
        description: 'Instantly access official, machine-readable NIST SP 800-53, BSI IT-Grundschutz, and ISO catalogs.',
        icon: '📚'
      },
      {
        title: 'Visual Group & Control Tree',
        description: 'Easily navigate, reorder, search, and manage thousands of controls through a high-performance sidebar hierarchy.',
        icon: '🌲'
      },
      {
        title: 'Live Parameter & Constraint Editor',
        description: 'Author and test parameter placeholders with real-time preview and constraint validation.',
        icon: '🏷️'
      },
      {
        title: 'Standard OSCAL Export',
        description: 'Export clean NIST OSCAL 1.1.0 JSON documents ready for distribution, auditing, or import into other tools.',
        icon: '📤'
      }
    ]
  },

  // -------------------------------------------------------------------------
  // STEP 2: PROFILES
  // -------------------------------------------------------------------------
  {
    id: 'profiles',
    stepNumber: 2,
    title: 'Step 2: Profile Tailoring & Baselines',
    shortTitle: 'Profile Tailoring',
    label: 'Profiles',
    icon: '⚙️',
    category: 'Design & Baseline',
    badgeLabel: 'Step 2 in Lifecycle',
    tagline: 'Tailor and customize security baselines without ever mutating the original catalog sources.',
    whyItExists: {
      overview:
        'A full standard catalog (like NIST 800-53 with 1,000+ controls) is too broad for any single organization. A Profile creates an organizational baseline by non-destructively choosing which controls apply to you, filling in parameter values, and adding company-specific requirements.',
      whoCreatesIt:
        'Security Architects, Compliance Officers, or Sector Regulators (e.g., FedRAMP publishes Moderate and High baseline profiles).',
      howItIsReused:
        'Profiles serve as the exact compliance target for your systems. Your System Security Plans (Step 4) and Assessment Plans (Step 5) build directly upon your tailored profile baseline.',
      realWorldExamples: [
        'FedRAMP Moderate Baseline Profile (Tailored subset of NIST SP 800-53)',
        'Company Corporate Information Security Policy Baseline (Customized values and internal rules)',
        'BSI IT-Grundschutz Basic Protection Profile for Cloud Services',
        'PCI-DSS Scoped Compliance Profile'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'This is the heart of compliance tailoring! Most organizations start by creating a Profile that imports a standard catalog and selects the controls required for their certification target.',
      prerequisites: 'At least one published Control Catalog (from Step 1 or a standard source like NIST/BSI).',
      whatYouProduce: 'A Tailored Profile Baseline defining the exact list of in-scope controls, assigned parameters, and organizational additions.',
      nextStep: {
        stageId: 'component-definitions',
        label: 'Step 3: Component Definitions',
        description: 'Document the IT components, software, and services that implement these baseline controls.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'Import & Filter (Select Controls)',
        subtitle: 'Decide which controls are in-scope or excluded',
        description: 'Import one or more source catalogs and select only the controls needed for your organizational baseline.',
        whatYouDo: [
          'Choose source catalogs or existing parent profiles to inherit from.',
          'Use include/exclude rules or pattern matching (e.g. import all AC controls, exclude physical controls).'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Merge & Structure (Organize Hierarchy)',
        subtitle: 'Arrange controls into intuitive navigation folders',
        description: 'Determine how controls from multiple sources are displayed and grouped in your baseline.',
        whatYouDo: [
          'Keep original catalog folders (as-is), flatten into a list, or build custom company folders.',
          'Resolve duplicate controls across different imported catalogs.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Modify & Customize (Tailor Requirements)',
        subtitle: 'Set company parameter values and add custom guidance',
        description: 'Fine-tune controls to reflect organizational policy without modifying the upstream source catalog.',
        whatYouDo: [
          'Assign concrete parameter values (e.g. set password length to "14 characters").',
          'Add company-specific policy statements, additional guidance, or strip inapplicable sub-statements.'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'Multi-Source Catalog Imports',
        description: 'Combine controls from multiple frameworks (e.g. NIST + BSI) into a single unified organizational baseline.',
        icon: '📥'
      },
      {
        title: 'Non-Destructive Overlays',
        description: 'Safely tailor controls with full visual diffs and strikethroughs, ensuring upstream catalog integrity is never broken.',
        icon: '🛡️'
      },
      {
        title: 'Live 3-Phase Profile Resolution',
        description: 'Instant resolution engine showing exactly what the final compiled baseline looks like in real time.',
        icon: '🔄'
      },
      {
        title: 'Custom Grouping & Control Pool',
        description: 'Drag and drop imported controls into customized organizational categories and departmental baselines.',
        icon: '📁'
      }
    ]
  },

  // -------------------------------------------------------------------------
  // STEP 3: COMPONENT DEFINITIONS
  // -------------------------------------------------------------------------
  {
    id: 'component-definitions',
    stepNumber: 3,
    title: 'Step 3: Component Definitions & IT Inventory',
    shortTitle: 'Component Inventory',
    label: 'Component Definitions',
    icon: '🧱',
    category: 'Implementation',
    badgeLabel: 'Step 3 in Lifecycle',
    tagline: 'Document the IT components, cloud services, software, and organizational policies that fulfill security controls.',
    whyItExists: {
      overview:
        'Security controls are not implemented in the abstract—they are fulfilled by concrete software, cloud services, hardware, and operational processes. A Component Definition documents what capabilities your tools provide (e.g. AWS S3 fulfills encryption at rest; Okta fulfills multi-factor authentication).',
      whoCreatesIt:
        'Software Vendors, Cloud Providers (e.g. AWS, Azure, Google Cloud publish OSCAL component models), or internal Enterprise Architecture and DevOps teams.',
      howItIsReused:
        'Components act as reusable Lego bricks. Once you describe how "PostgreSQL" or "AWS GuardDuty" satisfies controls, you can allocate those same components across multiple System Security Plans (Step 4) with zero duplicate documentation.',
      realWorldExamples: [
        'Cloud Service Capability Guide (e.g. AWS S3 implementing access control and encryption controls)',
        'Enterprise Identity Provider (e.g. Okta / Azure AD implementing authentication controls)',
        'Corporate HR Policy Component (Satisfying background check and offboarding controls)',
        'Container Platform Component (e.g. Kubernetes implementing network segmentation)'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'Build your reusable component library so your System Security Plans (SSPs) can simply reference these pre-documented software and cloud capabilities.',
      prerequisites: 'Control Catalogs (Step 1) or Profiles (Step 2) to know which control requirements components satisfy.',
      whatYouProduce: 'A library of reusable Components documenting technical capabilities and the specific controls each component satisfies.',
      nextStep: {
        stageId: 'ssps',
        label: 'Step 4: System Security Plan (SSP)',
        description: 'Assemble components into a concrete system boundary and document the full operational implementation.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'Cataloging Assets & Services',
        subtitle: 'Register software, hardware, services, and policies',
        description: 'Create entries for each technology, tool, or administrative policy used in your IT ecosystem.',
        whatYouDo: [
          'Identify component types (software, hardware, cloud service, validation tool, or policy).',
          'Document vendor, version, deployment model, and architectural purpose.'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Capability Mapping to Controls',
        subtitle: 'Link component features to security control requirements',
        description: 'Describe how the component inherently satisfies specific controls.',
        whatYouDo: [
          'Select controls satisfied by this component (e.g. TLS 1.3 satisfies cryptographic protection).',
          'Write clear implementation descriptions detailing the exact mechanism or configuration used.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Export & Ecosystem Sharing',
        subtitle: 'Share component definitions across projects and teams',
        description: 'Publish component models so development and compliance teams can consume them in their system plans.',
        whatYouDo: [
          'Package component definitions for reuse in enterprise-wide SSP authoring.',
          'Provide standardized configuration guidance for project teams.'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'Component Catalog Manager',
        description: 'Easily register and organize all software, cloud infrastructure, and organizational policies in one place.',
        icon: '📋'
      },
      {
        title: 'Capability-to-Control Linker',
        description: 'Connect component features directly to security controls with rich descriptive statements and parameters.',
        icon: '🔗'
      },
      {
        title: 'Cross-System Reusability',
        description: 'Instantly import component capability models into multiple System Security Plans to prevent redundant write-ups.',
        icon: '🧩'
      }
    ]
  },

  // -------------------------------------------------------------------------
  // STEP 4: SYSTEM SECURITY PLANS (SSP)
  // -------------------------------------------------------------------------
  {
    id: 'ssps',
    stepNumber: 4,
    title: 'Step 4: System Security Plans (SSP)',
    shortTitle: 'System Security Plan',
    label: 'System Security Plans',
    icon: '📝',
    category: 'Implementation',
    badgeLabel: 'Step 4 in Lifecycle',
    tagline: 'The authoritative description of an information system, its boundary, and how it implements its tailored baseline.',
    whyItExists: {
      overview:
        'The System Security Plan (SSP) is the primary compliance document for any IT system. It defines the system boundary, hardware/software inventory, user roles, and provides an exhaustive, control-by-control explanation of how every requirement in the Profile is implemented in practice.',
      whoCreatesIt:
        'System Owners, Lead Engineers, and Information System Security Officers (ISSOs).',
      howItIsReused:
        'The SSP is the primary target for audits. Assessors read the SSP to understand how the system works and use it to generate Assessment Plans (Step 5) and verify compliance (Step 6).',
      realWorldExamples: [
        'FedRAMP System Security Plan for a SaaS Application',
        'ISO 27001 Statement of Applicability & System Documentation',
        'BSI IT-Grundschutz Security Concept (Sicherheitskonzept)',
        'Healthcare HIPAA System Implementation Record'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'Create an SSP whenever you are bringing a specific application or system through a compliance audit or certification.',
      prerequisites: 'A tailored Profile (Step 2) defining your compliance target, and Component Definitions (Step 3) for the tools used.',
      whatYouProduce: 'A complete, machine-readable System Security Plan documenting system architecture, roles, and implementation details.',
      nextStep: {
        stageId: 'assessment-plans',
        label: 'Step 5: Assessment Plan',
        description: 'Define the audit scope, test procedures, and team to evaluate your implemented system.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'System Boundary & Characteristics',
        subtitle: 'Define system scope, deployment model, and user roles',
        description: 'Document high-level system information including data sensitivity, network diagrams, and responsible parties.',
        whatYouDo: [
          'State system name, operational status, security categorization (Low, Moderate, High).',
          'Define system boundary, interconnected systems, and organizational roles & responsibilities.'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Component Allocation',
        subtitle: 'Assign hardware, software, and services to the system',
        description: 'Instantiate the specific components (from Step 3) running in this system environment.',
        whatYouDo: [
          'Add your databases, web servers, cloud accounts, and team operational procedures to the system inventory.',
          'Inherit component control capabilities automatically.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Control Implementation Statements',
        subtitle: 'Write detailed answers for every baseline requirement',
        description: 'Provide concrete explanations of how each control requirement is met by the allocated components.',
        whatYouDo: [
          'Mark implementation status (Implemented, Partially Implemented, Planned, Alternative Implementation).',
          'Assign system-specific runtime parameter values (e.g. specific IP ranges, timeout durations).'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'Guided Control Implementation Wizard',
        description: 'Step through every baseline control with clear prompts, status badges, and component allocation tools.',
        icon: '✨'
      },
      {
        title: 'Automated Capability Inheritance',
        description: 'Automatically pull in pre-written control statements from your Component Definitions to save hundreds of hours.',
        icon: '⚡'
      },
      {
        title: 'Gap & Completeness Tracker',
        description: 'Track implementation progress with real-time percentage indicators and highlight missing control responses.',
        icon: '📊'
      }
    ]
  },

  // -------------------------------------------------------------------------
  // STEP 5: ASSESSMENT PLANS
  // -------------------------------------------------------------------------
  {
    id: 'assessment-plans',
    stepNumber: 5,
    title: 'Step 5: Security Assessment Plans',
    shortTitle: 'Assessment Plan',
    label: 'Assessment Plans',
    icon: '📅',
    category: 'Assessment & Audit',
    badgeLabel: 'Step 5 in Lifecycle',
    tagline: 'Define the audit scope, assessment objectives, test methods, schedules, and assessor teams.',
    whyItExists: {
      overview:
        'Before conducting a security audit, auditors must plan what they will test, how they will test it, and who will do the work. The Assessment Plan formalizes the testing methodology, activities, and schedule to ensure an objective, repeatable evaluation.',
      whoCreatesIt:
        'Third-Party Assessment Organizations (3PAO), Independent Auditors, or Internal Audit Teams.',
      howItIsReused:
        'The Assessment Plan guides the testing phase. Assessors execute the planned test steps and record their empirical findings in Assessment Results (Step 6).',
      realWorldExamples: [
        'FedRAMP Security Assessment Plan (SAP) for Initial Authorization',
        'ISO 27001 Internal & External Audit Schedules and Scope Documents',
        'SOC 2 Type II Testing Program & Sample Matrix',
        'Annual Penetration Testing and Control Validation Plan'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'Create an Assessment Plan when preparing for an upcoming audit, certification, or continuous monitoring cycle.',
      prerequisites: 'A completed System Security Plan (Step 4) that describes the system to be audited.',
      whatYouProduce: 'A formal Security Assessment Plan defining audit scope, assessment objectives, test methods, and schedules.',
      nextStep: {
        stageId: 'assessment-results',
        label: 'Step 6: Assessment Results',
        description: 'Execute the audit procedures and record findings, observations, and evidence.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'Audit Scope & Objectives',
        subtitle: 'Select in-scope controls and assessment objectives',
        description: 'Determine which controls will be audited during this assessment cycle.',
        whatYouDo: [
          'Select target controls from the SSP for sampling or full-scope audit.',
          'Define the assessment objectives and compliance standards being verified.'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Methodology & Test Procedures',
        subtitle: 'Choose testing methods (Examine, Interview, Test)',
        description: 'Specify how each requirement will be validated.',
        whatYouDo: [
          'Assign testing methods (e.g. Examine configuration files, Interview system admins, Test automated controls).',
          'Link automated test scripts or manual verification checklists to specific controls.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Team Roles & Schedule',
        subtitle: 'Assign assessor teams, timelines, and milestones',
        description: 'Establish who is responsible for each test and when activities will occur.',
        whatYouDo: [
          'Assign lead assessors and subject matter experts to specific control families.',
          'Set start dates, milestones, and deliverables for the assessment.'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'SSP-to-Plan Scope Generator',
        description: 'Instantly generate an assessment scope directly from any existing System Security Plan.',
        icon: '🎯'
      },
      {
        title: 'Test Procedure Builder',
        description: 'Configure Examine, Interview, and Test procedures with clear pass/fail criteria and checklists.',
        icon: '🧪'
      },
      {
        title: 'Assessor Team & Schedule Manager',
        description: 'Assign controls to audit team members and manage milestone schedules with interactive calendars.',
        icon: '👥'
      }
    ]
  },

  // -------------------------------------------------------------------------
  // STEP 6: ASSESSMENT RESULTS
  // -------------------------------------------------------------------------
  {
    id: 'assessment-results',
    stepNumber: 6,
    title: 'Step 6: Security Assessment Results',
    shortTitle: 'Assessment Results',
    label: 'Assessment Results',
    icon: '✅',
    category: 'Assessment & Audit',
    badgeLabel: 'Step 6 in Lifecycle',
    tagline: 'Record empirical audit evidence, observations, findings, and compliance satisfaction statuses.',
    whyItExists: {
      overview:
        'Assessment Results capture the actual outcome of the audit. Assessors record what evidence was inspected, which controls passed (Satisfied) or failed (Other than Satisfied), and document any security weaknesses or observations discovered during testing.',
      whoCreatesIt:
        'Lead Assessors, Compliance Auditors, or Automated Security Scanning Tools.',
      howItIsReused:
        'All failed controls and observations documented in Assessment Results are directly exported into the Plan of Action and Milestones (Step 7) for remediation tracking.',
      realWorldExamples: [
        'FedRAMP Security Assessment Report (SAR)',
        'ISO 27001 Certification Audit Report & Findings Summary',
        'SOC 2 Service Auditor Report with Test Results',
        'Automated CI/CD Compliance Scan Output'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'Use Assessment Results to record the findings and evidence collected during or after the execution of your audit plan.',
      prerequisites: 'An Assessment Plan (Step 5) defining what was scheduled to be tested.',
      whatYouProduce: 'An authoritative record of audit observations, evidence artifacts, and pass/fail satisfaction statuses.',
      nextStep: {
        stageId: 'poams',
        label: 'Step 7: Plan of Action and Milestones (POA&M)',
        description: 'Track and remediate all open findings and weaknesses discovered during the audit.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'Evidence Collection & Logging',
        subtitle: 'Log screenshots, configuration exports, and logs',
        description: 'Attach evidence collected during interviews, examinations, and automated tests.',
        whatYouDo: [
          'Record observations and attach evidence artifacts (e.g. log excerpts, screenshots, policy PDFs).',
          'Document assessor notes and interview summaries.'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Satisfaction Determination',
        subtitle: 'Judge compliance status for each audited control',
        description: 'Mark each control objective as Satisfied, Not Satisfied, or Not Applicable.',
        whatYouDo: [
          'Compare empirical evidence against SSP implementation claims.',
          'Assign official finding statuses with clear technical rationale.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Findings & Risk Characterization',
        subtitle: 'Document vulnerabilities, severity levels, and impact',
        description: 'Catalog security weaknesses discovered during testing.',
        whatYouDo: [
          'Rate finding severities (Low, Moderate, High, Critical).',
          'Detail potential impact and recommend remediation actions.'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'Interactive Audit Execution Grid',
        description: 'Quickly record pass/fail results, assessor notes, and timestamps across hundreds of controls.',
        icon: '📋'
      },
      {
        title: 'Evidence Attachment & Linking',
        description: 'Attach and link evidence documents directly to control findings for audit traceability.',
        icon: '📎'
      },
      {
        title: 'One-Click POA&M Export',
        description: 'Automatically transfer all open findings and weaknesses directly into a POA&M remediation tracker.',
        icon: '⚡'
      }
    ]
  },

  // -------------------------------------------------------------------------
  // STEP 7: POA&M (PLAN OF ACTION AND MILESTONES)
  // -------------------------------------------------------------------------
  {
    id: 'poams',
    stepNumber: 7,
    title: 'Step 7: Plan of Action & Milestones (POA&M)',
    shortTitle: 'POA&M Tracker',
    label: 'POA&M',
    icon: '⚠️',
    category: 'Assessment & Audit',
    badgeLabel: 'Step 7 in Lifecycle',
    tagline: 'Track open vulnerabilities, remediation milestones, scheduled deadlines, and formal risk acceptances.',
    whyItExists: {
      overview:
        'No system is 100% compliant at all times. A Plan of Action and Milestones (POA&M) is the official corrective action plan. It tracks every known security flaw, weakness, or audit finding, assigning ownership, scheduled completion dates, remediation milestones, and tracking them through resolution.',
      whoCreatesIt:
        'System Owners, Security Engineers, and Remediation Taskforces.',
      howItIsReused:
        'Continuous monitoring programs require regular POA&M reporting to regulators and leadership to demonstrate that security flaws are actively being fixed on schedule.',
      realWorldExamples: [
        'Monthly FedRAMP POA&M Submission Tracker',
        'Enterprise Vulnerability & Corrective Action Register',
        'ISO 27001 Non-Conformity and Corrective Action Log',
        'Executive Risk Acceptance & Deviation Dashboard'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'Use the POA&M tracker to manage ongoing remediation following an audit, automated scan, or vulnerability disclosure.',
      prerequisites: 'Identified weaknesses from Assessment Results (Step 6) or automated security scans.',
      whatYouProduce: 'An active, living register of remediation tasks, milestone dates, risk acceptances, and resolution statuses.',
      nextStep: {
        stageId: 'control-mappings',
        label: 'Step 8: Control Mappings',
        description: 'Map your controls across multiple frameworks to extend your compliance to new standards.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'Weakness Registration',
        subtitle: 'Log new vulnerabilities and audit non-conformities',
        description: 'Capture weaknesses with CVEs, severity ratings, affected components, and detection dates.',
        whatYouDo: [
          'Import findings automatically from Assessment Results or vulnerability scanners.',
          'Define root cause analysis and affected system components.'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Milestone & Resource Planning',
        subtitle: 'Set remediation steps, target dates, and owners',
        description: 'Break down complex fixes into trackable milestone tasks with accountable owners.',
        whatYouDo: [
          'Assign designated point of contact and remediation engineering team.',
          'Set binding scheduled completion dates and intermediate milestone checkpoints.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Remediation & Closure Verification',
        subtitle: 'Verify fixes, log evidence, or formalize risk acceptance',
        description: 'Close items once validated or obtain formal executive risk acceptance.',
        whatYouDo: [
          'Verify that patches or configuration changes resolved the weakness.',
          'Document formal risk acceptances or mark weaknesses as completed and closed.'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'Live Remediation Dashboard',
        description: 'Track open, in-progress, overdue, and closed remediation items with instant SLA countdowns.',
        icon: '⏱️'
      },
      {
        title: 'Milestone Task Tracking',
        description: 'Break large vulnerabilities into sub-tasks with assigned deadlines and engineer ownership.',
        icon: '🎯'
      },
      {
        title: 'Risk Acceptance Management',
        description: 'Formally document business justifications, compensating controls, and executive approvals.',
        icon: '🛡️'
      }
    ]
  },

  // -------------------------------------------------------------------------
  // STEP 8: CONTROL MAPPINGS
  // -------------------------------------------------------------------------
  {
    id: 'control-mappings',
    stepNumber: 8,
    title: 'Step 8: Cross-Framework Control Mappings',
    shortTitle: 'Control Mappings',
    label: 'Control Mappings',
    icon: '🔗',
    category: 'Cross-Framework',
    badgeLabel: 'Step 8 in Lifecycle',
    tagline: 'Map relationships across different standards to achieve multi-compliance without duplicate work.',
    whyItExists: {
      overview:
        'Organizations frequently need to comply with multiple regulations simultaneously (e.g. NIST 800-53, ISO 27001, BSI IT-Grundschutz, SOC 2). Control Mappings establish crosswalk relationships between controls across different frameworks, showing which controls are identical, related, or subsets of one another.',
      whoCreatesIt:
        'Compliance Architects, Regulatory Analysts, and Governance Teams.',
      howItIsReused:
        'Mapping lets you "comply once, satisfy many." If you have already implemented and audited NIST 800-53 controls, a mapping allows you to automatically demonstrate compliance with ISO 27001 or BSI Grundschutz with minimal gap remediation.',
      realWorldExamples: [
        'NIST SP 800-53 Rev. 5 ↔ ISO/IEC 27001:2022 Crosswalk Mapping',
        'BSI IT-Grundschutz ↔ ISO 27001 Equivalence Mapping',
        'NIST Cybersecurity Framework (CSF 2.0) ↔ NIST SP 800-53 Mapping',
        'Cloud Security Alliance (CSA CCM) ↔ Multi-Regulation Crosswalk'
      ]
    },
    workflowSequence: {
      startHereAdvice:
        'Use Control Mappings when expanding your compliance program to a new regulation or when managing multi-standard compliance.',
      prerequisites: 'Two or more Control Catalogs (Step 1) or Profiles (Step 2) that you want to map together.',
      whatYouProduce: 'A verified mapping crosswalk and gap analysis report between two or more security standards.',
      nextStep: {
        stageId: 'catalogs',
        label: 'Step 1: Catalogs (Return to Start)',
        description: 'Explore standard catalogs or author custom extensions for unmapped requirements.'
      }
    },
    keyPhases: [
      {
        phaseNumber: 1,
        title: 'Source & Target Selection',
        subtitle: 'Choose frameworks to correlate and compare',
        description: 'Select the baseline catalog you have already implemented and the target standard you wish to satisfy.',
        whatYouDo: [
          'Choose Source Standard (e.g. NIST SP 800-53) and Target Standard (e.g. ISO 27001).',
          'Establish comparison scope and control families.'
        ]
      },
      {
        phaseNumber: 2,
        title: 'Relationship Definition',
        subtitle: 'Define equivalence types (identical, subset, superset, related)',
        description: 'Characterize how closely control requirements match.',
        whatYouDo: [
          'Tag relationships: Identical (1:1 match), Subset (partially satisfies), Superset (exceeds requirement), or Related.',
          'Add bridging rationale explaining how source implementation satisfies target requirements.'
        ]
      },
      {
        phaseNumber: 3,
        title: 'Gap Analysis & Reporting',
        subtitle: 'Identify unaddressed controls in the target standard',
        description: 'Spot exact missing requirements to focus new engineering work only where gaps exist.',
        whatYouDo: [
          'Generate instant Gap Reports highlighting target controls with no source coverage.',
          'Create targeted mini-profiles to close identified gaps efficiently.'
        ]
      }
    ],
    reposolCapabilities: [
      {
        title: 'Visual Crosswalk Matrix',
        description: 'Side-by-side comparison grid linking controls with customizable relationship strength indicators.',
        icon: '⚡'
      },
      {
        title: 'Automated Gap Analysis',
        description: 'Instantly identify blind spots and unmapped requirements when adopting new security frameworks.',
        icon: '📊'
      },
      {
        title: 'Multi-Framework Evidence Reuse',
        description: 'Leverage existing audit evidence across multiple certifications to reduce compliance costs by up to 70%.',
        icon: '💎'
      }
    ]
  }
];

export function getStageGuide(id: OscalStageId): OscalStageGuide | undefined {
  return OSCAL_STAGE_GUIDES.find((stage) => stage.id === id);
}

export function getStageByStep(stepNumber: number): OscalStageGuide | undefined {
  return OSCAL_STAGE_GUIDES.find((s) => s.stepNumber === stepNumber);
}
