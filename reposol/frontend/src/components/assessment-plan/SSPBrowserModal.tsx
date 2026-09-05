import React, { useState, useEffect } from 'react';
import { fetchDocuments } from '../../lib/api';
import type { DocumentSummary } from '../../lib/types/api';
import styles from './APPage.module.css';

export interface SSPBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSSP: (href: string, remarks?: string) => void;
  currentHref?: string;
  currentRemarks?: string;
}

export const SSPBrowserModal: React.FC<SSPBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelectSSP,
  currentHref = '',
  currentRemarks = '',
}) => {
  const [ssps, setSsps] = useState<DocumentSummary[]>([]);
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
      fetchDocuments('ssps')
        .then((docs) => {
          setSsps(docs || []);
        })
        .catch((err) => {
          console.error('Failed to load SSP documents:', err);
          setError('Could not load workspace SSP documents.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, currentHref, currentRemarks]);

  if (!isOpen) return null;

  const filteredSsps = ssps.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      (s.title || '').toLowerCase().includes(term) ||
      (s.id || '').toLowerCase().includes(term)
    );
  });

  const handleConfirm = () => {
    const finalHref = activeMode === 'custom' ? customHref.trim() : selectedHref.trim();
    if (finalHref) {
      onSelectSSP(finalHref, remarks.trim() || undefined);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ssp-browser-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h3 id="ssp-browser-title" className="text-lg font-semibold text-slate-100">
              Select Target System Security Plan (SSP)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-3">
          <button
            type="button"
            onClick={() => setActiveMode('workspace')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeMode === 'workspace'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Workspace SSPs ({ssps.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('custom')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeMode === 'custom'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Custom URI / Relative Path
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeMode === 'workspace' ? (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Search SSPs by title or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />

              {loading && (
                <div className="py-8 text-center text-sm text-slate-400">
                  <span className="inline-block animate-spin mr-2">⏳</span> Loading workspace SSPs...
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-400 border border-red-800">
                  {error}
                </div>
              )}

              {!loading && filteredSsps.length === 0 && !error && (
                <div className="py-8 text-center text-sm text-slate-400">
                  {ssps.length === 0
                    ? 'No System Security Plans found in workspace.'
                    : 'No SSPs match the search query.'}
                </div>
              )}

              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredSsps.map((s) => {
                  const sspHref = `../system-security-plans/${s.id}.json`;
                  const isSelected = selectedHref === sspHref || selectedHref === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedHref(sspHref)}
                      className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500'
                          : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-100">{s.title || 'Untitled SSP'}</div>
                        <span className="text-xs rounded bg-slate-800 px-2 py-0.5 text-slate-400">
                          v{s.version || '1.0.0'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span>ID: <code className="text-slate-300">{s.id}</code></span>
                        {((s as any).lastModified || (s as any).last_modified) && (
                          <span>Modified: {new Date((s as any).lastModified || (s as any).last_modified).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">
                  Target SSP URI / Path:
                </label>
                <input
                  type="text"
                  placeholder="../system-security-plans/example-ssp-uuid.json or https://..."
                  value={customHref}
                  onChange={(e) => setCustomHref(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Specify a relative workspace URI (e.g. <code>../system-security-plans/&#123;uuid&#125;.json</code>) or an external HTTPS URL.
                </p>
              </div>
            </div>
          )}

          {/* Remarks input */}
          <div className="mt-5 border-t border-slate-800 pt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">
              Import Mandate / Remarks (Optional):
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Formal FedRAMP Annual Security Assessment baseline..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={activeMode === 'workspace' ? !selectedHref : !customHref.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Link Target SSP
          </button>
        </div>
      </div>
    </div>
  );
};
