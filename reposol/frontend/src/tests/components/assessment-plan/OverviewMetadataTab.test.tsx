import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OverviewMetadataTab } from '../../../components/assessment-plan/OverviewMetadataTab';
import { AssessmentPlan } from '../../../lib/types/oscal';

vi.mock('../../../lib/api', () => ({
  fetchDocument: vi.fn().mockResolvedValue({
    'system-security-plan': {
      'system-characteristics': { 'system-name': 'Target FedRAMP System', status: { state: 'operational' } },
      'control-implementation': { 'implemented-requirements': [{ 'control-id': 'ac-1' }, { 'control-id': 'ac-2' }, { 'control-id': 'ia-2' }] },
      'system-implementation': { components: [{ uuid: 'c1' }, { uuid: 'c2' }], users: [{ uuid: 'u1' }] },
    },
  }),
}));

describe('OverviewMetadataTab', () => {
  const mockDispatch = vi.fn();
  const mockOpenSSPBrowser = vi.fn();

  const mockAP: AssessmentPlan = {
    uuid: 'ap-1',
    metadata: {
      title: 'FedRAMP Assessment Plan',
      version: '1.0.0',
      'oscal-version': '1.2.2',
      remarks: 'Annual re-assessment mandate.',
      roles: [{ id: 'lead-assessor', title: 'Lead Assessor' }],
      parties: [{ uuid: 'party-1', name: 'Alice Auditor', type: 'person', 'email-addresses': ['alice@audit.com'] }],
      'responsible-parties': [{ 'role-id': 'lead-assessor', 'party-uuids': ['party-1'] }],
      props: [{ name: 'classification', value: 'CUI' }],
    },
    'import-ssp': {
      href: '../system-security-plans/00000000-0000-0000-0000-000000000001.json',
      remarks: 'Primary system SSP',
    },
    'reviewed-controls': {
      'control-selections': [{ 'include-all': {} }],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders metadata fields and dispatches title / version edits', () => {
    render(
      <OverviewMetadataTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
        onOpenSSPBrowser={mockOpenSSPBrowser}
      />
    );

    expect(screen.getByDisplayValue('FedRAMP Assessment Plan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1.2.2')).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue('FedRAMP Assessment Plan');
    fireEvent.change(titleInput, { target: { value: 'Updated Plan Title' } });
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_TITLE',
      })
    );
  });

  it('renders target SSP reference, triggers SSP browser, and shows live resolved card', async () => {
    render(
      <OverviewMetadataTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
        onOpenSSPBrowser={mockOpenSSPBrowser}
      />
    );

    // Browse button
    const browseBtn = screen.getByRole('button', { name: /Browse Workspace SSPs/i });
    fireEvent.click(browseBtn);
    expect(mockOpenSSPBrowser).toHaveBeenCalled();

    // Live Target System Summary card
    await waitFor(() => {
      expect(screen.getByText('Target FedRAMP System')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 controls
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 components
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 user
    });
  });

  it('adds a standard role using quick presets and custom role input', () => {
    render(
      <OverviewMetadataTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
        onOpenSSPBrowser={mockOpenSSPBrowser}
      />
    );

    const presetBtn = screen.getByRole('button', { name: /\+ Security Auditor/i });
    fireEvent.click(presetBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_ROLE',
      })
    );
  });

  it('adds and removes custom metadata properties', () => {
    render(
      <OverviewMetadataTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
        onOpenSSPBrowser={mockOpenSSPBrowser}
      />
    );

    expect(screen.getByText('classification:')).toBeInTheDocument();
    expect(screen.getByText('CUI')).toBeInTheDocument();

    const propNameInput = screen.getByPlaceholderText(/Property Name/i);
    const propValInput = screen.getByPlaceholderText(/Property Value/i);
    const addPropBtn = screen.getByRole('button', { name: /Add Property/i });

    fireEvent.change(propNameInput, { target: { value: 'environment' } });
    fireEvent.change(propValInput, { target: { value: 'production' } });
    fireEvent.click(addPropBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_PROP',
      })
    );
  });
});
