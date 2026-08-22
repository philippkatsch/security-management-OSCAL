import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileBaselineDiffView from '../../components/profile/ProfileBaselineDiffView';
import * as resolutionHooks from '../../hooks/useProfileResolution';

vi.mock('../../hooks/useProfileResolution', () => ({
  useProfileDiffQuery: vi.fn()
}));

describe('ProfileBaselineDiffView Component', () => {
  const sampleProfileDoc = {
    profile: {
      uuid: 'prof-123',
      imports: [{ href: '#cat-456' }]
    }
  };

  const sampleDiffData = {
    summary: {
      added_count: 1,
      removed_count: 1,
      modified_count: 1,
      untouched_count: 1,
      total_baseline_controls: 3
    },
    deltas: [
      {
        id: 'ac-1',
        status: 'modified',
        title: 'Access Control Policy',
        baseline_control: { title: 'Access Control Policy', parts: [{ name: 'statement', prose: 'Baseline prose' }] },
        profile_control: { title: 'Access Control Policy', parts: [{ name: 'statement', prose: 'Tailored prose' }] }
      },
      {
        id: 'ac-2',
        status: 'removed',
        title: 'Account Management',
        baseline_control: { title: 'Account Management', parts: [{ name: 'statement', prose: 'Remove this' }] },
        profile_control: null
      },
      {
        id: 'ac-3',
        status: 'untouched',
        title: 'Access Enforcement',
        baseline_control: { title: 'Access Enforcement', parts: [{ name: 'statement', prose: 'Untouched prose' }] },
        profile_control: { title: 'Access Enforcement', parts: [{ name: 'statement', prose: 'Untouched prose' }] }
      },
      {
        id: 'custom-1',
        status: 'added',
        title: 'Custom Internal Policy',
        baseline_control: null,
        profile_control: { title: 'Custom Internal Policy', parts: [{ name: 'statement', prose: 'Custom added prose' }] }
      }
    ]
  };

  it('renders metric count cards with diff summary statistics', () => {
    vi.spyOn(resolutionHooks, 'useProfileDiffQuery').mockReturnValue({
      data: sampleDiffData,
      isLoading: false,
      error: null
    } as any);

    render(<ProfileBaselineDiffView profileId="prof-123" profileDoc={sampleProfileDoc} />);

    expect(screen.getByText('Added Controls')).toBeInTheDocument();
    expect(screen.getByText('Removed Controls')).toBeInTheDocument();
    expect(screen.getByText('Modified Controls')).toBeInTheDocument();
    expect(screen.getByText('Untouched Controls')).toBeInTheDocument();

    expect(screen.getByText('ac-1')).toBeInTheDocument();
    expect(screen.getByText('ac-2')).toBeInTheDocument();
    expect(screen.getByText('ac-3')).toBeInTheDocument();
    expect(screen.getByText('custom-1')).toBeInTheDocument();
  });

  it('filters deltas by status when clicking filter buttons', () => {
    vi.spyOn(resolutionHooks, 'useProfileDiffQuery').mockReturnValue({
      data: sampleDiffData,
      isLoading: false,
      error: null
    } as any);

    render(<ProfileBaselineDiffView profileId="prof-123" profileDoc={sampleProfileDoc} />);

    const modifiedFilterBtn = screen.getByRole('button', { name: /Modified/i });
    fireEvent.click(modifiedFilterBtn);

    expect(screen.getByText('ac-1')).toBeInTheDocument();
    expect(screen.queryByText('ac-2')).not.toBeInTheDocument();
    expect(screen.queryByText('ac-3')).not.toBeInTheDocument();
  });

  it('filters controls using the search input', () => {
    vi.spyOn(resolutionHooks, 'useProfileDiffQuery').mockReturnValue({
      data: sampleDiffData,
      isLoading: false,
      error: null
    } as any);

    render(<ProfileBaselineDiffView profileId="prof-123" profileDoc={sampleProfileDoc} />);

    const searchInput = screen.getByPlaceholderText('Search by ID or title...');
    fireEvent.change(searchInput, { target: { value: 'custom-1' } });

    expect(screen.getByText('custom-1')).toBeInTheDocument();
    expect(screen.queryByText('ac-1')).not.toBeInTheDocument();
  });
});
