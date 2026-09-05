import React, { useState, useMemo } from 'react';
import styles from '../ARPage.module.css';
import { Result, Finding, Observation, Risk } from '../../../lib/types/oscal';
import StatusBadge from '@components/shared/status/StatusBadge';
import EntityTable from '@components/shared/entity/EntityTable';
import { FindingEditorModal } from '../modals/FindingEditorModal';

export interface AssessmentFindingsTabProps {
  resultSet: Result;
  resultIndex: number;
  isEditing: boolean;
  onAddFinding: (finding?: Partial<Finding>) => void;
  onUpdateFinding: (findingIndex: number, updates: Partial<Finding>) => void;
  onRemoveFinding: (findingIndex: number) => void;
}

export const AssessmentFindingsTab: React.FC<AssessmentFindingsTabProps> = ({
  resultSet,
  resultIndex,
  isEditing,
  onAddFinding,
  onUpdateFinding,
  onRemoveFinding,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'satisfied' | 'not-satisfied'>('all');
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);

  const findings: Finding[] = resultSet.findings || [];
  const observations: Observation[] = resultSet.observations || [];
  const risks: Risk[] = resultSet.risks || [];

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      const state = f.target?.status?.state;
      if (statusFilter !== 'all' && state !== statusFilter) {
        return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (f.title || '').toLowerCase().includes(term) ||
        (f.description || '').toLowerCase().includes(term) ||
        (f.target?.['target-id'] || '').toLowerCase().includes(term)
      );
    });
  }, [findings, statusFilter, searchTerm]);

  const handleCreateFinding = () => {
    const newFinding: Finding = {
      uuid: crypto.randomUUID(),
      title: 'New Finding',
      description: 'Finding assessment statement and compliance determination.',
      target: {
        type: 'statement-id',
        'target-id': 'ac-1_smt',
        status: {
          state: 'satisfied',
        },
      },
      'related-observations': [],
      'related-risks': [],
    };
    onAddFinding(newFinding);
    setActiveFinding(newFinding);
  };

  const handleSaveActiveFinding = (updated: Finding) => {
    const idx = findings.findIndex((f) => f.uuid === updated.uuid);
    if (idx >= 0) {
      onUpdateFinding(idx, updated);
      setActiveFinding(updated);
    } else {
      onAddFinding(updated);
      setActiveFinding(updated);
    }
  };

  const columns = [
    { key: 'title', label: 'Title' },
    {
      key: 'target',
      label: 'Target',
      render: (_: any, f: Finding) => (
        <span className="font-mono text-xs text-indigo-300">
          {f.target?.['target-id'] || '(None)'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, f: Finding) => (
        <StatusBadge status={f.target?.status?.state || 'unknown'} category="finding-status" />
      ),
    },
    {
      key: 'relations',
      label: 'Relations',
      render: (_: any, f: Finding) => (
        <span className="text-xs text-slate-400">
          Obs: {(f['related-observations'] || []).length} / Risks: {(f['related-risks'] || []).length}
        </span>
      ),
    },
    ...(isEditing
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (_: any, f: Finding) => {
              const idx = findings.findIndex((item) => item.uuid === f.uuid);
              return (
                <button
                  type="button"
                  className={styles['btn-danger-sm']}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (idx >= 0) onRemoveFinding(idx);
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
      {/* Control / Filter Bar */}
      <div className={styles['filter-bar']}>
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Filter findings by title, target ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles['modal-input']}
            style={{ maxWidth: '300px' }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={styles['modal-input']}
            style={{ width: '160px' }}
          >
            <option value="all">All States</option>
            <option value="satisfied">Satisfied</option>
            <option value="not-satisfied">Not Satisfied</option>
          </select>
        </div>

        {isEditing && (
          <button
            type="button"
            className={styles['btn-primary']}
            onClick={handleCreateFinding}
          >
            + Add Finding
          </button>
        )}
      </div>

      {/* Entity Table */}
      <EntityTable
        columns={columns}
        data={filteredFindings}
        onRowClick={(f: Finding) => setActiveFinding(f)}
      />

      {/* Finding Detail / Editor Modal */}
      <FindingEditorModal
        finding={activeFinding}
        observations={observations}
        risks={risks}
        isEditing={isEditing}
        isOpen={!!activeFinding}
        onClose={() => setActiveFinding(null)}
        onUpdate={handleSaveActiveFinding}
      />
    </div>
  );
};
