import React, { useState, useMemo } from 'react';
import styles from '../ARPage.module.css';
import { Result, Observation } from '../../../lib/types/oscal';
import StatusBadge from '@components/shared/status/StatusBadge';
import EntityTable from '@components/shared/entity/EntityTable';
import { ObservationEditorModal } from '../modals/ObservationEditorModal';

export interface ObservationsEvidenceTabProps {
  resultSet: Result;
  resultIndex: number;
  isEditing: boolean;
  onAddObservation: (observation?: Partial<Observation>) => void;
  onUpdateObservation: (observationIndex: number, updates: Partial<Observation>) => void;
  onRemoveObservation: (observationIndex: number) => void;
}

export const ObservationsEvidenceTab: React.FC<ObservationsEvidenceTabProps> = ({
  resultSet,
  resultIndex,
  isEditing,
  onAddObservation,
  onUpdateObservation,
  onRemoveObservation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [activeObservation, setActiveObservation] = useState<Observation | null>(null);

  const observations: Observation[] = resultSet.observations || [];

  const filteredObservations = useMemo(() => {
    return observations.filter((obs) => {
      if (methodFilter !== 'all') {
        if (!(obs.methods || []).includes(methodFilter)) {
          return false;
        }
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (obs.title || '').toLowerCase().includes(term) ||
        (obs.description || '').toLowerCase().includes(term) ||
        (obs.types || []).some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [observations, methodFilter, searchTerm]);

  const handleCreateObservation = () => {
    const newObs: Observation = {
      uuid: crypto.randomUUID(),
      title: 'New Observation',
      description: 'Observation details and assessment evidence.',
      methods: ['EXAMINE'],
      collected: new Date().toISOString(),
      types: [],
      subjects: [],
      'relevant-evidence': [],
    };
    onAddObservation(newObs);
    setActiveObservation(newObs);
  };

  const handleSaveActiveObservation = (updated: Observation) => {
    const idx = observations.findIndex((o) => o.uuid === updated.uuid);
    if (idx >= 0) {
      onUpdateObservation(idx, updated);
      setActiveObservation(updated);
    } else {
      onAddObservation(updated);
      setActiveObservation(updated);
    }
  };

  const columns = [
    { key: 'title', label: 'Title' },
    {
      key: 'methods',
      label: 'Methods',
      render: (methods: string[]) => (
        <div className="flex gap-1 flex-wrap">
          {(methods || []).map((m) => (
            <StatusBadge key={m} status={m} category="generic" />
          ))}
        </div>
      ),
    },
    {
      key: 'types',
      label: 'Types',
      render: (types: string[]) => (
        <span className="text-xs text-slate-400">{(types || []).join(', ') || '—'}</span>
      ),
    },
    {
      key: 'collected',
      label: 'Collected',
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '—'),
    },
    {
      key: 'subjects',
      label: 'Subjects',
      render: (_: any, obs: Observation) => (obs.subjects || []).length,
    },
    {
      key: 'evidence',
      label: 'Evidence',
      render: (_: any, obs: Observation) => (obs['relevant-evidence'] || []).length,
    },
    ...(isEditing
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (_: any, obs: Observation) => {
              const idx = observations.findIndex((o) => o.uuid === obs.uuid);
              return (
                <button
                  type="button"
                  className={styles['btn-danger-sm']}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (idx >= 0) onRemoveObservation(idx);
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
            placeholder="Filter observations by title, type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles['modal-input']}
            style={{ maxWidth: '300px' }}
          />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className={styles['modal-input']}
            style={{ width: '160px' }}
          >
            <option value="all">All Methods</option>
            <option value="EXAMINE">EXAMINE</option>
            <option value="INTERVIEW">INTERVIEW</option>
            <option value="TEST">TEST</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>

        {isEditing && (
          <button
            type="button"
            className={styles['btn-primary']}
            onClick={handleCreateObservation}
          >
            + Add Observation
          </button>
        )}
      </div>

      {/* Table */}
      <EntityTable
        columns={columns}
        data={filteredObservations}
        onRowClick={(obs: Observation) => setActiveObservation(obs)}
      />

      {/* Detail / Editor Modal */}
      <ObservationEditorModal
        observation={activeObservation}
        isEditing={isEditing}
        isOpen={!!activeObservation}
        onClose={() => setActiveObservation(null)}
        onUpdate={handleSaveActiveObservation}
      />
    </div>
  );
};
