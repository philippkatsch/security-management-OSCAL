import React, { useState, useEffect } from 'react';
import { DebouncedInput } from './DebouncedInput';

/**
 * Increment the minor segment of a semver-style version string.
 * E.g. "5.2.0" → "5.3.0", "2.1" → "2.2", "1" → "2"
 */
function nextMinorVersion(version) {
  if (!version) return '1.0.0';
  const parts = version.split('.');
  if (parts.length >= 2) {
    parts[1] = String(Number(parts[1] || 0) + 1);
    // Reset patch to 0 if present
    if (parts.length >= 3) parts[2] = '0';
    return parts.join('.');
  }
  // Single number – just increment
  return String(Number(parts[0] || 0) + 1);
}

/**
 * Slide-over Version Drawer.
 */
export function VersionDrawer({
  versions = [],
  currentVersion = null,
  onSwitch,
  onDelete,
  onSave,
  show = false,
  onClose,
  isEditing = false
}) {
  const [versionNum, setVersionNum] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-increment: pre-fill version number when drawer opens
  useEffect(() => {
    if (show && currentVersion) {
      setVersionNum(nextMinorVersion(currentVersion));
      setError('');
    }
  }, [show, currentVersion]);

  if (!show) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!versionNum.trim()) {
      setError('Version number cannot be empty.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(versionNum.trim(), remarks.trim());
      setVersionNum('');
      setRemarks('');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="version-drawer-overlay"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={onClose}
    >
      <div
        className="version-drawer-panel shadow-2xl"
        style={{
          width: '380px',
          background: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Version History</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', color: 'var(--color-text)', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Save Version Form */}
        {isEditing && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Save New Version</h4>
            
            {error && <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>⚠️ {error}</div>}

            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Version (e.g. 1.0.0)</label>
              <input
                type="text"
                value={versionNum}
                onChange={(e) => setVersionNum(e.target.value)}
                placeholder="e.g. 1.0.1"
                className="form-input"
                style={{ width: '100%', height: '30px', fontSize: '12px' }}
                disabled={saving}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Initial release"
                className="form-input"
                style={{ width: '100%', height: '30px', fontSize: '12px' }}
                disabled={saving}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '6px', fontSize: '12px', marginTop: '4px' }}
              disabled={saving}
            >
              {saving ? 'Saving...' : '💾 Create Version'}
            </button>
          </form>
        )}

        {/* History List */}
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Version List</h4>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {versions.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No versions available.</p>
          ) : (
            versions.map((v) => {
              const isActive = v.is_active || v.version === currentVersion;
              return (
                <div
                  key={v.version}
                  className="version-item-card"
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'var(--color-surface-2)' : 'var(--color-surface)',
                    border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: isActive ? 'default' : 'pointer'
                  }}
                  onClick={() => !isActive && onSwitch(v.version)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                      <strong
                        style={{
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={`v${v.version}`}
                      >
                        v{v.version}
                      </strong>
                      {isActive && (
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 600,
                            background: 'var(--color-primary)',
                            color: 'white',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    {/* Delete version button (only for historical non-active versions) */}
                    {!isActive && onDelete && (
                      <button
                        type="button"
                        className="btn-delete"
                        style={{ padding: '2px 6px', fontSize: '11px', flexShrink: 0 }}
                        title="Delete version"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to delete version ${v.version}?`)) {
                            onDelete(v.version);
                          }
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                  {v.remarks && <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text)' }}>{v.remarks}</p>}
                  {v['last-modified'] && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      Modified: {new Date(v['last-modified']).toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
