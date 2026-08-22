import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LoadingSpinner,
  WorkspaceSkeleton,
  TableSkeleton,
  CardListSkeleton
} from '../../components/shared/ui/LoadingSpinner';

describe('LoadingSpinner and WorkspaceSkeleton Component', () => {
  it('renders WorkspaceSkeleton with default skeleton structure', () => {
    render(<WorkspaceSkeleton />);
    const skeleton = screen.getByTestId('workspace-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(screen.getByText('Loading workspace...')).toBeInTheDocument();
  });

  it('renders WorkspaceSkeleton with custom message', () => {
    render(<WorkspaceSkeleton message="Loading Profile Workspace..." />);
    expect(screen.getByText('Loading Profile Workspace...')).toBeInTheDocument();
  });

  it('renders LoadingSpinner with default skeleton variant', () => {
    render(<LoadingSpinner message="Initializing baseline..." />);
    expect(screen.getByTestId('workspace-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Initializing baseline...')).toBeInTheDocument();
  });

  it('renders TableSkeleton and LoadingSpinner table variant', () => {
    render(<TableSkeleton rows={3} />);
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();

    const { container } = render(<LoadingSpinner variant="table" rows={2} />);
    expect(container.querySelector('[data-testid="table-skeleton"]')).toBeInTheDocument();
  });

  it('renders CardListSkeleton and LoadingSpinner list variant', () => {
    render(<CardListSkeleton items={4} />);
    expect(screen.getByTestId('card-list-skeleton')).toBeInTheDocument();

    const { container } = render(<LoadingSpinner variant="list" rows={3} />);
    expect(container.querySelector('[data-testid="card-list-skeleton"]')).toBeInTheDocument();
  });

  it('renders LoadingSpinner with spinner variant and accessibility attributes', () => {
    render(
      <LoadingSpinner
        variant="spinner"
        message="Saving changes..."
        subtext="Please wait a moment"
        size="lg"
      />
    );

    const statusContainer = screen.getByRole('status');
    expect(statusContainer).toBeInTheDocument();
    expect(statusContainer).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Saving changes...')).toBeInTheDocument();
    expect(screen.getByText('Please wait a moment')).toBeInTheDocument();
  });

  it('renders small spinner variant cleanly', () => {
    const { container } = render(<LoadingSpinner variant="spinner" size="sm" />);
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });
});
