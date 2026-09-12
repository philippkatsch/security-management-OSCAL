import React, { useState, useRef, useMemo } from 'react';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentActions } from '@hooks/useDocumentActions';
import { useConfirm } from '@hooks/useConfirm';
import {
  addComponent,
  updateComponent,
  deleteComponents,
  addCapability,
  updateCapability,
  deleteCapabilities,
  updateComponentDefinitionMetadata,
  updateComponentDefinitionBackMatter,
  setImportComponentDefinitions
} from '@lib/document-actions/component-definition-actions';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import EntityTable, { EntityTableColumn } from '@components/shared/entity/EntityTable';
import EntityDetailPanel from '@components/shared/entity/EntityDetailPanel';
import MetricCard from '@components/shared/dashboard/MetricCard';
import MetricCardGrid from '@components/shared/dashboard/MetricCardGrid';
import StatusBreakdown from '@components/shared/dashboard/StatusBreakdown';
import { MetadataEditor } from '@components/shared/MetadataEditor';
import { PropsEditor } from '@components/shared/PropsEditor';
import { BackMatterEditor } from '@components/shared/BackMatterEditor';
import { JsonEditor } from '@components/shared/JsonEditor';
import ComponentEditor from './ComponentEditor';
import CapabilityEditor from './CapabilityEditor';
import ImportDefinitionsEditor from './editors/ImportDefinitionsEditor';
import styles from './ComponentPage.module.css';

const generateUUID = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'comp-' + Math.random().toString(36).substring(2, 11));

