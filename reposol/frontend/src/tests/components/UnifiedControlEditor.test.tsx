import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnifiedControlEditor } from '@components/shared/control-editor/UnifiedControlEditor';
import { ConfirmProvider } from '@components/shared/ui/ConfirmProvider';

describe('UnifiedControlEditor Parameter Overlay (R3-04)', () => {
  const sampleControl: any = {
    id: 'ac-1',
    title: 'Access Control',
    params: [
      { id: 'ac-1_prm_1', label: 'frequency', values: ['monthly'] }
    ],
    parts: [
      { id: 'ac-1_smt', name: 'statement', prose: 'Review access {{ insert: param, ac-1_prm_1 }} and report to {{ insert: param, prof_prm_org }}.' }
    ]
  };

  const sampleProfile = {
    uuid: 'prof-123',
    modify: {
      'set-parameters': [
        { 'param-id': 'ac-1_prm_1', values: ['weekly'] },
        { 'param-id': 'prof_prm_org', label: 'Security Officer', values: ['CISO'] }
      ]
    }
  };

  it('overlays profile.modify.set-parameters in Profile mode and displays updated values in prose chips', () => {
    render(
      <ConfirmProvider>
        <UnifiedControlEditor
          control={sampleControl}
          stage="profile"
          profile={sampleProfile}
          isEditing={false}
        />
      </ConfirmProvider>
    );

    // Overridden catalog parameter should show 'weekly' instead of catalog default 'monthly'
    expect(screen.getByText('weekly')).toBeInTheDocument();
    expect(screen.queryByText('monthly')).not.toBeInTheDocument();

    // Profile-level parameter should show 'CISO'
    expect(screen.getByText('CISO')).toBeInTheDocument();
  });
});
