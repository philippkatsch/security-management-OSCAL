/**
 * High-performance, zero-browser static route generator for Reposol.
 *
 * Generates static, SEO-optimized HTML for all 10 canonical OSCAL routes:
 * - Injects route-specific meta tags (<title>, <meta description>, <link canonical>, OG, Twitter)
 * - Injects rich, indexable semantic content inside #root so search engines and
 *   AI indexers (Perplexity, ChatGPT, Claude) index authoritative OSCAL compliance content
 * - When loaded by real users, React mounts and takes over the #root DOM seamlessly
 * - Runs in < 30ms with zero browser dependencies (no Chromium, no Puppeteer, no display server)
 *
 * Usage: node scripts/generate-seo.mjs
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const SITE_URL = 'https://security-management-oscal.fly.dev';

export const CANONICAL_ROUTES = [
  {
    path: '/',
    title: 'Reposol — Free Online NIST OSCAL Viewer & Editor',
    description:
      'Free open-source NIST OSCAL viewer and editor. View, edit, and validate Catalogs, Profiles, Component Definitions, SSPs, Assessment Plans, and POA&Ms.',
    keywords:
      'OSCAL, NIST OSCAL, OSCAL Viewer, OSCAL Editor, security controls, compliance management, cybersecurity, compliance as code',
    heading: 'Reposol — Open-Source NIST OSCAL Management Platform',
    summary:
      'Reposol is an open-source web application for managing the complete NIST OSCAL (Open Security Controls Assessment Language) lifecycle. Author, edit, tailor, and validate security control catalogs, system security plans, and assessment artifacts across all 8 lifecycle steps.',
    highlights: [
      'Step 1: Catalog Builder — Author and inspect NIST SP 800-53 Rev 5, BSI IT-Grundschutz, and ISO/IEC 27001 catalogs with control groups and parameter constraints.',
      'Step 2: Profile Tailoring — Tailor control baselines through parameter overrides, control selection/exclusion, and multi-catalog merge rules.',
      'Step 3: Component Definitions — Catalog software, hardware, and service components with by-component control implementations.',
      'Step 4: System Security Plan (SSP) Builder — Build comprehensive SSPs with system boundary definitions, information types, and implementation responses.',
      'Step 5: Assessment Plans — Define assessment objectives, testing methodologies, activity schedules, and auditor terms.',
      'Step 6: Assessment Results — Record audit observations, findings, and CVSS-based risk evaluations against security controls.',
      'Step 7: POA&M Tracker — Monitor remediation milestones, risk lifecycles, and corrective action items.',
      'Step 8: Control Mapping & Crosswalks — Establish relationships and perform gap analysis between multiple compliance frameworks.',
      'Traceability Matrix — End-to-end auditability linking high-level controls to concrete system implementations and findings.',
    ],
  },
  {
    path: '/catalogs',
    title: 'OSCAL Catalogs — Create & Manage Security Control Catalogs | Reposol',
    description:
      'Create, import, and manage OSCAL Security Control Catalogs. Supports NIST SP 800-53, BSI IT-Grundschutz, and ISO/IEC 27001 with full control and parameter management.',
    keywords:
      'OSCAL Catalog, NIST 800-53, BSI Grundschutz, ISO 27001, security controls, catalog editor, control groups, parameter constraints',
    heading: 'OSCAL Security Control Catalogs',
    summary:
      'The OSCAL Catalog model represents structured collections of security controls, requirements, and objectives. Reposol enables security engineers to create, browse, and edit control catalogs with parameter definitions, prose sections, and control enhancements.',
    highlights: [
      'Multi-Framework Support: Native compatibility with NIST SP 800-53 (Rev 4 & Rev 5), BSI IT-Grundschutz (Edition 2023+), and ISO/IEC 27001:2022.',
      'Structured Control Hierarchy: Organize controls into groups, subgroups, and control enhancements with unique identifiers.',
      'Parameterization: Define configurable parameters with selection constraints, default values, and guideline prose.',
      'Validation Engine: Real-time schema validation ensuring strict compliance with NIST OSCAL metaschema standards.',
      'Format Interoperability: Import and export catalogs in JSON, YAML, and XML formats without loss of metadata.',
    ],
  },
  {
    path: '/profiles',
    title: 'OSCAL Profiles — Tailor Security Baselines & Overrides | Reposol',
    description:
      'Build and customize OSCAL Profiles with baseline selection, parameter overrides, and merge directives. Tailor control catalogs to organizational requirements.',
    keywords:
      'OSCAL Profile, security baseline, profile tailoring, parameter override, control selection, NIST baseline',
    heading: 'OSCAL Profile Tailoring & Security Baselines',
    summary:
      'OSCAL Profiles tailor baseline security catalogs to meet specific organizational, regulatory, or system constraints. Create customized baselines (such as FedRAMP Low/Moderate/High or custom corporate standards) through inclusion, exclusion, and parameter tailoring.',
    highlights: [
      'Baseline Import: Import parent catalogs and profiles with automated dependency tracking and resolution.',
      'Selective Control Inclusion: Select specific controls or entire families while excluding unnecessary requirements.',
      'Parameter Value Overrides: Customize parameter values to set organizational thresholds (e.g. password complexity, audit log retention).',
      'Set-Parameter & Alter Directives: Modify control prose, add organizational guidance, or supplement control requirements.',
      'Profile Resolution: Preview fully resolved catalogs generated by merging profile tailoring rules against source catalogs.',
    ],
  },
  {
    path: '/component-definitions',
    title: 'OSCAL Component Definitions — Security Component Inventory | Reposol',
    description:
      'Manage OSCAL Component Definitions across 11 component types with control implementation narratives and service protocols in Reposol.',
    keywords:
      'OSCAL Component Definition, component inventory, control implementation, security component, software inventory',
    heading: 'OSCAL Component Definitions & Technical Controls',
    summary:
      'The Component Definition model documents reusable technical, physical, and procedural components and describes how each component implements specific security controls. Build a reusable component library for operating systems, cloud services, firewalls, and security policies.',
    highlights: [
      '11 Component Types: Model software, hardware, services, policies, physical infrastructure, validation tools, and more.',
      'Control Implementations: Map individual components to specific catalog controls with detailed implementation narratives.',
      'Service Protocols & Ports: Document network protocols, ports, interconnects, and transport security configurations.',
      'Capability Grouping: Bundle related components into operational capabilities for modular reuse across multiple System Security Plans.',
    ],
  },
  {
    path: '/ssps',
    title: 'OSCAL System Security Plans (SSP) — Visual SSP Builder | Reposol',
    description:
      'Create and manage System Security Plans (SSPs) with baseline imports, system boundary diagrams, and by-component implementation narratives in Reposol.',
    keywords:
      'OSCAL SSP, System Security Plan, SSP builder, security plan, ATO, authorization to operate, FedRAMP SSP',
    heading: 'OSCAL System Security Plans (SSP)',
    summary:
      'A System Security Plan (SSP) is the central artifact for system authorization (ATO / FedRAMP). Reposol provides an integrated workflow to specify system characteristics, define system boundaries, document information types, and assemble by-component control implementation narratives.',
    highlights: [
      'System Characteristics: Document deployment models, authorization boundaries, categorization (FIPS 199), and data sensitivity.',
      'By-Component Responses: Detail how each system component fulfills required controls with responsible roles and parameters.',
      'Export Ready: Generate NIST-compliant OSCAL JSON, YAML, and XML documents ready for automated compliance pipelines and auditor review.',
    ],
  },
  {
    path: '/assessment-plans',
    title: 'OSCAL Assessment Plans — Security Audit & Assessment Planning | Reposol',
    description:
      'Plan security assessments with objectives, testing methods, activity schedules, and terms & conditions using the OSCAL Assessment Plan model.',
    keywords:
      'OSCAL Assessment Plan, security assessment, audit planning, assessment objectives, test methodology, cybersecurity audit',
    heading: 'OSCAL Assessment Plans',
    summary:
      'The Assessment Plan (AP) model defines the scope, objectives, activities, and schedule of a security assessment or audit. Plan comprehensive evaluations against targeted SSPs and control baselines with defined roles and evidence collection requirements.',
    highlights: [
      'Target SSP Linkage: Directly link assessment activities to specific System Security Plans and tailored profiles.',
      'Assessment Activities: Define examination, interview, and test activities with task dependencies and resource assignments.',
      'Terms & Conditions: Specify auditor rules of engagement, non-disclosure agreements, and testing constraints.',
    ],
  },
  {
    path: '/assessment-results',
    title: 'OSCAL Assessment Results — Document Audit Findings & Risks | Reposol',
    description:
      'Document audit findings, observations, and CVSS risk scoring from security assessments in compliance with the OSCAL Assessment Results standard.',
    keywords:
      'OSCAL Assessment Results, audit findings, CVSS scoring, security observations, attestation, compliance results',
    heading: 'OSCAL Assessment Results',
    summary:
      'Assessment Results (AR) capture findings, observations, evidence links, and control satisfaction statuses from completed security audits. Record CVSS scores, risk evaluations, and attestation sign-offs for system authorization.',
    highlights: [
      'Findings & Observations: Log detailed assessment observations with pass/fail satisfaction statuses per security control.',
      'Risk Scoring: Calculate and record CVSS vulnerability metrics and residual risk levels.',
      'Evidence Mapping: Link findings to test logs, configuration snapshots, and auditor attestations.',
    ],
  },
  {
    path: '/poams',
    title: 'OSCAL POA&M Tracker — Remediation Plan & Milestone Management | Reposol',
    description:
      'Track security remediation with auto-generated POA&M items, risk lifecycle tracking, and progress dashboards using NIST OSCAL POA&Ms.',
    keywords:
      'OSCAL POAM, POA&M, plan of action and milestones, remediation tracking, risk management, security weaknesses',
    heading: 'OSCAL Plan of Action & Milestones (POA&M)',
    summary:
      'The POA&M model tracks the remediation of security weaknesses and findings identified during audits or vulnerability scans. Manage milestones, scheduled completion dates, remediation owners, and residual risk lifecycles.',
    highlights: [
      'Weakness Lifecycle Tracking: Track findings from detection through remediation planning, milestone execution, and validation.',
      'Milestone Scheduling: Assign target dates, completion milestones, and risk owners for every open action item.',
      'Audit Trail: Maintain an immutable compliance record of remediation actions and sign-offs.',
    ],
  },
  {
    path: '/control-mappings',
    title: 'OSCAL Control Mappings — Cross-Framework Crosswalks & Gap Analysis | Reposol',
    description:
      'Map security controls between multiple frameworks with relationship types, confidence scores, and gap analysis in Reposol.',
    keywords:
      'OSCAL Mapping, control mapping, framework crosswalk, gap analysis, NIST to ISO mapping, compliance crosswalk',
    heading: 'OSCAL Control Mappings & Cross-Framework Crosswalks',
    summary:
      'The OSCAL Mapping Collection model enables bidirectional mapping between disparate security standards (e.g. NIST SP 800-53 to ISO/IEC 27001 or BSI IT-Grundschutz). Identify compliance gaps and reuse implementation evidence across multiple standards.',
    highlights: [
      'Relationship Types: Model exact matches, subsets, supersets, and intersecting relationships between controls.',
      'Confidence Scoring: Assign confidence metrics to crosswalk mappings for rigorous risk assessments.',
      'Automated Gap Analysis: Quickly determine unimplemented controls when certifying against a new regulatory framework.',
    ],
  },
  {
    path: '/traceability',
    title: 'OSCAL Traceability Matrix — End-to-End Compliance Auditability | Reposol',
    description:
      'Inspect end-to-end compliance traceability linking high-level controls to profiles, components, SSP implementations, findings, and POA&M milestones.',
    keywords:
      'OSCAL Traceability, compliance matrix, audit trail, control traceability, security governance, end-to-end compliance',
    heading: 'OSCAL End-to-End Traceability Matrix',
    summary:
      'The Reposol Traceability Matrix connects all 8 stages of the OSCAL lifecycle into a unified graph. Verify that every regulatory control maps to tailored profiles, technical component definitions, operational SSP narratives, audit findings, and active POA&M items.',
    highlights: [
      'Lifecycle Visibility: Full visibility across Catalogs, Profiles, Components, SSPs, Assessment Plans, Results, and POA&Ms.',
      'Coverage Verification: Immediately identify orphan controls or unaddressed audit findings.',
      'Audit Readiness: Provide continuous, auditable evidence of security posture to compliance assessors.',
    ],
  },
];

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Generate semantic, crawlable HTML content for a route to be placed inside #root.
 * React replaces this container on mount, but search engines (Googlebot, Bing,
 * Perplexity, GPTBot) index this rich semantic copy immediately upon GET.
 */
