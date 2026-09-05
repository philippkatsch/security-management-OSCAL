import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SystemCharacteristicsEditor, {
  calculateFipsHighWaterMark,
  SP_800_60_TEMPLATES,
  STANDARD_SSP_ROLES
} from '../../components/ssp/SystemCharacteristicsEditor';

describe('calculateFipsHighWaterMark', () => {
  it('correctly calculates high-water mark across info types', () => {
    const infoTypes = [
      {
        'confidentiality-impact': { base: 'fips-199-low' },
        'integrity-impact': { base: 'fips-199-moderate' },
        'availability-impact': { base: 'fips-199-low' }
      },
      {
        'confidentiality-impact': { base: 'fips-199-moderate', selected: 'fips-199-high' },
        'integrity-impact': { base: 'fips-199-low' },
        'availability-impact': { base: 'fips-199-moderate' }
      }
    ];

    const result = calculateFipsHighWaterMark(infoTypes);
    expect(result.confidentiality).toBe('fips-199-high');
    expect(result.integrity).toBe('fips-199-moderate');
    expect(result.availability).toBe('fips-199-moderate');
    expect(result.overall).toBe('fips-199-high');
  });

  it('returns empty strings for empty info types list', () => {
    const result = calculateFipsHighWaterMark([]);
    expect(result.overall).toBe('');
  });

  it('safely handles null, undefined, or non-array inputs by defaulting to fips-199-low', () => {
    const defaultLow = {
      confidentiality: 'fips-199-low',
      integrity: 'fips-199-low',
      availability: 'fips-199-low',
      overall: 'fips-199-low'
    };
    expect(calculateFipsHighWaterMark(null)).toEqual(defaultLow);
    expect(calculateFipsHighWaterMark(undefined)).toEqual(defaultLow);
    expect(calculateFipsHighWaterMark('invalid' as any)).toEqual(defaultLow);
  });

  it('safely handles non-string impact values', () => {
    const nonStringTypes = [
      {
        'confidentiality-impact': { base: 123 as any },
        'integrity-impact': { base: true as any },
        'availability-impact': { base: {} as any }
      }
    ];
    let result: any;
    expect(() => {
      result = calculateFipsHighWaterMark(nonStringTypes);
    }).not.toThrow();
    expect(result).toBeDefined();
  });
});

