import React, { useState } from 'react';
import { generateUUID, ROOT_KEYS } from '../../lib/oscal-utils';
import { saveDocument } from '../../lib/api';

/**
 * Minimal Document Creation Dialog (US 0.P1).
 */
export function CreateDocumentDialog({
  stage, // e.g., 'catalogs', 'profiles', 'ssps', etc.
  onSaved,
  onCancel
}) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty.');
      return;
    }
    setError('');
    setSaving(true);

    const uuid = generateUUID();
    const rootKey = ROOT_KEYS[stage];
    const now = new Date().toISOString();

    // Create minimal valid OSCAL skeleton based on stage schema
    const newDoc = {
      [rootKey]: {
        uuid,
        metadata: {
          title: title.trim(),
          'last-modified': now,
          version: '1.0.0',
          'oscal-version': '1.1.2'
        }
      }
    };

    // Stage-specific additions to satisfy schemas (US 0.P1)
    if (stage === 'catalogs') {
      // Omit empty groups and controls to satisfy minItems: 1 validation rules
    } else if (stage === 'profiles') {
      newDoc.profile.imports = [
        {
          href: '#placeholder',
          'include-all': {}
        }
      ];
    } else if (stage === 'ssps') {
      newDoc['system-security-plan'] = {
        ...newDoc['system-security-plan'],
        'import-profile': { href: '#placeholder' },
        'system-characteristics': {
          'system-name': title.trim(),
          'security-sensitivity-level': 'moderate',
          description: 'Minimal Security System characteristics',
          'system-status': { state: 'operational' },
          'authorization-boundary': { description: 'Authorization boundary' }
        }
      };
    } else if (stage === 'component-definitions') {
      newDoc['component-definition'].components = [
        {
          uuid: generateUUID(),
          type: 'software',
          title: 'Initial Component',
          description: 'Placeholder component'
        }
      ];
    } else if (stage === 'control-mappings') {
      newDoc['mapping-collection'].provenance = {
        method: 'manual',
        status: 'draft'
      };
      newDoc['mapping-collection'].mappings = [];
    }

    try {
      await saveDocument(stage, newDoc);
      onSaved(newDoc);
    } catch (err) {
      setError(err.message || 'Creation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        className="modal-panel shadow-2xl"
        style={{
          width: '450px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
            Create New OSCAL Document
          </h3>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: 'none', background: 'none', color: 'var(--color-text)', fontSize: '18px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {error && <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>⚠️ {error}</div>}

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Reposol Core Baseline"
              className="form-input"
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
              disabled={saving}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={saving}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !title.trim()}
              style={{ padding: '6px 16px', fontSize: '12px' }}
            >
              {saving ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