function buildSemanticBody(route) {
  const listItems = route.highlights
    .map((item) => `          <li>${escapeHtml(item)}</li>`)
    .join('\n');

  return `
    <div id="root">
      <main style="max-width:960px;margin:2rem auto;padding:1.5rem;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6">
        <header style="border-bottom:1px solid #e2e8f0;padding-bottom:1.5rem;margin-bottom:2rem">
          <nav aria-label="OSCAL Lifecycle Navigation" style="font-size:0.875rem;margin-bottom:1rem;color:#64748b">
            <a href="/" style="color:#4f46e5;text-decoration:none">Dashboard</a> &rsaquo;
            <span style="color:#0f172a;font-weight:600">${escapeHtml(route.heading)}</span>
          </nav>
          <h1 style="font-size:2rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem 0">${escapeHtml(route.heading)}</h1>
          <p style="font-size:1.125rem;color:#475569;margin:0">${escapeHtml(route.summary)}</p>
        </header>

        <section style="margin-bottom:2rem">
          <h2 style="font-size:1.25rem;font-weight:600;color:#1e293b;margin-bottom:0.75rem">Key Capabilities &amp; Standards</h2>
          <ul style="padding-left:1.25rem;margin:0;color:#334155">
${listItems}
          </ul>
        </section>

        <section style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1.25rem;margin-bottom:2rem">
          <h2 style="font-size:1rem;font-weight:600;color:#0f172a;margin:0 0 0.5rem 0">OSCAL Document Lifecycle Navigation</h2>
          <p style="font-size:0.875rem;color:#64748b;margin:0 0 1rem 0">Browse other stages of the OSCAL security management pipeline:</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
            <a href="/catalogs" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">📚 Catalogs</a>
            <a href="/profiles" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">📋 Profiles</a>
            <a href="/component-definitions" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">🧩 Components</a>
            <a href="/ssps" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">🔒 SSPs</a>
            <a href="/assessment-plans" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">📝 Assessment Plans</a>
            <a href="/assessment-results" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">📊 Assessment Results</a>
            <a href="/poams" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">🎯 POA&amp;M</a>
            <a href="/control-mappings" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">🔗 Control Mappings</a>
            <a href="/traceability" style="display:inline-block;padding:0.35rem 0.75rem;font-size:0.8125rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none">🌐 Traceability</a>
          </div>
        </section>

        <footer style="font-size:0.8125rem;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:1rem">
          <p style="margin:0">Reposol is open-source software licensed under Apache 2.0 &bull; <a href="https://github.com/philippkatsch/security-management-OSCAL" style="color:#6366f1;text-decoration:none">View Source on GitHub</a></p>
        </footer>
      </main>
    </div>`;
}

