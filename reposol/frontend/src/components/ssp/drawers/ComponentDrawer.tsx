import React, { useState, useEffect } from 'react';
import styles from '../SSPPage.module.css';
import { PropsEditor } from '../../shared/PropsEditor';
import StatusBadge from '../../shared/status/StatusBadge';
import { SystemComponent, ServiceProtocol, PortRange, LeveragedAuthorization } from '../../../lib/types/oscal';
import { STANDARD_SSP_ROLES } from '../SystemCharacteristicsEditor';

export interface ComponentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  component: SystemComponent | null;
  onSave: (component: SystemComponent) => void;
  onDelete?: (uuid: string) => void;
  isEditing: boolean;
  metadataRoles?: any[];
  leveragedAuths?: LeveragedAuthorization[];
}

export const COMPONENT_TYPES = [
  { value: 'this-system', label: '👑 this-system (Root System Component)' },
  { value: 'system', label: '🌐 system (Leveraged External System)' },
  { value: 'software', label: '💻 software (Software Application / OS)' },
  { value: 'hardware', label: '🖥️ hardware (Physical Server / Device)' },
  { value: 'service', label: '☁️ service (Cloud / Microservice / API)' },
  { value: 'policy', label: '📜 policy (Organizational Policy)' },
  { value: 'physical', label: '🏢 physical (Physical Facility / Data Center)' },
  { value: 'process-procedure', label: '⚙️ process-procedure (Operational Workflow)' },
  { value: 'plan', label: '📋 plan (Security / Contingency Plan)' },
  { value: 'guidance', label: '📖 guidance (Compliance Guidance)' },
  { value: 'standard', label: '📐 standard (Technical Standard)' },
  { value: 'validation', label: '🧪 validation (Testing / Verification Tool)' },
  { value: 'network', label: '🔌 network (Network Appliance / Firewall / VPC)' },
  { value: 'interconnection', label: '🔗 interconnection (System Interconnection)' }
];

export const PROTOCOL_TEMPLATES: { name: string; title: string; defaultPort: number; transport: 'TCP' | 'UDP' }[] = [
  { name: 'https', title: 'HTTPS Web / API', defaultPort: 443, transport: 'TCP' },
  { name: 'ssh', title: 'SSH Secure Shell', defaultPort: 22, transport: 'TCP' },
  { name: 'http', title: 'HTTP Web Traffic', defaultPort: 80, transport: 'TCP' },
  { name: 'postgresql', title: 'PostgreSQL Database', defaultPort: 5432, transport: 'TCP' },
  { name: 'mysql', title: 'MySQL / MariaDB', defaultPort: 3306, transport: 'TCP' },
  { name: 'mongodb', title: 'MongoDB Daemon', defaultPort: 27017, transport: 'TCP' },
  { name: 'redis', title: 'Redis Cache', defaultPort: 6379, transport: 'TCP' },
  { name: 'dns', title: 'DNS Resolution', defaultPort: 53, transport: 'UDP' }
];

