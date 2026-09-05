import React from 'react';
import styles from '../ARPage.module.css';
import { Finding, Observation, Risk, Property, Link } from '../../../lib/types/oscal';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';

export interface FindingEditorModalProps {
  finding: Finding | null;
  observations?: Observation[];
  risks?: Risk[];
  isEditing: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Finding) => void;
}

export const FindingEditorModal: React.FC<FindingEditorModalProps> = ({
  finding,
  observations = [],
  risks = [],
  isEditing,
  isOpen,
  onClose,
  onUpdate,
}) => {
  if (!isOpen || !finding) return null;

  const handleFieldChange = (field: keyof Finding, value: any) => {
    onUpdate({
      ...finding,
      [field]: value,
    });
  };

  const handleTargetChange = (targetField: string, value: any) => {
    const currentTarget = finding.target || {
      type: 'statement-id',
      'target-id': '',
      status: { state: 'satisfied' },
    };

    if (targetField === 'status-state') {
      onUpdate({
        ...finding,
        target: {
          ...currentTarget,
          status: {
            ...currentTarget.status,
            state: value,
          },
        },
      });
    } else if (targetField === 'status-reason') {
      onUpdate({
        ...finding,
        target: {
          ...currentTarget,
          status: {
            ...currentTarget.status,
            reason: value,
          },
        },
      });
    } else if (targetField === 'implementation-status') {
      onUpdate({
        ...finding,
        target: {
          ...currentTarget,
          'implementation-status': {
            state: value,
          },
        },
      });
    } else {
      onUpdate({
        ...finding,
        target: {
          ...currentTarget,
          [targetField]: value,
        },
      });
    }
  };

  const handleObservationsSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, (option) => ({
      'observation-uuid': option.value,
    }));
    handleFieldChange('related-observations', selected);
  };

  const handleRisksSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, (option) => ({
      'risk-uuid': option.value,
    }));
    handleFieldChange('related-risks', selected);
  };

  const selectedObsUuids = (finding['related-observations'] || []).map(
    (ro) => ro['observation-uuid']
  );
  const selectedRiskUuids = (finding['related-risks'] || []).map(
    (rr) => rr['risk-uuid']
  );

  return (
    <div className={styles['editor-panel-overlay']} role="dialog" aria-modal="true" aria-label="Finding Details">
      <div className={styles['editor-panel']}>
        <div className={styles['editor-panel-header']}>
          <h3>Finding Details</h3>
          <button type="button" className={styles['btn-close']} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles['editor-form']}>
          <div className={styles['form-group']}>
            <label htmlFor="finding-title">Title</label>
            <input
              id="finding-title"
              type="text"
              value={finding.title || ''}
              disabled={!isEditing}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="e.g. Inadequate Account Inactivity Lockout"
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="finding-description">Description</label>
            <textarea
              id="finding-description"
              value={finding.description || ''}
              disabled={!isEditing}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              placeholder="Detailed description of the finding..."
            />
          </div>

          <div className={styles['form-section']}>
            <h4>Target</h4>
            <div className={styles['form-row']}>
              <div className={styles['form-group']}>
                <label htmlFor="finding-target-type">Target Type</label>
                <select
                  id="finding-target-type"
                  value={finding.target?.type || 'statement-id'}
                  disabled={!isEditing}
                  onChange={(e) => handleTargetChange('type', e.target.value)}
                >
                  <option value="objective-id">Objective ID</option>
                  <option value="statement-id">Statement ID</option>
                </select>
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="finding-target-id">Target ID</label>
                <input
                  id="finding-target-id"
                  type="text"
                  value={finding.target?.['target-id'] || ''}
                  disabled={!isEditing}
                  onChange={(e) => handleTargetChange('target-id', e.target.value)}
                  placeholder="e.g. ac-2_smt_a, ac-2_obj_1"
                />
              </div>
            </div>

            <div className={styles['form-row']}>
              <div className={styles['form-group']}>
                <label htmlFor="finding-status-state">Status State</label>
                <select
                  id="finding-status-state"
                  value={finding.target?.status?.state || 'satisfied'}
                  disabled={!isEditing}
                  onChange={(e) => handleTargetChange('status-state', e.target.value)}
                >
                  <option value="satisfied">Satisfied</option>
                  <option value="not-satisfied">Not Satisfied</option>
                </select>
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="finding-impl-status">Implementation Status</label>
                <select
                  id="finding-impl-status"
                  value={finding.target?.['implementation-status']?.state || ''}
                  disabled={!isEditing}
                  onChange={(e) => handleTargetChange('implementation-status', e.target.value)}
                >
                  <option value="">(None)</option>
                  <option value="implemented">Implemented</option>
                  <option value="partial">Partial</option>
                  <option value="planned">Planned</option>
                  <option value="alternative">Alternative</option>
                  <option value="not-applicable">Not Applicable</option>
                </select>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="finding-status-reason">Status Reason</label>
              <input
                id="finding-status-reason"
                type="text"
                value={finding.target?.status?.reason || ''}
                disabled={!isEditing}
                onChange={(e) => handleTargetChange('status-reason', e.target.value)}
                placeholder="e.g. pass, fail, Missing controls"
              />
            </div>
          </div>

          <div className={styles['form-section']}>
            <h4>Relations</h4>
            <div className={styles['form-group']}>
              <label htmlFor="finding-related-observations">Related Observations</label>
              <select
                id="finding-related-observations"
                multiple
                value={selectedObsUuids}
                disabled={!isEditing}
                onChange={handleObservationsSelect}
                className={styles['select-multiple']}
              >
                {observations.map((obs) => (
                  <option key={obs.uuid} value={obs.uuid}>
                    {obs.title ? `${obs.title} (${obs.uuid})` : obs.uuid}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">Hold Ctrl (Cmd on Mac) to select multiple observations.</span>
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="finding-related-risks">Related Risks</label>
              <select
                id="finding-related-risks"
                multiple
                value={selectedRiskUuids}
                disabled={!isEditing}
                onChange={handleRisksSelect}
                className={styles['select-multiple']}
              >
                {risks.map((risk) => (
                  <option key={risk.uuid} value={risk.uuid}>
                    {risk.title ? `${risk.title} (${risk.uuid})` : risk.uuid}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">Hold Ctrl (Cmd on Mac) to select multiple risks.</span>
            </div>
          </div>

          <div className={styles['form-section']}>
            <h4>Properties & Links</h4>
            <PropsEditor
              properties={finding.props || []}
              isEditing={isEditing}
              onChange={(newProps: Property[]) => handleFieldChange('props', newProps)}
            />
            <div style={{ marginTop: '12px' }}>
              <LinksEditor
                links={finding.links || []}
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
