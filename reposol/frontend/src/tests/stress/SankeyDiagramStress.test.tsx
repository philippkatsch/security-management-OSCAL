import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SankeyDiagram, RELATIONSHIP_COLORS, SankeyControl, SankeyMapEntry } from '../../components/mapping/SankeyDiagram';

describe('SankeyDiagram Empirical Stress & Performance Test Suite', () => {
  const mockOnSelectMap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Small Dataset (5 Controls)', () => {
    const smallSources: SankeyControl[] = [
      { id: 'AC-1', title: 'Access Control Policy', group: 'AC' },
      { id: 'AC-2', title: 'Account Management', group: 'AC' },
      { id: 'AC-3', title: 'Access Enforcement', group: 'AC' },
      { id: 'AC-4', title: 'Information Flow Enforcement', group: 'AC' },
      { id: 'AC-5', title: 'Separation of Duties', group: 'AC' },
    ];

    const smallTargets: SankeyControl[] = [
      { id: 'A.5.1', title: 'Policies for security', group: 'A.5' },
      { id: 'A.9.1', title: 'Access control policy', group: 'A.9' },
      { id: 'A.9.2', title: 'User access provisioning', group: 'A.9' },
      { id: 'A.9.3', title: 'Management of privileged rights', group: 'A.9' },
      { id: 'A.9.4', title: 'System access control', group: 'A.9' },
    ];

    const smallMaps: SankeyMapEntry[] = [
      {
        uuid: 'smap-1',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
        props: [{ name: 'confidence', value: '100' }],
      },
      {
        uuid: 'smap-2',
        relationship: 'equivalent-to',
        sources: [{ 'id-ref': 'AC-2' }],
        targets: [{ 'id-ref': 'A.9.2' }],
        props: [{ name: 'confidence', value: '90' }],
      },
      {
        uuid: 'smap-3',
        relationship: 'subset-of',
        sources: [{ 'id-ref': 'AC-3' }],
        targets: [{ 'id-ref': 'A.9.4' }],
      },
    ];

    it('renders all 5 source and target nodes with unmapped gaps accounted for', () => {
      render(
        <SankeyDiagram
          sourceControls={smallSources}
          targetControls={smallTargets}
          maps={smallMaps}
          onSelectMap={mockOnSelectMap}
        />
      );

      // Verify source nodes
      smallSources.forEach((c) => {
        expect(screen.getByTestId(`sankey-node-${c.id}`)).toBeInTheDocument();
      });

      // Verify target nodes
      smallTargets.forEach((c) => {
        expect(screen.getByTestId(`sankey-node-${c.id}`)).toBeInTheDocument();
      });

      // Verify mapped links
      expect(screen.getByTestId(/^sankey-link-smap-1-/)).toBeInTheDocument();
      expect(screen.getByTestId(/^sankey-link-smap-2-/)).toBeInTheDocument();
      expect(screen.getByTestId(/^sankey-link-smap-3-/)).toBeInTheDocument();
    });

    it('verifies exact Bézier curve path coordinates for small dataset', () => {
      render(
        <SankeyDiagram
          sourceControls={smallSources}
          targetControls={smallTargets}
          maps={smallMaps}
        />
      );

      const link1 = screen.getByTestId(/^sankey-link-smap-1-/);
      const d = link1.getAttribute('d');
      expect(d).toBeTruthy();

      // Expected coordinate structure: M x1 y1 C cx1 y1, cx2 y2, x2 y2
      // xSource = 40, nodeWidth = 140 => x1 = 180
      // xTarget = 900 - 40 - 140 = 720 => x2 = 720
      // cx1 = 180 + (720-180)*0.5 = 450, cx2 = 720 - (720-180)*0.5 = 450
      const bezierRegex = /^M\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+C\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?),\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?),\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/;
      const match = d!.match(bezierRegex);

      expect(match).not.toBeNull();
      if (match) {
        const [, x1, y1, cx1, cy1, cx2, cy2, x2, y2] = match.map(Number);
        expect(x1).toBe(180);
        expect(x2).toBe(720);
        expect(cx1).toBe(450);
        expect(cx2).toBe(450);
        expect(cy1).toBe(y1);
        expect(cy2).toBe(y2);
      }
    });
  });

  describe('2. Large Dataset (100+ Controls, 150 Mappings)', () => {
    const generateLargeData = () => {
      const sourceControls: SankeyControl[] = [];
      const targetControls: SankeyControl[] = [];
      const maps: SankeyMapEntry[] = [];

      const relationships = [
        'equal-to',
        'equivalent-to',
        'subset-of',
        'superset-of',
        'intersects-with',
        'no-relationship',
      ];

      for (let i = 1; i <= 120; i++) {
        const sId = `SRC-${String(i).padStart(3, '0')}`;
        sourceControls.push({
          id: sId,
          title: `Source Control ${i}`,
          group: `Group ${Math.floor(i / 10)}`,
        });

        const tId = `TGT-${String(i).padStart(3, '0')}`;
        targetControls.push({
          id: tId,
          title: `Target Control ${i}`,
          group: `Domain ${Math.floor(i / 10)}`,
        });
      }

      // Generate 150 mappings
      for (let m = 1; m <= 150; m++) {
        const srcIdx = (m * 7) % 120 + 1;
        const tgtIdx = (m * 11) % 120 + 1;
        const rel = relationships[m % relationships.length];

        maps.push({
          uuid: `large-map-${m}`,
          relationship: rel,
          sources: [{ 'id-ref': `SRC-${String(srcIdx).padStart(3, '0')}` }],
          targets: [{ 'id-ref': `TGT-${String(tgtIdx).padStart(3, '0')}` }],
          props: [
            { name: 'confidence', value: String(50 + (m % 50)) },
            { name: 'rationale', value: `Mapping rationale for item ${m}` },
          ],
        });
      }

      return { sourceControls, targetControls, maps };
    };

    it('renders 120 source + 120 target controls (240 total) and 150 links within performance threshold', () => {
      const { sourceControls, targetControls, maps } = generateLargeData();

      const startTime = performance.now();
      render(
        <SankeyDiagram
          sourceControls={sourceControls}
          targetControls={targetControls}
          maps={maps}
          onSelectMap={mockOnSelectMap}
        />
      );
      const renderTime = performance.now() - startTime;

      // Render performance in JSDOM DOM simulation should be under 2500ms (robust under CPU contention)
      expect(renderTime).toBeLessThan(2500);

      // Verify total count in column header text
      expect(screen.getByText(/Source Framework \(120\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Target Framework \(120\)/i)).toBeInTheDocument();

      // Check sample nodes
      expect(screen.getByTestId('sankey-node-SRC-001')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-node-SRC-120')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-node-TGT-001')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-node-TGT-120')).toBeInTheDocument();

      // Check sample links
      expect(screen.getByTestId(/^sankey-link-large-map-1-/)).toBeInTheDocument();
      expect(screen.getByTestId(/^sankey-link-large-map-150-/)).toBeInTheDocument();
    });

    it('dynamically computes SVG totalHeight scaling for 120 controls', () => {
      const { sourceControls, targetControls, maps } = generateLargeData();

      render(
        <SankeyDiagram
          sourceControls={sourceControls}
          targetControls={targetControls}
          maps={maps}
        />
      );

      const svg = screen.getByTestId('sankey-svg');
      const viewBox = svg.getAttribute('viewBox');
      expect(viewBox).toBeTruthy();

      const [, , width, height] = viewBox!.split(' ').map(Number);
      expect(width).toBe(900);

      // 120 mapped controls: 60 + 120 * (30 + 8) + 60 = 4680px minimum height
      expect(height).toBeGreaterThan(4000);
    });
  });

  describe('3. Zoom Controls and Scaling', () => {
    const sampleSources = [{ id: 'AC-1', title: 'AC-1' }];
    const sampleTargets = [{ id: 'A.5.1', title: 'A.5.1' }];
    const sampleMaps = [
      {
        uuid: 'zoom-map-1',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
      },
    ];

    it('updates zoom level indicator and SVG scale when zoom buttons are clicked', () => {
      render(
        <SankeyDiagram
          sourceControls={sampleSources}
          targetControls={sampleTargets}
          maps={sampleMaps}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();

      const zoomInBtn = screen.getByTitle('Zoom In');
      const zoomOutBtn = screen.getByTitle('Zoom Out');
      const resetBtn = screen.getByTitle('Reset Zoom');

      // Click Zoom In
      fireEvent.click(zoomInBtn);
      expect(screen.getByText('115%')).toBeInTheDocument();

      const svg = screen.getByTestId('sankey-svg');
      expect(svg.style.transform).toContain('scale(1.15');

      // Click Zoom Out twice
      fireEvent.click(zoomOutBtn);
      fireEvent.click(zoomOutBtn);
      // Handle floating point representation in style string
      expect(svg.style.transform).toMatch(/scale\(0\.8[45]/);


      // Click Reset
      fireEvent.click(resetBtn);
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(svg.style.transform).toBe('scale(1)');
    });
  });

  describe('4. Hover Tooltips & Interactions', () => {
    const sampleSources = [{ id: 'AC-1' }];
    const sampleTargets = [{ id: 'A.5.1' }];
    const sampleMaps: SankeyMapEntry[] = [
      {
        uuid: 'hover-map-1',
        relationship: 'superset-of',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
        props: [
          { name: 'confidence', value: '88' },
          { name: 'rationale', value: 'AC-1 covers A.5.1 plus additional features' },
        ],
      },
    ];

    it('displays detailed floating tooltip on flow link mouse enter', () => {
      render(
        <SankeyDiagram
          sourceControls={sampleSources}
          targetControls={sampleTargets}
          maps={sampleMaps}
        />
      );

      const link = screen.getByTestId(/^sankey-link-hover-map-1-/);
      fireEvent.mouseEnter(link, { clientX: 350, clientY: 250 });

      const tooltip = screen.getByTestId('sankey-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(screen.getByText('AC-1 → A.5.1')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
      expect(screen.getByText('AC-1 covers A.5.1 plus additional features')).toBeInTheDocument();

      fireEvent.mouseLeave(link);
      expect(screen.queryByTestId('sankey-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('5. Edge Cases & Resilience Stress', () => {
    it('handles empty source and target control arrays gracefully without crash', () => {
      render(<SankeyDiagram sourceControls={[]} targetControls={[]} maps={[]} />);
      expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
      expect(screen.getByText(/Source Framework \(0\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Target Framework \(0\)/i)).toBeInTheDocument();
    });

    it('handles maps with missing/dangling control references gracefully', () => {
      const invalidMaps: SankeyMapEntry[] = [
        {
          uuid: 'dangling-map',
          relationship: 'equal-to',
          sources: [{ 'id-ref': 'NON-EXISTENT-SRC' }],
          targets: [{ 'id-ref': 'NON-EXISTENT-TGT' }],
        },
      ];

      render(
        <SankeyDiagram
          sourceControls={[{ id: 'AC-1' }]}
          targetControls={[{ id: 'A.5.1' }]}
          maps={invalidMaps}
        />
      );

      // Should not throw or crash, and dangling links should not render
      expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
      expect(screen.queryByTestId(/^sankey-link-dangling-map-/)).not.toBeInTheDocument();
    });

    it('handles special characters in control IDs correctly', () => {
      const specialSources = [{ id: 'AC-1 (a) [v2.0]' }];
      const specialTargets = [{ id: 'A.5.1.1/spec' }];
      const specialMaps: SankeyMapEntry[] = [
        {
          uuid: 'spec-map-1',
          relationship: 'equal-to',
          sources: [{ 'id-ref': 'AC-1 (a) [v2.0]' }],
          targets: [{ 'id-ref': 'A.5.1.1/spec' }],
        },
      ];

      render(
        <SankeyDiagram
          sourceControls={specialSources}
          targetControls={specialTargets}
          maps={specialMaps}
        />
      );

      expect(screen.getByTestId('sankey-node-AC-1 (a) [v2.0]')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-node-A.5.1.1/spec')).toBeInTheDocument();
      expect(screen.getByTestId(/^sankey-link-spec-map-1-/)).toBeInTheDocument();
    });
  });
});
