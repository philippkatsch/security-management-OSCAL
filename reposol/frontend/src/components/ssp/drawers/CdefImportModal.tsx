import React, { useState, useEffect } from 'react';
import { authFetch } from '../../../lib/api';
import { SystemComponent } from '../../../lib/types/oscal';
import { generateUUID } from '../../../lib/oscal-utils';

export interface CdefImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (components: SystemComponent[], rawEntities?: any[]) => void;
  onImportComponents?: (components: SystemComponent[], rawEntities?: any[]) => void;
}

export default function CdefImportModal({
  isOpen,
  onClose,
  onImport,
  onImportComponents
}: CdefImportModalProps) {
  const [cdefs, setCdefs] = useState<any[]>([]);
  const [selectedCdefId, setSelectedCdefId] = useState<string>('');
  const [selectedCdefDoc, setSelectedCdefDoc] = useState<any>(null);
  const [selectedCompUuids, setSelectedCompUuids] = useState<Set<string>>(new Set());
  const [selectedCapUuids, setSelectedCapUuids] = useState<Set<string>>(new Set());
  const [filterSection, setFilterSection] = useState<'all' | 'components' | 'capabilities'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCdefs();
    } else {
      setSelectedCdefId('');
      setSelectedCdefDoc(null);
      setSelectedCompUuids(new Set());
      setSelectedCapUuids(new Set());
      setFilterSection('all');
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
    setSelectedCapUuids(new Set());
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
        const cdef = (doc as any)?.['component-definition'] || doc;
        const components = cdef?.components || [];
        const capabilities = cdef?.capabilities || [];
        // Pre-select all by default
        setSelectedCompUuids(new Set(components.map((c: any) => c.uuid)));
        setSelectedCapUuids(new Set(capabilities.map((cap: any) => cap.uuid)));
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

  const toggleCapability = (uuid: string) => {
    setSelectedCapUuids(prev => {
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
    const cdef = (selectedCdefDoc as any)['component-definition'] || selectedCdefDoc;
    const components = cdef?.components || [];
    const capabilities = cdef?.capabilities || [];
    const chosenComps = components.filter((c: any) => selectedCompUuids.has(c.uuid));
    const chosenCaps = capabilities.filter((cap: any) => selectedCapUuids.has(cap.uuid));
    const cdefUuid = cdef?.uuid || cdef?.id || selectedCdefDoc.uuid || selectedCdefDoc.id || selectedCdefId;

    const rawComps: SystemComponent[] = chosenComps.map((c: any) => {
      const existingProps = c.props ? JSON.parse(JSON.stringify(c.props)) : [];
      const existingLinks = c.links ? JSON.parse(JSON.stringify(c.links)) : [];
      return {
        uuid: generateUUID(),
        type: c.type || 'software',
        title: c.title || 'Imported Component',
        description: (c.description && String(c.description).trim()) || c.purpose || 'Imported from Component Definition',
        purpose: c.purpose || '',
        status: { state: 'operational' as const },
        props: [
          ...existingProps,
          { name: 'source-component-uuid', value: c.uuid }
        ],
        ...(Array.isArray(c.protocols) && c.protocols.length > 0
          ? { protocols: JSON.parse(JSON.stringify(c.protocols)) }
          : {}),
        links: [
          ...existingLinks,
          {
            rel: 'imported-from',
            href: `../component-definitions/${cdefUuid}.json#${c.uuid}`
          }
        ]
      };
    });

    const importedCaps: SystemComponent[] = chosenCaps.map((cap: any) => {
      const existingProps = cap.props ? JSON.parse(JSON.stringify(cap.props)) : [];
      const existingLinks = cap.links ? JSON.parse(JSON.stringify(cap.links)) : [];
      return {
        uuid: generateUUID(),
        type: 'service' as const,
        title: cap.name || 'Imported Capability',
        description: cap.description || 'Imported Capability from Component Definition',
        purpose: cap.description ? (cap.description.length > 80 ? cap.description.slice(0, 80) + '...' : cap.description) : '',
        status: { state: 'operational' as const },
        props: [
          ...existingProps,
          { name: 'source-capability-uuid', value: cap.uuid },
          { name: 'is-capability', value: 'true' }
        ],
        links: [
          ...existingLinks,
          {
            rel: 'imported-from',
            href: `../component-definitions/${cdefUuid}.json#${cap.uuid}`
          }
        ]
      };
    });

    const importedComps = [...rawComps, ...importedCaps];
    const chosen = [...chosenComps, ...chosenCaps];

    if (onImport) {
      onImport(importedComps, chosen);
    } else if (onImportComponents) {
      onImportComponents(importedComps, chosen);
    }
    onClose();
  };

  if (!isOpen) return null;

  const activeCdef = selectedCdefDoc ? ((selectedCdefDoc as any)['component-definition'] || selectedCdefDoc) : null;
  const components = activeCdef?.components || [];
  const capabilities = activeCdef?.capabilities || [];
  const totalSelected = selectedCompUuids.size + selectedCapUuids.size;

  const getImportButtonLabel = () => {
    if (selectedCapUuids.size === 0) {
      return `Import (${selectedCompUuids.size}) Component${selectedCompUuids.size !== 1 ? 's' : ''}`;
    }
    if (selectedCompUuids.size === 0) {
      return `Import (${selectedCapUuids.size}) Capabilit${selectedCapUuids.size !== 1 ? 'ies' : 'y'}`;
    }
    return `Import (${totalSelected}) Item${totalSelected !== 1 ? 's' : ''} (${selectedCompUuids.size} comp, ${selectedCapUuids.size} cap)`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdef-modal-title"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div>
            <h2 id="cdef-modal-title" className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>📦</span> Import from Component Definition (Stage 3)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Import reusable Components and composite Capabilities along with their control implementations.
            </p>
          </div>
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
              {cdefs.map((rawDoc: any, idx: number) => {
                const cdef = (rawDoc as any)['component-definition'] || rawDoc;
                const docId = cdef.uuid || cdef.id || rawDoc.uuid || rawDoc.id;
                const docTitle = cdef.metadata?.title || cdef.title || rawDoc.title || 'Untitled Component Definition';
                return (
                  <option key={docId || idx} value={docId || ''}>
                    {docTitle}
                  </option>
                );
              })}
            </select>
          </div>

          {loading && <div className="text-xs text-gray-500 text-center py-4">Loading component definition...</div>}

          {selectedCdefDoc && components.length === 0 && capabilities.length === 0 && (
            <div className="text-xs text-gray-500 italic p-4 text-center">
              No components or capabilities found in this Component Definition.
            </div>
          )}

          {selectedCdefDoc && (components.length > 0 || capabilities.length > 0) && (
            <div className="space-y-3">
              {/* Category Filter Pills */}
              <div className="flex items-center justify-between border-b pb-2 dark:border-gray-800">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                      filterSection === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                    onClick={() => setFilterSection('all')}
                  >
                    All ({components.length + capabilities.length})
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                      filterSection === 'components'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                    onClick={() => setFilterSection('components')}
                  >
                    🧱 Components ({components.length})
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                      filterSection === 'capabilities'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                    onClick={() => setFilterSection('capabilities')}
                  >
                    ⚡ Capabilities ({capabilities.length})
                  </button>
                </div>
                <span className="text-xs text-gray-500">{totalSelected} selected</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {/* 1. Components List */}
                {(filterSection === 'all' || filterSection === 'components') && components.map((comp: any) => {
                  const isChecked = selectedCompUuids.has(comp.uuid);
                  const implSets = comp['control-implementations'] || [];
                  const totalControls = implSets.reduce(
                    (acc: number, ci: any) => acc + (ci['implemented-requirements']?.length || 0),
                    0
                  );

                  return (
                    <div
                      key={comp.uuid}
                      className={`p-3 rounded border cursor-pointer flex items-start gap-3 transition-colors ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== 'INPUT') {
                          toggleComponent(comp.uuid);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleComponent(comp.uuid)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">{comp.title}</span>
                          <span className="text-[11px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
                            🧱 {comp.type}
                          </span>
                          {totalControls > 0 && (
                            <span className="text-[11px] bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                              🔒 {totalControls} control{totalControls !== 1 ? 's' : ''}
                            </span>
                          )}
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

                {/* 2. Capabilities List */}
                {(filterSection === 'all' || filterSection === 'capabilities') && capabilities.map((cap: any) => {
                  const isChecked = selectedCapUuids.has(cap.uuid);
                  const incorpComps = cap['incorporates-components'] || [];
                  const implSets = cap['control-implementations'] || [];
                  const totalControls = implSets.reduce(
                    (acc: number, ci: any) => acc + (ci['implemented-requirements']?.length || 0),
                    0
                  );

                  return (
                    <div
                      key={cap.uuid}
                      className={`p-3 rounded border cursor-pointer flex items-start gap-3 transition-colors ${
                        isChecked
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== 'INPUT') {
                          toggleCapability(cap.uuid);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCapability(cap.uuid)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">{cap.name}</span>
                          <span className="text-[11px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-mono font-medium">
                            ⚡ Capability
                          </span>
                          {totalControls > 0 && (
                            <span className="text-[11px] bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                              🔒 {totalControls} control{totalControls !== 1 ? 's' : ''}
                            </span>
                          )}
                          {incorpComps.length > 0 && (
                            <span className="text-[11px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                              🧱 {incorpComps.length} building block{incorpComps.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {cap.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {cap.description}
                          </div>
                        )}
                        {incorpComps.length > 0 && (
                          <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-1">
                            Incorporates: {incorpComps.map((inc: any) => {
                              const found = components.find((c: any) => c.uuid === inc['component-uuid']);
                              return found?.title || inc['component-uuid'];
                            }).join(', ')}
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

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {totalSelected > 0 ? `${totalSelected} selected for SSP instantiation` : 'Select components or capabilities to import'}
          </span>
          <div className="flex gap-2">
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
              disabled={totalSelected === 0}
              onClick={handleExecuteImport}
            >
              {getImportButtonLabel()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