export const COMPONENT_TYPE_META: Record<string, { icon: string; bg: string; color: string; border: string }> = {
  software: { icon: '💻', bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.35)' },
  service: { icon: '☁️', bg: 'rgba(6, 182, 212, 0.1)', color: '#0891b2', border: 'rgba(6, 182, 212, 0.35)' },
  hardware: { icon: '🖥️', bg: 'rgba(249, 115, 22, 0.1)', color: '#ea580c', border: 'rgba(249, 115, 22, 0.35)' },
  physical: { icon: '🏢', bg: 'rgba(100, 116, 139, 0.1)', color: '#475569', border: 'rgba(100, 116, 139, 0.35)' },
  policy: { icon: '📜', bg: 'rgba(168, 85, 247, 0.1)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.35)' },
  'process-procedure': { icon: '📋', bg: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', border: 'rgba(99, 102, 241, 0.35)' },
  plan: { icon: '📅', bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)' },
  guidance: { icon: '🧭', bg: 'rgba(20, 184, 166, 0.1)', color: '#0d9488', border: 'rgba(20, 184, 166, 0.35)' },
  standard: { icon: '📐', bg: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: 'rgba(16, 185, 129, 0.35)' },
  validation: { icon: '🛡️', bg: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: 'rgba(34, 197, 94, 0.35)' },
  interconnection: { icon: '🔌', bg: 'rgba(236, 72, 153, 0.1)', color: '#db2777', border: 'rgba(236, 72, 153, 0.35)' }
};

export interface ComponentPageProps {
  componentDefId?: string;
  compId?: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export const ComponentPage: React.FC<ComponentPageProps> = ({ 
  componentDefId, 
  compId,
  initialEditMode, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [selectedCapability, setSelectedCapability] = useState<any>(null);
  const jsonEditorRef = useRef<any>(null);
  const { confirm } = useConfirm();

  const effectiveId = componentDefId || compId || '';
  const lifecycle = useDocumentLifecycle(
    'component-definitions', 
    'component-definition', 
    effectiveId, 
    initialEditMode
  );

  const { activeDoc, isEditing, setDoc, pushUndoRedoState } = lifecycle;
  const { dispatch } = useDocumentActions(lifecycle);
  const doc = activeDoc;
  const compDef: any = doc?.['component-definition'] || {};
  const components = compDef.components || [];
  const capabilities = compDef.capabilities || [];
  const importDefinitions = compDef['import-component-definitions'] || [];
  const backMatter = compDef['back-matter'] || {};
  const metadata = compDef.metadata || {};

  const handleAddComponent = () => {
    const newComp = {
      uuid: generateUUID(),
      type: 'software' as const,
      title: 'New Component',
      description: 'Component description.',
      purpose: '',
      props: [],
      links: [],
      'responsible-roles': [],
      protocols: [],
      'control-implementations': []
    };
    dispatch(addComponent(newComp));
    setSelectedComponent(newComp);
  };

  const handleDeleteComponents = async (uuids: string[]) => {
    const confirmed = await confirm({
      title: 'Delete Component(s)',
      message: `Are you sure you want to delete ${uuids.length} component(s)? This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch(deleteComponents(uuids));
    if (selectedComponent && uuids.includes(selectedComponent.uuid)) {
      setSelectedComponent(null);
    }
  };

  const handleUpdateComponent = (uuid: string, updates: any) => {
    dispatch(updateComponent(uuid, updates));
    if (selectedComponent && selectedComponent.uuid === uuid) {
      setSelectedComponent((prev: any) => ({ ...prev, ...updates }));
    }
  };

  const handleAddCapability = () => {
    const newCap = {
      uuid: generateUUID(),
      name: 'New Capability',
      description: 'New Capability Description',
      'incorporates-components': [],
      'control-implementations': []
    };
    dispatch(addCapability(newCap));
    setSelectedCapability(newCap);
  };

  const handleDeleteCapabilities = async (uuids: string[]) => {
    const confirmed = await confirm({
      title: 'Delete Capability',
      message: `Delete ${uuids.length} capability(ies)?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch(deleteCapabilities(uuids));
    if (selectedCapability && uuids.includes(selectedCapability.uuid)) {
      setSelectedCapability(null);
    }
  };

  const handleUpdateCapability = (uuid: string, updates: any) => {
    dispatch(updateCapability(uuid, updates));
    if (selectedCapability && selectedCapability.uuid === uuid) {
      setSelectedCapability((prev: any) => ({ ...prev, ...updates }));
    }
  };

  // US 3.15 Enhanced Component Table Columns
  const componentColumns: EntityTableColumn[] = [
    { 
      key: 'title', 
      label: 'Component', 
      sortable: true, 
      searchable: true,
      render: (val: string, item: any) => {
        const meta = COMPONENT_TYPE_META[item.type] || { icon: '🏷️', color: '#6b7280' };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{meta.icon}</span>
              <strong style={{ color: 'var(--color-text, #111827)' }}>{val || 'Untitled Component'}</strong>
            </div>
            {item.purpose && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #6b7280)', fontStyle: 'italic' }}>
                {item.purpose.length > 60 ? item.purpose.substring(0, 60) + '...' : item.purpose}
              </span>
            )}
          </div>
        );
      }
    },
    { 
      key: 'type', 
      label: 'Type', 
      sortable: true, 
      filterable: true,
      render: (type: string) => {
        const meta = COMPONENT_TYPE_META[type] || { icon: '🏷️', bg: 'rgba(107, 114, 128, 0.1)', color: '#4b5563', border: 'rgba(107, 114, 128, 0.3)' };
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.border}`
            }}
          >
            <span>{meta.icon}</span>
            <span>{type}</span>
          </span>
        );
      }
    },
    { 
      key: 'version', 
      label: 'Version', 
      sortable: true, 
      searchable: true,
      render: (_: any, item: any) => {
        const versionVal = item.props?.find((p: any) => p.name === 'version')?.value;
        return versionVal ? (
          <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'var(--surface-alt, #f3f4f6)', padding: '1px 6px', borderRadius: '4px' }}>
            v{versionVal}
          </span>
        ) : <span style={{ color: 'var(--color-text-muted, #9ca3af)' }}>—</span>;
      }
    },
    { 
      key: 'controlImplsCount', 
      label: 'Control Coverage', 
      sortable: true, 
      render: (_: any, item: any) => {
        const setsCount = (item['control-implementations'] || []).length;
        const reqsCount = (item['control-implementations'] || []).reduce(
          (sum: number, ci: any) => sum + (ci['implemented-requirements']?.length || 0), 
          0
        );
        return setsCount > 0 ? (
          <span style={{ fontSize: '12px', color: 'var(--color-text, #111827)' }}>
            <strong>{setsCount}</strong> set{setsCount > 1 ? 's' : ''}{' '}
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #6b7280)' }}>({reqsCount} reqs)</span>
          </span>
        ) : <span style={{ color: 'var(--color-text-muted, #9ca3af)', fontSize: '12px' }}>0 sets</span>;
      }
    },
    {
      key: 'protocolsSummary',
      label: 'Protocols / Interfaces',
      render: (_: any, item: any) => {
        const protocols = item.protocols || [];
        return protocols.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {protocols.slice(0, 2).map((p: any, i: number) => (
              <span key={i} className={styles['port-badge']} style={{ fontSize: '10px' }}>
                {p.name?.toUpperCase() || 'PROTO'}
                {p['port-ranges']?.[0] ? `:${p['port-ranges'][0].start}` : ''}
              </span>
            ))}
            {protocols.length > 2 && (
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted, #6b7280)' }}>+{protocols.length - 2} more</span>
            )}
          </div>
        ) : <span style={{ color: 'var(--color-text-muted, #9ca3af)', fontSize: '12px' }}>—</span>;
      }
    },
    { 
      key: 'description', 
      label: 'Description', 
      searchable: true,
      render: (val: string) => val && val.length > 70 ? val.substring(0, 70) + '...' : (val || '—') 
    }
  ];

  const capabilityColumns: EntityTableColumn[] = [
    { key: 'name', label: 'Capability Name', sortable: true, searchable: true },
    { 
      key: 'description', 
      label: 'Description', 
      searchable: true, 
      render: (val: string) => val && val.length > 80 ? val.substring(0, 80) + '...' : val 
    },
    { 
      key: 'components', 
      label: 'Incorporated Components', 
      render: (_: any, item: any) => (
        <span className="badge badge-info">{(item['incorporates-components'] || []).length} component(s)</span>
      )
    }
  ];

  // Overview calculations
  const totalControls = components.reduce((acc: number, c: any) => 
    acc + (c['control-implementations']?.reduce((sum: number, ci: any) => sum + (ci['implemented-requirements']?.length || 0), 0) || 0)
  , 0);

  const totalControlImpls = components.reduce((acc: number, c: any) => 
    acc + (c['control-implementations']?.length || 0)
  , 0);

  const compTypeCounts = components.reduce((acc: Record<string, number>, c: any) => {
    const t = c.type || 'other';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // DD-011 Properties Dashboard Analytics
  const propertiesAnalytics = useMemo(() => {
    const globalHeaderProps = (metadata?.props || []).length;
    const allElementProps: string[] = [];
    let totalAssignments = globalHeaderProps;

    components.forEach((c: any) => {
      (c.props || []).forEach((p: any) => {
        if (p.name) allElementProps.push(p.name);
        totalAssignments++;
      });
    });

    capabilities.forEach((cap: any) => {
      (cap.props || []).forEach((p: any) => {
        if (p.name) allElementProps.push(p.name);
        totalAssignments++;
      });
    });

    const uniqueKeys = new Set([
      ...(metadata?.props || []).map((p: any) => p.name),
      ...allElementProps
    ]);

    return {
      globalHeaderProps,
      elementPropsCount: new Set(allElementProps).size,
      uniqueKeysCount: uniqueKeys.size,
      totalAssignments
    };
  }, [metadata, components, capabilities]);

  const tabsConfig = [
    { id: 'overview', label: 'Overview' },
    { id: 'components', label: `Components (${components.length})` },
    { id: 'capabilities', label: `Capabilities (${capabilities.length})` },
    { id: 'imports', label: `Imports (${importDefinitions.length})` },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  return (
    <DocumentPageLayout
      stage="component-definitions"
      docId={effectiveId}
      lifecycle={lifecycle}
      title={metadata.title || 'Untitled Component Definition'}
      tabs={tabsConfig}
      activeTab={activeTab}
      onTabChange={(newTab) => {
        if (activeTab === 'json' && newTab !== 'json') {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) {
            const comp = components.find((c: any) => c.uuid === entityId);
            if (comp) setSelectedComponent(comp);
            else {
              const cap = capabilities.find((c: any) => c.uuid === entityId);
              if (cap) setSelectedCapability(cap);
            }
          }
        }
        setActiveTab(newTab);
      }}
      onClose={onClose}
    >
      <div className={styles['panel-body']} style={{ height: '100%', overflowY: 'auto', padding: '24px' }}>
        
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
                Component Definition Dashboard
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted, #6b7280)' }}>
                Overview of security building blocks, capabilities, and regulatory compliance coverage.
              </p>
            </div>

            <MetricCardGrid>
              <MetricCard title="Total Components" value={components.length} icon="🧱" accentColor="var(--color-primary, #3b82f6)" />
              <MetricCard title="Total Capabilities" value={capabilities.length} icon="⚡" accentColor="var(--color-warning, #f59e0b)" />
              <MetricCard title="External Imports" value={importDefinitions.length} icon="📥" accentColor="var(--color-accent, #06b6d4)" />
              <MetricCard title="Control Impl Sets" value={totalControlImpls} icon="🔒" accentColor="var(--color-info, #6366f1)" />
              <MetricCard title="Implemented Reqs" value={totalControls} icon="✅" accentColor="var(--color-success, #10b981)" />
            </MetricCardGrid>

            {/* Type Breakdown Chart */}
            <div style={{ background: 'var(--color-surface, #161b22)', padding: '18px', border: '1px solid var(--color-border, #30363d)', borderRadius: '8px' }}>
              <StatusBreakdown 
                title="Component Classification Breakdown" 
                variant="bar"
                items={Object.entries(compTypeCounts).map(([type, count], i) => ({
                  label: type,
                  count: count as number,
                  color: COMPONENT_TYPE_META[type]?.color || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'][i % 7]
                }))}
              />
            </div>

            {/* DD-011 Properties Dashboard Analytics */}
            <div style={{ background: 'var(--color-surface, #161b22)', padding: '18px', border: '1px solid var(--color-border, #30363d)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #e6edf3)' }}>
                  🏷️ Properties Analytics Dashboard (DD-011)
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>
                  Component &amp; Document Property Metrics
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--color-surface-2, #1c2333)', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--color-border, #30363d)' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-primary, #3b82f6)' }}>
                    {propertiesAnalytics.globalHeaderProps}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>Global Header Props</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-surface-2, #1c2333)', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--color-border, #30363d)' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-warning, #f59e0b)' }}>
                    {propertiesAnalytics.elementPropsCount}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>Distinct Element Props</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-surface-2, #1c2333)', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--color-border, #30363d)' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-info, #6366f1)' }}>
                    {propertiesAnalytics.uniqueKeysCount}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>Unique Property Keys</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-surface-2, #1c2333)', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--color-border, #30363d)' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success, #10b981)' }}>
                    {propertiesAnalytics.totalAssignments}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>Total Occurrences</div>
                </div>
              </div>
            </div>

            {/* Architectural Guidance: Components vs. Capabilities */}
            <div style={{
              background: 'var(--color-surface, #161b22)',
              padding: '18px',
              border: '1px solid var(--color-border, #30363d)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #e6edf3)' }}>
                  🏛️ OSCAL Architecture: Components vs. Capabilities
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>
                  NIST OSCAL v1.2.2 Lifecycle Modeling
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', fontSize: '13px', lineHeight: 1.5 }}>
                <div style={{
                  padding: '14px',
                  background: 'var(--color-surface-2, #1c2333)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #30363d)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>🧱</span>
                    <strong style={{ color: 'var(--color-text, #e6edf3)' }}>Components (Discrete Building Blocks)</strong>
                  </div>
                  <p style={{ margin: 0, color: 'var(--color-text-muted, #8b949e)' }}>
                    Individual reusable architectural units: commercial software, managed cloud services, physical hardware, organizational policies, or operating procedures. Each component encapsulates its own protocols, port ranges, responsible operational roles, and framework control implementations.
                  </p>
                </div>
                <div style={{
                  padding: '14px',
                  background: 'var(--color-surface-2, #1c2333)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #30363d)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>⚡</span>
                    <strong style={{ color: 'var(--color-text, #e6edf3)' }}>Capabilities (Composite Solutions)</strong>
                  </div>
                  <p style={{ margin: 0, color: 'var(--color-text-muted, #8b949e)' }}>
                    High-level composite security functions that integrate multiple discrete components (e.g., &quot;Enterprise IAM Architecture&quot; packaging Keycloak IAM and PostgreSQL Database). Capabilities incorporate components with tailored roles and define overarching control implementations across the composite solution.
                  </p>
                </div>
              </div>
              <div style={{
                padding: '10px 14px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--color-text-secondary, #8b949e)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>💡</span>
                <span>
                  <strong style={{ color: 'var(--color-text, #e6edf3)' }}>Stage 4 SSP Ready:</strong> Both Components and Capabilities can be imported directly into System Security Plans (SSPs), transferring their control narratives, parameters, and statement breakdowns into the system authorization boundary.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMPONENTS TABLE (US 3.15) */}
        {activeTab === 'components' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <div style={{
              padding: '12px 16px',
              background: 'var(--color-surface, #161b22)',
              border: '1px solid var(--color-border, #30363d)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--color-text-muted, #8b949e)'
            }}>
              <span style={{ fontSize: '20px' }}>🧱</span>
              <div>
                <strong style={{ color: 'var(--color-text, #e6edf3)' }}>Components (Discrete Building Blocks):</strong> Declare individual software packages, cloud services, hardware, policies, or procedures. Each component specifies its own protocols, responsible roles, and baseline control implementations.
              </div>
            </div>
            <EntityTable
              data={components.map((c: any) => ({ ...c, id: c.uuid }))}
              columns={componentColumns}
              onRowClick={setSelectedComponent}
              onAdd={isEditing ? handleAddComponent : undefined}
              onDelete={isEditing ? handleDeleteComponents : undefined}
              addLabel="+ Add Component"
              emptyState={{
                icon: <span style={{ fontSize: '32px' }}>🧱</span>,
                title: 'No Components Declared Yet',
                description: 'Declare reusable software, services, hardware, policies, or procedures to build your security component inventory.',
                actionLabel: isEditing ? '+ Add First Component' : undefined,
                onAction: isEditing ? handleAddComponent : undefined
              }}
            />
          </div>
        )}

        {/* TAB 3: CAPABILITIES TABLE */}
        {activeTab === 'capabilities' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <div style={{
              padding: '12px 16px',
              background: 'var(--color-surface, #161b22)',
              border: '1px solid var(--color-border, #30363d)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--color-text-muted, #8b949e)'
            }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <div>
                <strong style={{ color: 'var(--color-text, #e6edf3)' }}>Capabilities (Composite Solutions):</strong> Group multiple related components into high-level composite security functions (e.g. Identity &amp; Access Management bundling Keycloak + PostgreSQL). Capabilities define multi-component control implementations and can be imported into Stage 4 SSPs.
              </div>
            </div>
            <EntityTable
              data={capabilities.map((c: any) => ({ ...c, id: c.uuid }))}
              columns={capabilityColumns}
              onRowClick={setSelectedCapability}
              onAdd={isEditing ? handleAddCapability : undefined}
              onDelete={isEditing ? handleDeleteCapabilities : undefined}
              addLabel="+ Add Capability"
              emptyState={{
                icon: <span style={{ fontSize: '32px' }}>⚡</span>,
                title: 'No Capabilities Declared',
                description: 'Group multiple related components into high-level composite security capabilities.',
                actionLabel: isEditing ? '+ Add First Capability' : undefined,
                onAction: isEditing ? handleAddCapability : undefined
              }}
            />
          </div>
        )}

        {/* TAB 4: EXTERNAL IMPORTS (US 3.14) */}
        {activeTab === 'imports' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            <ImportDefinitionsEditor
              importDefinitions={importDefinitions}
              backMatter={backMatter}
              onChangeImports={(newImports) => dispatch(setImportComponentDefinitions(newImports))}
              onChangeBackMatter={(newBm) => dispatch(updateComponentDefinitionBackMatter(newBm))}
              editMode={isEditing}
            />
          </div>
        )}

        {/* TAB 5: METADATA & BACK MATTER */}
        {activeTab === 'metadata' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <section>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Document Metadata</h3>
              <MetadataEditor
                metadata={metadata}
                onChange={(md: any) => dispatch(updateComponentDefinitionMetadata(md))}
                isEditing={isEditing}
              />
            </section>
            
            <section>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Document Properties</h3>
              <PropsEditor
                props={metadata.props || []}
                onChange={(props: any) => dispatch(updateComponentDefinitionMetadata({ ...metadata, props }))}
                isEditing={isEditing}
              />
            </section>

            <section>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Back Matter Resources</h3>
              <BackMatterEditor
                backMatter={backMatter}
                onChange={(bm: any) => dispatch(updateComponentDefinitionBackMatter(bm))}
                readOnly={!isEditing}
              />
            </section>
          </div>
        )}

        {/* TAB 6: JSON SOURCE */}
        {activeTab === 'json' && (
          <div style={{ height: '100%' }}>
            <JsonEditor
              ref={jsonEditorRef}
              value={doc}
              onChange={(newDoc: any) => {
                setDoc(newDoc);
                pushUndoRedoState(newDoc);
              }}
              readOnly={!isEditing}
              highlightId={selectedComponent?.uuid || selectedCapability?.uuid || null}
            />
          </div>
        )}
      </div>

      {/* Slide-Out Detail Panel for Components */}
      <EntityDetailPanel
        isOpen={!!selectedComponent}
        onClose={() => setSelectedComponent(null)}
        title={selectedComponent?.title || 'Component Details'}
      >
        {selectedComponent && (
          <ComponentEditor
            component={components.find((c: any) => c.uuid === selectedComponent.uuid) || selectedComponent}
            components={components}
            parties={metadata.parties || []}
            resources={backMatter.resources || []}
            onUpdate={(updatedComponent: any) => handleUpdateComponent(selectedComponent.uuid, updatedComponent)}
            editMode={isEditing}
          />
        )}
      </EntityDetailPanel>

      {/* Slide-Out Detail Panel for Capabilities */}
      <EntityDetailPanel
        isOpen={!!selectedCapability}
        onClose={() => setSelectedCapability(null)}
        title={selectedCapability?.name || 'Capability Details'}
      >
        {selectedCapability && (
          <CapabilityEditor
            capability={capabilities.find((c: any) => c.uuid === selectedCapability.uuid) || selectedCapability}
            components={components}
            resources={backMatter.resources || []}
            onUpdate={(updatedCapability: any) => handleUpdateCapability(selectedCapability.uuid, updatedCapability)}
            editMode={isEditing}
          />
        )}
      </EntityDetailPanel>
    </DocumentPageLayout>
  );
};

export default ComponentPage;
