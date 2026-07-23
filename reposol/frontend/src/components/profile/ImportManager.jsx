import React from 'react';

/**
 * Import Manager for OSCAL Profile imports.
 * Displays imported Catalogs and Profiles, with buttons to remove them
 * or clone their structure to the baseline custom groups.
 */
export function ImportManager({
  imports = [],
  onChange,
  availableCatalogs = [],
  availableProfiles = [],
  isEditing = false,
  onCopyStructure,
  mergeMode = 'as-is',
  onMergeModeChange
}) {
  const handleAddImport = (uuid, type) => {
    if (!uuid) return;
    const stage = type === 'profile' ? 'profiles' : 'catalogs';
    const newHref = `/api/documents/${stage}/${uuid}`;
    if (imports.some(imp => imp.href === newHref)) {
      alert('This source is already imported.');
      return;
    }
    const newImport = {
      href: newHref,
      'include-all': {},
      'with-child-controls': 'yes'
    };
    const filteredImports = imports.filter(imp => imp.href !== '#placeholder');
    onChange([...filteredImports, newImport]);
  };

  const handleRemoveImport = (idx) => {
    onChange(imports.filter((_, i) => i !== idx));
  };

  // Detect whether an import references a catalog or profile
  const getImportInfo = (href) => {
    const isProfile = href.includes('/profiles/');
    const uuidMatch = href.match(/([a-fA-F0-9-]{36})/);
    const uuid = uuidMatch ? uuidMatch[1] : null;
    
    if (isProfile && uuid) {
      const prof = availableProfiles.find(p => p.profile?.uuid === uuid);
      return {
        type: 'profile',
        title: prof?.profile?.metadata?.title || `Profile (${uuid.substring(0, 8)})`,
        icon: '⚙️'
      };
    }
    
    if (uuid) {
      const cat = availableCatalogs.find(c => c.catalog?.uuid === uuid);
      return {
        type: 'catalog',
        title: cat?.catalog?.metadata?.title || `Catalog (${uuid.substring(0, 8)})`,
        icon: '📖'
      };
    }
    
    return { type: 'unknown', title: href, icon: '🔗' };
  };

  return (
    <div className="import-manager card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '15px' }}>Imported Catalogs & Profiles</h3>
      </div>

      {/* Unified Setup Panel: Structuring Mode + Add Catalog / Profile */}
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Structuring Mode Selector (Top row) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', width: '145px', flexShrink: 0, fontWeight: '500', display: 'inline-block' }}>
            ⚙️ Structuring Mode:
          </span>
          <select
            value={mergeMode}
            onChange={(e) => onMergeModeChange && onMergeModeChange(e.target.value)}
            disabled={!isEditing}
            className="form-input"
            style={{
              flex: 1,
              height: '30px',
              fontSize: '12px',
              fontWeight: '600',
              padding: '0 8px',
              borderRadius: 'var(--radius-sm)',
              background: mergeMode === 'as-is'
                ? 'rgba(46, 160, 67, 0.15)'
                : mergeMode === 'custom'
                  ? 'rgba(56, 139, 253, 0.15)'
                  : 'rgba(210, 153, 34, 0.15)',
              borderColor: mergeMode === 'as-is'
                ? 'var(--color-success)'
                : mergeMode === 'custom'
                  ? 'var(--color-accent)'
                  : 'var(--color-warning)',
              color: mergeMode === 'as-is'
                ? 'var(--color-success)'
                : mergeMode === 'custom'
                  ? 'var(--color-accent)'
                  : 'var(--color-warning)',
              cursor: isEditing ? 'pointer' : 'default'
            }}
          >
            <option value="as-is">as-is (Original Catalog Hierarchy)</option>
            <option value="custom">custom (Custom Profile Hierarchy)</option>
            <option value="flat">flat (Unstructured List)</option>
          </select>
        </div>

        {/* Source Import Selector (single combined row for Catalogs & Profiles when editing) */}
        {isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', width: '145px', flexShrink: 0, fontWeight: '500', display: 'inline-block' }}>📥 Add Import:</span>
            <select
              onChange={(e) => {
                if (!e.target.value) return;
                const [type, uuid] = e.target.value.split(':');
                handleAddImport(uuid, type);
                e.target.value = '';
              }}
              className="form-input"
              style={{ flex: 1, height: '30px', fontSize: '12px' }}
            >
              <option value="">-- Select Catalog or Profile to Import --</option>
              {availableCatalogs.length > 0 && (
                <optgroup label="📖 Catalogs">
                  {availableCatalogs.map((cat) => (
                    <option key={cat.catalog.uuid} value={`catalog:${cat.catalog.uuid}`}>
                      📖 {cat.catalog.metadata?.title || 'Untitled'} ({cat.catalog.metadata?.version || '—'})
                    </option>
                  ))}
                </optgroup>
              )}
              {availableProfiles.length > 0 && (
                <optgroup label="⚙️ Profiles">
                  {availableProfiles.map((prof) => (
                    <option key={prof.profile.uuid} value={`profile:${prof.profile.uuid}`}>
                      ⚙️ {prof.profile.metadata?.title || 'Untitled'} ({prof.profile.metadata?.version || '—'})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}
      </div>

      {/* List of current imports */}
      {imports.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          No sources imported. Please add a catalog or a profile above.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {imports.map((imp, idx) => {
            const importInfo = getImportInfo(imp.href);
            return (
              <div
                key={idx}
                className="import-card"
                style={{
                  padding: '12px 16px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                  <span className="badge" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontSize: '10px', flexShrink: 0 }}>
                    Import #{idx + 1}
                  </span>
                  <span className="badge" style={{
                    background: importInfo.type === 'profile' ? 'var(--color-success-subtle)' : 'var(--color-surface-3)',
                    color: importInfo.type === 'profile' ? 'var(--color-success)' : 'var(--color-text-muted)',
                    fontSize: '9px',
                    flexShrink: 0
                  }}>
                    {importInfo.icon} {importInfo.type === 'profile' ? 'Profile' : 'Catalog'}
                  </span>
                  <strong style={{ fontSize: '14px', color: 'var(--color-text)', wordBreak: 'break-word' }}>{importInfo.title}</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                  {mergeMode === 'custom' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onCopyStructure && onCopyStructure(imp.href, 'all')}
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      📥 Import Full Structure
                    </button>
                  )}
                  {isEditing && (
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleRemoveImport(idx)}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
