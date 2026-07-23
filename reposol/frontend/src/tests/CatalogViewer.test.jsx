/**
 * Tests for the CatalogViewer component.
 * Covers: Loading and rendering, sidebar search & filtering, control selection,
 * edit mode activation, visual parameter editing, undo/redo history,
 * raw JSON editing mode, validation alerts, saving new version,
 * and draft prompt recovery from localStorage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CatalogViewer from '../components/CatalogViewer';

const mockCatalogDoc = {
  catalog: {
    uuid: 'cat-1111-2222',
    metadata: {
      title: 'Mock Catalog 1',
      version: '1.0.0',
      'oscal-version': '1.1.2'
    },
    groups: [
      {
        id: 'group-1',
        title: 'Access Control',
        controls: [
          { id: 'ac-1', title: 'Access Control Policy', params: [{ id: 'ac-1_prm_1', label: 'Select policy' }] },
          { id: 'ac-2', title: 'Account Management' }
        ]
      },
      {
        id: 'group-2',
        title: 'Audit and Accountability',
        controls: [
          { id: 'au-1', title: 'Audit Policy' }
        ]
      }
    ]
  }
};

function setupFetchMocks(catalogData = mockCatalogDoc, ok = true) {
  global.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/versions')) {
      return Promise.resolve({
        ok,
        json: async () => ok ? [
          {
            version: '1.0.0',
            'last-modified': new Date().toISOString(),
            remarks: 'Initial version'
          },
          {
            version: '0.9.0',
            'last-modified': new Date().toISOString(),
            remarks: 'Previous version'
          }
        ] : [],
        statusText: ok ? 'OK' : 'Not Found',
      });
    }
    if (url.includes('/api/documents/catalogs/')) {
      return Promise.resolve({
        ok,
        json: async () => catalogData,
        statusText: ok ? 'OK' : 'Not Found',
      });
    }
    if (url.includes('/api/validate/')) {
      return Promise.resolve({
        ok,
        json: async () => ok ? { status: 'valid' } : { detail: 'Validation failed' }
      });
    }
    if (url.includes('/api/documents/')) {
      return Promise.resolve({
        ok,
        json: async () => ({ status: 'created', uuid: 'new-uuid', title: 'New title' })
      });
    }
    return Promise.resolve({
      ok: false,
      json: async () => ({}),
      statusText: 'Not Found'
    });
  });
}

describe('CatalogViewer', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders loading state and then catalog contents', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    expect(screen.getAllByText(/Mock Catalog 1/i).length).toBeGreaterThan(0);
    
    // Expand group
    fireEvent.click(screen.getByText('Access Control'));
    expect(screen.getByText('ac-1'.toUpperCase())).toBeInTheDocument();
    expect(screen.getByText('ac-2'.toUpperCase())).toBeInTheDocument();
  });

  it('handles catalog fetch failure error display', async () => {
    setupFetchMocks(null, false);
    await act(async () => {
      render(<CatalogViewer catalogId="invalid-uuid" onClose={vi.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText(/Catalog not found/i)).toBeInTheDocument();
    });
  });

  it('filters controls list based on sidebar search input', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    const searchInput = screen.getByPlaceholderText(/Search controls/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Account' } });
    });

    // AC-2 is matching, AC-1 should be filtered out
    expect(screen.getByText('ac-2'.toUpperCase())).toBeInTheDocument();
    expect(screen.queryByText('ac-1'.toUpperCase())).not.toBeInTheDocument();
  });

  it('selects and displays control details when clicked', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    // Expand group
    fireEvent.click(screen.getByText('Access Control'));

    const ac1Link = screen.getByText('ac-1'.toUpperCase());
    await act(async () => {
      fireEvent.click(ac1Link);
    });

    expect(screen.getByRole('heading', { name: 'Access Control Policy' })).toBeInTheDocument();
    expect(screen.getByText('ac-1_prm_1')).toBeInTheDocument();
  });

  it('toggles edit mode when clicking Edit Catalog button', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    const editBtn = screen.getByRole('button', { name: /Edit/i });
    await act(async () => {
      fireEvent.click(editBtn);
    });

    expect(screen.getByRole('button', { name: /Visual \/ Form/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Raw JSON/i })).toBeInTheDocument();
  });

  it('visual editing: edit title and parameters', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    // Enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    });

    // Change title while still in overview
    const titleInput = screen.getAllByPlaceholderText('Document Title')[0];
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Edited Mock Catalog' } });
    });
    expect(titleInput.value).toBe('Edited Mock Catalog');

    // Expand group
    fireEvent.click(screen.getByText('Access Control'));

    // Select AC-1 to edit its params
    await act(async () => {
      fireEvent.click(screen.getByText('ac-1'.toUpperCase()));
    });

    // Change parameter value
    const paramInput = screen.getByPlaceholderText(/Value 1/i);
    await act(async () => {
      fireEvent.change(paramInput, { target: { value: 'custom policy value' } });
    });
    expect(paramInput.value).toBe('custom policy value');
  });

  it('handles undo/redo visual changes history', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    });

    const titleInput = screen.getAllByPlaceholderText('Document Title')[0];
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Change A' } });
    });
    expect(titleInput.value).toBe('Change A');

    // Click Undo
    const undoBtn = screen.getByRole('button', { name: /Undo/i });
    await act(async () => {
      fireEvent.click(undoBtn);
    });
    expect(titleInput.value).toBe('Mock Catalog 1');

    // Click Redo
    const redoBtn = screen.getByRole('button', { name: /Redo/i });
    await act(async () => {
      fireEvent.click(redoBtn);
    });
    expect(titleInput.value).toBe('Change A');
  });

  it('raw JSON editor: checks formatting and validates schema', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    });

    const jsonTab = screen.getByRole('button', { name: /Raw JSON/i });
    await act(async () => {
      fireEvent.click(jsonTab);
    });

    const textarea = screen.getByPlaceholderText(/Paste or write raw OSCAL JSON/i);
    expect(textarea).toBeInTheDocument();

    // Trigger validation
    const validateBtn = screen.getByRole('button', { name: /Validate/i });
    await act(async () => {
      fireEvent.click(validateBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/OSCAL Compliant/i)).toBeInTheDocument();
    });
  });

  it('prompts to recover draft if found in localStorage', async () => {
    localStorage.setItem('reposol-draft-cat-1111-2222', JSON.stringify({
      catalog: {
        uuid: 'cat-1111-2222',
        metadata: { title: 'Draft Recovered Catalog' }
      }
    }));

    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    expect(screen.getByText(/Unsaved draft found/i)).toBeInTheDocument();
    
    // Click Load Draft
    const loadDraftBtn = screen.getByRole('button', { name: /Restore/i });
    await act(async () => {
      fireEvent.click(loadDraftBtn);
    });

    expect(screen.getAllByDisplayValue(/Draft Recovered Catalog/i).length).toBeGreaterThan(0);
  });

  it('discards draft from localStorage if Discard is clicked', async () => {
    localStorage.setItem('reposol-draft-cat-1111-2222', JSON.stringify({
      catalog: {
        uuid: 'cat-1111-2222',
        metadata: { title: 'Draft Recovered Catalog' }
      }
    }));

    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    expect(screen.getByText(/Unsaved draft found/i)).toBeInTheDocument();

    const discardBtn = screen.getByRole('button', { name: /Discard/i });
    await act(async () => {
      fireEvent.click(discardBtn);
    });

    expect(screen.queryByText(/Unsaved draft found/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('reposol-draft-cat-1111-2222')).toBeNull();
  });

  it('saves the edited catalog as a new version', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    // Enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    });

    // Change title
    const titleInput = screen.getAllByPlaceholderText('Document Title')[0];
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Newly Saved Catalog Title' } });
    });

    // Save
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Confirm save in version modal
    const confirmBtn = screen.getAllByRole('button', { name: /Save version/i }).pop();
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
    });
  });

  it('cancels edit mode and restores original document', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    setupFetchMocks();
    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    // Enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    });

    // Change title
    const titleInput = screen.getAllByPlaceholderText('Document Title')[0];
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Temporary Title' } });
    });

    // Exit (cancel)
    const exitBtn = screen.getByRole('button', { name: /Exit/i });
    await act(async () => {
      fireEvent.click(exitBtn);
    });

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Exit/i })).not.toBeInTheDocument();
    });
  });

  it('loads a profile and resolves imports', async () => {
    // Mock profile doc fetch
    const mockProfileDoc = {
      profile: {
        uuid: 'profile-9999-8888',
        metadata: {
          title: 'Mock Profile 1',
          version: '1.0.0',
          'oscal-version': '1.1.2'
        },
        imports: [
          { href: '#ea7c7688-79c5-463b-a91b-0650f2d98623', 'include-controls': [{ 'with-ids': ['ac-1'] }] }
        ]
      }
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/versions')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/api/documents/profiles/profile-9999-8888')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProfileDoc,
        });
      }
      if (url.includes('/api/documents/catalogs/ea7c7688-79c5-463b-a91b-0650f2d98623')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCatalogDoc,
        });
      }
      if (url.endsWith('/api/documents/profiles')) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockProfileDoc],
        });
      }
      if (url.endsWith('/api/documents/catalogs')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              catalog: {
                uuid: 'ea7c7688-79c5-463b-a91b-0650f2d98623',
                metadata: { title: 'Imported Catalog' }
              }
            }
          ]
        });
      }
      return Promise.resolve({ ok: false });
    });

    await act(async () => {
      render(<CatalogViewer profileId="profile-9999-8888" onClose={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Mock Profile 1/i).length).toBeGreaterThan(0);
    });
  });

  it('deletes a specific version when requested', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    setupFetchMocks();
    
    const fetchSpy = vi.spyOn(global, 'fetch');

    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    // Open versions list drawer
    const versionsBtn = screen.getByRole('button', { name: /Versions/i });
    await act(async () => {
      fireEvent.click(versionsBtn);
    });

    // Find the delete button for non-active version 0.9.0
    const deleteBtn = screen.getByTitle('Delete version');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/documents/catalogs/cat-1111-2222/versions/0.9.0'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('renders Tags tab with Global Properties and Used Tags, allowing promotion to global', async () => {
    const mockProfileDoc = {
      profile: {
        uuid: 'profile-9999-8888',
        metadata: {
          title: 'Mock Profile 1',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          props: [{ name: 'existing-global-prop', value: 'global-val' }]
        },
        imports: [
          { href: '#ea7c7688-79c5-463b-a91b-0650f2d98623', 'include-controls': [{ 'with-ids': ['ac-1'] }] }
        ]
      }
    };

    const mockCatalogWithProps = {
      catalog: {
        uuid: 'ea7c7688-79c5-463b-a91b-0650f2d98623',
        metadata: { title: 'Imported Catalog' },
        controls: [
          { 
            id: 'ac-1', 
            title: 'Access Control Policy', 
            props: [
              { name: 'sort-id', value: 'sort-val-1' },
              { name: 'existing-global-prop', value: 'global-val' }
            ] 
          }
        ]
      }
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/versions')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/api/documents/profiles/profile-9999-8888')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProfileDoc,
        });
      }
      if (url.includes('/api/documents/catalogs/ea7c7688-79c5-463b-a91b-0650f2d98623')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCatalogWithProps,
        });
      }
      if (url.endsWith('/api/documents/profiles')) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockProfileDoc],
        });
      }
      if (url.endsWith('/api/documents/catalogs')) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockCatalogWithProps]
        });
      }
      return Promise.resolve({ ok: false });
    });

    await act(async () => {
      render(<CatalogViewer profileId="profile-9999-8888" onClose={vi.fn()} initialEditMode={true} />);
    });

    // 1. Click "Properties" tab
    const tagsTabBtn = screen.getByRole('button', { name: /Properties|Tags/i });
    await act(async () => {
      fireEvent.click(tagsTabBtn);
    });

    // 2. Check that "existing-global-prop" is shown in Global Properties
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing-global-prop')).toBeInTheDocument();

    // 3. Check that Used Tags section is visible and contains "sort-id"
    expect(screen.getByText('sort-id')).toBeInTheDocument();
    expect(screen.getAllByText('(1x used)').length).toBe(2);

    // 4. Click promote button for "sort-id"
    const promoteBtn = screen.getByRole('button', { name: /Add as global property/i });
    await act(async () => {
      fireEvent.click(promoteBtn);
    });

    // 5. Verify "sort-id" is now in global properties (there should be two input rows now)
    const nameInputs = screen.getAllByPlaceholderText('Name');
    expect(nameInputs.length).toBe(2);
    expect(nameInputs[1].value).toBe('sort-id');
  });

  it('allows catalog parameter editing and profile dropdown selection and pattern validation', async () => {
    const mockCat = {
      catalog: {
        id: 'cat-1',
        metadata: { title: 'Mock Catalog 1' },
        groups: [
          {
            id: 'group-1',
            title: 'Group 1',
            controls: [
              {
                id: 'ac-1',
                title: 'Control 1',
                params: [
                  {
                    id: 'ac-1_prm_1',
                    label: 'Test parameter',
                    values: ['val1'],
                    select: {
                      'how-many': 'one',
                      choice: ['val1', 'val2', 'val3']
                    },
                    constraints: [
                      {
                        description: 'pattern',
                        tests: [{ expression: '^val[1-3]$' }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    };

    setupFetchMocks(mockCat);

    await act(async () => {
      render(
        <CatalogViewer
          catalogId="cat-1"
          onClose={vi.fn()}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Group 1'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Control 1'));
    });

    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ac-1_prm_1')).toBeInTheDocument();

    const addParamBtn = screen.getByRole('button', { name: /Add Parameter/i });
    expect(addParamBtn).toBeInTheDocument();

    expect(screen.getByPlaceholderText('e.g. choice1, choice2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. ^[0-9]+ Days$')).toBeInTheDocument();

    const regexInput = screen.getByPlaceholderText('e.g. ^[0-9]+ Days$');
    await act(async () => {
      fireEvent.change(regexInput, { target: { value: '^val[0-9]$' } });
    });
    expect(regexInput.value).toBe('^val[0-9]$');

    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(screen.queryByText('ac-1_prm_1')).not.toBeInTheDocument();
  });

  it('allows visual editing of metadata arrays, resources, groups, and control links/roles', async () => {
    setupFetchMocks({
      catalog: {
        uuid: 'cat-1111-2222',
        metadata: {
          title: 'Advanced OSCAL Catalog',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          roles: [{ id: 'role-1', title: 'Developer' }],
          parties: [{ uuid: 'party-1', type: 'person', name: 'Alice' }],
          'responsible-parties': [{ 'role-id': 'role-1', 'party-uuids': ['party-1'] }]
        },
        groups: [
          {
            id: 'group-1',
            title: 'Visual Group',
            props: [{ name: 'family', value: 'system' }],
            links: [{ href: '#resource-1', text: 'Resource link', rel: 'reference' }],
            parts: [{ id: 'gp-1', name: 'description', prose: 'Group prose description' }],
            controls: [
              {
                id: 'ac-1',
                title: 'Control 1',
                params: [{ id: 'p1', label: 'param 1' }],
                links: [{ href: 'https://google.com', text: 'Search', rel: 'alternate' }],
                'responsible-parties': [{ 'role-id': 'role-1', 'party-uuids': ['party-1'] }]
              }
            ]
          }
        ],
        'back-matter': {
          resources: [
            {
              uuid: 'resource-1',
              title: 'Source Document',
              description: 'NIST Framework doc',
              citation: { text: 'NIST SP 800-53' }
            }
          ]
        }
      }
    });

    await act(async () => {
      render(<CatalogViewer catalogId="cat-1111-2222" onClose={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    });

    expect(screen.getByText('Global Roles')).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(screen.getByText('Visual Group'));
    });
    expect(screen.getByText('Group ID')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Visual Group')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Group prose description')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTitle('AC-1: Control 1'));
    });
    expect(screen.getByText('Links / References')).toBeInTheDocument();
    const linkTextInput = screen.getByPlaceholderText('Link Text');
    expect(linkTextInput.value).toBe('Search');
  });
});
