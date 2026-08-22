import React, { useState } from 'react';
import { useDocumentListQuery } from '../../hooks/useDocumentQuery';
import { fetchDocument } from '../../lib/api';
import { OscalDocument, AssessmentResults, Finding, Observation, Risk, POAMItem } from '../../lib/types/oscal';
import { toast } from 'react-hot-toast';
import styles from './POAMPage.module.css';

const generateUUID = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));

export interface ARFindingsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: POAMItem[], observations: Observation[], risks: Risk[]) => void;
}

export function ARFindingsImportModal({ isOpen, onClose, onImport }: ARFindingsImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedArId, setSelectedArId] = useState<string | null>(null);
  const [selectedArDoc, setSelectedArDoc] = useState<AssessmentResults | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [selectedFindingUuids, setSelectedFindingUuids] = useState<string[]>([]);
  const [itemPriorities, setItemPriorities] = useState<Record<string, string>>({});

  const { data: arList = [], isLoading: isLoadingList } = useDocumentListQuery('assessment-results');

  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedArId(null);
      setSelectedArDoc(null);
      setSelectedFindingUuids([]);
      setItemPriorities({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAR = async (arId: string) => {
    setSelectedArId(arId);
    setLoadingDoc(true);
    try {
      const fullDoc: OscalDocument = await fetchDocument('assessment-results', arId);
      const ar = fullDoc['assessment-results'];
      setSelectedArDoc(ar || null);

      // Extract unsatisfied findings
      const unsatisfied = (ar?.results || []).flatMap((r: any) => r.findings || []).filter((f: Finding) => {
        const target = f.target as any;
        const state = typeof target?.status === 'string' ? target.status : target?.status?.state;
        return state === 'not-satisfied';
      });
      setSelectedFindingUuids(unsatisfied.map((f: Finding) => f.uuid));
      setStep(2);
    } catch (err: any) {
      toast.error(`Failed to load AR document: ${err.message || err}`);
    } finally {
      setLoadingDoc(false);
    }
  };

  const allFindings: Finding[] = (selectedArDoc?.results || []).flatMap((r: any) => r.findings || []);
  const unsatisfiedFindings = allFindings.filter((f: Finding) => {
    const target = f.target as any;
    const state = typeof target?.status === 'string' ? target.status : target?.status?.state;
    return state === 'not-satisfied';
  });

  const allObs: Observation[] = (selectedArDoc?.results || []).flatMap((r: any) => r.observations || []);
  const allRisks: Risk[] = (selectedArDoc?.results || []).flatMap((r: any) => r.risks || []);

  const handleToggleFinding = (uuid: string) => {
    setSelectedFindingUuids(prev =>
      prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]
    );
  };

  const handleSelectAll = () => {
    if (selectedFindingUuids.length === unsatisfiedFindings.length) {
      setSelectedFindingUuids([]);
    } else {
      setSelectedFindingUuids(unsatisfiedFindings.map(f => f.uuid));
    }
  };

  const handleConfirmImport = () => {
    const chosenFindings = unsatisfiedFindings.filter(f => selectedFindingUuids.includes(f.uuid));

    // Collect linked observation and risk UUIDs
    const linkedObsUuids = new Set(
      chosenFindings.flatMap(f => (f['related-observations'] || []).map((o: any) => o['observation-uuid']))
    );
    const linkedRiskUuids = new Set(
      chosenFindings.flatMap(f => (f['related-risks'] || []).map((r: any) => r['risk-uuid']))
    );

    const importedObs = allObs.filter(o => linkedObsUuids.has(o.uuid));
    const importedRisks = allRisks.filter(r => linkedRiskUuids.has(r.uuid));

    const generatedItems: POAMItem[] = chosenFindings.map(f => {
      const priority = itemPriorities[f.uuid] || '2';
      const item: any = {
        uuid: generateUUID(),
        title: `Remediate: ${f.title}`,
        description: f.description || `Automated remediation item for unsatisfied finding: ${f.title}`,
        'related-findings': [{ 'finding-uuid': f.uuid }],
        'related-observations': f['related-observations'] || [],
        'related-risks': f['related-risks'] || [],
        props: [
          { name: 'priority', value: priority },
          { name: 'status', value: 'open' },
          { name: 'origin-ar-id', value: selectedArId || '' }
        ]
      };
      return item as POAMItem;
    });

    onImport(generatedItems, importedObs, importedRisks);
    onClose();
  };

  return (
    <div className={styles['import-modal-overlay']} data-testid="ar-import-modal-overlay">
      <div className={styles['import-modal-dialog']} data-testid="ar-import-modal">
        <div className={styles['import-modal-header']}>
          <h3>Import Findings from Assessment Results</h3>
          <button className={styles['close-btn']} onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* Wizard Stepper */}
        <div className={styles['wizard-stepper']}>
          <div className={`${styles['stepper-step']} ${step >= 1 ? styles['active'] : ''}`}>1. Select AR</div>
          <div className={`${styles['stepper-step']} ${step >= 2 ? styles['active'] : ''}`}>2. Filter Findings</div>
          <div className={`${styles['stepper-step']} ${step >= 3 ? styles['active'] : ''}`}>3. Preview & Confirm</div>
        </div>

        <div className={styles['import-modal-body']}>
          {step === 1 && (
            <div className={styles['ar-selection-step']}>
              <p style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                Select an Assessment Results document from your workspace to import unsatisfied findings:
              </p>
              {isLoadingList ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>Loading Assessment Results...</div>
              ) : arList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No Assessment Results documents found in workspace.
                </div>
              ) : (
                <div className={styles['ar-doc-grid']}>
                  {arList.map(doc => (
                    <div
                      key={doc.id}
                      className={`${styles['ar-doc-card']} ${selectedArId === doc.id ? styles['selected'] : ''}`}
                      onClick={() => handleSelectAR(doc.id)}
                      data-testid={`ar-doc-card-${doc.id}`}
                    >
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>{doc.title}</h4>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        ID: {doc.id.substring(0, 8)}... | Ver: {doc.version || '1.0'}
                      </p>
                      <span className={styles['select-badge']}>
                        {loadingDoc && selectedArId === doc.id ? 'Loading...' : 'Click to Select'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className={styles['findings-filter-step']}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Found {unsatisfiedFindings.length} Unsatisfied Finding(s)
                </span>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                  onClick={handleSelectAll}
                >
                  {selectedFindingUuids.length === unsatisfiedFindings.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {unsatisfiedFindings.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No unsatisfied findings found in selected AR.
                </div>
              ) : (
                <div className={styles['findings-table-wrapper']}>
                  <table className={styles['findings-table']}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Title</th>
                        <th>Target ID</th>
                        <th>Linked Obs</th>
                        <th>Linked Risks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unsatisfiedFindings.map(f => (
                        <tr key={f.uuid}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedFindingUuids.includes(f.uuid)}
                              onChange={() => handleToggleFinding(f.uuid)}
                              data-testid={`finding-checkbox-${f.uuid}`}
                            />
                          </td>
                          <td style={{ fontWeight: 500 }}>{f.title}</td>
                          <td><code>{(f.target as any)?.['target-id'] || 'N/A'}</code></td>
                          <td>{(f['related-observations'] || []).length}</td>
                          <td>{(f['related-risks'] || []).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className={styles['preview-step']}>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                The following {selectedFindingUuids.length} POA&M item(s) will be generated. You can customize priorities before importing:
              </p>
              <div className={styles['preview-list']}>
                {unsatisfiedFindings.filter(f => selectedFindingUuids.includes(f.uuid)).map(f => (
                  <div key={f.uuid} className={styles['preview-item-card']}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>Remediate: {f.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {f.description ? (f.description.length > 90 ? `${f.description.substring(0, 90)}...` : f.description) : 'No description'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 500 }}>Priority:</label>
                      <select
                        value={itemPriorities[f.uuid] || '2'}
                        onChange={e => setItemPriorities({ ...itemPriorities, [f.uuid]: e.target.value })}
                        style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                      >
                        <option value="1">P1 - Critical</option>
                        <option value="2">P2 - High</option>
                        <option value="3">P3 - Medium</option>
                        <option value="4">P4 - Low</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles['import-modal-footer']}>
          {step > 1 && (
            <button
              type="button"
              className={styles['btn-secondary']}
              onClick={() => setStep((step - 1) as 1 | 2)}
            >
              Back
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className={styles['btn-primary']}
              disabled={selectedFindingUuids.length === 0}
              onClick={() => setStep(3)}
              data-testid="btn-next-preview"
            >
              Next: Preview ({selectedFindingUuids.length})
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className={styles['btn-primary']}
              onClick={handleConfirmImport}
              data-testid="btn-confirm-import"
            >
              Import Selected Items
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
