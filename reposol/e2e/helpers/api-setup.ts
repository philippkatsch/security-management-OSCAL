import { Page, APIRequestContext, request } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export class ApiSetup {
  private requestContext: APIRequestContext | null = null;
  private createdDocuments: { stage: string; id: string }[] = [];
  private baseURL: string;
  public readonly workspaceId: string;

  constructor(public readonly page: Page, workspaceId?: string) {
    this.baseURL = 'http://127.0.0.1:1001';
    this.workspaceId = workspaceId || `session-${randomUUID()}`;
  }

  /**
   * Synchronizes browser localStorage with the API setup workspace ID.
   * Must be called before navigating or creating test data.
   */
  async syncWorkspace() {
    const wsId = this.workspaceId;
    await this.page.addInitScript((id) => {
      window.localStorage.setItem('reposol_workspace_id', id);
    }, wsId);
    
    // If page is already on a domain, set it immediately in current window state as well
    try {
      await this.page.evaluate((id) => {
        window.localStorage.setItem('reposol_workspace_id', id);
      }, wsId);
    } catch {
      // Ignore if page not yet navigated to base URL
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

  async createCatalog(options: {
    uuid?: string;
    title?: string;
    status?: string;
    groups?: any[];
    controls?: any[];
    'back-matter'?: any;
  } = {}) {
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
    
    const response = await req.post('/api/documents/catalog', { data: payload });
    if (!response.ok()) {
      throw new Error(`Failed to create catalog: ${await response.text()}`);
    }
    
    this.createdDocuments.push({ stage: 'catalog', id: uuid });
    return uuid;
  }

  async createProfile(options: {
    uuid?: string;
    title?: string;
    status?: string;
    catalogUuid?: string;
    imports?: any[];
    modify?: any;
  }) {
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
      profile: {
        uuid,
        metadata: {
          title: options.title || 'Test Profile',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString(),
          ...(props.length > 0 ? { props } : {})
        },
        imports: options.imports || (options.catalogUuid ? [{ href: `../catalogs/${options.catalogUuid}.json`, 'include-all': {} }] : [{ href: '../catalogs/dummy.json', 'include-all': {} }]),
        modify: options.modify
      }
    };
    
    const response = await req.post('/api/documents/profile', { data: payload });
    if (!response.ok()) {
      throw new Error(`Failed to create profile: ${await response.text()}`);
    }
    
    this.createdDocuments.push({ stage: 'profile', id: uuid });
    return uuid;
  }

  async createAssessmentPlan(options: {
    uuid?: string;
    title?: string;
    sspHref?: string;
  } = {}) {
    await this.syncWorkspace();
    const req = await this.getRequest();
    const uuid = options.uuid || randomUUID();
    const payload = {
      'assessment-plan': {
        uuid,
        metadata: {
          title: options.title || 'Test Assessment Plan',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': {
          href: options.sspHref || '../ssps/test-ssp.json'
        },
        'reviewed-controls': {
          'control-selections': [
            {
              'include-all': {}
            }
          ]
        }
      }
    };
    
    const response = await req.post('/api/documents/assessment-plan', { data: payload });
    if (!response.ok()) {
      throw new Error(`Failed to create assessment plan: ${await response.text()}`);
    }
    
    this.createdDocuments.push({ stage: 'assessment-plan', id: uuid });
    return uuid;
  }

  async createDocument(stage: string, payload: any) {
    await this.syncWorkspace();
    const req = await this.getRequest();
    const rootKey = Object.keys(payload)[0];
    const uuid = payload[rootKey]?.uuid || randomUUID();
    
    const response = await req.post(`/api/documents/${stage}`, { data: payload });
    if (!response.ok()) {
      throw new Error(`Failed to create document in stage ${stage}: ${await response.text()}`);
    }
    
    this.createdDocuments.push({ stage, id: uuid });
    return uuid;
  }

  async getDocument(stage: string, id: string) {
    const req = await this.getRequest();
    const response = await req.get(`/api/documents/${stage}/${id}`);
    if (!response.ok()) {
      throw new Error(`Failed to get document ${id}`);
    }
    return response.json();
  }

  async deleteDocument(stage: string, id: string) {
    const req = await this.getRequest();
    await req.delete(`/api/documents/${stage}/${id}?force=true`);
  }

  async cleanup() {
    for (const doc of this.createdDocuments) {
      try {
        await this.deleteDocument(doc.stage, doc.id);
      } catch (e) {
        console.warn(`Failed to cleanup document ${doc.stage}/${doc.id}`, e);
      }
    }
    this.createdDocuments = [];
    if (this.requestContext) {
      await this.requestContext.dispose();
      this.requestContext = null;
    }
  }
}
