import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { EnhancementsAccordion } from '../components/shared/EnhancementsAccordion';
import { ControlDetailView } from '../components/shared/ControlDetailView';

describe('Requirement R1 — Enhancements Accordion Integration', () => {
  const sampleEnhancements = [
    { id: 'ac-2.1', title: 'Automated Account Management', parts: [{ id: 'ac-2.1_smt', name: 'statement', prose: 'System manages accounts automatically.' }] },
    { id: 'ac-2.2', title: 'Removal of Temporary Accounts', parts: [{ id: 'ac-2.2_smt', name: 'statement', prose: 'Temporary accounts are removed.' }] }
  ];

  it('renders accordion header and collapses/expands main accordion', () => {
    render(
      <EnhancementsAccordion
        enhancements={sampleEnhancements}
        showNavArrow={true}
      />
    );

    expect(screen.getByText('Control Enhancements (Sub-controls)')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Body is collapsed by default
    expect(screen.queryByText('ac-2.1')).not.toBeInTheDocument();

    // Click header to open body
    fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));
    expect(screen.getByText('ac-2.1')).toBeInTheDocument();
    expect(screen.getByText('ac-2.2')).toBeInTheDocument();
  });

  it('invokes onSelectEnhancement in Catalog mode (showNavArrow=true)', () => {
    const onSelect = vi.fn();
    render(
      <EnhancementsAccordion
        enhancements={sampleEnhancements}
        showNavArrow={true}
        onSelectEnhancement={onSelect}
      />
    );

    // Expand body
    fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));

    // Click item row
    fireEvent.click(screen.getByText('Automated Account Management'));
    expect(onSelect).toHaveBeenCalledWith('ac-2.1');
  });

  it('toggles inline expansion in Profile mode when clicking row and renders custom content', () => {
    const renderContent = vi.fn((e) => (
      <div data-testid={`content-${e.id}`}>Custom content for {e.id}</div>
    ));

    render(
      <EnhancementsAccordion
        enhancements={sampleEnhancements}
        showNavArrow={false}
        renderEnhancementContent={renderContent}
      />
    );

    // Expand body
    fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));

    // Inline content is not yet visible
    expect(screen.queryByTestId('content-ac-2.1')).not.toBeInTheDocument();

    // Click item row in profile mode -> toggles inline expansion
    fireEvent.click(screen.getByText('Automated Account Management'));
    expect(renderContent).toHaveBeenCalledWith(sampleEnhancements[0], 0);
    expect(screen.getByTestId('content-ac-2.1')).toBeInTheDocument();

    // Click again -> collapses
    fireEvent.click(screen.getByText('Automated Account Management'));
    expect(screen.queryByTestId('content-ac-2.1')).not.toBeInTheDocument();
  });

  it('correctly passes renderEnhancementContent and supports sub-control alters in ControlDetailView profile mode', () => {
    const mockProfile = {
      id: 'prof-1',
      modify: {
        alters: []
      }
    };
    const onProfileChange = vi.fn();

    const parentControl = {
      id: 'ac-2',
      title: 'Account Management',
      controls: sampleEnhancements
    };

    const originalControl = {
      id: 'ac-2',
      title: 'Account Management',
      controls: sampleEnhancements
    };

    render(
      <ControlDetailView
        control={parentControl}
        originalControl={originalControl}
        catalog={{ id: 'cat-1' }}
        mode="profile"
        isEditing={true}
        profile={mockProfile}
        onProfileChange={onProfileChange}
      />
    );

    // Expand Enhancements accordion header
    fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));
    expect(screen.getByText('ac-2.1')).toBeInTheDocument();

    // Expand inline enhancement ac-2.1
    fireEvent.click(screen.getByText('Automated Account Management'));

    // Check that enhancement statement prose textarea is rendered
    const textareas = screen.getAllByPlaceholderText(/prose text/i);
    expect(textareas.length).toBeGreaterThan(0);
  });
});
