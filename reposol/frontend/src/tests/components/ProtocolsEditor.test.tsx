import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ProtocolsEditor,
  validatePortNumber,
  validatePortRange,
  formatPortsSummary,
  PROTOCOL_PRESETS
} from '../../components/component-definition/editors/ProtocolsEditor';

describe('ProtocolsEditor Unit Tests & Validation Engine', () => {

  describe('Validation Functions', () => {
    it('validates standard valid port numbers', () => {
      expect(validatePortNumber(0)).toBeNull();
      expect(validatePortNumber(80)).toBeNull();
      expect(validatePortNumber(443)).toBeNull();
      expect(validatePortNumber(65535)).toBeNull();
    });

    it('rejects out of bounds and non-integer ports', () => {
      expect(validatePortNumber(-1)).toMatch(/between 0 and 65535/);
      expect(validatePortNumber(65536)).toMatch(/between 0 and 65535/);
      expect(validatePortNumber(70000)).toMatch(/between 0 and 65535/);
      expect(validatePortNumber(80.5)).toMatch(/whole integer/);
      expect(validatePortNumber(NaN)).toMatch(/required/);
    });

    it('validates port range ordering (start <= end)', () => {
      expect(validatePortRange(80, 80)).toBeNull();
      expect(validatePortRange(8000, 8080)).toBeNull();
      expect(validatePortRange(8080, 80)).toMatch(/cannot exceed end port/);
      expect(validatePortRange(-1, 80)).toMatch(/Start port error/);
      expect(validatePortRange(80, 70000)).toMatch(/End port error/);
    });

    it('formats port summaries accurately', () => {
      expect(formatPortsSummary([])).toBe('No ports');
      expect(formatPortsSummary([{ start: 443, end: 443, transport: 'TCP' }])).toBe('443/TCP');
      expect(
        formatPortsSummary([
          { start: 80, end: 80, transport: 'TCP' },
          { start: 8000, end: 8080, transport: 'TCP' },
          { start: 53, end: 53, transport: 'UDP' }
        ])
      ).toBe('80/TCP, 8000–8080/TCP, 53/UDP');
    });
  });

  describe('Presets Configuration', () => {
    it('contains all 12 mandatory presets', () => {
      const presetIds = PROTOCOL_PRESETS.map(p => p.id);
      expect(presetIds).toEqual([
        'https',
        'http',
        'graphql',
        'websocket',
        'postgresql',
        'mongodb',
        'mysql',
        'redis',
        'ssh',
        'dns',
        'smtp',
        'grpc'
      ]);
      expect(PROTOCOL_PRESETS.length).toBe(12);
    });

    it('defines accurate port numbers for database and web presets', () => {
      const https = PROTOCOL_PRESETS.find(p => p.id === 'https')!;
      expect(https.defaultPort).toBe(443);
      expect(https.transport).toBe('TCP');

      const mongo = PROTOCOL_PRESETS.find(p => p.id === 'mongodb')!;
      expect(mongo.defaultPort).toBe(27017);
      expect(mongo.transport).toBe('TCP');

      const postgres = PROTOCOL_PRESETS.find(p => p.id === 'postgresql')!;
      expect(postgres.defaultPort).toBe(5432);
      expect(postgres.transport).toBe('TCP');

      const dns = PROTOCOL_PRESETS.find(p => p.id === 'dns')!;
      expect(dns.defaultPort).toBe(53);
      expect(dns.transport).toBe('UDP');
    });
  });

  describe('Component Rendering & Interactions', () => {
    const sampleComponent = {
      uuid: 'comp-1',
      type: 'service',
      title: 'API Gateway Service',
      protocols: [
        {
          uuid: 'proto-1',
          name: 'https',
          title: 'Primary Ingress',
          'port-ranges': [{ start: 443, end: 443, transport: 'TCP' as const }]
        }
      ]
    };

    it('renders contextual service recommendation when type="service"', () => {
      render(<ProtocolsEditor component={sampleComponent} onChange={vi.fn()} editMode={true} />);
      expect(screen.getByText(/Service Component Recommendation/i)).toBeInTheDocument();
      expect(screen.getByText(/NIST SP 800-53 SA-4\(9\)/i)).toBeInTheDocument();
    });

    it('does not render contextual service recommendation when type="hardware"', () => {
      const hardwareComp = { ...sampleComponent, type: 'hardware' };
      render(<ProtocolsEditor component={hardwareComp} onChange={vi.fn()} editMode={true} />);
      expect(screen.queryByText(/Service Component Recommendation/i)).not.toBeInTheDocument();
    });

    it('applies quick-add preset on click', () => {
      const mockChange = vi.fn();
      render(<ProtocolsEditor component={sampleComponent} onChange={mockChange} editMode={true} />);

      const mongoBtn = screen.getByText('MONGODB');
      fireEvent.click(mongoBtn);

      expect(mockChange).toHaveBeenCalledWith(
        'protocols',
        expect.arrayContaining([
          expect.objectContaining({ name: 'https' }),
          expect.objectContaining({
            name: 'mongodb',
            title: 'MongoDB Database Daemon',
            'port-ranges': [{ start: 27017, end: 27017, transport: 'TCP' }]
          })
        ])
      );
    });

    it('expands protocol details when clicking a table row and allows updating port range', () => {
      const mockChange = vi.fn();
      render(<ProtocolsEditor component={sampleComponent} onChange={mockChange} editMode={true} />);

      const row = screen.getByText('Primary Ingress');
      fireEvent.click(row);

      expect(screen.getByText(/Editing Protocol #1: https/i)).toBeInTheDocument();

      const startInput = screen.getAllByRole('spinbutton')[0];
      fireEvent.change(startInput, { target: { value: '8443' } });

      expect(mockChange).toHaveBeenCalledWith(
        'protocols',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'https',
            'port-ranges': [{ start: 8443, end: 443, transport: 'TCP' }]
          })
        ])
      );
    });

    it('allows deleting a protocol in edit mode', () => {
      const mockChange = vi.fn();
      render(<ProtocolsEditor component={sampleComponent} onChange={mockChange} editMode={true} />);

      const row = screen.getByText('Primary Ingress');
      fireEvent.click(row);

      const deleteBtn = screen.getByText('Delete Protocol');
      fireEvent.click(deleteBtn);

      expect(mockChange).toHaveBeenCalledWith('protocols', []);
    });

    it('displays empty state when no protocols are configured', () => {
      const emptyComp = { uuid: 'comp-2', type: 'software', protocols: [] };
      render(<ProtocolsEditor component={emptyComp} onChange={vi.fn()} editMode={false} />);
      expect(screen.getByText('No protocols defined')).toBeInTheDocument();
    });
  });
});