describe('SystemCharacteristicsEditor Component', () => {
  const sampleSystemChars = {
    'system-ids': [
      { id: 'SYS-PROD-001', 'identifier-type': 'http://fedramp.gov/ns/oscal' },
      { id: 'SYS-SEC-002', 'identifier-type': 'http://datatracker.ietf.org/doc/html/rfc4122' }
    ],
    'system-name': 'Test OSCAL System',
    'system-name-short': 'TOS',
    description: 'A test system for verification.',
    'security-sensitivity-level': 'moderate',
    status: { state: 'operational' },
    props: [
      { name: 'cloud-deployment-model', value: 'public-cloud' },
      { name: 'cloud-service-model', value: 'saas' },
      { name: 'identity-assurance-level', value: '2' },
      { name: 'authenticator-assurance-level', value: '2' },
      { name: 'federation-assurance-level', value: '1' }
    ],
    'security-impact-level': {
      'security-objective-confidentiality': 'fips-199-low',
      'security-objective-integrity': 'fips-199-low',
      'security-objective-availability': 'fips-199-low'
    },
    'system-information': {
      'information-types': [
        {
          uuid: 'info-1',
          title: 'Personnel Information',
          description: 'HR records',
          categorizations: [
            {
              system: 'http://doi.org/10.6028/NIST.SP.800-60v2r1',
              'information-type-ids': ['C.3.5.8']
            }
          ],
          'confidentiality-impact': { base: 'fips-199-high' },
          'integrity-impact': { base: 'fips-199-moderate' },
          'availability-impact': { base: 'fips-199-low' }
        }
      ]
    },
    'authorization-boundary': {
      description: 'Production cloud VPC boundary',
      diagrams: []
    },
    'responsible-parties': [
      { 'role-id': 'system-owner', 'party-uuids': ['party-1'] }
    ]
  };

  const mockParties = [
    { uuid: 'party-1', name: 'Alice Smith', type: 'person' },
    { uuid: 'party-2', name: 'Acme Cloud Corp', type: 'organization' }
  ];

  it('renders system identity in view mode', () => {
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        editMode={false}
        metadataParties={mockParties}
      />
    );
    expect(screen.getByDisplayValue('Test OSCAL System')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SYS-PROD-001')).toBeInTheDocument();
    expect(screen.getByText('Security Impact Level (FIPS-199)')).toBeInTheDocument();
  });

  it('detects impact conflict and allows applying high-water mark suggestion', () => {
    const mockUpdate = vi.fn();
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        onUpdate={mockUpdate}
        editMode={true}
        metadataParties={mockParties}
      />
    );

    expect(screen.getByText(/Impact Level Conflict/i)).toBeInTheDocument();

    const applyBtn = screen.getByText('Apply High-Water Mark Suggestion');
    expect(applyBtn).toBeInTheDocument();

    fireEvent.click(applyBtn);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'security-sensitivity-level': 'high',
        'security-impact-level': {
          'security-objective-confidentiality': 'fips-199-high',
          'security-objective-integrity': 'fips-199-moderate',
          'security-objective-availability': 'fips-199-low'
        }
      })
    );
  });

  it('supports adding and editing system-ids', () => {
    const mockUpdate = vi.fn();
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        onUpdate={mockUpdate}
        editMode={true}
      />
    );

    const addIdBtn = screen.getByText('+ Add System ID');
    expect(addIdBtn).toBeInTheDocument();
    fireEvent.click(addIdBtn);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'system-ids': expect.arrayContaining([
          expect.objectContaining({ id: 'SYS-PROD-001' }),
          expect.objectContaining({ 'identifier-type': 'http://fedramp.gov/ns/oscal' })
        ])
      })
    );

    // Edit first system ID
    const firstIdInput = screen.getByDisplayValue('SYS-PROD-001');
    fireEvent.change(firstIdInput, { target: { value: 'SYS-CUSTOM-999' } });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'system-ids': expect.arrayContaining([
          expect.objectContaining({ id: 'SYS-CUSTOM-999' })
        ])
      })
    );
  });

  it('supports removing system-id when multiple exist', () => {
    const mockUpdate = vi.fn();
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        onUpdate={mockUpdate}
        editMode={true}
      />
    );

    const removeBtns = screen.getAllByLabelText(/Remove system id/i);
    expect(removeBtns.length).toBeGreaterThan(0);
    fireEvent.click(removeBtns[0]);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'system-ids': [
          { id: 'SYS-SEC-002', 'identifier-type': 'http://datatracker.ietf.org/doc/html/rfc4122' }
        ]
      })
    );
  });

  it('supports operational status state change and remarks when state is other', () => {
    const mockUpdate = vi.fn();
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        onUpdate={mockUpdate}
        editMode={true}
      />
    );

    const stateSelect = screen.getByDisplayValue('Operational');
    fireEvent.change(stateSelect, { target: { value: 'other' } });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { state: 'other' }
      })
    );
  });

  it('supports modifying Standard OSCAL Property Palette', () => {
    const mockUpdate = vi.fn();
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        onUpdate={mockUpdate}
        editMode={true}
      />
    );

    const cloudDeploySelect = screen.getByDisplayValue('Public Cloud');
    fireEvent.change(cloudDeploySelect, { target: { value: 'hybrid-cloud' } });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.arrayContaining([
          expect.objectContaining({ name: 'cloud-deployment-model', value: 'hybrid-cloud' })
        ])
      })
    );
  });

  it('supports assigning responsible parties via metadata parties checkbox picker', () => {
    const mockUpdate = vi.fn();
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        onUpdate={mockUpdate}
        editMode={true}
        metadataParties={mockParties}
      />
    );

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Acme Cloud Corp')).toBeInTheDocument();

    const acmeCheckbox = screen.getByLabelText(/Acme Cloud Corp/i);
    fireEvent.click(acmeCheckbox);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'responsible-parties': [
          { 'role-id': 'system-owner', 'party-uuids': ['party-1', 'party-2'] }
        ]
      })
    );
  });

  it('supports adding SP 800-60 preset template', () => {
    const mockUpdate = vi.fn();
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        onUpdate={mockUpdate}
        editMode={true}
      />
    );

    const selectPreset = screen.getByDisplayValue('➕ Load Preset SP 800-60 Template...');
    fireEvent.change(selectPreset, { target: { value: '1' } }); // Financial Management Information

    expect(mockUpdate).toHaveBeenCalled();
  });

  it('toggles expand and collapse all toolbar buttons', () => {
    render(
      <SystemCharacteristicsEditor
        systemChars={sampleSystemChars}
        editMode={true}
      />
    );

    const collapseBtn = screen.getByText('Collapse All');
    fireEvent.click(collapseBtn);

    expect(screen.queryByDisplayValue('Test OSCAL System')).not.toBeInTheDocument();

    const expandBtn = screen.getByText('Expand All');
    fireEvent.click(expandBtn);

    expect(screen.getByDisplayValue('Test OSCAL System')).toBeInTheDocument();
  });
});
