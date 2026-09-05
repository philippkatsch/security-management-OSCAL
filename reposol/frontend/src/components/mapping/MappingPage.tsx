import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './MappingPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';

import { fetchDocument } from '@lib/api';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentActions } from '@hooks/useDocumentActions';
import {
  updateResourceReference,
  addMapEntry,
  updateMapEntry,
  removeMapEntry,
  deleteMapEntries,
  batchSetRelationship,
  replaceMappingCollection,
  updateMappingRoot,
  updateMappingProvenance
} from '@lib/document-actions/mapping-actions';
import { MappingRelationship, MappingMethod, MappingMatchingRationale } from '@lib/types/oscal';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';

import { MetadataEditor } from '@components/shared/MetadataEditor';
import { JsonEditor } from '@components/shared/JsonEditor';
import { PropsEditor } from '@components/shared/PropsEditor';
import { BackMatterEditor } from '@components/shared/BackMatterEditor';
import { LinksEditor } from '@components/shared/LinksEditor';

import StatusBadge from '@components/shared/status/StatusBadge';
import EntityTable from '@components/shared/entity/EntityTable';
import EntityDetailPanel from '@components/shared/entity/EntityDetailPanel';
import MetricCard from '@components/shared/dashboard/MetricCard';
import MetricCardGrid from '@components/shared/dashboard/MetricCardGrid';
import ProgressBar from '@components/shared/dashboard/ProgressBar';
import StatusBreakdown from '@components/shared/dashboard/StatusBreakdown';
import CompletenessReport from '@components/shared/dashboard/CompletenessReport';
import { SankeyDiagram } from './SankeyDiagram';
import { useConfirm } from '@hooks/useConfirm';
import { toast } from 'react-hot-toast';

