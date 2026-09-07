import React, { useState, useEffect } from 'react';
import { fetchDocuments } from '../../../lib/api';
import type { DocumentSummary } from '../../../lib/types/api';
import styles from '../ARPage.module.css';

export interface APBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAP: (href: string, remarks?: string) => void;
  currentHref?: string;
  currentRemarks?: string;
}

export const APBrowserModal: React.FC<APBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelectAP,
  currentHref = '',
  currentRemarks = '',
}) => {
  const [aps, setAps] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHref, setSelectedHref] = useState(currentHref);
  const [remarks, setRemarks] = useState(currentRemarks);
  const [customHref, setCustomHref] = useState('');
  const [activeMode, setActiveMode] = useState<'workspace' | 'custom'>('workspace');

  useEffect(() => {
    if (isOpen) {
      setSelectedHref(currentHref);
      setRemarks(currentRemarks);
      setLoading(true);
      setError(null);
      fetchDocuments('assessment-plans')
        .then((docs) => {
          setAps(docs || []);
        })
        .catch((err) => {
          console.error('Failed to load AP documents:', err);
          setError('Could not load workspace Assessment Plans.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, currentHref, currentRemarks]);

  if (!isOpen) return null;

  const filteredAps = aps.filter((a) => {
    const plan = (a as any)['assessment-plan'] || a;
    const planId = plan.uuid || plan.id || a.id || '';
    const planTitle = plan.metadata?.title || a.title || 'Untitled AP';
    const term = searchTerm.toLowerCase();
    return (
      planTitle.toLowerCase().includes(term) ||
      planId.toLowerCase().includes(term)
    );
  });

  const handleConfirm = () => {
    const finalHref = activeMode === 'custom' ? customHref.trim() : selectedHref.trim();
    if (finalHref) {
      onSelectAP(finalHref, remarks.trim() || undefined);
      onClose();
    }
  };

  return (
    <div
      className={styles['modal-overlay']}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ap-browser-title"
    >
      <div className={styles['modal-container']}>
        {/* Modal Header */}
        <div className={styles['modal-header']}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 id="ap-browser-title" className={styles['modal-title']}>
              Select Target Assessment Plan (AP)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles['btn-close']}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher */}
        <div className={styles['modal-tab-bar']}>
          <button
            type="button"
            onClick={() => setActiveMode('workspace')}
            className={`${styles['modal-tab-btn']} ${activeMode === 'workspace' ? styles['active'] : ''}`}
          >
            Workspace Plans ({aps.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('custom')}
            className={`${styles['modal-tab-btn']} ${activeMode === 'custom' ? styles['active'] : ''}`}
          >
            Custom URI / Relative Path
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles['modal-body']}>
          {activeMode === 'workspace' ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Search plans by title or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles['modal-input']}
              />

              {loading ? (
                <div className={styles['empty-hint']}>Loading assessment plans...</div>
              ) : error ? (
                <div className="text-sm text-red-400">{error}</div>
              ) : filteredAps.length === 0 ? (
                <div className={styles['empty-hint']}>
                  No Assessment Plans found in active workspace.
                </div>
              ) : (
                <div className={styles['modal-card-list']}>
                  {filteredAps.map((ap) => {
                    const plan = (ap as any)['assessment-plan'] || ap;
                    const planId = plan.uuid || plan.id || ap.id;
                    const planTitle = plan.metadata?.title || ap.title || 'Untitled AP';
                    const planVersion = plan.metadata?.version || ap.version || '1.0';
                    const apHref = `#${planId}`;
                    const isSelected = selectedHref === apHref || selectedHref === planId || selectedHref === ap.id;
                    return (
                      <button
                        key={planId}
                        type="button"
                        onClick={() => setSelectedHref(apHref)}
                        className={`${styles['modal-card-btn']} ${isSelected ? styles['active'] : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-semibold text-slate-100">{planTitle}</span>
                          <span className="text-xs text-slate-400">v{planVersion}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400 font-mono">
                          UUID: {planId}
                        </div>
                        <div className="mt-0.5 text-xs text-indigo-400">
                          Target URI: {apHref}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label htmlFor="custom-ap-href" className="text-sm font-medium text-slate-300">
                Custom Assessment Plan URI or Relative Path
              </label>
              <input
                id="custom-ap-href"
                type="text"
                placeholder="e.g. #8f5a2b1c-..., ../assessment-plans/plan.json"
                value={customHref}
                onChange={(e) => setCustomHref(e.target.value)}
                className={styles['modal-input']}
              />
              <span className="text-xs text-slate-400">
                Supports internal fragments (<code>#uuid</code>) or workspace relative file paths.
              </span>
            </div>
          )}

          {/* Remarks input */}
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="ap-import-remarks" className="text-xs font-medium text-slate-400">
              Import Remarks / Context (Optional)
            </label>
            <input
              id="ap-import-remarks"
              type="text"
              placeholder="e.g. Assessment Plan for FY26 Comprehensive Evaluation"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={styles['modal-input']}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles['modal-footer']}>
          <button
            type="button"
            onClick={onClose}
            className={styles['btn-secondary']}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={activeMode === 'custom' ? !customHref.trim() : !selectedHref.trim()}
            className={styles['btn-primary']}
          >
            Link Assessment Plan
          </button>
        </div>
      </div>
    </div>
  );
};
