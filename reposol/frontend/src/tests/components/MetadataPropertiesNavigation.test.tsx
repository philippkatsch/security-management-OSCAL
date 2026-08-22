import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetadataEditor } from '../../components/shared/MetadataEditor';

describe('MetadataEditor properties section & navigation', () => {
  it('renders properties summary and handles navigation callback when onNavigateToProperties is provided', () => {
    const onNavigateToProperties = vi.fn();
    const metadata = {
      title: 'Test Document',
      version: '1.0.0',
      props: [
        { name: 'marking', value: 'internal', class: 'security' },
        { name: 'framework', value: 'NIST-800-53' }
      ]
    };

    render(
      <MetadataEditor
        metadata={metadata}
        onNavigateToProperties={onNavigateToProperties}
        readOnly={false}
      />
    );

    // Expand Global Document Properties section
    const propsSectionHeader = screen.getByText(/Global Document Properties/i);
    expect(propsSectionHeader).toBeInTheDocument();
    fireEvent.click(propsSectionHeader);

    // Verify summary is rendered
    expect(screen.getByText('marking')).toBeInTheDocument();
    expect(screen.getByText('internal')).toBeInTheDocument();
    expect(screen.getByText('framework')).toBeInTheDocument();
    expect(screen.getByText('NIST-800-53')).toBeInTheDocument();

    // Verify navigation button
    const navBtn = screen.getByRole('button', { name: /Manage in Properties Tab/i });
    expect(navBtn).toBeInTheDocument();

    fireEvent.click(navBtn);
    expect(onNavigateToProperties).toHaveBeenCalledTimes(1);
  });

  it('renders fallback PropsEditor when onNavigateToProperties is not provided', () => {
    const metadata = {
      title: 'Test Document',
      version: '1.0.0',
      props: [
        { name: 'custom-prop', value: 'custom-val' }
      ]
    };

    render(
      <MetadataEditor
        metadata={metadata}
        readOnly={false}
      />
    );

    // Expand Global Document Properties section
    const propsSectionHeader = screen.getByText(/Global Document Properties/i);
    fireEvent.click(propsSectionHeader);

    // Verify PropsEditor input is present (has input fields for editing)
    expect(screen.queryByRole('button', { name: /Manage in Properties Tab/i })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('custom-prop')).toBeInTheDocument();
    expect(screen.getByDisplayValue('custom-val')).toBeInTheDocument();
  });
});
