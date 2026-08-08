import { Page, APIRequestContext, request } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export interface CatalogOptions {
  uuid?: string;
  title?: string;
  status?: string;
  groups?: any[];
  controls?: any[];
  'back-matter'?: any;
}

export interface ProfileOptions {
  uuid?: string;
  title?: string;
  status?: string;
  catalogUuid?: string;
  imports?: any[];
  modify?: any;
}

export interface ComponentDefinitionOptions {
  uuid?: string;
  title?: string;
  version?: string;
  components?: any[];
  capabilities?: any[];
}

export interface SspOptions {
  uuid?: string;
  title?: string;
  version?: string;
  profileId?: string;
  profileHref?: string;
  componentDefId?: string;
  systemName?: string;
  description?: string;
  systemCharacteristics?: any;
  systemImplementation?: any;
  controlImplementation?: any;
}

export interface AssessmentPlanOptions {
  uuid?: string;
  title?: string;
  sspId?: string;
  sspHref?: string;
  reviewedControls?: any;
}

export interface AssessmentResultsOptions {
  uuid?: string;
  title?: string;
  version?: string;
  apId?: string;
  apHref?: string;
  results?: any[];
}

export interface PoamOptions {
  uuid?: string;
  title?: string;
  version?: string;
  sspId?: string;
  sspHref?: string;
  arId?: string;
  poamItems?: any[];
}

export interface ControlMappingOptions {
  uuid?: string;
  title?: string;
  version?: string;
  provenance?: any;
  mappings?: any[];
}

export class ApiSetup {
  private requestContext: APIRequestContext | null = null;
  private createdDocuments: { stage: string; id: string }[] = [];
  private baseURL: string;
  public readonly workspaceId: string;

  private synced = false;

  constructor(public readonly page: Page, workspaceId?: string) {
    this.baseURL = 'http://127.0.0.1:1000';
    this.workspaceId = workspaceId || randomUUID();
  }

  private hasDocument(stage: string, id?: string): boolean {
    if (!id) return false;
    const norm = (s: string) => s.toLowerCase().replace(/s$/, '').replace(/-/g, '');
    const cleanStage = norm(stage);
    return this.createdDocuments.some(doc => doc.id === id && norm(doc.stage) === cleanStage);
  }

  /**
   * Synchronizes browser localStorage with the API setup workspace ID.
   * Must be called before navigating or creating test data.
   */
  async syncWorkspace() {
    if (!this.synced) {
      await this.page.addInitScript((wsId) => {
        window.localStorage.setItem('reposol_workspace_id', wsId);
      }, this.workspaceId);
      this.synced = true;
    }
  }

  private async getRequest() {
    if (this.requestContext) {
      return this.requestContext;
    }

    this.requestContext = await request.newContext({
      baseURL: this.baseURL,
      extraHTTPHeaders: {
        'X-Workspace-ID': this.workspaceId
      }
    });

    return this.requestContext;
  }

