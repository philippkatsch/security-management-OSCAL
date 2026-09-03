import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PropertyPalette, { OSCAL_NS, STANDARD_PROP_NAMES, STANDARD_ASSET_TYPES } from '../../components/component-definition/editors/PropertyPalette';
import { DefinedComponent } from '../../lib/types/oscal';

describe('PropertyPalette Component Unit Tests', () => {
  const baseComponent: DefinedComponent = {
    uuid: 'comp-test-001',
    type: 'software',
    title: 'MongoDB Database',
    description: 'Document database',
    props: [
      { name: 'version', value: '7.0.5', ns: OSCAL_NS },
      { name: 'implementation-point', value: 'internal', ns: OSCAL_NS },
      { name: 'asset-type', value: 'database', ns: OSCAL_NS },
      { name: 'release-date', value: '2026-06-15', ns: OSCAL_NS }
    ]
  };

  it('renders standard properties from props array correctly', () => {
    render(<PropertyPalette component={baseComponent} onChange={vi.fn()} editMode={true} />);

    expect(screen.getByDisplayValue('7.0.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-06-15')).toBeInTheDocument();
    expect(screen.getByDisplayValue('database')).toBeInTheDocument();
  });

  it('updates boolean toggle switches and automatically sets oscal namespace', () => {
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={baseComponent} onChange={mockOnChange} editMode={true} />);

    // Click Virtual toggle 'Yes'
    const virtualYesBtn = screen.getByRole('button', { name: /☁️ Yes/i });
    fireEvent.click(virtualYesBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'virtual', value: 'yes', ns: OSCAL_NS })
      ])
    );
  });

  it('toggles implementation-point between internal and external and clears when toggled off', () => {
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={baseComponent} onChange={mockOnChange} editMode={true} />);

    // Click Internal toggle again to clear
    const internalBtn = screen.getByRole('button', { name: /🏢 Internal/i });
    fireEvent.click(internalBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const updatedProps = mockOnChange.mock.calls[0][0];
    expect(updatedProps.find((p: any) => p.name === 'implementation-point')).toBeUndefined();
  });

  it('updates public and allows-authenticated-scan toggles', () => {
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={baseComponent} onChange={mockOnChange} editMode={true} />);

    const publicBtn = screen.getByRole('button', { name: /🌍 Public/i });
    fireEvent.click(publicBtn);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'public', value: 'yes', ns: OSCAL_NS })
      ])
    );

    const scanBtn = screen.getByRole('button', { name: /🔍 Yes/i });
    fireEvent.click(scanBtn);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'allows-authenticated-scan', value: 'yes', ns: OSCAL_NS })
      ])
    );
  });

  it('validates release-date format and handles date changes', () => {
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={baseComponent} onChange={mockOnChange} editMode={true} />);

    const dateInput = screen.getByDisplayValue('2026-06-15');
    fireEvent.change(dateInput, { target: { value: '2026-08-31' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'release-date', value: '2026-08-31', ns: OSCAL_NS })
      ])
    );
  });

  it('handles asset-type select and custom asset type entry', () => {
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={baseComponent} onChange={mockOnChange} editMode={true} />);

    const select = screen.getByDisplayValue('database');
    fireEvent.change(select, { target: { value: 'web-server' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'asset-type', value: 'web-server', ns: OSCAL_NS })
      ])
    );

    // Select custom asset type
    fireEvent.change(select, { target: { value: '__custom__' } });
    const customInput = screen.getByPlaceholderText(/Enter custom asset type/i);
    expect(customInput).toBeInTheDocument();

    fireEvent.change(customInput, { target: { value: 'cloud-service' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'asset-type', value: 'cloud-service', ns: OSCAL_NS })
      ])
    );
  });

  it('renders software-specific properties when type === "software"', () => {
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={baseComponent} onChange={mockOnChange} editMode={true} />);

    expect(screen.getByText('Software Specifications')).toBeInTheDocument();
    const swidInput = screen.getByPlaceholderText(/pkg:deb\/debian\/mongodb/i);
    expect(swidInput).toBeInTheDocument();

    fireEvent.change(swidInput, { target: { value: 'cpe:2.3:a:mongodb:mongodb:7.0.5' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'software-identifier', value: 'cpe:2.3:a:mongodb:mongodb:7.0.5', ns: OSCAL_NS })
      ])
    );
  });

  it('hides software properties when component type is not software', () => {
    const hardwareComp: DefinedComponent = {
      ...baseComponent,
      type: 'hardware'
    };
    render(<PropertyPalette component={hardwareComp} onChange={vi.fn()} editMode={true} />);

    expect(screen.queryByText('Software Specifications')).not.toBeInTheDocument();
  });

  it('renders validation properties when type === "validation"', () => {
    const validationComp: DefinedComponent = {
      ...baseComponent,
      type: 'validation',
      props: [
        { name: 'validation-type', value: 'FIPS-140-3', ns: OSCAL_NS },
        { name: 'validation-reference', value: 'Cert #4123', ns: OSCAL_NS }
      ]
    };
    render(<PropertyPalette component={validationComp} onChange={vi.fn()} editMode={true} />);

    expect(screen.getByText('Validation & Certification')).toBeInTheDocument();
    expect(screen.getByDisplayValue('FIPS-140-3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cert #4123')).toBeInTheDocument();
  });

  it('updates OS and network properties correctly', () => {
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={baseComponent} onChange={mockOnChange} editMode={true} />);

    const osNameInput = screen.getByPlaceholderText(/Ubuntu Linux, Windows Server/i);
    fireEvent.change(osNameInput, { target: { value: 'Ubuntu Linux' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'os-name', value: 'Ubuntu Linux', ns: OSCAL_NS })
      ])
    );

    const ipv4Input = screen.getByPlaceholderText(/192.168.1.100/i);
    fireEvent.change(ipv4Input, { target: { value: '10.0.0.1' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'ipv4-address', value: '10.0.0.1', ns: OSCAL_NS })
      ])
    );
  });

  it('displays deprecation warning and migrates hardware-model to model', () => {
    const compWithDeprecated: DefinedComponent = {
      ...baseComponent,
      props: [
        { name: 'hardware-model', value: 'PowerEdge R740', ns: OSCAL_NS }
      ]
    };
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={compWithDeprecated} onChange={mockOnChange} editMode={true} />);

    expect(screen.getByText(/Deprecation Notice:/i)).toBeInTheDocument();
    expect(screen.getByText(/hardware-model/i)).toBeInTheDocument();

    const migrateBtn = screen.getByRole('button', { name: /Migrate to 'model'/i });
    fireEvent.click(migrateBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'model', value: 'PowerEdge R740', ns: OSCAL_NS })
      ])
    );
    const updatedProps = mockOnChange.mock.calls[0][0];
    expect(updatedProps.find((p: any) => p.name === 'hardware-model')).toBeUndefined();
  });

  it('renders clean read-only representation when editMode is false', () => {
    render(<PropertyPalette component={baseComponent} onChange={vi.fn()} editMode={false} />);

    expect(screen.getByText('🏢 Internal')).toBeInTheDocument();
    expect(screen.getByText('7.0.5')).toBeInTheDocument();
    expect(screen.getByText('2026-06-15')).toBeInTheDocument();
  });

  it('preserves custom properties when updating standard properties', () => {
    const compWithCustom: DefinedComponent = {
      ...baseComponent,
      props: [
        { name: 'version', value: '7.0.5', ns: OSCAL_NS },
        { name: 'custom-property', value: 'custom-val' }
      ]
    };
    const mockOnChange = vi.fn();
    render(<PropertyPalette component={compWithCustom} onChange={mockOnChange} editMode={true} />);

    const versionInput = screen.getByDisplayValue('7.0.5');
    fireEvent.change(versionInput, { target: { value: '8.0.0' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'version', value: '8.0.0' }),
        expect.objectContaining({ name: 'custom-property', value: 'custom-val' })
      ])
    );
  });
});
