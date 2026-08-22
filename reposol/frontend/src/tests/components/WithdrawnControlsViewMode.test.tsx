import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useControlTree } from '../../hooks/useControlTree';
import { ControlHeader } from '../../components/shared/ControlHeader';
import { GroupEditor } from '../../components/shared/GroupEditor';

import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';

describe('Withdrawn Controls - View Mode vs Edit Mode', () => {
  const sampleGroups = [
    {
      id: 'family-active',
      title: 'Active Family',
      controls: [
        { id: 'ctrl-1', title: 'Active Control 1' },
        {
          id: 'ctrl-2-withdrawn',
          title: 'Withdrawn Control 2',
          props: [{ name: 'status', value: 'withdrawn' }]
        }
      ]
    },
    {
      id: 'family-withdrawn',
      title: 'Withdrawn Family',
      props: [{ name: 'status', value: 'withdrawn' }],
      controls: [
        { id: 'ctrl-3', title: 'Sub Control in Withdrawn Family' }
      ]
    }
  ];

  describe('useControlTree hook', () => {
    it('hides withdrawn controls and withdrawn groups when showWithdrawn is false (View Mode)', () => {
      const { result } = renderHook(() =>
        useControlTree({
          groups: sampleGroups as any,
          showWithdrawn: false
        })
      );

      const filteredIds = result.current.filteredNodes.map(n => n.id);
      expect(filteredIds).toContain('family-active');
      expect(filteredIds).toContain('ctrl-1');
      expect(filteredIds).not.toContain('ctrl-2-withdrawn');
      expect(filteredIds).not.toContain('family-withdrawn');
      expect(filteredIds).not.toContain('ctrl-3');
    });

    it('shows withdrawn controls and withdrawn groups when showWithdrawn is true (Edit Mode)', () => {
      const { result } = renderHook(() =>
        useControlTree({
          groups: sampleGroups as any,
          showWithdrawn: true
        })
      );

      const filteredIds = result.current.filteredNodes.map(n => n.id);
      expect(filteredIds).toContain('family-active');
      expect(filteredIds).toContain('ctrl-1');
      expect(filteredIds).toContain('ctrl-2-withdrawn');
      expect(filteredIds).toContain('family-withdrawn');
      expect(filteredIds).toContain('ctrl-3');
    });
  });

  describe('ControlHeader component', () => {
    const withdrawnControl = {
      id: 'ctrl-withdrawn',
      title: 'Withdrawn Control',
      props: [{ name: 'status', value: 'withdrawn' }],
      links: [{ rel: 'incorporated-into', href: '#ctrl-replacement' }]
    };

    it('does NOT render Restore Control button in View Mode (isEditing = false)', () => {
      render(
        <ConfirmProvider>
          <ControlHeader
            id="ctrl-withdrawn"
            title="Withdrawn Control"
            control={withdrawnControl}
            isEditing={false}
          />
        </ConfirmProvider>
      );

      expect(screen.getByText(/Control Withdrawn: This control is deprecated./i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Restore Control/i })).not.toBeInTheDocument();
    });

    it('renders Restore Control button in Edit Mode (isEditing = true)', () => {
      render(
        <ConfirmProvider>
          <ControlHeader
            id="ctrl-withdrawn"
            title="Withdrawn Control"
            control={withdrawnControl}
            isEditing={true}
          />
        </ConfirmProvider>
      );

      expect(screen.getByText(/Control Withdrawn: This control is deprecated./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore Control/i })).toBeInTheDocument();
    });
  });

  describe('GroupEditor component', () => {
    const groupWithWithdrawn = {
      id: 'grp-test',
      title: 'Test Group',
      groups: [
        { id: 'sub-active', title: 'Sub Active' },
        { id: 'sub-withdrawn', title: 'Sub Withdrawn', props: [{ name: 'status', value: 'withdrawn' }] }
      ],
      controls: [
        { id: 'c-active', title: 'Active Control' },
        { id: 'c-withdrawn', title: 'Withdrawn Control', props: [{ name: 'status', value: 'withdrawn' }] }
      ]
    };

    it('hides withdrawn controls and subgroups in View Mode (isEditing = false)', () => {
      render(
        <GroupEditor
          group={groupWithWithdrawn}
          isEditing={false}
        />
      );

      expect(screen.getByText('Active Control')).toBeInTheDocument();
      expect(screen.queryByText('Withdrawn Control')).not.toBeInTheDocument();
      expect(screen.getByText('Sub Active')).toBeInTheDocument();
      expect(screen.queryByText('Sub Withdrawn')).not.toBeInTheDocument();
    });

    it('shows withdrawn controls and subgroups in Edit Mode (isEditing = true)', () => {
      render(
        <GroupEditor
          group={groupWithWithdrawn}
          isEditing={true}
        />
      );

      expect(screen.getByText('Active Control')).toBeInTheDocument();
      expect(screen.getByText('Withdrawn Control')).toBeInTheDocument();
      expect(screen.getByText('Sub Active')).toBeInTheDocument();
      expect(screen.getByText('Sub Withdrawn')).toBeInTheDocument();
    });
  });
});
