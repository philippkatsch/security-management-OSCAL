import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { POAMDashboard } from '../POAMDashboard';

describe('POAMDashboard', () => {
  const samplePoam = {
    uuid: 'poam-101',
    'system-id': { identifier: 'SYS-2026' },
    'poam-items': [
      { uuid: 'item-1', props: [{ name: 'status', value: 'completed' }, { name: 'priority', value: '1' }] },
      { uuid: 'item-2', props: [{ name: 'status', value: 'open' }, { name: 'priority', value: '2' }] },
    ],
    risks: [
      {
        uuid: 'risk-1',
        title: 'Overdue Critical Risk',
        status: 'open',
        deadline: '2020-01-01', // Past date -> overdue
        remediations: [
          { uuid: 'rem-1', lifecycle: 'completed' },
          { uuid: 'rem-2', lifecycle: 'planned' }
        ]
      },
      {
        uuid: 'risk-2',
        title: 'Active Future Risk',
        status: 'investigating',
        deadline: '2099-12-31',
      }
    ]
  };

  const sampleMetrics = [
    { title: 'Total Items', value: 2 },
    { title: 'Open Items', value: 1 },
  ];

  it('renders dashboard metric cards and resolution progress', () => {
    render(
      <POAMDashboard
        poam={samplePoam}
        dashboardMetrics={sampleMetrics}
        resolvedPercent={50}
        completedItems={[samplePoam['poam-items'][0]]}
        items={samplePoam['poam-items']}
        riskStatusData={{ open: 1, investigating: 1 }}
        priorityData={{ P1: 1, P2: 1 }}
      />
    );

    expect(screen.getByTestId('poam-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('System ID')).toBeInTheDocument();
    expect(screen.getByText('SYS-2026')).toBeInTheDocument();
  });

  it('displays the overdue alert banner when overdue risks exist', () => {
    render(
      <POAMDashboard
        poam={samplePoam}
        dashboardMetrics={sampleMetrics}
        resolvedPercent={50}
        completedItems={[samplePoam['poam-items'][0]]}
        items={samplePoam['poam-items']}
        riskStatusData={{ open: 1 }}
        priorityData={{ P1: 1 }}
      />
    );

    expect(screen.getByTestId('overdue-alert-banner')).toBeInTheDocument();
    expect(screen.getByText('1 Overdue Risk(s) Detected!')).toBeInTheDocument();
  });

  it('renders AR import bridge banner and triggers onOpenImportWizard when in edit mode', () => {
    const onOpenImportWizard = vi.fn();
    render(
      <POAMDashboard
        poam={samplePoam}
        isEditing={true}
        onOpenImportWizard={onOpenImportWizard}
        dashboardMetrics={sampleMetrics}
        resolvedPercent={50}
        completedItems={[samplePoam['poam-items'][0]]}
        items={samplePoam['poam-items']}
        riskStatusData={{ open: 1 }}
        priorityData={{ P1: 1 }}
      />
    );

    expect(screen.getByTestId('import-bridge-banner')).toBeInTheDocument();
    const importBtn = screen.getByTestId('btn-open-import-wizard');
    fireEvent.click(importBtn);
    expect(onOpenImportWizard).toHaveBeenCalledTimes(1);
  });
});