function cleanTemplateHtml(html) {
  let cleaned = html;
  // Clean previously injected subpage JSON-LD schemas
  cleaned = cleaned.replace(
    /\s*<script type="application\/ld\+json" id="subpage-schema">[\s\S]*?<\/script>/g,
    ''
  );
  // Reset #root to empty container (anchoring between <div id="root"> and </body>)
  const rootStart = cleaned.indexOf('<div id="root">');
  const bodyEnd = cleaned.indexOf('</body>', rootStart);
  if (rootStart !== -1 && bodyEnd !== -1) {
    cleaned = `${cleaned.substring(0, rootStart)}<div id="root"></div>\n  ${cleaned.substring(bodyEnd)}`;
  }
  return cleaned;
}

function injectRouteMeta(templateHtml, route) {
  const canonical = `${SITE_URL}${route.path === '/' ? '/' : route.path}`;

  let html = templateHtml;

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`);

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${escapeAttr(route.description)}"`
  );

  // Replace meta keywords
  if (route.keywords) {
    html = html.replace(
      /<meta name="keywords" content="[^"]*"/,
      `<meta name="keywords" content="${escapeAttr(route.keywords)}"`
    );
  }

  // Replace canonical link
  html = html.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${canonical}"`
  );

  // Replace Open Graph tags
  html = html.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${canonical}"`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${escapeAttr(route.title)}"`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${escapeAttr(route.description)}"`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:url" content="[^"]*"/,
    `<meta name="twitter:url" content="${canonical}"`
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${escapeAttr(route.title)}"`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${escapeAttr(route.description)}"`
  );

  // Inject semantic crawlable HTML into #root
  const semanticBody = buildSemanticBody(route);
  if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', semanticBody.trim());
  } else {
    const rootStart = html.indexOf('<div id="root">');
    const bodyEnd = html.indexOf('</body>', rootStart);
    if (rootStart !== -1 && bodyEnd !== -1) {
      html = `${html.substring(0, rootStart)}${semanticBody.trim()}\n  ${html.substring(bodyEnd)}`;
    }
  }

  // Inject BreadcrumbList & WebPage JSON-LD structured data for subpages
  if (route.path !== '/') {
    const subpageSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: route.title,
      description: route.description,
      url: canonical,
      isPartOf: {
        '@type': 'WebApplication',
        name: 'Reposol',
        url: `${SITE_URL}/`,
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${SITE_URL}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: route.heading,
            item: canonical,
          },
        ],
      },
    };

    const schemaTag = `\n    <script type="application/ld+json" id="subpage-schema">\n    ${JSON.stringify(subpageSchema, null, 2).replace(/\n/g, '\n    ')}\n    </script>`;
    html = html.replace('</head>', `${schemaTag}\n  </head>`);
  }

  return html;
}

export async function generateSeoRoutes() {
  if (!existsSync(DIST_DIR)) {
    console.error('❌ dist/ directory not found. Run "npm run build:only" first.');
    process.exit(1);
  }

  const baseTemplatePath = join(DIST_DIR, '_base.html');
  const indexHtmlPath = join(DIST_DIR, 'index.html');

  let baseHtml;
  if (existsSync(baseTemplatePath)) {
    baseHtml = await readFile(baseTemplatePath, 'utf-8');
  } else {
    const rawHtml = await readFile(indexHtmlPath, 'utf-8');
    baseHtml = cleanTemplateHtml(rawHtml);
    await writeFile(baseTemplatePath, baseHtml, 'utf-8');
  }

  console.log('⚡ Starting high-performance SEO static route generation...');
  const startTime = Date.now();
  let generated = 0;

  for (const route of CANONICAL_ROUTES) {
    const routeHtml = injectRouteMeta(baseHtml, route);

    const outDir =
      route.path === '/'
        ? DIST_DIR
        : join(DIST_DIR, ...route.path.split('/').filter(Boolean));

    await mkdir(outDir, { recursive: true });
    const outFile = join(outDir, 'index.html');
    await writeFile(outFile, routeHtml, 'utf-8');

    const relativePath = outFile.replace(DIST_DIR, 'dist');
    console.log(`   ✅ Generated: ${relativePath}`);
    generated++;
  }

  const duration = Date.now() - startTime;
  console.log(`\n🎉 SEO route generation complete: ${generated}/${CANONICAL_ROUTES.length} routes in ${duration}ms.\n`);
}

// Execute if run directly
generateSeoRoutes().catch((err) => {
  console.error('Fatal SEO generation error:', err);
  process.exit(1);
});
