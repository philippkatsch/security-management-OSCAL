import React from 'react';
import styles from '../ARPage.module.css';
import { Observation, SubjectReference, RelevantEvidence, Property, Link } from '../../../lib/types/oscal';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';
import { OriginsEditor } from '@components/shared/risk-assessment/OriginsEditor';
import { RelevantEvidenceEditor } from '@components/shared/risk-assessment/RelevantEvidenceEditor';

export interface ObservationEditorModalProps {
  observation: Observation | null;
  isEditing: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Observation) => void;
}

export const ObservationEditorModal: React.FC<ObservationEditorModalProps> = ({
  observation,
  isEditing,
  isOpen,
  onClose,
  onUpdate,
}) => {
  if (!isOpen || !observation) return null;

  const handleFieldChange = (field: keyof Observation, value: any) => {
    onUpdate({
      ...observation,
      [field]: value,
    });
  };

  const handleToggleMethod = (method: string) => {
    const currentMethods = observation.methods || ['EXAMINE'];
    let nextMethods: string[];
    if (currentMethods.includes(method)) {
      if (currentMethods.length > 1) {
        nextMethods = currentMethods.filter((m) => m !== method);
      } else {
        // minItems: 1 rule
        nextMethods = currentMethods;
      }
    } else {
      nextMethods = [...currentMethods, method];
    }
    handleFieldChange('methods', nextMethods);
  };

  const handleAddSubject = () => {
    const newSubject: SubjectReference = {
      'subject-uuid': crypto.randomUUID(),
      type: 'component',
    };
    handleFieldChange('subjects', [...(observation.subjects || []), newSubject]);
  };

  const handleUpdateSubject = (index: number, updates: Partial<SubjectReference>) => {
    const nextSubjects = [...(observation.subjects || [])];
    nextSubjects[index] = { ...nextSubjects[index], ...updates };
    handleFieldChange('subjects', nextSubjects);
  };

  const handleRemoveSubject = (index: number) => {
    const nextSubjects = [...(observation.subjects || [])];
    nextSubjects.splice(index, 1);
    handleFieldChange('subjects', nextSubjects);
  };

  return (
    <div className={styles['editor-panel-overlay']} role="dialog" aria-modal="true" aria-label="Observation Details">
      <div className={styles['editor-panel']}>
        <div className={styles['editor-panel-header']}>
          <h3>Observation Details</h3>
          <button type="button" className={styles['btn-close']} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles['editor-form']}>
          <div className={styles['form-group']}>
            <label htmlFor="obs-title">Title</label>
            <input
              id="obs-title"
              type="text"
              value={observation.title || ''}
              disabled={!isEditing}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="e.g. Inactive Account Review"
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="obs-desc">Description</label>
            <textarea
              id="obs-desc"
              value={observation.description || ''}
              disabled={!isEditing}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              placeholder="Assessor observations and factual findings..."
            />
          </div>

          <div className={styles['form-section']}>
            <h4>Classification & Methods</h4>
            <div className={styles['form-group']}>
              <label>Methods (min 1)</label>
              <div className={styles['checkbox-group']}>
                {['EXAMINE', 'INTERVIEW', 'TEST', 'UNKNOWN'].map((m) => (
                  <label key={m} htmlFor={`obs-method-${m}`}>
                    <input
                      id={`obs-method-${m}`}
                      type="checkbox"
                      checked={(observation.methods || []).includes(m)}
                      disabled={!isEditing}
                      onChange={() => handleToggleMethod(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="obs-types">Types (comma-separated)</label>
              <input
                id="obs-types"
                type="text"
                value={(observation.types || []).join(', ')}
                disabled={!isEditing}
                onChange={(e) =>
                  handleFieldChange(
                    'types',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="ssp-statement-issue, control-objective, historic..."
              />
            </div>
          </div>

          <div className={styles['form-section']}>
            <h4>Timing</h4>
            <div className={styles['form-row']}>
              <div className={styles['form-group']}>
                <label htmlFor="obs-collected">Collected</label>
                <input
                  id="obs-collected"
                  type="datetime-local"
                  value={(observation.collected || '').slice(0, 16)}
                  disabled={!isEditing}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    handleFieldChange('collected', !isNaN(d.getTime()) ? d.toISOString() : e.target.value);
                  }}
                />
              </div>
              <div className={styles['form-group']}>
                <label htmlFor="obs-expires">Expires (Optional)</label>
                <input
                  id="obs-expires"
                  type="datetime-local"
                  value={(observation.expires || '').slice(0, 16)}
                  disabled={!isEditing}
                  onChange={(e) => {
                    if (!e.target.value) {
                      const copy = { ...observation };
                      delete copy.expires;
                      onUpdate(copy);
                    } else {
                      const d = new Date(e.target.value);
                      handleFieldChange('expires', !isNaN(d.getTime()) ? d.toISOString() : e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles['form-section']}>
            <div className="flex items-center justify-between mb-2">
              <h4>Assessment Subjects</h4>
              {isEditing && (
                <button type="button" className={styles['btn-secondary']} onClick={handleAddSubject}>
                  + Add Subject
                </button>
              )}
            </div>
            {(observation.subjects || []).length === 0 ? (
              <div className={styles['empty-hint']}>No subjects linked.</div>
            ) : (
              (observation.subjects || []).map((sub, i) => (
                <div key={i} className={styles['form-row']}>
                  <div style={{ flex: 3 }}>
                    <label htmlFor={`obs-subject-uuid-${i}`} className="sr-only">Subject UUID</label>
                    <input
                      id={`obs-subject-uuid-${i}`}
                      type="text"
                      value={sub['subject-uuid'] || ''}
                      placeholder="Subject UUID"
                      disabled={!isEditing}
                      onChange={(e) => handleUpdateSubject(i, { 'subject-uuid': e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label htmlFor={`obs-subject-type-${i}`} className="sr-only">Subject Type</label>
                    <select
                      id={`obs-subject-type-${i}`}
                      value={sub.type || 'component'}
                      disabled={!isEditing}
                      onChange={(e) => handleUpdateSubject(i, { type: e.target.value })}
                    >
                      <option value="component">Component</option>
                      <option value="inventory-item">Inventory Item</option>
                      <option value="location">Location</option>
                      <option value="party">Party</option>
                      <option value="user">User</option>
                      <option value="resource">Resource</option>
                    </select>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      className={styles['btn-danger-sm']}
                      onClick={() => handleRemoveSubject(i)}
                      aria-label="Remove Subject"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className={styles['form-section']}>
            <h4>Relevant Evidence</h4>
            <RelevantEvidenceEditor
              value={observation['relevant-evidence'] || []}
              isEditing={isEditing}
              onChange={(newEv: RelevantEvidence[]) => handleFieldChange('relevant-evidence', newEv)}
            />
          </div>

          <div className={styles['form-section']}>
            <h4>Origins & Actors</h4>
            <OriginsEditor
              value={observation.origins || []}
              isEditing={isEditing}
              onChange={(newOrigins: any[]) => handleFieldChange('origins', newOrigins)}
            />
          </div>

          <div className={styles['form-section']}>
            <h4>Properties & Links</h4>
            <PropsEditor
              properties={observation.props || []}
              isEditing={isEditing}
              onChange={(newProps: Property[]) => handleFieldChange('props', newProps)}
            />
            <div style={{ marginTop: '12px' }}>
              <LinksEditor
                links={observation.links || []}
                readOnly={!isEditing}
                onChange={(newLinks: Link[]) => handleFieldChange('links', newLinks)}
              />
            </div>
          </div>
        </div>

        <div className={styles['editor-panel-footer']}>
          <button type="button" className={styles['btn-secondary']} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
