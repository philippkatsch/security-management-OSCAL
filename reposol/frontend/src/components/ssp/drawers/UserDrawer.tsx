import React, { useState, useEffect } from 'react';
import styles from '../SSPPage.module.css';
import { PropsEditor } from '../../shared/PropsEditor';
import { SystemUser, AuthorizedPrivilege } from '../../../lib/types/oscal';
import { STANDARD_SSP_ROLES } from '../SystemCharacteristicsEditor';

export interface UserDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: SystemUser | null;
  onSave: (user: SystemUser) => void;
  onDelete?: (uuid: string) => void;
  isEditing: boolean;
  metadataRoles?: any[];
}

export default function UserDrawer({
  isOpen,
  onClose,
  user,
  onSave,
  onDelete,
  isEditing,
  metadataRoles = []
}: UserDrawerProps) {
  const [formData, setFormData] = useState<SystemUser | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'privileges' | 'props'>('general');

  useEffect(() => {
    if (user) {
      setFormData({
        uuid: user.uuid || crypto.randomUUID(),
        title: user.title || '',
        'short-name': user['short-name'] || '',
        description: user.description || '',
        props: user.props ? [...user.props] : [],
        'role-ids': user['role-ids'] ? [...user['role-ids']] : [],
        'authorized-privileges': user['authorized-privileges']
          ? JSON.parse(JSON.stringify(user['authorized-privileges']))
          : [],
        remarks: user.remarks || ''
      });
    } else {
      setFormData(null);
    }
  }, [user]);

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

  const addPrivilegeBlock = () => {
    const current = [...(formData['authorized-privileges'] || [])];
    const newPriv: AuthorizedPrivilege = {
      title: 'New Authorized Privilege',
      description: '',
      'functions-performed': ['Perform administrative tasks']
    };
    setFormData({ ...formData, 'authorized-privileges': [...current, newPriv] });
  };

  const removePrivilegeBlock = (index: number) => {
    const current = (formData['authorized-privileges'] || []).filter((_, i) => i !== index);
    setFormData({ ...formData, 'authorized-privileges': current });
  };

  const updatePrivilegeBlock = (index: number, updates: Partial<AuthorizedPrivilege>) => {
    const current = [...(formData['authorized-privileges'] || [])];
    current[index] = { ...current[index], ...updates };
    setFormData({ ...formData, 'authorized-privileges': current });
  };

  const addFunctionToPrivilege = (privIdx: number) => {
    const current = [...(formData['authorized-privileges'] || [])];
    const priv = { ...current[privIdx] };
    const funcs = [...(priv['functions-performed'] || []), 'New authorized function'];
    priv['functions-performed'] = funcs;
    current[privIdx] = priv;
    setFormData({ ...formData, 'authorized-privileges': current });
  };

  const updateFunctionInPrivilege = (privIdx: number, funcIdx: number, value: string) => {
    const current = [...(formData['authorized-privileges'] || [])];
    const priv = { ...current[privIdx] };
    const funcs = [...(priv['functions-performed'] || [])];
    funcs[funcIdx] = value;
    priv['functions-performed'] = funcs;
    current[privIdx] = priv;
    setFormData({ ...formData, 'authorized-privileges': current });
  };

  const removeFunctionFromPrivilege = (privIdx: number, funcIdx: number) => {
    const current = [...(formData['authorized-privileges'] || [])];
    const priv = { ...current[privIdx] };
    const funcs = (priv['functions-performed'] || []).filter((_, i) => i !== funcIdx);
    priv['functions-performed'] = funcs.length > 0 ? funcs : ['Standard operation'];
    current[privIdx] = priv;
    setFormData({ ...formData, 'authorized-privileges': current });
  };

  const handleSave = () => {
    if (!formData.title?.trim()) {
      alert('User class title is required.');
      return;
    }
    onSave(formData);
    onClose();
  };

  const availableRoles = metadataRoles.length > 0
    ? metadataRoles.map(r => ({ id: r.id, title: r.title || r.id }))
    : STANDARD_SSP_ROLES;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div className="flex items-center gap-3">
            <h2 id="user-drawer-title" className="text-lg font-bold text-gray-900 dark:text-white">
              👤 Edit System User Class
            </h2>
            {getProp('privilege-level') && (
              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                getProp('privilege-level') === 'privileged'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              }`}>
                {getProp('privilege-level')}
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
            User Details & Roles
          </button>
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'privileges'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('privileges')}
          >
            Authorized Privileges ({formData['authorized-privileges']?.length || 0})
          </button>
          <button
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${
              activeTab === 'props'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('props')}
          >
            Properties
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
                  User Class Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={styles['form-input']}
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g. Cloud Infrastructure Administrator"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Short Name / Moniker</label>
                <input
                  type="text"
                  className={styles['form-input']}
                  value={formData['short-name'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'short-name': e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g. CloudAdmin"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">User Access Type</label>
                  {isEditing ? (
                    <select
                      className={styles['form-select']}
                      value={getProp('type')}
                      onChange={(e) => setProp('type', e.target.value)}
                    >
                      <option value="">Select Type...</option>
                      <option value="internal">Internal (Organizational Staff)</option>
                      <option value="external">External (Third-Party / Contractor)</option>
                      <option value="general-public">General Public</option>
                    </select>
                  ) : (
                    <div className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-800">
                      {getProp('type') || 'Not specified'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Privilege Level</label>
                  {isEditing ? (
                    <select
                      className={styles['form-select']}
                      value={getProp('privilege-level')}
                      onChange={(e) => setProp('privilege-level', e.target.value)}
                    >
                      <option value="">Select Privilege Level...</option>
                      <option value="privileged">Privileged (Superuser / Admin Access)</option>
                      <option value="non-privileged">Non-Privileged (Standard User)</option>
                      <option value="no-logical-access">No Logical Access</option>
                    </select>
                  ) : (
                    <div className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-800">
                      {getProp('privilege-level') || 'Not specified'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  className={styles['form-textarea']}
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Describe the scope, responsibilities, and access boundaries for this user class..."
                />
              </div>

              {/* Role IDs */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Associated Roles ({formData['role-ids']?.length || 0})
                </label>
                {isEditing ? (
                  <div className="p-3 border rounded border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-2">
                    {availableRoles.map((role) => {
                      const isChecked = (formData['role-ids'] || []).includes(role.id);
                      return (
                        <label key={role.id} className="inline-flex items-center gap-1.5 text-xs bg-white dark:bg-gray-900 border px-2.5 py-1 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentRoles = formData['role-ids'] || [];
                              let nextRoles: string[];
                              if (e.target.checked) {
                                nextRoles = [...currentRoles, role.id];
                              } else {
                                nextRoles = currentRoles.filter((r) => r !== role.id);
                              }
                              setFormData({ ...formData, 'role-ids': nextRoles });
                            }}
                          />
                          <span className="font-medium text-gray-800 dark:text-gray-200">{role.title}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(formData['role-ids'] || []).map((r) => (
                      <span key={r} className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded font-medium">
                        {availableRoles.find((ar) => ar.id === r)?.title || r}
                      </span>
                    ))}
                    {(!formData['role-ids'] || formData['role-ids'].length === 0) && (
                      <span className="text-xs text-gray-500 italic">No roles associated</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'privileges' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Authorized Privileges Matrix
                </h3>
                {isEditing && (
                  <button
                    type="button"
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-2.5 py-1 rounded"
                    onClick={addPrivilegeBlock}
                  >
                    + Add Privilege
                  </button>
                )}
              </div>

              {(!formData['authorized-privileges'] || formData['authorized-privileges'].length === 0) && (
                <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed rounded dark:border-gray-700">
                  No authorized privileges defined. Click "+ Add Privilege" to declare authorized functions.
                </div>
              )}

              {(formData['authorized-privileges'] || []).map((priv, privIdx) => (
                <div
                  key={privIdx}
                  className="p-4 border rounded border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      className="text-xs font-bold p-1.5 border rounded flex-1 mr-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Privilege Title (e.g. Cluster Administration)"
                      value={priv.title}
                      onChange={(e) => updatePrivilegeBlock(privIdx, { title: e.target.value })}
                      disabled={!isEditing}
                    />
                    {isEditing && (
                      <button
                        type="button"
                        className="text-red-500 text-xs hover:underline"
                        onClick={() => removePrivilegeBlock(privIdx)}
                      >
                        Remove Privilege
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    className="text-xs p-1.5 border rounded w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Description / Context (optional)"
                    value={priv.description || ''}
                    onChange={(e) => updatePrivilegeBlock(privIdx, { description: e.target.value })}
                    disabled={!isEditing}
                  />

                  {/* Functions Performed */}
                  <div className="pl-3 border-l-2 border-indigo-400 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold uppercase text-gray-500">
                        Functions Performed (minItems: 1)
                      </span>
                      {isEditing && (
                        <button
                          type="button"
                          className="text-[11px] text-blue-600 hover:underline"
                          onClick={() => addFunctionToPrivilege(privIdx)}
                        >
                          + Add Function
                        </button>
                      )}
                    </div>

                    {(priv['functions-performed'] || []).map((func, funcIdx) => (
                      <div key={funcIdx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          className="flex-1 text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={func}
                          onChange={(e) => updateFunctionInPrivilege(privIdx, funcIdx, e.target.value)}
                          disabled={!isEditing}
                          placeholder="e.g. Deploy workloads, Rotate credentials"
                        />
                        {isEditing && (priv['functions-performed'] || []).length > 1 && (
                          <button
                            type="button"
                            className="text-red-500 text-xs hover:text-red-700"
                            onClick={() => removeFunctionFromPrivilege(privIdx, funcIdx)}
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

          {activeTab === 'props' && (
            <div className="space-y-4">
              <PropsEditor
                props={formData.props || []}
                onChange={(newProps) => setFormData({ ...formData, props: newProps })}
                isEditing={isEditing}
              />
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
                  if (confirm(`Delete user class "${formData.title}"?`)) {
                    onDelete(formData.uuid);
                    onClose();
                  }
                }}
              >
                Delete User Class
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
                Save User Class
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