  private async postWithRetry(url: string, payload: any, maxRetries = 30) {
    let lastErr: any;
    for (let i = 0; i < maxRetries; i++) {
      let ctx: any;
      try {
        ctx = await request.newContext({
          baseURL: this.baseURL,
          extraHTTPHeaders: { 'X-Workspace-ID': this.workspaceId }
        });
        const response = await ctx.post(url, { data: payload });
        if (response.ok()) {
          const text = await response.text();
          await ctx.dispose();
          return { ok: () => true, status: () => response.status(), text: async () => text, json: async () => JSON.parse(text) };
        }
        lastErr = new Error(`POST ${url} failed: ${await response.text()}`);
      } catch (err: any) {
        lastErr = err;
      } finally {
        if (ctx) await ctx.dispose().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw lastErr;
  }

  private async getWithRetry(url: string, maxRetries = 30) {
    let lastErr: any;
    for (let i = 0; i < maxRetries; i++) {
      let ctx: any;
      try {
        ctx = await request.newContext({
          baseURL: this.baseURL,
          extraHTTPHeaders: { 'X-Workspace-ID': this.workspaceId }
        });
        const response = await ctx.get(url);
        if (response.ok()) {
          const text = await response.text();
          await ctx.dispose();
          return { ok: () => true, status: () => response.status(), text: async () => text, json: async () => JSON.parse(text) };
        }
        lastErr = new Error(`GET ${url} failed with status ${response.status()}`);
      } catch (err: any) {
        lastErr = err;
      } finally {
        if (ctx) await ctx.dispose().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw lastErr;
  }

  private async deleteWithRetry(url: string, maxRetries = 30) {
    let lastErr: any;
    for (let i = 0; i < maxRetries; i++) {
      let ctx: any;
      try {
        ctx = await request.newContext({
          baseURL: this.baseURL,
          extraHTTPHeaders: { 'X-Workspace-ID': this.workspaceId }
        });
        const response = await ctx.delete(url);
        if (response.ok()) {
          const text = await response.text();
          await ctx.dispose();
          return { ok: () => true, status: () => response.status(), text: async () => text, json: async () => JSON.parse(text) };
        }
        lastErr = new Error(`DELETE ${url} failed with status ${response.status()}`);
        if (response.status() < 500) {
          await ctx.dispose();
          throw lastErr;
        }
      } catch (err: any) {
        lastErr = err;
        if (err.message && err.message.includes('failed with status')) {
          throw err;
        }
      } finally {
        if (ctx) await ctx.dispose().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw lastErr;
  }

  /**
   * Step 1: Create Catalog Document
   */
  async createCatalog(options: CatalogOptions = {}): Promise<string> {
    await this.syncWorkspace();
    const req = await this.getRequest();
    const uuid = options.uuid || randomUUID();
    
    const props: any[] = [];
    if (options.status) {
      props.push({
        name: 'document-status',
        value: options.status,
        ns: 'https://reposol.dev/ns'
      });
    }

    const payload = {
      catalog: {
        uuid,
        metadata: {
          title: options.title || 'Test Catalog',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString(),
          ...(props.length > 0 ? { props } : {})
        },
        groups: options.groups || [],
        ...(options.controls ? { controls: options.controls } : {}),
        ...(options['back-matter'] ? { 'back-matter': options['back-matter'] } : {})
      }
    };
    
    await this.postWithRetry('/api/documents/catalog', payload);
    
    this.createdDocuments.push({ stage: 'catalog', id: uuid });
    return uuid;
  }

  /**
   * Step 2: Create Profile Document
   */
  async createProfile(options: ProfileOptions = {}): Promise<string> {
    await this.syncWorkspace();
    let catUuid = options.catalogUuid;
    if (!options.imports && !catUuid) {
      catUuid = await this.createCatalog({ title: 'Default Base Catalog' });
    }
    const req = await this.getRequest();
    const uuid = options.uuid || randomUUID();
    
    const props: any[] = [];
    if (options.status) {
      props.push({
        name: 'document-status',
        value: options.status,
        ns: 'https://reposol.dev/ns'
      });
    }

    const payload = {
      profile: {
        uuid,
        metadata: {
          title: options.title || 'Test Profile',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString(),
          ...(props.length > 0 ? { props } : {})
        },
        imports: options.imports || [{ href: `../catalogs/${catUuid}.json`, 'include-all': {} }],
        modify: options.modify
      }
    };
    
    await this.postWithRetry('/api/documents/profile', payload);
    
    this.createdDocuments.push({ stage: 'profile', id: uuid });
    return uuid;
  }

  /**
   * Step 3: Create Component Definition Document
   */
  async createComponentDefinition(options: ComponentDefinitionOptions = {}): Promise<string> {
    await this.syncWorkspace();
    const req = await this.getRequest();
    const uuid = options.uuid || randomUUID();

    const rawComponents = options.components || [
      {
        uuid: randomUUID(),
        type: 'software',
        title: 'Test Component',
        description: 'Default test software component'
      }
    ];

    const components = rawComponents.map((c: any) => ({
      uuid: c.uuid || randomUUID(),
      type: c.type || 'software',
      title: c.title || 'Test Component',
      description: c.description || c.title || 'Component description',
      ...c
    }));

    const payload = {
      'component-definition': {
        uuid,
        metadata: {
          title: options.title || 'Test Component Definition',
          version: options.version || '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        components,
        ...(options.capabilities ? { capabilities: options.capabilities } : {})
      }
    };

    await this.postWithRetry('/api/documents/component-definitions', payload);

    this.createdDocuments.push({ stage: 'component-definitions', id: uuid });
    return uuid;
  }

  /**
   * Step 4: Create System Security Plan (SSP) Document
   */
  async createSsp(
    profileIdOrOptions?: string | SspOptions,
    componentDefIdOrOptions?: string | SspOptions,
    options: SspOptions = {}
  ): Promise<string> {
    let profileId: string | undefined;
    let componentDefId: string | undefined;
    let opts: SspOptions = {};

    if (typeof profileIdOrOptions === 'string') {
      profileId = profileIdOrOptions;
      if (typeof componentDefIdOrOptions === 'string') {
        componentDefId = componentDefIdOrOptions;
        opts = options;
      } else if (componentDefIdOrOptions) {
        opts = componentDefIdOrOptions;
      }
    } else if (profileIdOrOptions) {
      opts = profileIdOrOptions;
      profileId = opts.profileId;
      componentDefId = opts.componentDefId;
    }

    await this.syncWorkspace();
    let profileHref = opts.profileHref;
    if (!profileHref) {
      if (profileId && this.hasDocument('profile', profileId)) {
        profileHref = `../profiles/${profileId}.json`;
      } else {
        const defaultProfileId = await this.createProfile();
        await this.syncWorkspace();
        profileHref = `../profiles/${defaultProfileId}.json`;
      }
    }
    const req = await this.getRequest();
    const uuid = opts.uuid || randomUUID();

    const defaultSystemCharacteristics = {
      'system-ids': [
        {
          id: 'sys-test-01',
          'identifier-type': 'https://fedramp.gov'
        }
      ],
      'system-name': opts.systemName || opts.title || 'Test System Security Plan',
      description: opts.description || 'Default test system security plan description',
      'system-information': {
        'information-types': [
          {
            uuid: randomUUID(),
            title: 'System Data',
            description: 'General system operational data'
          }
        ]
      },
      status: {
        state: 'operational'
      },
      'authorization-boundary': {
        description: 'Test Authorization Boundary'
      }
    };

    const defaultSystemImplementation = {
      users: [
        {
          uuid: randomUUID(),
          'role-ids': ['system-administrator']
        }
      ],
      components: [
        {
          uuid: randomUUID(),
          type: 'software',
          title: 'Primary System Component',
          description: 'Main system application component',
          status: {
            state: 'operational'
          }
        }
      ]
    };

    const validCompDefId = (componentDefId && this.hasDocument('component-definitions', componentDefId))
      ? componentDefId
      : (opts.componentDefId && this.hasDocument('component-definitions', opts.componentDefId) ? opts.componentDefId : undefined);

    const implementedReqByComponents = validCompDefId
      ? [
          {
            uuid: randomUUID(),
            'component-uuid': validCompDefId,
            description: 'Implemented by component'
          }
        ]
      : [];

    const defaultControlImplementation = {
      description: 'Default test control implementation',
      'implemented-requirements': [
        {
          uuid: randomUUID(),
          'control-id': 'ac-1',
          ...(implementedReqByComponents.length > 0 ? { 'by-components': implementedReqByComponents } : {})
        }
      ]
    };

    const payload = {
      'system-security-plan': {
        uuid,
        metadata: {
          title: opts.title || opts.systemName || 'Test System Security Plan',
          version: opts.version || '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-profile': {
          href: profileHref
        },
        'system-characteristics': opts.systemCharacteristics || defaultSystemCharacteristics,
        'system-implementation': opts.systemImplementation || defaultSystemImplementation,
        'control-implementation': opts.controlImplementation || defaultControlImplementation
      }
    };

    await this.postWithRetry('/api/documents/ssps', payload);

    this.createdDocuments.push({ stage: 'ssps', id: uuid });
    return uuid;
  }

  /**
   * Step 5: Create Assessment Plan Document
   */
  async createAssessmentPlan(
    sspIdOrOptions?: string | AssessmentPlanOptions,
    options: AssessmentPlanOptions = {}
  ): Promise<string> {
    let sspId: string | undefined;
    let opts: AssessmentPlanOptions = {};

    if (typeof sspIdOrOptions === 'string') {
      sspId = sspIdOrOptions;
      opts = options;
    } else if (sspIdOrOptions) {
      opts = sspIdOrOptions;
      sspId = opts.sspId;
    }

    await this.syncWorkspace();
    let sspHref = opts.sspHref;
    if (!sspHref) {
      if (sspId && this.hasDocument('ssps', sspId)) {
        sspHref = `../ssps/${sspId}.json`;
      } else {
        const defaultSspId = await this.createSsp();
        sspHref = `../ssps/${defaultSspId}.json`;
      }
    }
    const req = await this.getRequest();
    const uuid = opts.uuid || randomUUID();

    const payload = {
      'assessment-plan': {
        uuid,
        metadata: {
          title: opts.title || 'Test Assessment Plan',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': {
          href: sspHref
        },
        'reviewed-controls': opts.reviewedControls || {
          'control-selections': [
            {
              'include-all': {}
            }
          ]
        }
      }
    };
    
    await this.postWithRetry('/api/documents/assessment-plan', payload);
    
    this.createdDocuments.push({ stage: 'assessment-plan', id: uuid });
    return uuid;
  }

  /**
   * Step 6: Create Assessment Results Document
   */
  async createAssessmentResults(
    apIdOrOptions?: string | AssessmentResultsOptions,
    options: AssessmentResultsOptions = {}
  ): Promise<string> {
    let apId: string | undefined;
    let opts: AssessmentResultsOptions = {};

    if (typeof apIdOrOptions === 'string') {
      apId = apIdOrOptions;
      opts = options;
    } else if (apIdOrOptions) {
      opts = apIdOrOptions;
      apId = opts.apId;
    }

    await this.syncWorkspace();
    let apHref = opts.apHref;
    if (!apHref) {
      if (apId && this.hasDocument('assessment-plan', apId)) {
        apHref = `../assessment-plans/${apId}.json`;
      } else {
        const defaultApId = await this.createAssessmentPlan();
        apHref = `../assessment-plans/${defaultApId}.json`;
      }
    }
    const req = await this.getRequest();
    const uuid = opts.uuid || randomUUID();

    const rawResults = opts.results || [
      {
        uuid: randomUUID(),
        title: 'Automated Test Assessment Result',
        description: 'Default assessment result description',
        start: new Date().toISOString(),
        'reviewed-controls': {
          'control-selections': [
            {
              'include-all': {}
            }
          ]
        }
      }
    ];

    const results = rawResults.map((r: any) => ({
      uuid: r.uuid || randomUUID(),
      title: r.title || 'Assessment Result',
      description: r.description || r.title || 'Assessment result description',
      start: r.start || new Date().toISOString(),
      'reviewed-controls': r['reviewed-controls'] || {
        'control-selections': [
          {
            'include-all': {}
          }
        ]
      },
      ...r
    }));

    const payload = {
      'assessment-results': {
        uuid,
        metadata: {
          title: opts.title || 'Test Assessment Results',
          version: opts.version || '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ap': {
          href: apHref
        },
        results
      }
    };

    await this.postWithRetry('/api/documents/assessment-results', payload);

    this.createdDocuments.push({ stage: 'assessment-results', id: uuid });
    return uuid;
  }

  /**
   * Step 7: Create Plan of Action & Milestones (POA&M) Document
   */
  async createPoam(
    sspIdOrOptions?: string | PoamOptions,
    arIdOrOptions?: string | PoamOptions,
    options: PoamOptions = {}
  ): Promise<string> {
    let sspId: string | undefined;
    let arId: string | undefined;
    let opts: PoamOptions = {};

    if (typeof sspIdOrOptions === 'string') {
      sspId = sspIdOrOptions;
      if (typeof arIdOrOptions === 'string') {
        arId = arIdOrOptions;
        opts = options;
      } else if (arIdOrOptions) {
        opts = arIdOrOptions;
      }
    } else if (sspIdOrOptions) {
      opts = sspIdOrOptions;
      sspId = opts.sspId;
      arId = opts.arId;
    }

    await this.syncWorkspace();
    const req = await this.getRequest();
    const uuid = opts.uuid || randomUUID();
    const sspHref = opts.sspHref || (sspId && this.hasDocument('ssps', sspId) ? `../ssps/${sspId}.json` : undefined);
    const validArId = arId && this.hasDocument('assessment-results', arId) ? arId : undefined;

    const rawPoamItems = opts.poamItems || [
      {
        uuid: randomUUID(),
        title: 'Remediate Test Finding',
        description: 'Default test POA&M item description',
        ...(validArId ? { 'related-findings': [{ 'finding-uuid': validArId }] } : {})
      }
    ];

    const poamItems = rawPoamItems.map((p: any) => ({
      uuid: p.uuid || randomUUID(),
      title: p.title || 'POA&M Item',
      description: p.description || p.title || 'POA&M item description',
      ...p
    }));

    const payload = {
      'plan-of-action-and-milestones': {
        uuid,
        metadata: {
          title: opts.title || 'Test Plan of Action & Milestones',
          version: opts.version || '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        ...(sspHref ? { 'import-ssp': { href: sspHref } } : {}),
        'poam-items': poamItems
      }
    };

    await this.postWithRetry('/api/documents/poam', payload);

    this.createdDocuments.push({ stage: 'poams', id: uuid });
    return uuid;
  }

  /**
   * Step 8: Create Control Mapping Document
   */
  async createControlMapping(options: ControlMappingOptions = {}): Promise<string> {
    await this.syncWorkspace();
    const req = await this.getRequest();
    const uuid = options.uuid || randomUUID();

    const payload = {
      'mapping-collection': {
        uuid,
        metadata: {
          title: options.title || 'Test Control Mapping',
          version: options.version || '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        provenance: options.provenance || {
          method: 'human',
          status: 'draft',
          'matching-rationale': 'semantic',
          'mapping-description': 'Test mapping description'
        },
        mappings: options.mappings || []
      }
    };

    await this.postWithRetry('/api/documents/control-mapping', payload);

    this.createdDocuments.push({ stage: 'control-mappings', id: uuid });
    return uuid;
  }

  /**
   * Generic document creation helper for custom payloads
   */
  async createDocument(stage: string, payload: any): Promise<string> {
    await this.syncWorkspace();
    const req = await this.getRequest();
    const rootKey = Object.keys(payload)[0];
    const uuid = payload[rootKey]?.uuid || randomUUID();
    if (payload[rootKey] && !payload[rootKey].uuid) {
      payload[rootKey].uuid = uuid;
    }
    
    await this.postWithRetry(`/api/documents/${stage}`, payload);
    
    this.createdDocuments.push({ stage, id: uuid });
    return uuid;
  }

  async getDocument(stage: string, id: string) {
    const response = await this.getWithRetry(`/api/documents/${stage}/${id}`);
    return response.json();
  }

  async deleteDocument(stage: string, id: string) {
    await this.deleteWithRetry(`/api/documents/${stage}/${id}?force=true`);
  }

  async cleanup() {
    const docs = [...this.createdDocuments].reverse();
    for (const doc of docs) {
      try {
        await this.deleteDocument(doc.stage, doc.id);
      } catch {
        // Ignore cleanup errors during teardown
      }
    }
    this.createdDocuments = [];
    if (this.requestContext) {
      await this.requestContext.dispose();
      this.requestContext = null;
    }
  }
}
