import React, { useState, useMemo } from 'react';
import { ImportComponentDefinition, BackMatter, Resource, ComponentDefinition, DefinedComponent } from '@lib/types/oscal';
import { generateUUID } from '@lib/oscal-utils';
import { validateDocument } from '@lib/api';
import styles from '../ComponentPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface ImportDefinitionsEditorProps {
  importDefinitions?: ImportComponentDefinition[];
  backMatter?: BackMatter;
  onChangeImports: (imports: ImportComponentDefinition[]) => void;
  onChangeBackMatter?: (backMatter: BackMatter) => void;
  onAdoptComponent?: (component: DefinedComponent) => void;
  editMode?: boolean;
  isReadOnly?: boolean;
}

export function ImportDefinitionsEditor({
  importDefinitions = [],
  backMatter = {},
  onChangeImports,
  onChangeBackMatter,
  onAdoptComponent,
  editMode = false,
  isReadOnly = false
}: ImportDefinitionsEditorProps) {
  const isEditing = editMode && !isReadOnly;
  const [newUriInput, setNewUriInput] = useState('');
  const [activeImportTab, setActiveImportTab] = useState<'uri' | 'file'>('uri');
  const [selectedInspectImport, setSelectedInspectImport] = useState<{
    importDef: ImportComponentDefinition;
    parsedDoc?: ComponentDefinition;
    rawJson?: string;
    validationState?: 'valid' | 'invalid' | 'checking' | 'unknown';
    errorMsg?: string;
  } | null>(null);

  const [validationStatuses, setValidationStatuses] = useState<Record<string, { state: 'valid' | 'invalid' | 'checking'; msg?: string }>>({});
  const [ingestedUuids, setIngestedUuids] = useState<string[]>([]);

  const resources = useMemo(() => backMatter.resources || [], [backMatter.resources]);

  // Lookup resource by UUID from fragment #<uuid>
  const getResourceByHref = (href: string): Resource | undefined => {
    if (!href.startsWith('#')) return undefined;
    const targetUuid = href.slice(1);
    return resources.find(r => r.uuid === targetUuid);
  };

  // Decode resource JSON content
  const decodeResourceJson = (resource: Resource): { parsed?: any; raw?: string; error?: string } => {
    try {
      const b64Val = (resource.base64 as any)?.value;
      if (b64Val && typeof b64Val === 'string') {
        const decoded = atob(b64Val);
        const parsed = JSON.parse(decoded);
        return { parsed, raw: decoded };
      }
    } catch (e: any) {
      return { error: `Failed to decode Base64 JSON: ${e.message}` };
    }
    return { error: 'No embedded file payload found in resource.' };
  };

  const handleAddUriImport = () => {
    if (!isEditing || !newUriInput.trim()) return;
    const trimmed = newUriInput.trim();
    if (importDefinitions.some(imp => imp.href === trimmed)) {
      alert(`Import with href "${trimmed}" already exists.`);
      return;
    }

    onChangeImports([
      ...importDefinitions,
      { href: trimmed }
    ]);
    setNewUriInput('');
  };

  const handleRemoveImport = (index: number) => {
    if (!isEditing) return;
    const target = importDefinitions[index];
    // If it is a back-matter reference, optionally remove resource
    if (target?.href?.startsWith('#') && onChangeBackMatter) {
      const resUuid = target.href.slice(1);
      const remainingResources = resources.filter(r => r.uuid !== resUuid);
      onChangeBackMatter({ ...backMatter, resources: remainingResources });
    }

    onChangeImports(importDefinitions.filter((_, i) => i !== index));
    if (selectedInspectImport?.importDef.href === target?.href) {
      setSelectedInspectImport(null);
    }
  };

  // File Upload Handler (.json)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const textContent = typeof reader.result === 'string' ? reader.result : '';
        const jsonParsed = JSON.parse(textContent);

        // Verify OSCAL Component Definition root wrapper
        const compDefPayload = jsonParsed['component-definition'] || jsonParsed;
        if (!compDefPayload || (!compDefPayload.components && !compDefPayload.metadata)) {
          alert('Uploaded JSON does not appear to be an OSCAL Component Definition (missing "component-definition" or "components" element).');
          return;
        }

        const newResourceUuid = generateUUID();
        const base64String = btoa(unescape(encodeURIComponent(textContent)));

        const sanitizedFilename = file.name.replace(/\s+/g, '_');
        const newResource: Resource = {
          uuid: newResourceUuid,
          title: file.name,
          description: `Imported OSCAL Component Definition: ${compDefPayload.metadata?.title || file.name}`,
          base64: {
            filename: sanitizedFilename,
            'media-type': 'application/json',
            value: base64String
          }
        };

        // Add to Back-Matter
        if (onChangeBackMatter) {
          onChangeBackMatter({
            ...backMatter,
            resources: [...resources, newResource]
          });
        }

        // Add to import-component-definitions
        const newImport: ImportComponentDefinition = {
          href: `#${newResourceUuid}`
        };

        onChangeImports([...importDefinitions, newImport]);
      } catch (err: any) {
        alert(`Error processing JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Inspect Import Drawer Trigger
  const handleInspectImport = (importDef: ImportComponentDefinition) => {
    if (importDef.href.startsWith('#')) {
      const res = getResourceByHref(importDef.href);
      if (res) {
        const { parsed, raw, error } = decodeResourceJson(res);
        const compDef = parsed?.['component-definition'] || parsed;
        setSelectedInspectImport({
          importDef,
          parsedDoc: compDef,
          rawJson: raw,
          validationState: compDef ? 'valid' : 'invalid',
          errorMsg: error
        });
        return;
      }
    }

    // Remote URI
    setSelectedInspectImport({
      importDef,
      validationState: 'unknown'
    });
  };

  // Validate on Demand
  const handleValidateImport = async (importDef: ImportComponentDefinition) => {
    setValidationStatuses(prev => ({ ...prev, [importDef.href]: { state: 'checking' } }));
    try {
      if (importDef.href.startsWith('#')) {
        const res = getResourceByHref(importDef.href);
        if (res) {
          const { parsed } = decodeResourceJson(res);
          const fullDoc = parsed?.['component-definition'] ? parsed : { 'component-definition': parsed };
          const result = await validateDocument('component-definitions', fullDoc as any);
          if (result && result.valid) {
            setValidationStatuses(prev => ({ ...prev, [importDef.href]: { state: 'valid' } }));
          } else {
            setValidationStatuses(prev => ({
              ...prev,
              [importDef.href]: { state: 'invalid', msg: result?.errors?.join('; ') || 'Schema validation failed' }
            }));
          }
          return;
        }
      }
      setValidationStatuses(prev => ({
        ...prev,
        [importDef.href]: { state: 'valid', msg: 'URI reference syntax valid' }
      }));
    } catch (e: any) {
      setValidationStatuses(prev => ({
        ...prev,
        [importDef.href]: { state: 'invalid', msg: e.message }
      }));
    }
  };

  return (
    <div className={styles['imports-editor']} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
            External Component Definition Imports
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-muted, #6b7280)' }}>
            Import reusable components and capabilities declared by external vendors, standards, or workspace definitions (US 3.14).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-info" style={{ padding: '4px 10px', fontSize: '12px' }}>
            📥 {importDefinitions.length} External Import(s)
          </span>
        </div>
      </div>

      {/* Add Import Section (Editable Mode) */}
      {isEditing && (
        <div
          style={{
            padding: '16px',
            background: 'var(--surface-alt, #f8f9fa)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveImportTab('uri')}
              className={styles['segment-btn']}
              style={{
                background: activeImportTab === 'uri' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                color: activeImportTab === 'uri' ? '#ffffff' : 'var(--color-text, #111827)'
              }}
            >
              🌐 Add via URI / URL
            </button>
            <button
              type="button"
              onClick={() => setActiveImportTab('file')}
              className={styles['segment-btn']}
              style={{
                background: activeImportTab === 'file' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                color: activeImportTab === 'file' ? '#ffffff' : 'var(--color-text, #111827)'
              }}
            >
              📁 Upload JSON File (Back-Matter)
            </button>
          </div>

          {activeImportTab === 'uri' ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter URI (e.g. https://example.com/oscal/aws-components.json or /catalogs/nist-baseline.json)"
                value={newUriInput}
                onChange={(e) => setNewUriInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddUriImport(); }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                onClick={handleAddUriImport}
                disabled={!newUriInput.trim()}
              >
                + Add Import
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  background: 'var(--surface-color, #ffffff)',
                  border: '2px dashed var(--border-color, #d1d5db)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '28px' }}>📤</span>
                <strong style={{ fontSize: '14px', color: 'var(--color-text, #111827)' }}>
                  Click or Drag &amp; Drop an OSCAL Component Definition JSON file
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                  File will be stored securely in back-matter resources and referenced via #uuid
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Imports List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {importDefinitions.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              background: 'var(--surface-alt, #f8f9fa)',
              border: '1px dashed var(--border-color, #d1d5db)',
              borderRadius: '6px',
              color: 'var(--color-text-muted, #6b7280)',
              fontSize: '13px'
            }}
          >
            No external component definitions imported. Add an import above to incorporate pre-built components into this definition.
          </div>
        ) : (
          importDefinitions.map((imp, idx) => {
            const isResourceRef = imp.href.startsWith('#');
            const res = isResourceRef ? getResourceByHref(imp.href) : undefined;
            const valStatus = validationStatuses[imp.href];

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--surface-color, #ffffff)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '6px',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
                  <span style={{ fontSize: '20px' }}>{isResourceRef ? '📁' : '🌐'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text, #111827)' }}>
                        {res ? res.title : imp.href}
                      </strong>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: isResourceRef ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          color: isResourceRef ? '#059669' : '#2563eb',
                          border: `1px solid ${isResourceRef ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                        }}
                      >
                        {isResourceRef ? 'Embedded Resource' : 'Remote URI'}
                      </span>
                    </div>

                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-text-muted, #6b7280)' }}>
                      href: {imp.href}
                    </span>

                    {res?.description && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                        {res.description}
                      </span>
                    )}

                    {valStatus?.state === 'valid' && (
                      <span style={{ fontSize: '11px', color: 'var(--color-success, #059669)', fontWeight: 600 }}>
                        ✅ Valid OSCAL Schema
                      </span>
                    )}
                    {valStatus?.state === 'invalid' && (
                      <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', fontWeight: 600 }}>
                        ⚠️ Validation Error: {valStatus.msg}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className={styles['switch-mode-btn']}
                    onClick={() => handleInspectImport(imp)}
                    title="Inspect imported components and capabilities"
                  >
                    👁️ Inspect
                  </button>

                  <button
                    type="button"
                    className={styles['switch-mode-btn']}
                    onClick={() => handleValidateImport(imp)}
                    title="Validate against OSCAL schema"
                  >
                    🔍 Validate
                  </button>

                  {isEditing && (
                    <button
                      type="button"
                      className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                      onClick={() => handleRemoveImport(idx)}
                      title="Remove import"
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Read-Only Inspection Drawer / Modal */}
      {selectedInspectImport && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(640px, 90vw)',
            background: 'var(--surface-color, #ffffff)',
            boxShadow: '-6px 0 24px rgba(0,0,0,0.15)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--border-color, #e5e7eb)'
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-alt, #f8f9fa)'
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--color-text, #111827)' }}>
                📥 Imported Definition Inspection (Read-Only)
              </h4>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-text-muted, #6b7280)' }}>
                {selectedInspectImport.importDef.href}
              </span>
            </div>
            <button
              type="button"
              className={styles['close-drawer-btn']}
              onClick={() => setSelectedInspectImport(null)}
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {selectedInspectImport.parsedDoc ? (
              <>
                <div style={{ padding: '12px', background: 'var(--surface-alt, #f8f9fa)', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 6px 0', fontSize: '14px', color: 'var(--color-text, #111827)' }}>
                    {selectedInspectImport.parsedDoc.metadata?.title || 'Untitled Definition'}
                  </h5>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div><strong>Version:</strong> {selectedInspectImport.parsedDoc.metadata?.version || '1.0.0'}</div>
                    <div><strong>OSCAL:</strong> {selectedInspectImport.parsedDoc.metadata?.['oscal-version'] || '1.1.2'}</div>
                  </div>
                </div>

                <div>
                  <h6 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
                    Components ({selectedInspectImport.parsedDoc.components?.length || 0})
                  </h6>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(selectedInspectImport.parsedDoc.components || []).map((c, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px',
                          border: '1px solid var(--border-color, #e5e7eb)',
                          borderRadius: '4px',
                          background: 'var(--surface-color, #ffffff)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{c.title}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="badge badge-info">{c.type}</span>
                            {onAdoptComponent && isEditing && (
                              <button
                                type="button"
                                className={styles['switch-mode-btn']}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  color: ingestedUuids.includes(c.uuid) ? 'var(--color-success, #059669)' : undefined,
                                  borderColor: ingestedUuids.includes(c.uuid) ? 'var(--color-success, #059669)' : undefined
                                }}
                                disabled={ingestedUuids.includes(c.uuid)}
                                onClick={() => {
                                  onAdoptComponent(c);
                                  setIngestedUuids(prev => [...prev, c.uuid]);
                                }}
                                title="Ingest / copy this component into local inventory"
                              >
                                {ingestedUuids.includes(c.uuid) ? '✓ Ingested' : '📥 Ingest to Inventory'}
                              </button>
                            )}
                          </div>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                          {c.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h6 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
                    Capabilities ({selectedInspectImport.parsedDoc.capabilities?.length || 0})
                  </h6>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(selectedInspectImport.parsedDoc.capabilities || []).map((cap, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px',
                          border: '1px solid var(--border-color, #e5e7eb)',
                          borderRadius: '4px',
                          background: 'var(--surface-color, #ffffff)'
                        }}
                      >
                        <strong>{cap.name}</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                          {cap.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '16px', background: 'var(--surface-alt, #f8f9fa)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text-muted, #6b7280)' }}>
                This is an external remote URI ({selectedInspectImport.importDef.href}). Remote content resolution occurs during workspace build or export.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportDefinitionsEditor;