export default function ComponentDrawer({
  isOpen,
  onClose,
  component,
  onSave,
  onDelete,
  isEditing,
  metadataRoles = [],
  leveragedAuths = []
}: ComponentDrawerProps) {
  const [formData, setFormData] = useState<SystemComponent | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'props' | 'protocols' | 'roles'>('general');

  useEffect(() => {
    if (component) {
      setFormData({
        uuid: component.uuid || crypto.randomUUID(),
        type: component.type || 'software',
        title: component.title || '',
        description: component.description || '',
        purpose: component.purpose || '',
        status: component.status || { state: 'operational' },
        props: component.props ? [...component.props] : [],
        protocols: component.protocols ? JSON.parse(JSON.stringify(component.protocols)) : [],
        'responsible-roles': component['responsible-roles'] ? JSON.parse(JSON.stringify(component['responsible-roles'])) : [],
        links: component.links ? [...component.links] : []
      });
    } else {
      setFormData(null);
    }
  }, [component]);

  if (!isOpen || !formData) return null;

  const isRootComponent = formData.type === 'this-system';

  const getProp = (name: string) => {
    const p = (formData.props || []).find((item: any) => item.name === name);
    return p ? p.value : '';
  };

  const setProp = (name: string, value: string, ns = 'https://fedramp.gov/ns/oscal') => {
    const currentProps = [...(formData.props || [])];
    const idx = currentProps.findIndex((p: any) => p.name === name);
    if (idx > -1) {
      if (value) {
        currentProps[idx] = { ...currentProps[idx], value };
      } else {
        currentProps.splice(idx, 1);
      }
    } else if (value) {
      currentProps.push({ name, value, ns });
    }
    setFormData({ ...formData, props: currentProps });
  };

  const addProtocolTemplate = (tmpl: typeof PROTOCOL_TEMPLATES[0]) => {
    const currentProtocols = [...(formData.protocols || [])];
    const newProto: ServiceProtocol = {
      name: tmpl.name,
      title: tmpl.title,
      'port-ranges': [
        {
          start: tmpl.defaultPort,
          end: tmpl.defaultPort,
          transport: tmpl.transport
        }
      ]
    };
    setFormData({
      ...formData,
      protocols: [...currentProtocols, newProto]
    });
  };

  const addEmptyProtocol = () => {
    const currentProtocols = [...(formData.protocols || [])];
    const newProto: ServiceProtocol = {
      name: 'custom-proto',
      title: 'Custom Protocol',
      'port-ranges': [{ start: 8080, end: 8080, transport: 'TCP' }]
    };
    setFormData({
      ...formData,
      protocols: [...currentProtocols, newProto]
    });
  };

  const removeProtocol = (index: number) => {
    const updated = (formData.protocols || []).filter((_, i) => i !== index);
    setFormData({ ...formData, protocols: updated });
  };

  const updateProtocol = (index: number, updates: Partial<ServiceProtocol>) => {
    const current = [...(formData.protocols || [])];
    current[index] = { ...current[index], ...updates };
    setFormData({ ...formData, protocols: current });
  };

  const addPortRange = (protoIdx: number) => {
    const current = [...(formData.protocols || [])];
    const targetProto = { ...current[protoIdx] };
    const portRanges = [...(targetProto['port-ranges'] || [])];
    portRanges.push({ start: 80, end: 80, transport: 'TCP' });
    targetProto['port-ranges'] = portRanges;
    current[protoIdx] = targetProto;
    setFormData({ ...formData, protocols: current });
  };

  const removePortRange = (protoIdx: number, rangeIdx: number) => {
    const current = [...(formData.protocols || [])];
    const targetProto = { ...current[protoIdx] };
    targetProto['port-ranges'] = (targetProto['port-ranges'] || []).filter((_, i) => i !== rangeIdx);
    current[protoIdx] = targetProto;
    setFormData({ ...formData, protocols: current });
  };

  const updatePortRange = (protoIdx: number, rangeIdx: number, updates: Partial<PortRange>) => {
    const current = [...(formData.protocols || [])];
    const targetProto = { ...current[protoIdx] };
    const portRanges = [...(targetProto['port-ranges'] || [])];
    portRanges[rangeIdx] = { ...portRanges[rangeIdx], ...updates };
    targetProto['port-ranges'] = portRanges;
    current[protoIdx] = targetProto;
    setFormData({ ...formData, protocols: current });
  };

  const handleSave = () => {
    if (!formData.title?.trim()) {
      alert('Component title is required.');
      return;
    }
    if (!formData.description?.trim()) {
      alert('Component description is required by NIST OSCAL SSP schema.');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div className="flex items-center gap-3">
            <h2 id="drawer-title" className="text-lg font-bold text-gray-900 dark:text-white">
              {isRootComponent ? '👑 Root Component (this-system)' : 'Edit System Component'}
            </h2>
            <StatusBadge category="operational-status" status={formData.status?.state || 'unknown'} />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/40 px-4">
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('general')}
          >
            General & Status
          </button>
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'props'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('props')}
          >
            Properties & Asset Data
          </button>
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'protocols'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('protocols')}
          >
            Protocols & Ports ({formData.protocols?.length || 0})
          </button>
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'roles'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('roles')}
          >
            Responsible Roles ({formData['responsible-roles']?.length || 0})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">UUID</label>
                <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-700 dark:text-gray-300">
                  {formData.uuid}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={styles['form-input']}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Component Title (e.g. Production Web Application Cluster)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Component Type <span className="text-red-500">*</span>
                </label>
                {isRootComponent ? (
                  <div className="text-xs bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-2.5 rounded text-amber-800 dark:text-amber-200">
                    👑 <strong>this-system</strong> — Root system component representing the system as a whole.
                  </div>
                ) : (
                  <select
                    className={styles['form-select']}
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    disabled={!isEditing}
                  >
                    {COMPONENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Operational Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={styles['form-select']}
                    value={formData.status?.state || 'operational'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: { ...(formData.status || {}), state: e.target.value }
                      })
                    }
                    disabled={!isEditing}
                  >
                    <option value="operational">Operational</option>
                    <option value="under-development">Under Development</option>
                    <option value="under-major-modification">Under Major Modification</option>
                    <option value="disposition">Disposition</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {formData.status?.state === 'other' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Status Remarks <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={styles['form-input']}
                      placeholder="Remarks for 'other' status"
                      value={formData.status?.remarks || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: { ...(formData.status || { state: 'other' }), remarks: e.target.value }
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={styles['form-textarea']}
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Detailed component description, architecture role, and functionality..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Purpose</label>
                <input
                  type="text"
                  className={styles['form-input']}
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Primary operational purpose (e.g. Ingress load balancing and SSL termination)"
                />
              </div>
            </div>
          )}

          {activeTab === 'props' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Standard OSCAL Component Properties</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Implementation Point</label>
                  <select
                    className={styles['form-select']}
                    value={getProp('implementation-point')}
                    onChange={(e) => setProp('implementation-point', e.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="">Select Point...</option>
                    <option value="internal">Internal (Managed by System)</option>
                    <option value="external">External (Third-Party / Leveraged)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Vendor Name</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('vendor-name')}
                    onChange={(e) => setProp('vendor-name', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. Canonical, Oracle, AWS"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Version</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('version')}
                    onChange={(e) => setProp('version', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. 22.04 LTS, 15.3"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Model</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('model')}
                    onChange={(e) => setProp('model', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. PowerEdge R740, EC2 c5.large"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Virtual Asset?</label>
                  <select
                    className={styles['form-select']}
                    value={getProp('virtual')}
                    onChange={(e) => setProp('virtual', e.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="">Unspecified</option>
                    <option value="yes">Yes (Virtual Machine / Cloud)</option>
                    <option value="no">No (Bare Metal / Physical)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Public Ingress?</label>
                  <select
                    className={styles['form-select']}
                    value={getProp('public')}
                    onChange={(e) => setProp('public', e.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="">Unspecified</option>
                    <option value="yes">Yes (Internet Accessible)</option>
                    <option value="no">No (Internal Only)</option>
                  </select>
                </div>

                {leveragedAuths && leveragedAuths.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                      Leveraged Authorization Link
                    </label>
                    <select
                      className={styles['form-select']}
                      value={getProp('leveraged-authorization-uuid')}
                      onChange={(e) => setProp('leveraged-authorization-uuid', e.target.value)}
                      disabled={!isEditing}
                    >
                      <option value="">None (Independent Component)</option>
                      {leveragedAuths.map((auth) => (
                        <option key={auth.uuid} value={auth.uuid}>
                          {auth.title} ({auth.uuid.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Custom Properties</h3>
                <PropsEditor
                  props={formData.props || []}
                  onChange={(newProps) => setFormData({ ...formData, props: newProps })}
                  isEditing={isEditing}
                />
              </div>
            </div>
          )}

          {activeTab === 'protocols' && (
            <div className="space-y-4">
              {isEditing && (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Quick Add Protocol Preset
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {PROTOCOL_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.name}
                        type="button"
                        className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded"
                        onClick={() => addProtocolTemplate(tmpl)}
                      >
                        + {tmpl.title} ({tmpl.defaultPort}/{tmpl.transport})
                      </button>
                    ))}
                    <button
                      type="button"
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-2.5 py-1 rounded"
                      onClick={addEmptyProtocol}
                    >
                      + Custom Protocol
                    </button>
                  </div>
                </div>
              )}

              {(!formData.protocols || formData.protocols.length === 0) && (
                <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed rounded dark:border-gray-700">
                  No service protocols or listening ports declared for this component.
                </div>
              )}

              {(formData.protocols || []).map((proto, pIdx) => (
                <div
                  key={pIdx}
                  className="p-3 border rounded border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2 items-center flex-1">
                      <input
                        type="text"
                        className="text-xs font-bold p-1 border rounded w-32 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="Protocol Name (e.g. https)"
                        value={proto.name}
                        onChange={(e) => updateProtocol(pIdx, { name: e.target.value })}
                        disabled={!isEditing}
                      />
                      <input
                        type="text"
                        className="text-xs p-1 border rounded flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="Title / Description"
                        value={proto.title || ''}
                        onChange={(e) => updateProtocol(pIdx, { title: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        className="text-red-500 text-xs hover:underline ml-2"
                        onClick={() => removeProtocol(pIdx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Port Ranges */}
                  <div className="pl-3 border-l-2 border-blue-400 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold uppercase text-gray-500">Port Ranges</span>
                      {isEditing && (
                        <button
                          type="button"
                          className="text-[11px] text-blue-600 hover:underline"
                          onClick={() => addPortRange(pIdx)}
                        >
                          + Add Port
                        </button>
                      )}
                    </div>

                    {(proto['port-ranges'] || []).map((range, rIdx) => (
                      <div key={rIdx} className="flex gap-2 items-center">
                        <input
                          type="number"
                          className="w-20 text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="Start Port"
                          value={range.start ?? ''}
                          onChange={(e) =>
                            updatePortRange(pIdx, rIdx, {
                              start: e.target.value ? Number(e.target.value) : undefined
                            })
                          }
                          disabled={!isEditing}
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                          type="number"
                          className="w-20 text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="End Port"
                          value={range.end ?? ''}
                          onChange={(e) =>
                            updatePortRange(pIdx, rIdx, {
                              end: e.target.value ? Number(e.target.value) : undefined
                            })
                          }
                          disabled={!isEditing}
                        />
                        <select
                          className="text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={range.transport || 'TCP'}
                          onChange={(e) =>
                            updatePortRange(pIdx, rIdx, { transport: e.target.value as 'TCP' | 'UDP' })
                          }
                          disabled={!isEditing}
                        >
                          <option value="TCP">TCP</option>
                          <option value="UDP">UDP</option>
                        </select>
                        {isEditing && (
                          <button
                            type="button"
                            className="text-red-500 text-xs hover:text-red-700"
                            onClick={() => removePortRange(pIdx, rIdx)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Responsible Roles</h3>
                {isEditing && (
                  <button
                    type="button"
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-2 py-1 rounded"
                    onClick={() => {
                      const roles = [...(formData['responsible-roles'] || [])];
                      roles.push({ 'role-id': 'maintainer', 'party-uuids': [] });
                      setFormData({ ...formData, 'responsible-roles': roles });
                    }}
                  >
                    + Add Responsible Role
                  </button>
                )}
              </div>

              {(!formData['responsible-roles'] || formData['responsible-roles'].length === 0) && (
                <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed rounded dark:border-gray-700">
                  No responsible roles assigned to this component.
                </div>
              )}

              {(formData['responsible-roles'] || []).map((rr, rIdx) => (
                <div
                  key={rIdx}
                  className="p-3 border rounded border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center gap-2"
                >
                  <div className="flex-1">
                    {isEditing ? (
                      <select
                        className={styles['form-select']}
                        value={rr['role-id']}
                        onChange={(e) => {
                          const roles = [...(formData['responsible-roles'] || [])];
                          roles[rIdx] = { ...roles[rIdx], 'role-id': e.target.value };
                          setFormData({ ...formData, 'responsible-roles': roles });
                        }}
                      >
                        {STANDARD_SSP_ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {STANDARD_SSP_ROLES.find((r) => r.id === rr['role-id'])?.title || rr['role-id']}
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      className="text-red-500 text-xs hover:underline"
                      onClick={() => {
                        const roles = (formData['responsible-roles'] || []).filter((_, i) => i !== rIdx);
                        setFormData({ ...formData, 'responsible-roles': roles });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div>
            {isEditing && onDelete && !isRootComponent && (
              <button
                type="button"
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded"
                onClick={() => {
                  if (confirm(`Delete component "${formData.title}"?`)) {
                    onDelete(formData.uuid);
                    onClose();
                  }
                }}
              >
                Delete Component
              </button>
            )}
            {isRootComponent && (
              <span className="text-xs text-gray-500 italic">Root component cannot be deleted</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium px-4 py-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={onClose}
            >
              Cancel
            </button>
            {isEditing && (
              <button
                type="button"
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1.5 rounded"
                onClick={handleSave}
              >
                Save Component
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
