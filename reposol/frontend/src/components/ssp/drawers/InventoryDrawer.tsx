import React, { useState, useEffect } from 'react';
import styles from '../SSPPage.module.css';
import { PropsEditor } from '../../shared/PropsEditor';
import { InventoryItem, SystemComponent, ImplementedComponent } from '../../../lib/types/oscal';

export interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSave: (item: InventoryItem) => void;
  onDelete?: (uuid: string) => void;
  isEditing: boolean;
  components?: SystemComponent[];
  metadataParties?: any[];
}

export const ASSET_TYPES = [
  { value: 'virtual-machine', label: 'Virtual Machine (VM)' },
  { value: 'container', label: 'Container Instance / Pod' },
  { value: 'hardware-server', label: 'Physical Bare-Metal Server' },
  { value: 'database-instance', label: 'Managed Database Instance' },
  { value: 'network-appliance', label: 'Router / Switch / Firewall' },
  { value: 'storage-array', label: 'Storage Array / SAN / S3' },
  { value: 'endpoint', label: 'Workstation / Laptop Endpoint' },
  { value: 'other', label: 'Other Asset Type' }
];

export default function InventoryDrawer({
  isOpen,
  onClose,
  item,
  onSave,
  onDelete,
  isEditing,
  components = []
}: InventoryDrawerProps) {
  const [formData, setFormData] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'components' | 'props'>('general');

  useEffect(() => {
    if (item) {
      setFormData({
        uuid: item.uuid || crypto.randomUUID(),
        description: item.description || '',
        props: item.props ? [...item.props] : [],
        'implemented-components': item['implemented-components']
          ? JSON.parse(JSON.stringify(item['implemented-components']))
          : [],
        links: item.links ? [...item.links] : [],
        remarks: item.remarks || ''
      });
    } else {
      setFormData(null);
    }
  }, [item]);

  if (!isOpen || !formData) return null;

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

  const toggleComponentLinkage = (compUuid: string) => {
    const currentList = formData['implemented-components'] || [];
    const exists = currentList.some(ic => ic['component-uuid'] === compUuid);
    let nextList: ImplementedComponent[];
    if (exists) {
      nextList = currentList.filter(ic => ic['component-uuid'] !== compUuid);
    } else {
      nextList = [...currentList, { 'component-uuid': compUuid }];
    }
    setFormData({ ...formData, 'implemented-components': nextList });
  };

  const getTemplateLink = () => {
    const l = (formData.links || []).find(link => link.rel === 'baseline-template');
    return l ? l.href : '';
  };

  const setTemplateLink = (href: string) => {
    const currentLinks = [...(formData.links || [])];
    const idx = currentLinks.findIndex(link => link.rel === 'baseline-template');
    if (href.trim()) {
      if (idx > -1) {
        currentLinks[idx] = { ...currentLinks[idx], href: href.trim() };
      } else {
        currentLinks.push({ rel: 'baseline-template', href: href.trim() });
      }
    } else if (idx > -1) {
      currentLinks.splice(idx, 1);
    }
    setFormData({ ...formData, links: currentLinks });
  };

  const handleSave = () => {
    if (!formData.description?.trim()) {
      alert('Inventory item description is required by NIST OSCAL schema.');
      return;
    }
    onSave(formData);
    onClose();
  };

  const implementedCompUuids = new Set(
    (formData['implemented-components'] || []).map(ic => ic['component-uuid'])
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-drawer-title"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div className="flex items-center gap-3">
            <h2 id="inv-drawer-title" className="text-lg font-bold text-gray-900 dark:text-white">
              🖥️ Edit Asset Inventory Item
            </h2>
            {getProp('is-scanned') === 'yes' && (
              <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 px-2 py-0.5 rounded font-semibold">
                🛡️ Scanned
              </span>
            )}
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
            Asset Identity & Network
          </button>
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'components'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('components')}
          >
            Implemented Components ({formData['implemented-components']?.length || 0})
          </button>
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'props'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('props')}
          >
            All Properties & Template
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
                  Asset Description <span className="text-red-500">* (OSCAL requirement: description binds asset name/purpose)</span>
                </label>
                <textarea
                  className={styles['form-textarea']}
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g. Primary production PostgreSQL RDS instance (eu-central-1)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Asset Tag / Name</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('asset-tag')}
                    onChange={(e) => setProp('asset-tag', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. srv-prod-db-01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Asset ID / Hardware ID</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('asset-id')}
                    onChange={(e) => setProp('asset-id', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. i-0abcd1234ef567890"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Asset Type</label>
                  {isEditing ? (
                    <select
                      className={styles['form-select']}
                      value={getProp('asset-type')}
                      onChange={(e) => setProp('asset-type', e.target.value)}
                    >
                      <option value="">Select Asset Type...</option>
                      {ASSET_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-800">
                      {getProp('asset-type') || 'Not specified'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Scanned Asset?</label>
                  {isEditing ? (
                    <select
                      className={styles['form-select']}
                      value={getProp('is-scanned')}
                      onChange={(e) => setProp('is-scanned', e.target.value)}
                    >
                      <option value="">Unspecified</option>
                      <option value="yes">Yes (Subject to automated vulnerability scan)</option>
                      <option value="no">No (Exempt / Not scanned)</option>
                    </select>
                  ) : (
                    <div className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-800">
                      {getProp('is-scanned') || 'Unspecified'}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 pt-2">Network Addressing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">IPv4 Address</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('ipv4-address')}
                    onChange={(e) => setProp('ipv4-address', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. 10.0.1.50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">IPv6 Address</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('ipv6-address')}
                    onChange={(e) => setProp('ipv6-address', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. 2001:db8::1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">FQDN / Hostname</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('fqdn')}
                    onChange={(e) => setProp('fqdn', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. db-primary.internal.acme.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">MAC Address</label>
                  <input
                    type="text"
                    className={styles['form-input']}
                    value={getProp('mac-address')}
                    onChange={(e) => setProp('mac-address', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. 00:1A:2B:3C:4D:5E"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Physical / Cloud Location</label>
                <input
                  type="text"
                  className={styles['form-input']}
                  value={getProp('physical-location')}
                  onChange={(e) => setProp('physical-location', e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. AWS eu-central-1a / Data Center Rack B4"
                />
              </div>
            </div>
          )}

          {activeTab === 'components' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Link this physical or virtual inventory item to the logical system component(s) it implements.
              </div>

              {components.length === 0 ? (
                <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed rounded dark:border-gray-700">
                  No system components exist in this SSP yet. Add components first in the Components sub-tab.
                </div>
              ) : (
                <div className="space-y-2">
                  {components.map((comp) => {
                    const isChecked = implementedCompUuids.has(comp.uuid);
                    return (
                      <div
                        key={comp.uuid}
                        className={`p-3 rounded border flex items-center justify-between transition-colors ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isEditing && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleComponentLinkage(comp.uuid)}
                              className="rounded"
                            />
                          )}
                          <div>
                            <div className="font-semibold text-sm text-gray-900 dark:text-white">
                              {comp.type === 'this-system' ? '👑 ' : ''}{comp.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              Type: <span className="font-mono">{comp.type}</span> | UUID: {comp.uuid.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 px-2 py-0.5 rounded font-semibold">
                            Linked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'props' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Baseline Template Reference Link (rel="baseline-template")
                </label>
                <input
                  type="text"
                  className={styles['form-input']}
                  value={getTemplateLink()}
                  onChange={(e) => setTemplateLink(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. https://benchmarks.cisecurity.org/cis-ubuntu-22-04.json or #resource-uuid"
                />
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Custom Properties</h3>
                <PropsEditor
                  props={formData.props || []}
                  onChange={(newProps) => setFormData({ ...formData, props: newProps })}
                  isEditing={isEditing}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded"
                onClick={() => {
                  if (confirm(`Delete inventory item "${formData.description}"?`)) {
                    onDelete(formData.uuid);
                    onClose();
                  }
                }}
              >
                Delete Inventory Item
              </button>
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
                Save Inventory Item
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
