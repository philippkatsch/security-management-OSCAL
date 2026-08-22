import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SankeyDiagram, SankeyControl, SankeyMapEntry, RELATIONSHIP_COLORS } from '../../components/mapping/SankeyDiagram';

describe('SankeyDiagram Challenger 4 Gate Check - Empirical Verification Suite', () => {
  const mockOnSelectMap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Zoom Scaling Bounds (0.5 to 2.0)', () => {
    it('strictly enforces zoom scaling bounds between 0.5 (min) and 2.0 (max)', () => {
      render(
        <SankeyDiagram
          sourceControls={[{ id: 'AC-1' }]}
          targetControls={[{ id: 'A.5.1' }]}
          maps={[{ uuid: 'map-1', relationship: 'equal-to', sources: [{ 'id-ref': 'AC-1' }], targets: [{ 'id-ref': 'A.5.1' }] }]}
        />
      );

      const zoomInBtn = screen.getByTitle('Zoom In');
      const zoomOutBtn = screen.getByTitle('Zoom Out');
      const resetBtn = screen.getByTitle('Reset Zoom');
      const svg = screen.getByTestId('sankey-svg');

      // Initial state: 100% (scale 1.0)
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(svg.style.transform).toBe('scale(1)');

      // Lower Bound Test: Click Zoom Out 10 times
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomOutBtn);
      }

      // Should be clamped at 50% / scale(0.5)
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(svg.style.transform).toBe('scale(0.5)');
      expect(svg.style.width).toBe(`${900 * 0.5}px`); // 450px

      // Upper Bound Test: Click Zoom In 20 times
      for (let i = 0; i < 20; i++) {
        fireEvent.click(zoomInBtn);
      }

      // Should be clamped at 200% / scale(2)
      expect(screen.getByText('200%')).toBeInTheDocument();
      expect(svg.style.transform).toBe('scale(2)');
      expect(svg.style.width).toBe(`${900 * 2}px`); // 1800px

      // Reset Test
      fireEvent.click(resetBtn);
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(svg.style.transform).toBe('scale(1)');
    });
  });

  describe('2. Zoom Floating-Point Precision (scale(0.85))', () => {
    it('maintains clean floating-point precision when zooming out to scale(0.85)', () => {
      render(
        <SankeyDiagram
          sourceControls={[{ id: 'AC-1' }]}
          targetControls={[{ id: 'A.5.1' }]}
          maps={[{ uuid: 'map-1', relationship: 'equal-to', sources: [{ 'id-ref': 'AC-1' }], targets: [{ 'id-ref': 'A.5.1' }] }]}
        />
      );

      const zoomOutBtn = screen.getByTitle('Zoom Out');
      const svg = screen.getByTestId('sankey-svg');

      // 1.0 -> 0.85
      fireEvent.click(zoomOutBtn);

      // Verify display indicator shows 85%
      expect(screen.getByText('85%')).toBeInTheDocument();

      // Verify scale attribute is formatted without IEEE 754 artifacts (e.g., scale(0.85), NOT scale(0.8499999999999999))
      expect(svg.style.transform).toBe('scale(0.85)');
      expect(svg.style.width).toBe(`${900 * 0.85}px`); // 765px
    });

    it('verifies precision across all zoom step transitions', () => {
      render(
        <SankeyDiagram
          sourceControls={[{ id: 'AC-1' }]}
          targetControls={[{ id: 'A.5.1' }]}
          maps={[{ uuid: 'map-1', relationship: 'equal-to', sources: [{ 'id-ref': 'AC-1' }], targets: [{ 'id-ref': 'A.5.1' }] }]}
        />
      );

      const zoomInBtn = screen.getByTitle('Zoom In');
      const zoomOutBtn = screen.getByTitle('Zoom Out');
      const resetBtn = screen.getByTitle('Reset Zoom');
      const svg = screen.getByTestId('sankey-svg');

      // Test stepping up from 1.0 to 2.0
      const expectedInScales = ['scale(1.15)', 'scale(1.3)', 'scale(1.45)', 'scale(1.6)', 'scale(1.75)', 'scale(1.9)', 'scale(2)'];
      expectedInScales.forEach((expectedScale) => {
        fireEvent.click(zoomInBtn);
        expect(svg.style.transform).toBe(expectedScale);
      });

      // Reset
      fireEvent.click(resetBtn);

      // Test stepping down from 1.0 to 0.5
      const expectedOutScales = ['scale(0.85)', 'scale(0.7)', 'scale(0.55)', 'scale(0.5)'];
      expectedOutScales.forEach((expectedScale) => {
        fireEvent.click(zoomOutBtn);
        expect(svg.style.transform).toBe(expectedScale);
      });
    });
  });

  describe('3. Large Dataset Rendering (240 Nodes, 150 Links)', () => {
    const generateLargeDataset = () => {
      const sourceControls: SankeyControl[] = [];
      const targetControls: SankeyControl[] = [];
      const maps: SankeyMapEntry[] = [];
      const relationships = ['equal-to', 'equivalent-to', 'subset-of', 'superset-of', 'intersects-with', 'no-relationship'];

      for (let i = 1; i <= 120; i++) {
        const sId = `SRC-${String(i).padStart(3, '0')}`;
        const tId = `TGT-${String(i).padStart(3, '0')}`;
        sourceControls.push({ id: sId, title: `Source Control ${i}`, group: `Group-${Math.floor(i / 10)}` });
        targetControls.push({ id: tId, title: `Target Control ${i}`, group: `Domain-${Math.floor(i / 10)}` });
      }

      for (let m = 1; m <= 150; m++) {
        const sIdx = (m * 7) % 120 + 1;
        const tIdx = (m * 11) % 120 + 1;
        maps.push({
          uuid: `large-map-${m}`,
          relationship: relationships[m % relationships.length],
          sources: [{ 'id-ref': `SRC-${String(sIdx).padStart(3, '0')}` }],
          targets: [{ 'id-ref': `TGT-${String(tIdx).padStart(3, '0')}` }],
          props: [
            { name: 'confidence', value: `${70 + (m % 30)}` },
            { name: 'rationale', value: `Rationale for mapping ${m}` },
          ],
        });
      }

      return { sourceControls, targetControls, maps };
    };

    it('renders 120 source + 120 target nodes (240 total) and 150 links accurately under performance threshold', () => {
      const { sourceControls, targetControls, maps } = generateLargeDataset();
      expect(sourceControls).toHaveLength(120);
      expect(targetControls).toHaveLength(120);
      expect(maps).toHaveLength(150);

      const start = performance.now();
      render(
        <SankeyDiagram
          sourceControls={sourceControls}
          targetControls={targetControls}
          maps={maps}
          onSelectMap={mockOnSelectMap}
        />
      );
      const duration = performance.now() - start;

      // Verify DOM render duration < 2500ms (robust against test runner CPU contention)
      expect(duration).toBeLessThan(2500);

      // Verify header totals
      expect(screen.getByText(/Source Framework \(120\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Target Framework \(120\)/i)).toBeInTheDocument();

      // Check boundary node elements
      expect(screen.getByTestId('sankey-node-SRC-001')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-node-SRC-120')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-node-TGT-001')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-node-TGT-120')).toBeInTheDocument();

      // Check boundary link elements
      expect(screen.getByTestId(/^sankey-link-large-map-1-/)).toBeInTheDocument();
      expect(screen.getByTestId(/^sankey-link-large-map-150-/)).toBeInTheDocument();
    });
  });

  describe('4. Hover Tooltips & Link Interactions', () => {
    const sampleSources: SankeyControl[] = [{ id: 'AC-1', title: 'Access Control Policy' }];
    const sampleTargets: SankeyControl[] = [{ id: 'A.5.1', title: 'Policies for security' }];
    const sampleMaps: SankeyMapEntry[] = [
      {
        uuid: 'map-hover-test',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
        props: [
          { name: 'confidence', value: '95' },
          { name: 'rationale', value: 'Complete coverage of access control principles' },
        ],
      },
    ];

    it('displays and positions floating tooltip with full mapping metadata on link mouse enter', () => {
      render(
        <SankeyDiagram
          sourceControls={sampleSources}
          targetControls={sampleTargets}
          maps={sampleMaps}
          onSelectMap={mockOnSelectMap}
        />
      );

      const link = screen.getByTestId(/^sankey-link-map-hover-test-/);
      expect(screen.queryByTestId('sankey-tooltip')).not.toBeInTheDocument();

      // Trigger hover with mouse coordinates
      fireEvent.mouseEnter(link, { clientX: 300, clientY: 180 });

      const tooltip = screen.getByTestId('sankey-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip.textContent).toContain('AC-1 → A.5.1');
      expect(tooltip.textContent).toContain('equal-to');
      expect(tooltip.textContent).toContain('95%');
      expect(tooltip.textContent).toContain('Complete coverage of access control principles');

      // Trigger mouse leave
      fireEvent.mouseLeave(link);
      expect(screen.queryByTestId('sankey-tooltip')).not.toBeInTheDocument();
    });
  });
});
