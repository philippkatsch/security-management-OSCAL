import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SankeyDiagram, RELATIONSHIP_COLORS } from '../../components/mapping/SankeyDiagram';

describe('SankeyDiagram Empirical Edge Cases & Robustness Test Suite', () => {
  const mockOnSelectMap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Edge Case 1: Empty mapping arrays & controls
  it('renders gracefully with completely empty sourceControls, targetControls, and maps', () => {
    render(
      <SankeyDiagram
        sourceControls={[]}
        targetControls={[]}
        maps={[]}
        onSelectMap={mockOnSelectMap}
      />
    );

    expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-svg')).toBeInTheDocument();
    expect(screen.getByText(/Source Framework \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Target Framework \(0\)/i)).toBeInTheDocument();
  });

  // Edge Case 2: Missing controls (maps referencing non-existent control IDs)
  it('handles missing control definitions in sourceControls or targetControls without crashing', () => {
    const sourceControls = [{ id: 'AC-1', title: 'Access Control' }];
    const targetControls = [{ id: 'A.5.1', title: 'Security Policies' }];
    const maps = [
      {
        uuid: 'map-missing-src',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'MISSING-SRC-99' }],
        targets: [{ 'id-ref': 'A.5.1' }],
      },
      {
        uuid: 'map-missing-tgt',
        relationship: 'subset-of',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'MISSING-TGT-99' }],
      },
      {
        uuid: 'map-valid',
        relationship: 'equivalent-to',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
      },
    ];

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
    // Only map-valid link should be rendered
    expect(screen.queryByTestId(/^sankey-link-map-missing-src/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^sankey-link-map-missing-tgt/)).not.toBeInTheDocument();
    expect(screen.getByTestId(/^sankey-link-map-valid/)).toBeInTheDocument();
  });

  // Edge Case 3: 1:N Mappings (1 source to multiple targets)
  it('correctly renders 1:N mappings (one source control connected to N target controls)', () => {
    const sourceControls = [{ id: 'AC-1', title: 'Access Control' }];
    const targetControls = [
      { id: 'A.5.1', title: 'Policy' },
      { id: 'A.9.1', title: 'Access Control Policy' },
      { id: 'A.9.2', title: 'User Registration' },
    ];
    const maps = [
      {
        uuid: 'map-1-to-N',
        relationship: 'intersects-with',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }, { 'id-ref': 'A.9.1' }, { 'id-ref': 'A.9.2' }],
      },
    ];

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    const links = screen.getAllByTestId(/^sankey-link-map-1-to-N/);
    expect(links).toHaveLength(3);
    expect(screen.getByTestId('sankey-node-AC-1')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.5.1')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.9.1')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.9.2')).toBeInTheDocument();
  });

  // Edge Case 4: N:1 Mappings (multiple sources to 1 target)
  it('correctly renders N:1 mappings (multiple source controls connected to one target control)', () => {
    const sourceControls = [
      { id: 'AC-1', title: 'Policy' },
      { id: 'AC-2', title: 'Account Mgmt' },
      { id: 'AC-3', title: 'Access Enforcement' },
    ];
    const targetControls = [{ id: 'A.9.4', title: 'System Access' }];
    const maps = [
      {
        uuid: 'map-N-to-1',
        relationship: 'superset-of',
        sources: [{ 'id-ref': 'AC-1' }, { 'id-ref': 'AC-2' }, { 'id-ref': 'AC-3' }],
        targets: [{ 'id-ref': 'A.9.4' }],
      },
    ];

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    const links = screen.getAllByTestId(/^sankey-link-map-N-to-1/);
    expect(links).toHaveLength(3);
    expect(screen.getByTestId('sankey-node-AC-1')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-AC-2')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-AC-3')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.9.4')).toBeInTheDocument();
  });

  // Edge Case 5: N:M Mappings (multiple sources to multiple targets)
  it('correctly renders N:M mappings (multiple sources connected to multiple targets in one map entry)', () => {
    const sourceControls = [
      { id: 'IA-1', title: 'IA Policy' },
      { id: 'IA-2', title: 'Authentication' },
    ];
    const targetControls = [
      { id: 'A.9.3', title: 'Password Mgmt' },
      { id: 'A.9.4', title: 'Secret Auth' },
    ];
    const maps = [
      {
        uuid: 'map-N-to-M',
        relationship: 'equivalent-to',
        sources: [{ 'id-ref': 'IA-1' }, { 'id-ref': 'IA-2' }],
        targets: [{ 'id-ref': 'A.9.3' }, { 'id-ref': 'A.9.4' }],
      },
    ];

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    const links = screen.getAllByTestId(/^sankey-link-map-N-to-M/);
    expect(links).toHaveLength(4); // 2 sources x 2 targets = 4 links
  });

  // Edge Case 6: All 6 Relationship Types Verification
  it('renders links and legend items for all 6 relationship types with correct colors', () => {
    const allRelationships = [
      'equal-to',
      'equivalent-to',
      'subset-of',
      'superset-of',
      'intersects-with',
      'no-relationship',
    ];

    const sourceControls = allRelationships.map((r, i) => ({ id: `SRC-${i}` }));
    const targetControls = allRelationships.map((r, i) => ({ id: `TGT-${i}` }));
    const maps = allRelationships.map((r, i) => ({
      uuid: `map-rel-${r}`,
      relationship: r,
      sources: [{ 'id-ref': `SRC-${i}` }],
      targets: [{ 'id-ref': `TGT-${i}` }],
    }));

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    allRelationships.forEach((rel) => {
      const link = screen.getByTestId(new RegExp(`^sankey-link-map-rel-${rel}`));
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('stroke')).toBe(RELATIONSHIP_COLORS[rel]);
    });
  });

  // Edge Case 7: Unmapped controls and gap node toggle
  it('toggles visibility of unmapped control gap nodes when checkbox is clicked', () => {
    const sourceControls = [
      { id: 'AC-1', title: 'Mapped Src' },
      { id: 'PE-1', title: 'Unmapped Src Gap' },
    ];
    const targetControls = [
      { id: 'A.5.1', title: 'Mapped Tgt' },
      { id: 'A.18.1', title: 'Unmapped Tgt Gap' },
    ];
    const maps = [
      {
        uuid: 'map-1',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
      },
    ];

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    // Initial state: showGaps defaults to true
    expect(screen.getByTestId('sankey-node-PE-1')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.18.1')).toBeInTheDocument();

    // Toggle gap checkbox to uncheck
    const toggle = screen.getByLabelText(/show gap nodes/i);
    fireEvent.click(toggle);

    // Unmapped nodes should be hidden
    expect(screen.queryByTestId('sankey-node-PE-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sankey-node-A.18.1')).not.toBeInTheDocument();
  });

  // Edge Case 8: Search Filter Matching (Source ID, Target ID, Relationship, Remarks)
  it('filters diagram elements correctly based on search query matching source, target, relationship, or remarks', () => {
    const sourceControls = [
      { id: 'AC-1' },
      { id: 'SI-2' },
    ];
    const targetControls = [
      { id: 'A.5.1' },
      { id: 'A.12.6' },
    ];
    const maps = [
      {
        uuid: 'map-search-src',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
        remarks: 'Custom note',
      },
      {
        uuid: 'map-search-tgt',
        relationship: 'subset-of',
        sources: [{ 'id-ref': 'SI-2' }],
        targets: [{ 'id-ref': 'A.12.6' }],
        remarks: 'Flaw remediation',
      },
    ];

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search controls/i);

    // Search by remarks 'flaw'
    fireEvent.change(searchInput, { target: { value: 'flaw' } });
    expect(screen.queryByTestId(/^sankey-link-map-search-src/)).not.toBeInTheDocument();
    expect(screen.getByTestId(/^sankey-link-map-search-tgt/)).toBeInTheDocument();

    // Search by non-existent term
    fireEvent.change(searchInput, { target: { value: 'nonexistent-query-123' } });
    expect(screen.queryByTestId(/^sankey-link-map-search-src/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^sankey-link-map-search-tgt/)).not.toBeInTheDocument();
  });

  // Edge Case 9: Relationship Dropdown Filtering
  it('filters diagram elements based on relationship dropdown select', () => {
    const sourceControls = [{ id: 'AC-1' }, { id: 'AC-2' }];
    const targetControls = [{ id: 'A.5.1' }, { id: 'A.9.2' }];
    const maps = [
      {
        uuid: 'map-eq',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'AC-1' }],
        targets: [{ 'id-ref': 'A.5.1' }],
      },
      {
        uuid: 'map-sub',
        relationship: 'subset-of',
        sources: [{ 'id-ref': 'AC-2' }],
        targets: [{ 'id-ref': 'A.9.2' }],
      },
    ];

    render(
      <SankeyDiagram
        sourceControls={sourceControls}
        targetControls={targetControls}
        maps={maps}
      />
    );

    const select = screen.getByLabelText(/filter relationship type/i);

    fireEvent.change(select, { target: { value: 'subset-of' } });
    expect(screen.queryByTestId(/^sankey-link-map-eq/)).not.toBeInTheDocument();
    expect(screen.getByTestId(/^sankey-link-map-sub/)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'all' } });
    expect(screen.getByTestId(/^sankey-link-map-eq/)).toBeInTheDocument();
    expect(screen.getByTestId(/^sankey-link-map-sub/)).toBeInTheDocument();
  });

  // Edge Case 10: Zoom Control Scaling & Bounds
  it('scales zoom level accurately and enforces minimum and maximum zoom bounds', () => {
    render(
      <SankeyDiagram
        sourceControls={[{ id: 'AC-1' }]}
        targetControls={[{ id: 'A.5.1' }]}
        maps={[{ uuid: 'm1', relationship: 'equal-to', sources: [{ 'id-ref': 'AC-1' }], targets: [{ 'id-ref': 'A.5.1' }] }]}
      />
    );

    const zoomInBtn = screen.getByTitle('Zoom In');
    const zoomOutBtn = screen.getByTitle('Zoom Out');
    const resetBtn = screen.getByTitle('Reset Zoom');
    const zoomText = screen.getByText('100%');

    expect(zoomText).toBeInTheDocument();

    // Zoom In once: 100% -> 115%
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('115%')).toBeInTheDocument();

    // Zoom Out twice: 115% -> 100% -> 85%
    fireEvent.click(zoomOutBtn);
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('85%')).toBeInTheDocument();

    // Reset Zoom
    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Test Zoom In upper bound (max 200%)
    for (let i = 0; i < 15; i++) {
      fireEvent.click(zoomInBtn);
    }
    expect(screen.getByText('200%')).toBeInTheDocument();

    // Test Zoom Out lower bound (min 50%)
    for (let i = 0; i < 20; i++) {
      fireEvent.click(zoomOutBtn);
    }
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
