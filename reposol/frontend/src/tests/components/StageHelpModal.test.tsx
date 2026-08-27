import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { StageHelpModal } from '@components/shared/ui/StageHelpModal';
import { OSCAL_STAGE_GUIDES, STAGE_IDS } from '@components/knowledge-base/data/kbStageData';

describe('StageHelpModal - In-Page Contextual Documentation Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <StageHelpModal isOpen={false} stage="catalogs" onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders complete contextual guide for Catalogs (Step 1)', () => {
    const handleClose = vi.fn();
    render(<StageHelpModal isOpen={true} stage="catalogs" onClose={handleClose} />);

    const modal = screen.getByTestId('stage-help-modal');
    expect(modal).toBeInTheDocument();

    // Header metadata
    expect(within(modal).getByText('Step 1: Security Control Catalogs')).toBeInTheDocument();
    expect(within(modal).getByText('Step 1 in Lifecycle')).toBeInTheDocument();
    expect(within(modal).getByText('Design & Baseline')).toBeInTheDocument();

    // Section 1: Foundational Purpose
    expect(within(modal).getByText('Why does this Stage exist?')).toBeInTheDocument();
    expect(within(modal).getByText('👥 Who creates it?')).toBeInTheDocument();
    expect(within(modal).getByText('🔄 Downstream Reuse')).toBeInTheDocument();
    expect(within(modal).getByText('Standard Real-World Examples:')).toBeInTheDocument();
    expect(within(modal).getByText(/NIST SP 800-53 Rev. 5/i)).toBeInTheDocument();

    // Section 2: Workflow & Sequence
    expect(within(modal).getByText('Lifecycle Workflow & Sequence')).toBeInTheDocument();
    expect(within(modal).getByText('Where to start?')).toBeInTheDocument();
    expect(within(modal).getByText('Prerequisites')).toBeInTheDocument();
    expect(within(modal).getByText('What you produce')).toBeInTheDocument();

    // Section 3: Key Steps & Activities
    expect(within(modal).getByText('Key Activities & Steps in this Stage')).toBeInTheDocument();
    expect(within(modal).getByText('Structure & Categorization')).toBeInTheDocument();
    expect(within(modal).getByText('Control Authoring & Guidance')).toBeInTheDocument();

    // Section 4: Reposol Capabilities
    expect(within(modal).getByText('What can you do in Reposol?')).toBeInTheDocument();
    expect(within(modal).getByText('Pre-Loaded Standard Catalogs')).toBeInTheDocument();
  });

  it('renders complete contextual guide for Profiles (Step 2)', () => {
    render(<StageHelpModal isOpen={true} stage="profiles" onClose={vi.fn()} />);

    expect(screen.getByText('Step 2: Profile Tailoring & Baselines')).toBeInTheDocument();
    expect(screen.getByText('Import & Filter (Select Controls)')).toBeInTheDocument();
    expect(screen.getByText('Merge & Structure (Organize Hierarchy)')).toBeInTheDocument();
    expect(screen.getByText('Modify & Customize (Tailor Requirements)')).toBeInTheDocument();
    expect(screen.getByText('Non-Destructive Overlays')).toBeInTheDocument();
  });

  it('renders all 8 stages correctly with their respective content', () => {
    STAGE_IDS.forEach((stageId) => {
      const guide = OSCAL_STAGE_GUIDES.find((g) => g.id === stageId)!;
      const { unmount } = render(
        <StageHelpModal isOpen={true} stage={stageId} onClose={vi.fn()} />
      );

      expect(screen.getByText(guide.title)).toBeInTheDocument();
      expect(screen.getByText(guide.badgeLabel)).toBeInTheDocument();
      expect(screen.getByText(guide.whyItExists.overview)).toBeInTheDocument();
      expect(screen.getByText(guide.workflowSequence.startHereAdvice)).toBeInTheDocument();

      unmount();
    });
  });

  it('calls onClose when close button ✕ is clicked', () => {
    const handleClose = vi.fn();
    render(<StageHelpModal isOpen={true} stage="catalogs" onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close guide modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when "Got it, close guide" button is clicked', () => {
    const handleClose = vi.fn();
    render(<StageHelpModal isOpen={true} stage="catalogs" onClose={handleClose} />);

    const gotItBtn = screen.getByRole('button', { name: /Got it, close guide/i });
    fireEvent.click(gotItBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    render(<StageHelpModal isOpen={true} stage="catalogs" onClose={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking modal backdrop overlay', () => {
    const handleClose = vi.fn();
    render(<StageHelpModal isOpen={true} stage="catalogs" onClose={handleClose} />);

    const overlay = screen.getByTestId('stage-help-modal');
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
