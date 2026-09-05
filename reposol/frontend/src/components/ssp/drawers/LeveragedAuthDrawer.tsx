import React, { useState, useEffect } from 'react';
import styles from '../SSPPage.module.css';
import { PropsEditor } from '../../shared/PropsEditor';
import { LeveragedAuthorization } from '../../../lib/types/oscal';

export interface LeveragedAuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  auth: LeveragedAuthorization | null;
  onSave: (auth: LeveragedAuthorization) => void;
  onDelete?: (uuid: string) => void;
  isEditing: boolean;
  metadataParties?: any[];
}

export default function LeveragedAuthDrawer({
  isOpen,
  onClose,
  auth,
  onSave,
  onDelete,
  isEditing,
  metadataParties = []
}: LeveragedAuthDrawerProps) {
  const [formData, setFormData] = useState<LeveragedAuthorization | null>(null);

  useEffect(() => {
    if (auth) {
      setFormData({
        uuid: auth.uuid || crypto.randomUUID(),
        title: auth.title || '',
        'party-uuid': auth['party-uuid'] || '',
        'date-authorized': auth['date-authorized'] || new Date().toISOString().split('T')[0],
        props: auth.props ? [...auth.props] : [],
        links: auth.links ? [...auth.links] : [],
        remarks: auth.remarks || ''
      });
    } else {
      setFormData(null);
    }
  }, [auth]);

  if (!isOpen || !formData) return null;

  const getSspLink = () => {
    const l = (formData.links || []).find(link => link.rel === 'system-security-plan');
    return l ? l.href : '';
  };

  const setSspLink = (href: string) => {
    const currentLinks = [...(formData.links || [])];
    const idx = currentLinks.findIndex(link => link.rel === 'system-security-plan');
    if (href.trim()) {
      if (idx > -1) {
        currentLinks[idx] = { ...currentLinks[idx], href: href.trim() };
      } else {
        currentLinks.push({ rel: 'system-security-plan', href: href.trim() });
      }
    } else if (idx > -1) {
      currentLinks.splice(idx, 1);
    }
    setFormData({ ...formData, links: currentLinks });
  };

  const handleSave = () => {
    if (!formData.title?.trim()) {
      alert('Leveraged authorization title is required.');
      return;
    }
    if (!formData['party-uuid']?.trim()) {
      alert('Common Control Provider Party UUID is required by NIST OSCAL schema.');
      return;
    }
    const rawDate = (formData['date-authorized'] || new Date().toISOString()).trim();
    const dateAuth = rawDate.split('T')[0] || new Date().toISOString().split('T')[0];
    onSave({
      ...formData,
      'date-authorized': dateAuth
    });
    onClose();
  };

  const matchedParty = metadataParties.find(p => p.uuid === formData['party-uuid']);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-drawer-title"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div className="flex items-center gap-3">
            <h2 id="auth-drawer-title" className="text-lg font-bold text-gray-900 dark:text-white">
              🛡️ Edit Leveraged Authorization (Common Controls)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">UUID</label>
            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-700 dark:text-gray-300">
              {formData.uuid}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Authorization Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={styles['form-input']}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={!isEditing}
              placeholder="e.g. Amazon Web Services (AWS) FedRAMP High Authorization"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Common Control Provider (Party UUID) <span className="text-red-500">*</span>
            </label>
            {metadataParties.length > 0 ? (
              <div className="space-y-2">
                <select
                  className={styles['form-select']}
                  value={formData['party-uuid']}
                  onChange={(e) => setFormData({ ...formData, 'party-uuid': e.target.value })}
                  disabled={!isEditing}
                >
                  <option value="">Select Common Control Provider Party...</option>
                  {metadataParties.map((p) => (
                    <option key={p.uuid} value={p.uuid}>
                      {p.name || p['short-name'] || 'Unnamed Party'} ({p.type || 'party'}) — {p.uuid.substring(0, 8)}...
                    </option>
                  ))}
                </select>
                {matchedParty && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                    Provider: <strong>{matchedParty.name || matchedParty['short-name']}</strong> | Type: {matchedParty.type}
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                className={styles['form-input']}
                value={formData['party-uuid']}
                onChange={(e) => setFormData({ ...formData, 'party-uuid': e.target.value })}
                disabled={!isEditing}
                placeholder="Party UUID referencing metadata.parties (e.g. 12345678-abcd-...)"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Date Authorized <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={styles['form-input']}
              value={formData['date-authorized'] ? formData['date-authorized'].split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, 'date-authorized': e.target.value })}
              disabled={!isEditing}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Leveraged System Security Plan Link (rel="system-security-plan")
            </label>
            <input
              type="text"
              className={styles['form-input']}
              value={getSspLink()}
              onChange={(e) => setSspLink(e.target.value)}
              disabled={!isEditing}
              placeholder="e.g. https://compliance.aws.amazon.com/ssp or ../ssps/aws-fedramp-high.json"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Remarks</label>
            <textarea
              className={styles['form-textarea']}
              rows={3}
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              disabled={!isEditing}
              placeholder="Operational remarks regarding the leveraged authorization scope or CRM matrix..."
            />
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Custom Properties</h3>
            <PropsEditor
              props={formData.props || []}
              onChange={(newProps) => setFormData({ ...formData, props: newProps })}
              isEditing={isEditing}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/60">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded"
                onClick={() => {
                  if (confirm(`Delete leveraged authorization "${formData.title}"?`)) {
                    onDelete(formData.uuid);
                    onClose();
                  }
                }}
              >
                Delete Authorization
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
                Save Authorization
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
