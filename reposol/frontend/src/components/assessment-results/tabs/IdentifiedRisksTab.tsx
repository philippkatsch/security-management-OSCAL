import React, { useState, useMemo } from 'react';
import styles from '../ARPage.module.css';
import { Result, Risk } from '../../../lib/types/oscal';
import StatusBadge from '@components/shared/status/StatusBadge';
import EntityTable from '@components/shared/entity/EntityTable';
import { RiskEditorModal } from '../modals/RiskEditorModal';

export interface IdentifiedRisksTabProps {
  resultSet: Result;
  resultIndex: number;
  isEditing: boolean;
  onAddRisk: (risk?: Partial<Risk>) => void;
  onUpdateRisk: (riskIndex: number, updates: Partial<Risk>) => void;
  onRemoveRisk: (riskIndex: number) => void;
}

export const IdentifiedRisksTab: React.FC<IdentifiedRisksTabProps> = ({
  resultSet,
  resultIndex,
  isEditing,
  onAddRisk,
  onUpdateRisk,
  onRemoveRisk,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeRisk, setActiveRisk] = useState<Risk | null>(null);

  const risks: Risk[] = resultSet.risks || [];

  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (statusFilter !== 'all') {
        if ((r.status || 'open') !== statusFilter) {
          return false;
        }
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (r.title || '').toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term) ||
        (r.statement || '').toLowerCase().includes(term)
      );
    });
  }, [risks, statusFilter, searchTerm]);

  const handleCreateRisk = () => {
    const newRisk: Risk = {
      uuid: crypto.randomUUID(),
      title: 'New Risk',
      description: 'Identified risk details and operational impact.',
      statement: 'Deficiency presents a potential risk to system confidentiality, integrity, or availability.',
      status: 'open',
      remediations: [],
      'mitigating-factors': [],
      'threat-ids': [],
      characterizations: [],
    };
    onAddRisk(newRisk);
    setActiveRisk(newRisk);
  };

  const handleSaveActiveRisk = (updated: Risk) => {
    const idx = risks.findIndex((r) => r.uuid === updated.uuid);
    if (idx >= 0) {
      onUpdateRisk(idx, updated);
      setActiveRisk(updated);
    } else {
      onAddRisk(updated);
      setActiveRisk(updated);
    }
  };

  const columns = [
    { key: 'title', label: 'Title' },
    {
      key: 'status',
      label: 'Status',
      render: (val: string) => <StatusBadge status={val || 'open'} category="risk-status" />,
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (_: any, r: Risk) => {
        const char = (r.characterizations || [])[0];
        const facet = (char?.facets || []).find(
          (f) => f.name === 'likelihood' || f.name === 'impact' || f.name === 'score'
        );
        return facet?.value || 'N/A';
      },
    },
    {
      key: 'remediations',
      label: 'Remediations',
      render: (_: any, r: Risk) => (r.remediations || []).length,
    },
    {
      key: 'logEntries',
      label: 'Log Entries',
      render: (_: any, r: Risk) => (r['risk-log']?.entries || []).length,
    },
    ...(isEditing
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (_: any, r: Risk) => {
              const idx = risks.findIndex((item) => item.uuid === r.uuid);
              return (
                <button
                  type="button"
                  className={styles['btn-danger-sm']}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (idx >= 0) onRemoveRisk(idx);
                  }}
                >
                  Delete
                </button>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className={styles['entity-section']}>
      {/* Filter / Action Bar */}
      <div className={styles['filter-bar']}>
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Filter risks by title, statement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles['modal-input']}
            style={{ maxWidth: '300px' }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles['modal-input']}
            style={{ width: '180px' }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="remediating">Remediating</option>
            <option value="deviation-requested">Deviation Requested</option>
            <option value="deviation-approved">Deviation Approved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {isEditing && (
          <button
            type="button"
            className={styles['btn-primary']}
            onClick={handleCreateRisk}
          >
            + Add Risk
          </button>
        )}
      </div>

      {/* Table */}
      <EntityTable
        columns={columns}
        data={filteredRisks}
        onRowClick={(r: Risk) => setActiveRisk(r)}
      />

      {/* Detail / Editor Modal */}
      <RiskEditorModal
        risk={activeRisk}
        isEditing={isEditing}
        isOpen={!!activeRisk}
        onClose={() => setActiveRisk(null)}
        onUpdate={handleSaveActiveRisk}
      />
    </div>
  );
};
