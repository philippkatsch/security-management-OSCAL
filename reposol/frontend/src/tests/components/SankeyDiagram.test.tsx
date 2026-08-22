import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SankeyDiagram, RELATIONSHIP_COLORS } from '../../components/mapping/SankeyDiagram';

describe('SankeyDiagram Component', () => {
  const sampleSourceControls = [
    { id: 'AC-1', title: 'Access Control Policy', group: 'AC' },
    { id: 'AC-2', title: 'Account Management', group: 'AC' },
    { id: 'AC-3', title: 'Access Enforcement', group: 'AC' },
    { id: 'PE-1', title: 'Physical Access Policy', group: 'PE' }, // Unmapped gap
  ];

  const sampleTargetControls = [
    { id: 'A.5.1', title: 'Policies for Information Security', group: 'A.5' },
    { id: 'A.9.2', title: 'User Access Provisioning', group: 'A.9' },
    { id: 'A.9.4', title: 'System Access Control', group: 'A.9' },
    { id: 'A.18.1', title: 'Compliance with Legal Requirements', group: 'A.18' }, // Unmapped gap
  ];

  const sampleMaps = [
    {
      uuid: 'map-uuid-1',
      relationship: 'equal-to',
      sources: [{ 'id-ref': 'AC-1' }],
      targets: [{ 'id-ref': 'A.5.1' }],
      props: [
        { name: 'confidence', value: '95' },
        { name: 'rationale', value: 'Identical policy requirement scope' }
      ],
      remarks: 'Direct mapping'
    },
    {
      uuid: 'map-uuid-2',
      relationship: 'equivalent-to',
      sources: [{ 'id-ref': 'AC-2' }],
      targets: [{ 'id-ref': 'A.9.2' }],
      props: [
        { name: 'confidence', value: '90' },
        { name: 'rationale', value: 'Equivalent account lifecycle management' }
      ]
    },
    {
      uuid: 'map-uuid-3',
      relationship: 'subset-of',
      sources: [{ 'id-ref': 'AC-3' }],
      targets: [{ 'id-ref': 'A.9.4' }],
      props: [
        { name: 'confidence', value: '80' }
      ]
    }
  ];

  const mockOnSelectMap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders SVG diagram with column headers and control nodes', () => {
    render(
      <SankeyDiagram
        sourceControls={sampleSourceControls}
        targetControls={sampleTargetControls}
        maps={sampleMaps}
        onSelectMap={mockOnSelectMap}
        sourceTitle="NIST 800-53"
        targetTitle="ISO 27001"
      />
    );

    expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-svg')).toBeInTheDocument();

    expect(screen.getByText(/NIST 800-53 \(4\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ISO 27001 \(4\)/i)).toBeInTheDocument();

    // Check source nodes
    expect(screen.getByTestId('sankey-node-AC-1')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-AC-2')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-AC-3')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-PE-1')).toBeInTheDocument();

    // Check target nodes
    expect(screen.getByTestId('sankey-node-A.5.1')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.9.2')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.9.4')).toBeInTheDocument();
    expect(screen.getByTestId('sankey-node-A.18.1')).toBeInTheDocument();
  });

  it('renders Bézier flow links with correct relationship color coding', () => {
    render(
      <SankeyDiagram
        sourceControls={sampleSourceControls}
        targetControls={sampleTargetControls}
        maps={sampleMaps}
        onSelectMap={mockOnSelectMap}
      />
    );

    const link1 = screen.getByTestId(/^sankey-link-map-uuid-1/);
    const link2 = screen.getByTestId(/^sankey-link-map-uuid-2/);
    const link3 = screen.getByTestId(/^sankey-link-map-uuid-3/);

    expect(link1).toBeInTheDocument();
    expect(link2).toBeInTheDocument();
    expect(link3).toBeInTheDocument();

    expect(link1.getAttribute('stroke')).toBe(RELATIONSHIP_COLORS['equal-to']);
    expect(link2.getAttribute('stroke')).toBe(RELATIONSHIP_COLORS['equivalent-to']);
    expect(link3.getAttribute('stroke')).toBe(RELATIONSHIP_COLORS['subset-of']);
  });

  it('visually represents unmapped control gaps as gap nodes', () => {
    render(
      <SankeyDiagram
        sourceControls={sampleSourceControls}
        targetControls={sampleTargetControls}
        maps={sampleMaps}
        onSelectMap={mockOnSelectMap}
      />
    );

    const pe1Node = screen.getByTestId('sankey-node-PE-1');
    const a181Node = screen.getByTestId('sankey-node-A.18.1');

    expect(pe1Node.textContent).toContain('Unmapped');
    expect(a181Node.textContent).toContain('Unmapped');
  });

  it('triggers onSelectMap callback when a flow link is clicked', () => {
    render(
      <SankeyDiagram
        sourceControls={sampleSourceControls}
        targetControls={sampleTargetControls}
        maps={sampleMaps}
        onSelectMap={mockOnSelectMap}
      />
    );

    const link1 = screen.getByTestId(/^sankey-link-map-uuid-1/);
    fireEvent.click(link1);

    expect(mockOnSelectMap).toHaveBeenCalledTimes(1);
    expect(mockOnSelectMap).toHaveBeenCalledWith(sampleMaps[0]);
  });

  it('displays tooltip on link hover with confidence and rationale details', () => {
    render(
      <SankeyDiagram
        sourceControls={sampleSourceControls}
        targetControls={sampleTargetControls}
        maps={sampleMaps}
        onSelectMap={mockOnSelectMap}
      />
    );

    const link1 = screen.getByTestId(/^sankey-link-map-uuid-1/);
    fireEvent.mouseEnter(link1, { clientX: 300, clientY: 200 });

    const tooltip = screen.getByTestId('sankey-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toContain('AC-1 → A.5.1');
    expect(tooltip.textContent).toContain('equal-to');
    expect(tooltip.textContent).toContain('95%');
    expect(tooltip.textContent).toContain('Identical policy requirement scope');

    fireEvent.mouseLeave(link1);
    expect(screen.queryByTestId('sankey-tooltip')).not.toBeInTheDocument();
  });

  it('filters relationship links when relationship select changes', () => {
    render(
      <SankeyDiagram
        sourceControls={sampleSourceControls}
        targetControls={sampleTargetControls}
        maps={sampleMaps}
        onSelectMap={mockOnSelectMap}
      />
    );

    const select = screen.getByLabelText(/filter relationship type/i);
    fireEvent.change(select, { target: { value: 'equal-to' } });

    expect(screen.getByTestId(/^sankey-link-map-uuid-1/)).toBeInTheDocument();
    expect(screen.queryByTestId(/^sankey-link-map-uuid-2/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^sankey-link-map-uuid-3/)).not.toBeInTheDocument();
  });

  it('filters nodes and links based on search query', () => {
    render(
      <SankeyDiagram
        sourceControls={sampleSourceControls}
        targetControls={sampleTargetControls}
        maps={sampleMaps}
        onSelectMap={mockOnSelectMap}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search controls/i);
    fireEvent.change(searchInput, { target: { value: 'A.9.2' } });

    expect(screen.queryByTestId(/^sankey-link-map-uuid-1/)).not.toBeInTheDocument();
    expect(screen.getByTestId(/^sankey-link-map-uuid-2/)).toBeInTheDocument();
    expect(screen.queryByTestId(/^sankey-link-map-uuid-3/)).not.toBeInTheDocument();
  });
});
