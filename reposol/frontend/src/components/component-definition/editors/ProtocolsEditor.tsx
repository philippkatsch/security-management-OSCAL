import React, { useState, useEffect } from 'react';
import styles from '../ComponentPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import EntityTable from '@components/shared/entity/EntityTable';
import { generateUUID } from '@lib/oscal-utils';
import { ServiceProtocol, PortRange, DefinedComponent } from '@lib/types/oscal';

// ============================================================================
// Types & Constants
// ============================================================================

export interface ProtocolPreset {
  id: string;
  name: string;
  title: string;
  defaultPort: number;
  endPort?: number;
  transport: 'TCP' | 'UDP';
  category: 'web' | 'database' | 'system' | 'api';
  description: string;
  icon: string;
}

export const PROTOCOL_PRESETS: ProtocolPreset[] = [
  // Web & Realtime
  {
    id: 'https',
    name: 'https',
    title: 'Hypertext Transfer Protocol Secure',
    defaultPort: 443,
    endPort: 443,
    transport: 'TCP',
    category: 'web',
    description: 'Encrypted web & API traffic over TLS',
    icon: '🔒'
  },
  {
    id: 'http',
    name: 'http',
    title: 'Hypertext Transfer Protocol',
    defaultPort: 80,
    endPort: 80,
    transport: 'TCP',
    category: 'web',
    description: 'Unencrypted web traffic / HTTP redirect',
    icon: '🌐'
  },
  {
    id: 'graphql',
    name: 'graphql',
    title: 'GraphQL API Endpoint',
    defaultPort: 443,
    endPort: 443,
    transport: 'TCP',
    category: 'web',
    description: 'GraphQL query & mutation endpoint over HTTPS',
    icon: '◈'
  },
  {
    id: 'websocket',
    name: 'websocket',
    title: 'Secure WebSocket Protocol',
    defaultPort: 443,
    endPort: 443,
    transport: 'TCP',
    category: 'web',
    description: 'Full-duplex WebSocket channel over TLS (WSS)',
    icon: '🔌'
  },

  // Databases & Storage
  {
    id: 'postgresql',
    name: 'postgresql',
    title: 'PostgreSQL Database Service',
    defaultPort: 5432,
    endPort: 5432,
    transport: 'TCP',
    category: 'database',
    description: 'PostgreSQL relational database listener',
    icon: '🐘'
  },
  {
    id: 'mongodb',
    name: 'mongodb',
    title: 'MongoDB Database Daemon',
    defaultPort: 27017,
    endPort: 27017,
    transport: 'TCP',
    category: 'database',
    description: 'MongoDB document database listener (mongod)',
    icon: '🍃'
  },
  {
    id: 'mysql',
    name: 'mysql',
    title: 'MySQL Database Server',
    defaultPort: 3306,
    endPort: 3306,
    transport: 'TCP',
    category: 'database',
    description: 'MySQL / MariaDB database listener',
    icon: '🐬'
  },
  {
    id: 'redis',
    name: 'redis',
    title: 'Redis In-Memory Data Store',
    defaultPort: 6379,
    endPort: 6379,
    transport: 'TCP',
    category: 'database',
    description: 'Redis in-memory cache and pub/sub service',
    icon: '⚡'
  },

  // System, Mail & Network
  {
    id: 'ssh',
    name: 'ssh',
    title: 'Secure Shell',
    defaultPort: 22,
    endPort: 22,
    transport: 'TCP',
    category: 'system',
    description: 'Encrypted remote shell & administrative access',
    icon: '🔑'
  },
  {
    id: 'dns',
    name: 'dns',
    title: 'Domain Name System',
    defaultPort: 53,
    endPort: 53,
    transport: 'UDP',
    category: 'system',
    description: 'DNS domain name resolution service',
    icon: '🧭'
  },
  {
    id: 'smtp',
    name: 'smtp',
    title: 'Simple Mail Transfer Protocol',
    defaultPort: 25,
    endPort: 25,
    transport: 'TCP',
    category: 'system',
    description: 'Electronic mail routing & transfer service',
    icon: '✉️'
  },
  {
    id: 'grpc',
    name: 'grpc',
    title: 'gRPC Remote Procedure Calls',
    defaultPort: 50051,
    endPort: 50051,
    transport: 'TCP',
    category: 'api',
    description: 'High-performance microservice RPC over HTTP/2',
    icon: '⚡'
  }
];