export interface MappingPageProps {
  mappingId?: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export function MappingPage({ mappingId = '', initialEditMode = false, onClose }: MappingPageProps) {
  const lifecycle = useDocumentLifecycle('control-mappings', 'mapping-collection', mappingId, initialEditMode);
  const { confirm } = useConfirm();
  const {
    activeDoc,
    isEditing,
  } = lifecycle;
  const { dispatch } = useDocumentActions(lifecycle);

  const [activeTab, setActiveTab] = useState('overview');
  
  // Master lists
  const [sourceControls, setSourceControls] = useState<any[]>([]);
  const [targetControls, setTargetControls] = useState<any[]>([]);

  // Mapping selections
  const [selectedMappingIdx, setSelectedMappingIdx] = useState(0);
  
  // Selection states for mappings detail
  const [selectedMapEntry, setSelectedMapEntry] = useState<any>(null);
  const [selectedMaps, setSelectedMaps] = useState([]);
  const [matrixFilter, setMatrixFilter] = useState('all');
  const jsonEditorRef = useRef<any>(null);

  const updateResourceField = (resourceKey: 'source-resource' | 'target-resource', field: string, value: any) => {
    dispatch(updateResourceReference(resourceKey, { [field]: value } as any));
  };

  // Load referenced controls when doc changes
  useEffect(() => {
    if (activeDoc) {
      loadReferencedControls(activeDoc['mapping-collection']);
    }
  }, [activeDoc]);

  const loadReferencedControls = async (mappingCollection) => {
    if (!mappingCollection) return;
    const mappings = mappingCollection.mappings?.[0] || {};
    if (mappings['source-resource']) {
      fetchControlsForResource(mappings['source-resource'], setSourceControls);
    }
    if (mappings['target-resource']) {
      fetchControlsForResource(mappings['target-resource'], setTargetControls);
    }
  };

  const fetchControlsForResource = async (resource, setter) => {
    if (!resource?.href) {
      setter([]);
      return;
    }
    const match = resource.href.match(/([a-f0-9-]{36})/i);
    if (!match) {
      setter([]);
      return;
    }
    const uuid = match[1];
    const stage = resource.type === 'catalog' ? 'catalogs' : 'profiles';
    try {
      const docData = await fetchDocument(stage, uuid);
      if (docData) {
        const controls: any[] = [];
        const traverse = (item: any) => {
          if (item.controls) {
            item.controls.forEach(c => {
              controls.push({ id: c.id, title: c.title, group: item.title || 'Ungrouped' });
              if (c.controls) c.controls.forEach(sub => traverse(sub));
            });
          }
          if (item.groups) {
            item.groups.forEach(g => traverse(g));
          }
        };
        const root = docData[resource.type === 'catalog' ? 'catalog' : 'profile'];
        if (root) {
          traverse(root);
        }
        setter(controls);
      }
    } catch (e) {
      setter([]);
    }
  };

  const getCleanDocCopy = (prev) => {
    if (!prev) return prev;
    return produce(prev, draft => {
      if (draft['control-mapping'] && !draft['mapping-collection']) {
        draft['mapping-collection'] = draft['control-mapping'];
        delete draft['control-mapping'];
      }
      if (!draft['mapping-collection']) {
        draft['mapping-collection'] = { mappings: [{ maps: [] }] };
      }
      const mc = draft['mapping-collection'];
      if (!Array.isArray(mc.mappings) || mc.mappings.length === 0) {
        mc.mappings = [{ maps: [] }];
      }
      if (!mc.mappings[0].maps) {
        mc.mappings[0].maps = [];
      }
    });
  };

  const handleDocUpdate = (newDoc) => {
    setDoc(newDoc);
    pushUndoRedoState(newDoc);
  };

  const mcNode = activeDoc?.['mapping-collection'] || activeDoc?.['control-mapping'] || {};
  const mappingNode = mcNode.mappings?.[0] || {};
  const maps = mappingNode.maps || [];

  const calculateGapStats = () => {
    const mappedSourceIds = new Set(maps.flatMap(m => m.sources?.map(s => s['id-ref']) || []));
    const mappedTargetIds = new Set(maps.flatMap(m => m.targets?.map(t => t['id-ref']) || []));

    const unmappedSource = (sourceControls || []).filter(c => !mappedSourceIds.has(c.id));
    const unmappedTarget = (targetControls || []).filter(c => !mappedTargetIds.has(c.id));

    const totalSource = (sourceControls || []).length;
    const coverage = totalSource > 0 ? Math.round(((totalSource - unmappedSource.length) / totalSource) * 100) : 0;

    const confidences = maps
      .map(m => m['confidence-score'] ?? m.props?.find((p: any) => p.name === 'confidence')?.value)
      .filter((v: any) => v !== undefined && v !== null && v !== '')
      .map(Number);
    const avgConfidence = confidences.length ? Math.round(confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length) : 0;

    const methodCounts: Record<string, number> = { human: 0, automation: 0, hybrid: 0 };
    maps.forEach((m: any) => {
      const rawMethod = m.method || mappingNode.method || mcNode.provenance?.method || m.props?.find((p: any) => p.name === 'method')?.value || 'human';
      const method = rawMethod === 'manual' ? 'human' : (rawMethod === 'automated' ? 'automation' : (rawMethod === 'mixed' ? 'hybrid' : rawMethod));
      if (method in methodCounts) {
        methodCounts[method] += 1;
      } else {
        methodCounts['human'] += 1;
      }
    });
    const methodStats: { label: string; count: number }[] = Object.entries(methodCounts).map(([label, count]) => ({ label, count: Number(count) }));

    return { coverage, unmappedSource, unmappedTarget, avgConfidence, methodStats };
  };

  const stats = calculateGapStats();

  const getRelationshipStats = (): { label: string; count: number }[] => {
    const counts: Record<string, number> = {};
    maps.forEach((m: any) => {
      const rel = m.relationship || 'unknown';
      counts[rel] = (counts[rel] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count: Number(count) }));
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'mappings', label: 'Mappings' },
    { id: 'matrix', label: 'Matrix View' },
    { id: 'sankey', label: 'Sankey Flow View' },
    { id: 'gap', label: 'Gap Analysis' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  const renderDetailPanel = (entry: any) => {
    if (!entry) return null;
    return (
      <EntityDetailPanel
        isOpen={true}
        title="Mapping Entry Detail"
        onClose={() => setSelectedMapEntry(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <strong>Source:</strong> {entry.sources?.[0]?.['id-ref']}
          </div>
          <div>
            <strong>Target:</strong> {entry.targets?.[0]?.['id-ref']}
          </div>
          
          <div>
            <strong>Relationship:</strong>
            {isEditing ? (
              <select 
                style={{ marginLeft: '8px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                value={entry.relationship || 'equivalent-to'} 
                category="mapping-relationship"
                onChange={(e) => {
                  const rel = e.target.value as MappingRelationship;
                  dispatch(setMapEntryRelationship(entry.uuid, rel));
                  setSelectedMapEntry((prev: any) => prev ? { ...prev, relationship: rel } : null);
                }}
              >
                <option value="equal-to">equal-to</option>
                <option value="equivalent-to">equivalent-to</option>
                <option value="subset-of">subset-of</option>
                <option value="superset-of">superset-of</option>
                <option value="intersects-with">intersects-with</option>
                <option value="no-relationship">no-relationship</option>
              </select>
            ) : (
              <span style={{ marginLeft: '8px' }}>
                <StatusBadge value={entry.relationship} category="mapping-relationship" />
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--color-surface-2)', borderRadius: '8px' }}>
            <h4 style={{ margin: 0 }}>Provenance & Confidence</h4>
            <div>
              <strong>Method:</strong>
              {isEditing ? (
                <select 
                  style={{ marginLeft: '8px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  value={entry.method || mappingNode.method || mcNode.provenance?.method || 'human'}
                  onChange={(e) => {
                    const methodVal = e.target.value as MappingMethod;
                    dispatch(updateMapEntry(entry.uuid, { method: methodVal } as any));
                    setSelectedMapEntry((prev: any) => prev ? { ...prev, method: methodVal } : null);
                  }}
                >
                  <option value="human">Human</option>
                  <option value="automation">Automation</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              ) : (
                <span style={{ marginLeft: '8px' }}>{entry.method || mappingNode.method || mcNode.provenance?.method || 'human'}</span>
              )}
            </div>
            <div>
              <strong>Confidence Score:</strong>
              {isEditing ? (
                <input 
                  type="number" min="0" max="100"
                  style={{ marginLeft: '8px', width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  value={entry['confidence-score'] ?? (entry.props?.find((p: any) => p.name === 'confidence')?.value || 0)}
                  onChange={(e) => {
                    const score = parseInt(e.target.value) || 0;
                    dispatch(updateMapEntry(entry.uuid, { 'confidence-score': score } as any));
                    setSelectedMapEntry((prev: any) => prev ? { ...prev, 'confidence-score': score } : null);
                  }}
                />
              ) : (
                <span style={{ marginLeft: '8px' }}>{entry['confidence-score'] ?? entry.props?.find((p: any) => p.name === 'confidence')?.value ?? 0}%</span>
              )}
              <ProgressBar progress={parseInt(String(entry['confidence-score'] ?? entry.props?.find((p: any) => p.name === 'confidence')?.value ?? 0))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <strong>Matching Rationale:</strong>
              {isEditing ? (
                <select
                  style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  value={entry['matching-rationale'] || 'semantic'}
                  onChange={(e) => {
                    const rationale = e.target.value as MappingMatchingRationale;
                    dispatch(updateMapEntry(entry.uuid, { 'matching-rationale': rationale } as any));
                    setSelectedMapEntry((prev: any) => prev ? { ...prev, 'matching-rationale': rationale } : null);
                  }}
                >
                  <option value="syntactic">Syntactic</option>
                  <option value="semantic">Semantic</option>
                  <option value="functional">Functional</option>
                </select>
              ) : (
                <div style={{ background: 'var(--color-surface)', padding: '8px', borderRadius: '4px' }}>
                  {entry['matching-rationale'] || 'No matching rationale provided'}
                </div>
              )}
            </div>
          </div>

          <div>
            <strong>Remarks:</strong>
            {isEditing ? (
              <textarea
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', minHeight: '60px', marginTop: '4px' }}
                value={entry.remarks || ''}
                onChange={(e) => {
                  dispatch(updateMapEntry(entry.uuid, { remarks: e.target.value }));
                  setSelectedMapEntry((prev: any) => prev ? { ...prev, remarks: e.target.value } : null);
                }}
              />
            ) : (
              <div style={{ marginTop: '4px' }}>{entry.remarks || 'None'}</div>
            )}
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Map Entry Properties</h4>
            <PropsEditor
              properties={entry.props || []}
              isEditing={isEditing}
              onChange={(props) => {
                dispatch(updateMapEntry(entry.uuid, { props }));
                setSelectedMapEntry((prev: any) => prev ? { ...prev, props } : null);
              }}
            />
          </div>
        </div>
      </EntityDetailPanel>
    );
  };

  return (
    <DocumentPageLayout
      stage="control-mappings"
      docId={mappingId}
      lifecycle={lifecycle}
      title={mcNode.metadata?.title || 'Untitled Mapping'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(newTab) => {
        if (activeTab === 'json' && newTab !== 'json') {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) {
            for (const mapping of mcNode.mappings || []) {
              const map = (mapping.maps || []).find((m: any) => m.uuid === entityId);
              if (map) { setSelectedMapEntry(map); break; }
            }
          }
        }
        setActiveTab(newTab);
      }}
      onClose={onClose}
    >
      <div className={styles['mapping-content']}>
        <div className={styles['tab-panel']}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <MetricCardGrid>
                <MetricCard title="Total Mappings" value={mcNode.mappings?.length || 0} icon="🔗" />
                <MetricCard title="Total Map Entries" value={maps.length} icon="📋" />
                <MetricCard title="Source Coverage" value={`${stats.coverage}%`} icon="🎯" />
                <MetricCard title="Avg Confidence" value={`${stats.avgConfidence}%`} icon="⭐" />
              </MetricCardGrid>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="dashboard-card" style={{ padding: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <h3>Relationship Types</h3>
                  <StatusBreakdown
                    title="Relationships"
                    items={getRelationshipStats()}
                    category="mapping-relationship"
                  />
                  <h3 style={{ marginTop: '20px' }}>Method Breakdown</h3>
                  <StatusBreakdown
                    title="Methods"
                    items={stats.methodStats}
                    category="default"
                  />
                </div>
                
                <CompletenessReport
                  title="Coverage Report"
                  sections={[
                    { name: 'Source Controls Mapped', status: stats.unmappedSource.length === 0 ? 'pass' : 'warn', count: sourceControls.length - stats.unmappedSource.length, message: `${stats.unmappedSource.length} controls remain unmapped` },
                    { name: 'Target Controls Mapped', status: stats.unmappedTarget.length === 0 ? 'pass' : 'warn', count: targetControls.length - stats.unmappedTarget.length, message: `${stats.unmappedTarget.length} controls remain unmapped` }
                  ]}
                />
              </div>
            </div>
          )}

          {activeTab === 'mappings' && (
            <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <EntityTable
                  data={maps.map(m => ({
                    id: m.uuid,
                    source: m.sources?.[0]?.['id-ref'] || 'N/A',
                    target: m.targets?.[0]?.['id-ref'] || 'N/A',
                    relationship: m.relationship,
                    remarks: m.remarks || ''
                  }))}
                  columns={[
                    { key: 'source', label: 'Source Control', sortable: true, filterable: true, searchable: true },
                    { key: 'relationship', label: 'Relationship', render: (val) => <StatusBadge value={val} category="mapping-relationship" />, filterable: true },
                    { key: 'target', label: 'Target Control', sortable: true, filterable: true, searchable: true },
                    { key: 'remarks', label: 'Remarks' }
                  ]}
                  onRowClick={(entity) => setSelectedMapEntry(maps.find(m => m.uuid === entity.id))}
                  onSelectionChange={setSelectedMaps}
                  actions={isEditing ? [
                    { label: 'Set Relationship', icon: '🔗', onClick: async (selected) => {
                        const confirmed = await confirm({
                          title: 'Set Relationship',
                          message: `Set relationship for ${selected.length} selected map entry(ies) to "equivalent-to"?`,
                          confirmLabel: 'Set Relationship',
                        });
                        if (confirmed) {
                          dispatch(batchSetRelationship(selected.map(s => s.id), 'equivalent-to'));
                          toast.success('Updated relationship for selected map(s)');
                        }
                      }
                    },
                    { label: 'Delete Selected', icon: '🗑️', onClick: async (selected) => {
                        const confirmed = await confirm({
                          title: 'Delete Selected Maps',
                          message: `Delete ${selected.length} selected map(s)?`,
                          confirmLabel: 'Delete',
                          variant: 'danger',
                        });
                        if (confirmed) {
                          dispatch(deleteMapEntries(selected.map(s => s.id)));
                          setSelectedMapEntry(null);
                          toast.success('Deleted selected map(s)');
                        }
                      }
                    }
                  ] : undefined}
                />
              </div>
              {selectedMapEntry && renderDetailPanel(selectedMapEntry)}
            </div>
          )}

          {activeTab === 'matrix' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <strong>Legend:</strong>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: 'var(--color-info-subtle)', border: '1px solid var(--color-info)' }}></div> Equal</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: 'var(--color-success-subtle)', border: '1px solid var(--color-success)' }}></div> Equivalent</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: 'var(--color-warning-subtle)', border: '1px solid var(--color-warning)' }}></div> Subset/Superset</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary)' }}></div> Intersects</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <strong>Filter:</strong>
                  <select 
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                    value={matrixFilter}
                    onChange={(e) => setMatrixFilter(e.target.value)}
                  >
                    <option value="all">Show All</option>
                    <option value="unmapped-only">Unmapped Only</option>
                    <option value="equal-to">Equal To</option>
                    <option value="equivalent-to">Equivalent To</option>
                    <option value="subset-of">Subset Of</option>
                    <option value="superset-of">Superset Of</option>
                    <option value="intersects-with">Intersects With</option>
                  </select>
                </div>
              </div>
              {(() => {
                const filteredSourceControls = sourceControls.filter(sc => {
                  if (matrixFilter === 'all') return true;
                  const matches = targetControls.map(tc => maps.find(m => m.sources?.some(s => s['id-ref'] === sc.id) && m.targets?.some(t => t['id-ref'] === tc.id)));
                  if (matrixFilter === 'unmapped-only') return matches.every(m => !m);
                  return matches.some(m => m && m.relationship === matrixFilter);
                });
                const filteredTargetControls = targetControls.filter(tc => {
                  if (matrixFilter === 'all') return true;
                  const matches = sourceControls.map(sc => maps.find(m => m.sources?.some(s => s['id-ref'] === sc.id) && m.targets?.some(t => t['id-ref'] === tc.id)));
                  if (matrixFilter === 'unmapped-only') return matches.every(m => !m);
                  return matches.some(m => m && m.relationship === matrixFilter);
                });

                return (
                  <div className={styles['matrix-container']}>
                    <div className={styles['matrix-grid']} style={{ gridTemplateColumns: `auto repeat(${filteredTargetControls.length}, minmax(40px, 1fr))` }}>
                      <div className={styles['matrix-header-corner']}>Source \ Target</div>
                      {filteredTargetControls.map(tc => (
                        <div key={tc.id} className={styles['matrix-header-col']} title={tc.title}>
                          {tc.id}
                        </div>
                      ))}
                      
                      {filteredSourceControls.map(sc => (
                        <React.Fragment key={sc.id}>
                          <div className={styles['matrix-header-row']} title={sc.title}>{sc.id}</div>
                          {filteredTargetControls.map(tc => {
                            const match = maps.find(m => 
                              m.sources?.some(s => s['id-ref'] === sc.id) && 
                              m.targets?.some(t => t['id-ref'] === tc.id)
                            );
                            const relClass = match && match.relationship ? (styles[`rel-cell-${match.relationship}`] || '') : '';
                            return (
                              <div
                                key={`${sc.id}-${tc.id}`}
                                className={`${styles['matrix-cell']} ${match ? styles['mapped'] : ''} ${relClass}`}
                                tabIndex={0}
                                role="gridcell"
                                aria-label={`Mapping cell ${sc.id} to ${tc.id}: ${match ? match.relationship : 'unmapped'}`}
                                onClick={() => match && setSelectedMapEntry(match)}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ') && match) {
                                    e.preventDefault();
                                    setSelectedMapEntry(match);
                                  }
                                }}
                              >
                                {match && (
                                  <div className={styles['matrix-tooltip']}>
                                    {sc.id} → {tc.id} ({match.relationship})
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'sankey' && (
            <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <SankeyDiagram
                  sourceControls={sourceControls}
                  targetControls={targetControls}
                  maps={maps}
                  selectedMapUuid={selectedMapEntry?.uuid}
                  onSelectMap={(mapEntry) => setSelectedMapEntry(mapEntry)}
                  filterRelationship={matrixFilter}
                  sourceTitle={mappingNode['source-resource']?.title || 'Source Framework'}
                  targetTitle={mappingNode['target-resource']?.title || 'Target Framework'}
                />
              </div>
              {selectedMapEntry && renderDetailPanel(selectedMapEntry)}
            </div>
          )}

          {activeTab === 'gap' && (
            <div className={styles['gap-grid']}>
              <div className="dashboard-card" style={{ padding: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Unmapped Source Controls</span>
                  <span className="badge" style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}>{stats.unmappedSource.length}</span>
                </h4>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {stats.unmappedSource.map(c => (
                    <div key={c.id} style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <strong>{c.id}</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{c.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dashboard-card" style={{ padding: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Unmapped Target Controls</span>
                  <span className="badge" style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}>{stats.unmappedTarget.length}</span>
                </h4>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {stats.unmappedTarget.map(c => (
                    <div key={c.id} style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <strong>{c.id}</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{c.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="dashboard-card" style={{ padding: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Source Resource</h3>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-muted)' }}>Type</label>
                    {isEditing ? (
                      <select
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                        value={mappingNode['source-resource']?.type || 'catalog'}
                        onChange={(e) => updateResourceField('source-resource', 'type', e.target.value)}
                      >
                        <option value="catalog">Catalog</option>
                        <option value="profile">Profile</option>
                        <option value="component-definition">Component Definition</option>
                        <option value="system-security-plan">SSP</option>
                      </select>
                    ) : (
                      <div style={{ padding: '8px', background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        {mappingNode['source-resource']?.type || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-muted)' }}>Title</label>
                    {isEditing ? (
                      <input
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                        value={mappingNode['source-resource']?.title || ''}
                        onChange={(e) => updateResourceField('source-resource', 'title', e.target.value)}
                      />
                    ) : (
                      <div style={{ padding: '8px', background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        {mappingNode['source-resource']?.title || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 3 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-muted)' }}>HREF</label>
                    {isEditing ? (
                      <input
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                        value={mappingNode['source-resource']?.href || ''}
                        onChange={(e) => updateResourceField('source-resource', 'href', e.target.value)}
                      />
                    ) : (
                      <div style={{ padding: '8px', background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        {mappingNode['source-resource']?.href || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
                <h4 style={{ margin: '0 0 12px 0' }}>Source Resource Properties</h4>
                <PropsEditor
                  properties={mappingNode['source-resource']?.props || []}
                  isEditing={isEditing}
                  onChange={(props) => updateResourceField('source-resource', 'props', props)}
                />
              </div>

              <div className="dashboard-card" style={{ padding: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Target Resource</h3>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-muted)' }}>Type</label>
                    {isEditing ? (
                      <select
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                        value={mappingNode['target-resource']?.type || 'catalog'}
                        onChange={(e) => updateResourceField('target-resource', 'type', e.target.value)}
                      >
                        <option value="catalog">Catalog</option>
                        <option value="profile">Profile</option>
                        <option value="component-definition">Component Definition</option>
                        <option value="system-security-plan">SSP</option>
                      </select>
                    ) : (
                      <div style={{ padding: '8px', background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        {mappingNode['target-resource']?.type || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-muted)' }}>Title</label>
                    {isEditing ? (
                      <input
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                        value={mappingNode['target-resource']?.title || ''}
                        onChange={(e) => updateResourceField('target-resource', 'title', e.target.value)}
                      />
                    ) : (
                      <div style={{ padding: '8px', background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        {mappingNode['target-resource']?.title || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 3 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-muted)' }}>HREF</label>
                    {isEditing ? (
                      <input
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                        value={mappingNode['target-resource']?.href || ''}
                        onChange={(e) => updateResourceField('target-resource', 'href', e.target.value)}
                      />
                    ) : (
                      <div style={{ padding: '8px', background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        {mappingNode['target-resource']?.href || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
                <h4 style={{ margin: '0 0 12px 0' }}>Target Resource Properties</h4>
                <PropsEditor
                  properties={mappingNode['target-resource']?.props || []}
                  isEditing={isEditing}
                  onChange={(props) => updateResourceField('target-resource', 'props', props)}
                />
              </div>

              <MetadataEditor
                metadata={mcNode.metadata || {}}
                readOnly={!isEditing}
                onChange={(md) => {
                  setDoc(prev => {
                    if (!prev) return prev;
                    return produce(prev, draft => {
                      const rootKey = draft['mapping-collection'] ? 'mapping-collection' : (draft['control-mapping'] ? 'control-mapping' : 'mapping-collection');
                      if (!draft[rootKey]) draft[rootKey] = {};
                      draft[rootKey].metadata = md;
                    });
                  });
                }}
              />
              <PropsEditor
                properties={mcNode.metadata?.props || []}
                isEditing={isEditing}
                onChange={(props) => {
                  setDoc(prev => {
                    if (!prev) return prev;
                    return produce(prev, draft => {
                      const rootKey = draft['mapping-collection'] ? 'mapping-collection' : (draft['control-mapping'] ? 'control-mapping' : 'mapping-collection');
                      if (!draft[rootKey]) draft[rootKey] = {};
                      if (!draft[rootKey].metadata) draft[rootKey].metadata = {};
                      draft[rootKey].metadata.props = props;
                    });
                  });
                }}
              />
              <BackMatterEditor
                backMatter={mcNode['back-matter'] || { resources: [] }}
                readOnly={!isEditing}
                onChange={(bm) => {
                  setDoc(prev => {
                    if (!prev) return prev;
                    return produce(prev, draft => {
                      const rootKey = draft['mapping-collection'] ? 'mapping-collection' : (draft['control-mapping'] ? 'control-mapping' : 'mapping-collection');
                      if (!draft[rootKey]) draft[rootKey] = {};
                      draft[rootKey]['back-matter'] = bm;
                    });
                  });
                }}
              />
            </div>
          )}

          {activeTab === 'json' && (
            <JsonEditor
              ref={jsonEditorRef}
              value={activeDoc}
              readOnly={!isEditing}
              onChange={(newDoc) => handleDocUpdate(newDoc)}
              highlightId={selectedMapEntry?.uuid || null}
            />
          )}
        </div>
      </div>
    </DocumentPageLayout>
  );
}

export default MappingPage;
