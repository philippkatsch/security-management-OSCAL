import React, { useState, useEffect } from 'react';
import { authFetch } from '../../../lib/api';
import { SystemComponent } from '../../../lib/types/oscal';
import { generateUUID } from '../../../lib/oscal-utils';

export interface CdefImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (components: SystemComponent[], rawComponents?: any[]) => void;
}

export default function CdefImportModal({
  isOpen,
  onClose,
  onImport
}: CdefImportModalProps) {
  const [cdefs, setCdefs] = useState<any[]>([]);
  const [selectedCdefId, setSelectedCdefId] = useState<string>('');
  const [selectedCdefDoc, setSelectedCdefDoc] = useState<any>(null);
  const [selectedCompUuids, setSelectedCompUuids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCdefs();
    } else {
      setSelectedCdefId('');
      setSelectedCdefDoc(null);
      setSelectedCompUuids(new Set());
      setError(null);
    }
  }, [isOpen]);

  const fetchCdefs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/documents/component-definitions');
      if (res.ok) {
        const data = await res.json();
        setCdefs(Array.isArray(data) ? data : []);
      } else {
        // Fallback demo definitions if backend not available in unit test environment
        setCdefs([]);
      }
    } catch (err: any) {
      console.warn('Could not load component definitions from API', err);
      setCdefs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCdef = async (cdefId: string) => {
    setSelectedCdefId(cdefId);
    setSelectedCompUuids(new Set());
    if (!cdefId) {
      setSelectedCdefDoc(null);
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`/api/documents/component-definitions/${cdefId}`);
      if (res.ok) {
        const doc = await res.json();
        setSelectedCdefDoc(doc);
        const components = doc?.['component-definition']?.components || [];
        // Pre-select all by default
        setSelectedCompUuids(new Set(components.map((c: any) => c.uuid)));
      } else {
        setError('Failed to load component definition details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch document');
    } finally {
      setLoading(false);
    }
  };

  const toggleComponent = (uuid: string) => {
    setSelectedCompUuids(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  };

  const handleExecuteImport = () => {
    if (!selectedCdefDoc) return;
    const cdef = selectedCdefDoc['component-definition'];
    const components = cdef?.components || [];
    const chosen = components.filter((c: any) => selectedCompUuids.has(c.uuid));
    const cdefUuid = selectedCdefDoc['component-definition']?.uuid || selectedCdefId;

    const importedComps: SystemComponent[] = chosen.map((c: any) => {
      const existingProps = c.props ? JSON.parse(JSON.stringify(c.props)) : [];
      const existingLinks = c.links ? JSON.parse(JSON.stringify(c.links)) : [];
      return {
        uuid: generateUUID(),
        type: c.type || 'software',
        title: c.title || 'Imported Component',
        description: c.description || c.purpose || 'Imported from Component Definition',
        purpose: c.purpose || '',
        status: { state: 'operational' },
        props: [
          ...existingProps,
          { name: 'source-component-uuid', value: c.uuid }
        ],
        protocols: c.protocols ? JSON.parse(JSON.stringify(c.protocols)) : [],
        links: [
          ...existingLinks,
          {
            rel: 'imported-from',
            href: `../component-definitions/${cdefUuid}.json#${c.uuid}`
          }
        ]
      };
    });

    onImport(importedComps, chosen);
    onClose();
  };


  if (!isOpen) return null;

  const components = selectedCdefDoc?.['component-definition']?.components || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdef-modal-title"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <h2 id="cdef-modal-title" className="text-base font-bold text-gray-900 dark:text-white">
            📦 Import from Component Definition (Stage 3)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && <div className="p-3 bg-red-100 text-red-700 text-xs rounded">{error}</div>}

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Select Workspace Component Definition
            </label>
            <select
              className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              value={selectedCdefId}
              onChange={(e) => handleSelectCdef(e.target.value)}
              disabled={loading}
            >
              <option value="">Choose a Component Definition document...</option>
              {cdefs.map((doc) => (
                <option key={doc.id || doc.uuid} value={doc.id || doc.uuid}>
                  {doc.title || doc.metadata?.title || doc.id || 'Untitled Component Definition'}
                </option>
              ))}
            </select>
          </div>

          {loading && <div className="text-xs text-gray-500 text-center py-4">Loading component definition...</div>}

          {selectedCdefDoc && components.length === 0 && (
            <div className="text-xs text-gray-500 italic p-4 text-center">
              No components found in this Component Definition.
            </div>
          )}

          {selectedCdefDoc && components.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Components in Definition ({components.length})
                </span>
                <span className="text-xs text-gray-500">{selectedCompUuids.size} selected</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {components.map((comp: any) => {
                  const isChecked = selectedCompUuids.has(comp.uuid);
                  return (
                    <div
                      key={comp.uuid}
                      className={`p-3 rounded border cursor-pointer flex items-start gap-3 transition-colors ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => toggleComponent(comp.uuid)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">{comp.title}</span>
                          <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                            {comp.type}
                          </span>
                        </div>
                        {comp.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {comp.description}
                          </div>
                        )}
                        {comp.protocols && comp.protocols.length > 0 && (
                          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                            Protocols: {comp.protocols.map((p: any) => p.name).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2 bg-gray-50 dark:bg-gray-800/60">
          <button
            type="button"
            className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium px-4 py-2 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded"
            disabled={selectedCompUuids.size === 0}
            onClick={handleExecuteImport}
          >
            Import ({selectedCompUuids.size}) Component{selectedCompUuids.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