// ============================================================================
// Helper Validation Functions
// ============================================================================

export function validatePortNumber(port: number): string | null {
  if (port === null || port === undefined || isNaN(port)) {
    return 'Port number is required';
  }
  if (!Number.isInteger(port)) {
    return 'Port must be a whole integer';
  }
  if (port < 0 || port > 65535) {
    return 'Port must be between 0 and 65535';
  }
  return null;
}

export function validatePortRange(start: number, end: number): string | null {
  const startErr = validatePortNumber(start);
  if (startErr) return `Start port error: ${startErr}`;

  const endErr = validatePortNumber(end);
  if (endErr) return `End port error: ${endErr}`;

  if (start > end) {
    return `Start port (${start}) cannot exceed end port (${end})`;
  }
  return null;
}

export function formatPortsSummary(portRanges?: PortRange[]): string {
  if (!portRanges || portRanges.length === 0) return 'No ports';
  return portRanges
    .map(r => {
      const portStr = r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`;
      return `${portStr}/${r.transport || 'TCP'}`;
    })
    .join(', ');
}

// ============================================================================
// Main Component Props
// ============================================================================

export interface ProtocolsEditorProps {
  component: DefinedComponent | any;
  onChange: (field: string, val: any) => void;
  editMode: boolean;
}

export const ProtocolsEditor: React.FC<ProtocolsEditorProps> = ({
  component,
  onChange,
  editMode
}) => {
  const protocols: ServiceProtocol[] = component?.protocols || [];
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const isService = component?.type === 'service';
  const protocolsRef = React.useRef(protocols);
  React.useEffect(() => {
    protocolsRef.current = protocols;
  }, [protocols]);

  // ──────────────────────────────────────────────────────────────────────────
  // Mutation Handlers
  // ──────────────────────────────────────────────────────────────────────────

  const addCustomProtocol = () => {
    if (!editMode) return;
    const newProtocol: ServiceProtocol = {
      uuid: generateUUID(),
      name: '',
      title: '',
      'port-ranges': [{ start: 80, end: 80, transport: 'TCP' }]
    };
    const updated = [...protocolsRef.current, newProtocol];
    protocolsRef.current = updated;
    onChange('protocols', updated);
    setExpandedIndex(updated.length - 1);
  };

  const applyPreset = (preset: ProtocolPreset) => {
    if (!editMode) return;
    const newProtocol: ServiceProtocol = {
      uuid: generateUUID(),
      name: preset.name,
      title: preset.title,
      'port-ranges': [
        {
          start: preset.defaultPort,
          end: preset.endPort ?? preset.defaultPort,
          transport: preset.transport
        }
      ]
    };
    const updated = [...protocolsRef.current, newProtocol];
    protocolsRef.current = updated;
    onChange('protocols', updated);
    setExpandedIndex(updated.length - 1);
  };

  const removeProtocol = (idx: number) => {
    if (!editMode) return;
    const updated = protocolsRef.current.filter((_, i) => i !== idx);
    protocolsRef.current = updated;
    onChange('protocols', updated);
    if (expandedIndex === idx) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > idx) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const updateProtocolField = (idx: number, field: string, value: any) => {
    if (!editMode) return;
    const updated = [...protocolsRef.current];
    updated[idx] = { ...updated[idx], [field]: value };
    protocolsRef.current = updated;
    onChange('protocols', updated);
  };

  const addPortRange = (protoIdx: number) => {
    if (!editMode) return;
    const updated = [...protocolsRef.current];
    const currentRanges = updated[protoIdx]['port-ranges'] || [];
    updated[protoIdx] = {
      ...updated[protoIdx],
      'port-ranges': [...currentRanges, { start: 0, end: 0, transport: 'TCP' }]
    };
    protocolsRef.current = updated;
    onChange('protocols', updated);
  };

  const updatePortRange = (protoIdx: number, rangeIdx: number, patch: Partial<PortRange>) => {
    if (!editMode) return;
    const updated = [...protocolsRef.current];
    const currentRanges = [...(updated[protoIdx]['port-ranges'] || [])];
    currentRanges[rangeIdx] = { ...currentRanges[rangeIdx], ...patch };
    updated[protoIdx] = {
      ...updated[protoIdx],
      'port-ranges': currentRanges
    };
    protocolsRef.current = updated;
    onChange('protocols', updated);
  };

  const removePortRange = (protoIdx: number, rangeIdx: number) => {
    if (!editMode) return;
    const updated = [...protocolsRef.current];
    const currentRanges = (updated[protoIdx]['port-ranges'] || []).filter((_, i) => i !== rangeIdx);
    updated[protoIdx] = {
      ...updated[protoIdx],
      'port-ranges': currentRanges
    };
    protocolsRef.current = updated;
    onChange('protocols', updated);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles['protocols-editor']}>
      
      {/* 1. Contextual Service Hint */}
      {isService && (
        <div 
          className={styles['service-hint-banner']}
          role="note" 
          aria-label="Service protocol recommendation"
        >
          <span className={styles['service-hint-icon']}>💡</span>
          <div className={styles['service-hint-text']}>
            <strong>Service Component Recommendation:</strong> As a <em>Service</em> component, declaring network protocols, listener ports, and transport protocols (TCP/UDP) is recommended to enable boundary analysis and compliance verification (NIST SP 800-53 SA-4(9), SC-7).
          </div>
        </div>
      )}

      {/* 2. Quick-Add Protocol Presets Bar */}
      {editMode && (
        <div className={styles['presets-bar'] || styles['protocol-presets-container']}>
          <div className={styles['presets-header'] || styles['protocol-presets-label']}>
            <span className={styles['presets-label'] || ''}>⚡ Quick-Add Presets:</span>
          </div>
          <div className={styles['presets-chip-grid'] || styles['protocol-presets-grid']}>
            {PROTOCOL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles['preset-chip'] || styles['preset-pill']}
                onClick={() => applyPreset(preset)}
                title={`${preset.title} (${preset.defaultPort}/${preset.transport}) - ${preset.description}`}
              >
                <span className={styles['preset-icon']}>{preset.icon}</span>
                <span className={styles['preset-name']}>{preset.name.toUpperCase()}</span>
                <span className={styles['preset-port'] || styles['preset-port-badge']}>
                  {preset.defaultPort}/{preset.transport}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Protocols Table */}
      <EntityTable
        columns={[
          { key: 'name', label: 'Protocol', sortable: true },
          { key: 'title', label: 'Title / Description', sortable: true },
          { 
            key: 'portsSummary', 
            label: 'Ports & Transport', 
            render: (_: any, row: any) => (
              <span className={styles['port-badge']}>
                {formatPortsSummary(row['port-ranges'])}
              </span>
            )
          }
        ]}
        data={protocols.map((p: ServiceProtocol, i: number) => ({
          ...p,
          id: i.toString(),
          portsSummary: formatPortsSummary(p['port-ranges'])
        }))}
        onRowClick={(row: any) => {
          const index = parseInt(row.id, 10);
          setExpandedIndex(prev => (prev === index ? null : index));
        }}
        emptyState={{
          title: 'No protocols defined',
          description: editMode
            ? 'Use the Quick-Add Presets above or click + Add Custom Protocol to specify service listener ports.'
            : 'No network protocols or port ranges configured for this component.'
        }}
      />

      {/* 4. Add Custom Protocol Button */}
      {editMode && (
        <div className={styles['add-protocol-row']}>
          <button
            type="button"
            className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
            onClick={addCustomProtocol}
          >
            + Add Custom Protocol
          </button>
        </div>
      )}

      {/* 5. Expanded Protocol Editor Drawer / Card */}
      {expandedIndex !== null && expandedIndex < protocols.length && (
        <div className={styles['protocol-edit-card']}>
          <div className={styles['protocol-edit-header']}>
            <h5 className="font-bold text-sm">
              Editing Protocol #{expandedIndex + 1}: {protocols[expandedIndex].name || '(unnamed)'}
            </h5>
            <button
              type="button"
              className={styles['close-drawer-btn']}
              onClick={() => setExpandedIndex(null)}
              title="Close editor"
            >
              ✕
            </button>
          </div>

          <div className={styles['protocol-edit-grid'] || styles['form-row']}>
            <div className={styles['form-group']}>
              <label className="form-label">
                Protocol Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`form-input ${!protocols[expandedIndex].name?.trim() ? (styles['input-invalid'] || styles['input-error']) : ''}`}
                placeholder="e.g. https, mongodb, ssh"
                value={protocols[expandedIndex].name || ''}
                onChange={(e) => updateProtocolField(expandedIndex, 'name', e.target.value)}
                disabled={!editMode}
              />
              {!protocols[expandedIndex].name?.trim() && (
                <span className={styles['field-error'] || styles['error-text']}>Protocol identifier is required.</span>
              )}
            </div>

            <div className={styles['form-group']}>
              <label className="form-label">Title / Description</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Primary TLS REST Endpoint"
                value={protocols[expandedIndex].title || ''}
                onChange={(e) => updateProtocolField(expandedIndex, 'title', e.target.value)}
                disabled={!editMode}
              />
            </div>
          </div>

          {/* Port Ranges Sub-Section */}
          <div className={styles['port-ranges-container']}>
            <div className={styles['port-ranges-header']}>
              <span className="font-semibold text-xs uppercase tracking-wide">
                Port Ranges &amp; Transport Layer
              </span>
            </div>

            {(protocols[expandedIndex]['port-ranges'] || []).length === 0 ? (
              <p className={styles['empty-ports-hint']}>
                No port ranges specified. Click below to add a port or port range.
              </p>
            ) : (
              (protocols[expandedIndex]['port-ranges'] || []).map((range: PortRange, rIdx: number) => {
                const rangeError = validatePortRange(range.start, range.end);
                const startError = validatePortNumber(range.start);
                const endError = validatePortNumber(range.end);

                return (
                  <div key={rIdx} className={styles['port-range-item-wrapper']}>
                    <div className={styles['port-range-row']}>
                      <div className={styles['port-input-wrapper']}>
                        <label className={styles['sub-label']}>Start Port</label>
                        <input
                          type="number"
                          min={0}
                          max={65535}
                          className={`form-input ${styles['num-input']} ${startError || rangeError ? (styles['input-invalid'] || styles['input-error']) : ''}`}
                          value={range.start ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updatePortRange(expandedIndex, rIdx, { start: isNaN(val) ? 0 : val });
                          }}
                          disabled={!editMode}
                        />
                      </div>

                      <span className={styles['range-sep'] || styles['port-range-arrow']}>to</span>

                      <div className={styles['port-input-wrapper']}>
                        <label className={styles['sub-label']}>End Port</label>
                        <input
                          type="number"
                          min={0}
                          max={65535}
                          className={`form-input ${styles['num-input']} ${endError || rangeError ? (styles['input-invalid'] || styles['input-error']) : ''}`}
                          value={range.end ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updatePortRange(expandedIndex, rIdx, { end: isNaN(val) ? 0 : val });
                          }}
                          disabled={!editMode}
                        />
                      </div>

                      <div className={styles['port-input-wrapper']}>
                        <label className={styles['sub-label']}>Transport</label>
                        <select
                          className={`form-input ${styles['transport-select']}`}
                          value={range.transport || 'TCP'}
                          onChange={(e) => updatePortRange(expandedIndex, rIdx, { transport: e.target.value as 'TCP' | 'UDP' })}
                          disabled={!editMode}
                        >
                          <option value="TCP">TCP</option>
                          <option value="UDP">UDP</option>
                        </select>
                      </div>

                      {editMode && (
                        <button
                          type="button"
                          className={styles['delete-range-btn']}
                          onClick={() => removePortRange(expandedIndex, rIdx)}
                          title="Remove this port range"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Inline Validation Feedback */}
                    {rangeError && (
                      <div className={styles['range-error-banner']}>
                        ⚠️ {rangeError}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {editMode && (
              <button
                type="button"
                className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm'], 'mt-2'].filter(Boolean).join(' ')}
                onClick={() => addPortRange(expandedIndex)}
              >
                + Add Port Range
              </button>
            )}
          </div>

          {/* Action Row */}
          {editMode && (
            <div className={styles['protocol-card-actions']}>
              <button
                type="button"
                className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                onClick={() => removeProtocol(expandedIndex)}
              >
                Delete Protocol
              </button>
              <button
                type="button"
                className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                onClick={() => setExpandedIndex(null)}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProtocolsEditor;
