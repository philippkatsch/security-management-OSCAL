/**
 * Tests for the DocumentEditor component.
 * Covers: Rendering and initialization, field binding, extra JSON fields,
 * validation flows (success/error), saving documents,
 * and profile visual tailoring mode (catalog checklist, controls toggling).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DocumentEditor from '../components/DocumentEditor';

const mockCatalogList = [
  {
    catalog: {
      uuid: 'cat-1111-2222',
      metadata: { title: 'Loaded Catalog 1' }
    }
  }
];

const mockCatalogDetail = {
  catalog: {
    uuid: 'cat-1111-2222',
    metadata: { title: 'Loaded Catalog 1' },
    controls: [
      { id: 'ac-1', title: 'Access Control Policy' },
      { id: 'ac-2', title: 'Account Management' }
    ],
    groups: [
      {
        id: 'group-1',
        title: 'Identification and Authentication',
        controls: [
          { id: 'ia-1', title: 'IA Policy' }
        ]
      }
    ]
  }
};

const mockProfileDoc = {
  profile: {
    uuid: 'prof-1111-2222',
    metadata: {
      title: '',
      version: '1.0.0',
      'oscal-version': '1.1.2'
    },
    imports: [],
    modify: {
      'set-parameters': [],
      alters: []
    }
  }
};

function setupFetchMocks(catalogsList = mockCatalogList, catalogDetail = mockCatalogDetail, ok = true) {
  global.fetch = vi.fn().mockImplementation((url, options) => {
    if (url.includes('/api/documents/catalogs/')) {
      return Promise.resolve({
        ok,
        json: async () => catalogDetail,
      });
    }
    if (url.includes('/api/documents/catalogs')) {
      return Promise.resolve({
        ok: true,
        json: async () => catalogsList,
      });
    }
    if (url.includes('/api/documents/profiles')) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    }
    if (url.includes('/api/validate/')) {
      return Promise.resolve({
        ok,
        json: async () => ok ? { status: 'valid' } : { detail: 'Schema error' },
      });
    }
    if (url.includes('/api/import/registry')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 'nist-catalog', title: 'Mock NIST Catalog', model: 'catalog', source: 'nist' }
        ]
      });
    }
    if (url.includes('/api/documents/')) {
      return Promise.resolve({
        ok,
        json: async () => ok ? {} : { detail: 'Save failed error' },
      });
    }
    return Promise.resolve({
      ok: false,
      json: async () => ({})
    });
  });
}

describe('DocumentEditor', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders input fields for metadata', async () => {
    await act(async () => {
      render(<DocumentEditor stage="catalogs" onSaved={vi.fn()} onCancel={vi.fn()} />);
    });
    expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('1.0.0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('1.1.2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/remarks/i)).toBeInTheDocument();
  });

  it('populates fields when editDoc is provided', () => {
    const editDoc = {
      catalog: {
        uuid: 'existing-uuid-1234',
        metadata: {
          title: 'Existing Catalog Title',
          version: '2.0.0',
          'oscal-version': '1.1.3',
          remarks: 'Some remark text'
        }
      }
    };
    render(<DocumentEditor stage="catalogs" editDoc={editDoc} onSaved={vi.fn()} onCancel={vi.fn()} />);
    
    expect(screen.getByPlaceholderText(/title/i).value).toBe('Existing Catalog Title');
    expect(screen.getByPlaceholderText('1.0.0').value).toBe('2.0.0');
    expect(screen.getByPlaceholderText('1.1.2').value).toBe('1.1.3');
    expect(screen.getByPlaceholderText(/remarks/i).value).toBe('Some remark text');
  });

  it('binds input changes', async () => {
    await act(async () => {
      render(<DocumentEditor stage="catalogs" onSaved={vi.fn()} onCancel={vi.fn()} />);
    });
    const titleInput = screen.getByPlaceholderText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'New Test Catalog' } });
    expect(titleInput.value).toBe('New Test Catalog');
  });

  it('handles validation successfully', async () => {
    setupFetchMocks();
    render(<DocumentEditor stage="catalogs" onSaved={vi.fn()} onCancel={vi.fn()} />);
    
    // Fill title
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Valid Catalog' } });
    
    const validateBtn = screen.getByRole('button', { name: /^Validate$/ });
    await act(async () => {
      fireEvent.click(validateBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Valid Catalog/i)).toBeInTheDocument();
    });
  });

  it('handles validation error response', async () => {
    setupFetchMocks([], {}, false);
    render(<DocumentEditor stage="catalogs" onSaved={vi.fn()} onCancel={vi.fn()} />);
    
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Invalid Catalog' } });
    
    const validateBtn = screen.getByRole('button', { name: /^Validate$/ });
    await act(async () => {
      fireEvent.click(validateBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Schema error/i)).toBeInTheDocument();
    });
  });

  it('submits valid document and calls onSaved callback', async () => {
    const onSaved = vi.fn();
    setupFetchMocks();
    render(<DocumentEditor stage="catalogs" onSaved={onSaved} onCancel={vi.fn()} />);
    
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Saved Catalog' } });
    
    const saveBtn = screen.getByRole('button', { name: /Create Document|Create Catalog/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('renders the complete raw JSON textarea for catalogs', async () => {
    render(<DocumentEditor stage="catalogs" onSaved={vi.fn()} onCancel={vi.fn()} />);
    const rawToggle = screen.getByRole('button', { name: /Raw JSON Editor/i });
    await act(async () => {
      fireEvent.click(rawToggle);
    });
    expect(screen.getByPlaceholderText(/Paste your raw OSCAL JSON here.../i)).toBeInTheDocument();
  });

  it('displays error if raw JSON textarea contains invalid JSON', async () => {
    render(<DocumentEditor stage="catalogs" onSaved={vi.fn()} onCancel={vi.fn()} />);
    
    const rawToggle = screen.getByRole('button', { name: /Raw JSON Editor/i });
    await act(async () => {
      fireEvent.click(rawToggle);
    });

    const rawTextarea = screen.getByPlaceholderText(/Paste your raw OSCAL JSON here.../i);
    fireEvent.change(rawTextarea, { target: { value: '{invalid json}' } });

    const saveBtn = screen.getByRole('button', { name: /Create Document|Create Catalog/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Unexpected token|JSON|Expected property/i, { selector: '.error-message' })).toBeInTheDocument();
    });
  });

  it('profile visual tailoring loads and checks available catalogs', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<DocumentEditor stage="profiles" editDoc={mockProfileDoc} onSaved={vi.fn()} onCancel={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Select Catalogs and Profiles as Import Baseline (Inputs)')).toBeInTheDocument();
      expect(screen.getByText('Loaded Catalog 1')).toBeInTheDocument();
    });

    // Check catalog checkbox
    const checkbox = screen.getByRole('checkbox', { name: /Loaded Catalog 1/i });
    expect(checkbox.checked).toBe(false);

    await act(async () => {
      fireEvent.click(checkbox);
    });

    // It should load catalog controls and display controls checklist
    await waitFor(() => {
      expect(checkbox.checked).toBe(true);
      expect(screen.getByText(/Access Control Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/Account Management/i)).toBeInTheDocument();
      expect(screen.getByText(/IA Policy/i)).toBeInTheDocument();
    });

    // Toggles single control checkbox
    const ac1Checkbox = screen.getByRole('checkbox', { name: /AC-1/i });
    expect(ac1Checkbox.checked).toBe(true); // Default behavior in code selects loaded catalog controls

    await act(async () => {
      fireEvent.click(ac1Checkbox);
    });
    expect(ac1Checkbox.checked).toBe(false);
  });

  it('profile visual tailoring can build profile document with imports and selected controls', async () => {
    const onSaved = vi.fn();
    setupFetchMocks();
    await act(async () => {
      render(<DocumentEditor stage="profiles" editDoc={mockProfileDoc} onSaved={onSaved} onCancel={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Loaded Catalog 1')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', { name: /Loaded Catalog 1/i });
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await waitFor(() => {
      expect(screen.getByText(/Access Control Policy/i)).toBeInTheDocument();
    });

    // Populate profile title so button is enabled
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'My Profile Title' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /^Update Document$/ });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
        profile: expect.objectContaining({
          imports: expect.arrayContaining([
            expect.objectContaining({
              href: '../catalogs/cat-1111-2222.json',
              'include-controls': expect.any(Array)
            })
          ])
        })
      }));
    });
  });

  it('SSP visual builder loads profile, components, shows parameter variables and saves set-parameters', async () => {
    const onSaved = vi.fn();
    
    // Setup fetch mocks for SSP flow
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.endsWith('/api/documents/profiles')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              profile: {
                uuid: '201765f8-6d45-4941-8789-9eef2effd7d0',
                metadata: { title: 'Test Profile' }
              }
            }
          ]
        });
      }
      if (url.endsWith('/api/documents/component-definitions')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              'component-definition': {
                uuid: 'bedec39a-6f8c-4d24-8b12-34458f387800',
                metadata: { title: 'Test Component Def' },
                components: [
                  {
                    uuid: 'bbbbbbbb-cccc-4444-dddd-eeeeeeeeeeee',
                    title: 'Database Server',
                    type: 'software',
                    description: 'Local postgres database'
                  }
                ]
              }
            }
          ]
        });
      }
      if (url.includes('/api/documents/profiles/201765f8-6d45-4941-8789-9eef2effd7d0')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            profile: {
              uuid: '201765f8-6d45-4941-8789-9eef2effd7d0',
              metadata: { title: 'Test Profile' },
              imports: [
                { href: '/api/documents/catalogs/ea7c7688-79c5-463b-a91b-0650f2d98623' }
              ],
              modify: {
                'set-parameters': [
                  { 'param-id': 'ac-1_prm_1', values: ['weekly'] }
                ]
              }
            }
          })
        });
      }
      if (url.includes('/api/documents/catalogs/ea7c7688-79c5-463b-a91b-0650f2d98623')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            catalog: {
              uuid: 'ea7c7688-79c5-463b-a91b-0650f2d98623',
              metadata: { title: 'Test Catalog' },
              controls: [
                {
                  id: 'ac-1',
                  title: 'Access Control Policy',
                  params: [
                    { id: 'ac-1_prm_1', label: 'Frequency of review', values: ['monthly'] }
                  ]
                }
              ]
            }
          })
        });
      }
      if (url.includes('/api/validate/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'valid' }),
        });
      }
      if (url.includes('/api/documents/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({}),
        statusText: 'Not Found'
      });
    });

    await act(async () => {
      render(<DocumentEditor stage="ssps" onSaved={onSaved} onCancel={vi.fn()} />);
    });

    // Populate title & system name
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'My SSP Document' } });
    fireEvent.change(screen.getByPlaceholderText(/My Secure Web Application/i), { target: { value: 'My App' } });

    // Select Profile
    const profileSelect = screen.getAllByRole('combobox')[0];
    await act(async () => {
      fireEvent.change(profileSelect, { target: { value: '201765f8-6d45-4941-8789-9eef2effd7d0' } });
    });

    // Go to Tab 2: System Components
    const componentsTabBtn = screen.getByRole('button', { name: /Active Components/i });
    await act(async () => {
      fireEvent.click(componentsTabBtn);
    });

    // Check Database Server checkbox
    const compCheckbox = screen.getByRole('checkbox', { name: /Database Server/i });
    await act(async () => {
      fireEvent.click(compCheckbox);
    });

    // Go to Tab 3: Control Implementation
    const controlsTabBtn = screen.getByRole('button', { name: /Control Implementation/i });
    await act(async () => {
      fireEvent.click(controlsTabBtn);
    });

    // Wait for resolved controls and parameter values to render
    await waitFor(() => {
      expect(screen.getByText(/AC-1: Access Control Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/ac-1_prm_1/i)).toBeInTheDocument();
    });

    // Modify the variable input value (Baseline is weekly because of profile set-parameters override)
    const paramInput = screen.getByDisplayValue('weekly');
    fireEvent.change(paramInput, { target: { value: 'daily' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /^Create Document$/ });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
        'system-security-plan': expect.objectContaining({
          'control-implementation': expect.objectContaining({
            'implemented-requirements': expect.arrayContaining([
              expect.objectContaining({
                'control-id': 'ac-1',
                'set-parameters': expect.arrayContaining([
                  expect.objectContaining({
                    'param-id': 'ac-1_prm_1',
                    values: ['daily']
                  })
                ])
              })
            ])
          })
        })
      }));
    });
  });

  it('synchronizes visual and raw modes when toggled using handleModeToggle', async () => {
    render(<DocumentEditor stage="catalogs" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const rawToggle = screen.getByRole('button', { name: /Raw JSON Editor/i });
    await act(async () => {
      fireEvent.click(rawToggle);
    });

    const rawTextarea = screen.getByPlaceholderText(/Paste your raw OSCAL JSON here.../i);
    const catalogData = {
      catalog: {
        uuid: 'test-catalog-uuid-1234',
        metadata: {
          title: 'My Synced Catalog',
          version: '1.2.3',
          'oscal-version': '1.1.2'
        },
        groups: [
          { id: 'g1', title: 'Group 1', controls: [] }
        ]
      }
    };
    fireEvent.change(rawTextarea, { target: { value: JSON.stringify(catalogData) } });

    const visualToggle = screen.getByRole('button', { name: /Catalog Metadata/i });
    await act(async () => {
      fireEvent.click(visualToggle);
    });

    expect(screen.getByPlaceholderText(/Catalog title/i).value).toBe('My Synced Catalog');
    expect(screen.getByPlaceholderText('1.0.0').value).toBe('1.2.3');
    expect(screen.getByPlaceholderText('e.g. Access Control').value).toBe('Group 1');
  });

  it('profile visual tailoring supports inline editing of control statement with transparent alters mapping', async () => {
    const onSaved = vi.fn();
    const catalogDetailWithParts = {
      catalog: {
        uuid: 'cat-1111-2222',
        metadata: { title: 'Loaded Catalog 1' },
        controls: [
          {
            id: 'ac-2',
            title: 'Account Management',
            parts: [
              {
                id: 'ac-2_smt',
                name: 'statement',
                prose: 'Original statement prose text'
              }
            ]
          }
        ]
      }
    };
    setupFetchMocks(mockCatalogList, catalogDetailWithParts);

    await act(async () => {
      render(<DocumentEditor stage="profiles" editDoc={mockProfileDoc} onSaved={onSaved} onCancel={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Loaded Catalog 1')).toBeInTheDocument();
    });

    // Check catalog to import
    const checkbox = screen.getByRole('checkbox', { name: /Loaded Catalog 1/i });
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await waitFor(() => {
      expect(screen.getByText(/Account Management/i)).toBeInTheDocument();
    });

    // Check that the control is selected by default (catalog controls are auto-imported)
    const ctrlCheckbox = screen.getByRole('checkbox', { name: /AC-2/i });
    expect(ctrlCheckbox.checked).toBe(true);

    // Navigate to Tab 2: Modifications
    const modTabBtn = screen.getByRole('button', { name: /2. Modifications/i });
    await act(async () => {
      fireEvent.click(modTabBtn);
    });

    // Click "Full Control Text" disclosure summary to show statement
    await waitFor(() => {
      expect(screen.getByText(/Full Control Text/i)).toBeInTheDocument();
    });
    const summaryBtn = screen.getByText(/Full Control Text/i);
    await act(async () => {
      fireEvent.click(summaryBtn);
    });

    // Find the textarea with original text and edit it
    const textarea = screen.getByDisplayValue('Original statement prose text');
    fireEvent.change(textarea, { target: { value: 'Modified statement prose text' } });

    // Populate profile title so save button is enabled
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test Inline Alters' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /^Update Document$/ });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
        profile: expect.objectContaining({
          modify: expect.objectContaining({
            alters: expect.arrayContaining([
              expect.objectContaining({
                'control-id': 'AC-2',
                adds: expect.arrayContaining([
                  expect.objectContaining({
                    position: 'before',
                    'by-id': 'ac-2_smt',
                    parts: expect.arrayContaining([
                      expect.objectContaining({
                        id: 'ac-2_smt_modified',
                        prose: 'Modified statement prose text'
                      })
                    ])
                  })
                ]),
                removes: expect.arrayContaining([
                  expect.objectContaining({
                    'by-id': 'ac-2_smt'
                  })
                ])
              })
            ])
          })
        })
      }));
    });
  });

  it('supports Assessment Objectives and Assessment Methods with ProseWithParams and Add Parameter button', async () => {
    const editCatalogDoc = {
      catalog: {
        uuid: 'cat-test-obj-method',
        metadata: {
          title: 'Catalog for Obj Method Test',
          version: '1.0.0',
          'oscal-version': '1.1.2'
        },
        groups: [
          {
            id: 'g1',
            title: 'Group 1',
            controls: [
              {
                id: 'c1',
                title: 'Control 1',
                params: [{ id: 'param_1', label: 'Param 1' }],
                parts: [
                  { id: 'c1_obj', name: 'objective', prose: 'Initial objective' },
                  { id: 'c1_method', name: 'assessment-method', prose: 'Initial method' }
                ]
              }
            ]
          }
        ]
      }
    };

    render(<DocumentEditor stage="catalogs" editDoc={editCatalogDoc} onSaved={vi.fn()} onCancel={vi.fn()} />);

    // Verify Assessment Objectives and Assessment Methods inputs exist with initial prose
    const objInput = screen.getByDisplayValue('Initial objective');
    const methodInput = screen.getByDisplayValue('Initial method');
    expect(objInput).toBeInTheDocument();
    expect(methodInput).toBeInTheDocument();

    // Verify "⚙️ Add Parameter" buttons exist
    const addParamBtns = screen.getAllByRole('button', { name: /⚙️ Add Parameter/i });
    expect(addParamBtns.length).toBeGreaterThanOrEqual(2);

    // Click "Add Parameter" on Assessment Objectives
    await act(async () => {
      fireEvent.click(addParamBtns[0]);
    });

    // Should insert parameter placeholder {{ insert: param, param_1 }} into Objectives
    expect(objInput.value).toContain('{{ insert: param, param_1 }}');
  });
});

