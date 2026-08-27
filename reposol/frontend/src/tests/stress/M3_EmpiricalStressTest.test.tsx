import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SystemCharacteristicsEditor, { calculateFipsHighWaterMark } from '../../components/ssp/SystemCharacteristicsEditor';
import DiagramUploader from '../../components/ssp/DiagramUploader';

describe('Milestone M3 Empirical Stress Tests', () => {

  describe('Edge Case Group 1: FIPS 199 High-Water Mark Calculation', () => {
    it('handles empty information types array correctly', () => {
      const result = calculateFipsHighWaterMark([]);
      expect(result).toEqual({
        confidentiality: '',
        integrity: '',
        availability: '',
        overall: ''
      });
    });

    it('safely handles null infoTypes input without throwing TypeError', () => {
      const result = calculateFipsHighWaterMark(null as any);
      expect(result).toEqual({
        confidentiality: 'fips-199-low',
        integrity: 'fips-199-low',
        availability: 'fips-199-low',
        overall: 'fips-199-low'
      });
    });

    it('handles conflicting manual impact selections and triggers conflict detection in UI', () => {
      const infoTypes = [
        {
          uuid: 'info-1',
          'confidentiality-impact': { base: 'fips-199-high' },
          'integrity-impact': { base: 'fips-199-low' },
          'availability-impact': { base: 'fips-199-moderate' }
        }
      ];

      const systemChars = {
        'system-information': { 'information-types': infoTypes },
        'security-impact-level': {
          'security-objective-confidentiality': 'fips-199-low', // Conflicting! HWM is high
          'security-objective-integrity': 'fips-199-low',
          'security-objective-availability': 'fips-199-moderate'
        }
      };

      const onUpdate = vi.fn();
      render(
        <SystemCharacteristicsEditor
          systemChars={systemChars}
          onUpdate={onUpdate}
          editMode={true}
        />
      );

      // Verify that the UI flags a conflict between HWM suggestion (HIGH) and manual selection (LOW)
      const warningElement = screen.queryByText(/discrepancy/i) || screen.queryByText(/conflict/i) || screen.queryByText(/high-water mark/i);
      expect(warningElement).not.toBeNull();
    });

    it('handles non-standard or invalid impact values in information types', () => {
      const malformedInfoTypes = [
        {
          uuid: 'info-malformed-1',
          'confidentiality-impact': { base: 'INVALID_VALUE' },
          'integrity-impact': { base: 'fips-199-high' },
          'availability-impact': {} // Missing base and selected
        },
        {
          uuid: 'info-malformed-2',
          'confidentiality-impact': null,
          'integrity-impact': 'fips-199-moderate', // String instead of object
          'availability-impact': { selected: 'fips-199-low' }
        }
      ];

      // Should not throw an exception even with invalid/malformed impact structures
      let hwmResult;
      expect(() => {
        hwmResult = calculateFipsHighWaterMark(malformedInfoTypes);
      }).not.toThrow();

      expect(hwmResult).toBeDefined();
      expect(hwmResult?.integrity).toBe('fips-199-high');
    });

    it('safely handles non-string impact values without throwing TypeError', () => {
      const nonStringInfoTypes = [
        {
          uuid: 'info-num',
          'confidentiality-impact': { base: 123 as any }
        }
      ];

      expect(() => {
        calculateFipsHighWaterMark(nonStringInfoTypes);
      }).not.toThrow();

      const result = calculateFipsHighWaterMark(nonStringInfoTypes);
      expect(result).toBeDefined();
    });
  });

  describe('Edge Case Group 3: Diagram Persistence in Back-Matter with Large Base64 Strings', () => {
    it('handles diagram addition, rendering, and removal with 1MB+ Base64 image payload', () => {
      // Create a 1MB mock Base64 image string
      const mockBase64Payload = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024);
      const resourceUuid = 'res-large-1';
      const diagramUuid = 'diag-large-1';

      const backMatter = {
        resources: [
          {
            uuid: resourceUuid,
            title: 'Large Architecture Diagram.png',
            rlinks: [{ href: mockBase64Payload }]
          }
        ]
      };

      const diagrams = [
        {
          uuid: diagramUuid,
          description: 'Diagram for Architecture Boundary',
          links: [{ rel: 'diagram', href: `#${resourceUuid}` }]
        }
      ];

      const onDiagramsChange = vi.fn();
      const onBackMatterChange = vi.fn();

      render(
        <DiagramUploader
          diagrams={diagrams}
          onDiagramsChange={onDiagramsChange}
          backMatter={backMatter}
          onBackMatterChange={onBackMatterChange}
          label="Architecture Boundary"
          editMode={true}
        />
      );

      // Verify that the image element renders with the large base64 source
      const img = screen.getByRole('img');
      expect(img).toBeDefined();
      expect(img.getAttribute('src')).toEqual(mockBase64Payload);

      // Test diagram removal
      const removeBtn = screen.getByText('Remove Diagram');
      fireEvent.click(removeBtn);

      expect(onDiagramsChange).toHaveBeenCalledWith([]);
      expect(onBackMatterChange).toHaveBeenCalledWith({ resources: [] });
    });
  });
});
