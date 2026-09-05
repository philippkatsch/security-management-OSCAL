import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ControlHeader } from '../../components/shared/ControlHeader';
import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';

describe('ControlHeader Component - Badges and Stage Independence', () => {
  const sampleControl = {
    id: 'ac-1',
    title: 'Access Control Policy and Procedures',
    class: 'Access Control',
    props: [{ name: 'label', value: 'AC-1' }],
  };

  const withdrawnControl = {
    id: 'ac-2.1',
    title: 'Automated System Account Management',
    status: 'withdrawn',
    links: [{ rel: 'incorporated-into', href: '#ac-2' }],
  };

  it('does NOT render "Catalog Source" badge or knowledge-base link in catalog view mode', () => {
    const { container } = render(
      <ConfirmProvider>
        <ControlHeader
          id="ac-1"
          title="Access Control Policy"
          controlClass="Access Control"
          isEditing={false}
          stage="catalog"
          control={sampleControl}
        />
      </ConfirmProvider>
    );

    expect(screen.queryByText(/Catalog Source/i)).toBeNull();
    expect(screen.queryByText(/Profile Baseline/i)).toBeNull();
    const kbLinks = container.querySelectorAll('a[href="/knowledge-base"]');
    expect(kbLinks.length).toBe(0);
    expect(screen.getByText('ac-1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Access Control Policy/i })).toBeInTheDocument();
  });

  it('does NOT render "Catalog Source" badge or knowledge-base link in catalog edit mode', () => {
    const { container } = render(
      <ConfirmProvider>
        <ControlHeader
          id="ac-1"
          title="Access Control Policy"
          controlClass="Access Control"
          isEditing={true}
          stage="catalog"
          control={sampleControl}
        />
      </ConfirmProvider>
    );

    expect(screen.queryByText(/Catalog Source/i)).toBeNull();
    expect(screen.queryByText(/Profile Baseline/i)).toBeNull();
    const kbLinks = container.querySelectorAll('a[href="/knowledge-base"]');
    expect(kbLinks.length).toBe(0);
  });

  it('does NOT render "Profile Baseline" badge or knowledge-base link in profile view mode', () => {
    const { container } = render(
      <ConfirmProvider>
        <ControlHeader
          id="ac-1"
          title="Access Control Policy"
          controlClass="Access Control"
          isEditing={false}
          stage="profile"
          control={sampleControl}
        />
      </ConfirmProvider>
    );

    expect(screen.queryByText(/Profile Baseline/i)).toBeNull();
    expect(screen.queryByText(/Catalog Source/i)).toBeNull();
    const kbLinks = container.querySelectorAll('a[href="/knowledge-base"]');
    expect(kbLinks.length).toBe(0);
  });

  it('does NOT render "Profile Baseline" badge or knowledge-base link in profile edit mode', () => {
    const { container } = render(
      <ConfirmProvider>
        <ControlHeader
          id="ac-1"
          title="Access Control Policy"
          controlClass="Access Control"
          isEditing={true}
          stage="profile"
          control={sampleControl}
        />
      </ConfirmProvider>
    );

    expect(screen.queryByText(/Profile Baseline/i)).toBeNull();
    expect(screen.queryByText(/Catalog Source/i)).toBeNull();
    const kbLinks = container.querySelectorAll('a[href="/knowledge-base"]');
    expect(kbLinks.length).toBe(0);
  });

  it('renders typeBadge and control class without stage badge in view and edit modes', () => {
    const { rerender } = render(
      <ConfirmProvider>
        <ControlHeader
          id="ac-1"
          title="Access Control Policy"
          controlClass="Access Control"
          typeBadge="Guidance"
          isEditing={false}
          stage="catalog"
          control={sampleControl}
        />
      </ConfirmProvider>
    );

    expect(screen.getByText('Guidance')).toBeInTheDocument();
    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.queryByText(/Catalog Source/i)).toBeNull();

    rerender(
      <ConfirmProvider>
        <ControlHeader
          id="ac-1"
          title="Access Control Policy"
          controlClass="Access Control"
          typeBadge="Guidance"
          isEditing={true}
          stage="catalog"
          control={sampleControl}
        />
      </ConfirmProvider>
    );

    expect(screen.getByText('Guidance')).toBeInTheDocument();
    expect(screen.queryByText(/Catalog Source/i)).toBeNull();
  });

  it('renders withdrawal banner correctly for deprecated controls in both modes without stage badges', () => {
    const { rerender } = render(
      <ConfirmProvider>
        <ControlHeader
          id="ac-2.1"
          title="Automated Account Management"
          isEditing={false}
          stage="catalog"
          control={withdrawnControl}
        />
      </ConfirmProvider>
    );

    expect(screen.getByTestId('withdrawal-banner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore Control/i })).toBeNull();
    expect(screen.queryByText(/Catalog Source/i)).toBeNull();

    rerender(
      <ConfirmProvider>
        <ControlHeader
          id="ac-2.1"
          title="Automated Account Management"
          isEditing={true}
          stage="catalog"
          control={withdrawnControl}
        />
      </ConfirmProvider>
    );

    expect(screen.getByTestId('withdrawal-banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore Control/i })).toBeInTheDocument();
    expect(screen.queryByText(/Catalog Source/i)).toBeNull();
  });
});
