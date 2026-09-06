import React, { useState } from 'react';
import styles from './Document.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { generateUUID, ROOT_KEYS } from '@lib/oscal-utils';
import { saveDocument, fetchDocuments } from '@lib/api';

const getFirstDocUuid = (docs: any[]) => {
  if (!Array.isArray(docs) || docs.length === 0) return null;
  const first = docs[0];
  const inner = first.profile || first.catalog || first['system-security-plan'] || first['component-definition'] || first['assessment-plan'] || first['assessment-results'] || first['plan-of-action-and-milestones'] || first['mapping-collection'] || first;
  return inner.uuid || first.uuid || null;
};

/**
 * Minimal Document Creation Dialog (US 0.P1).
 */
export function CreateDocumentDialog({
  stage, // e.g., 'catalogs', 'profiles', 'ssps', etc.
  onSaved,
  onCancel
}: any) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
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
    const newDoc: any = {
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
      // Minimal catalog
    } else if (stage === 'profiles') {
      // Minimal profile — user will add imports via the Imports tab
    } else if (stage === 'ssps') {
      let profileUuid = generateUUID();
      try {
        const profiles = await fetchDocuments('profiles');
        const firstProf = getFirstDocUuid(profiles);
        if (firstProf) profileUuid = firstProf;
      } catch (e) {
        // fallback
      }
      newDoc['system-security-plan'] = {
        ...newDoc['system-security-plan'],
        'import-profile': { href: `../profiles/${profileUuid}.json` },
        'system-characteristics': {
          'system-name': title.trim(),
          'system-ids': [{ id: 'sys-01' }],
          description: 'Enterprise Security System Characteristics',
          'security-sensitivity-level': 'moderate',
          'system-information': {
            'information-types': [
              {
                uuid: generateUUID(),
                title: 'System Data',
                description: 'General System Data'
              }
            ]
          },
          status: { state: 'operational' },
          'authorization-boundary': { description: 'System Authorization Boundary' }
        },
        'system-implementation': {
          users: [
            {
              uuid: generateUUID(),
              title: 'System Administrator',
              'short-name': 'admin',
              description: 'Primary administrative user account'
            }
          ],
          components: [
            {
              uuid: generateUUID(),
              type: 'software',
              title: 'Default Component',
              description: 'Default System Component',
              status: { state: 'operational' }
            }
          ]
        },
        'control-implementation': {
          description: 'System Security Plan Control Implementation',
          'implemented-requirements': [
            {
              uuid: generateUUID(),
              'control-id': 'ac-1'
            }
          ]
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
        method: 'human',
        status: 'draft',
        'matching-rationale': 'semantic',
        'mapping-description': 'Control mapping collection'
      };
      newDoc['mapping-collection'].mappings = [
        {
          uuid: generateUUID(),
          'source-resource': { href: '', type: 'catalog' },
          'target-resource': { href: '', type: 'catalog' },
          maps: []
        }
      ];
    } else if (stage === 'assessment-plans') {
      let sspUuid = generateUUID();
      try {
        const ssps = await fetchDocuments('ssps');
        const firstSsp = getFirstDocUuid(ssps);
        if (firstSsp) sspUuid = firstSsp;
      } catch (e) {
        // fallback
      }
      newDoc['assessment-plan'] = {
        ...newDoc['assessment-plan'],
        'import-ssp': { href: `../ssps/${sspUuid}.json` },
        'reviewed-controls': {
          'control-selections': [
            {
              'include-all': {}
            }
          ]
        }
      };
    } else if (stage === 'assessment-results') {
      let apUuid = generateUUID();
      try {
        const aps = await fetchDocuments('assessment-plans');
        const firstAp = getFirstDocUuid(aps);
        if (firstAp) apUuid = firstAp;
      } catch (e) {
        // fallback
      }
      newDoc['assessment-results'] = {
        ...newDoc['assessment-results'],
        'import-ap': { href: `../assessment-plans/${apUuid}.json` },
        results: [
          {
            uuid: generateUUID(),
            title: 'Initial Assessment Result',
            description: 'Default assessment result',
            start: now,
            'reviewed-controls': {
              'control-selections': [
                {
                  'include-all': {}
                }
              ]
            }
          }
        ]
      };
    } else if (stage === 'poams') {
      let sspUuid = generateUUID();
      try {
        const ssps = await fetchDocuments('ssps');
        const firstSsp = getFirstDocUuid(ssps);
        if (firstSsp) sspUuid = firstSsp;
      } catch (e) {
        // fallback
      }
      newDoc['plan-of-action-and-milestones'] = {
        ...newDoc['plan-of-action-and-milestones'],
        'import-ssp': { href: `../ssps/${sspUuid}.json` },
        'poam-items': [
          {
            uuid: generateUUID(),
            title: 'Initial Remediation Action',
            description: 'Placeholder remediation item'
          }
        ]
      };
    }

    try {
      const skipValidation = stage === 'profiles';
      await saveDocument(stage, newDoc, { skipValidation });
      onSaved(newDoc);
    } catch (err: any) {
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
            <label htmlFor="create-doc-title" style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              Document Title
            </label>
            <input
              id="create-doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Reposol Core Baseline (Title)"
              className="form-input"
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
              disabled={saving}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              className={sharedStyles['btn-secondary']}
              onClick={onCancel}
              disabled={saving}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={sharedStyles['btn-primary']}
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
