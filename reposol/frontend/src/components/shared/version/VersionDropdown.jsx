import React, { useState, useRef, useEffect } from 'react';
import './VersionDropdown.css';

/**
 * Formats a version object or string cleanly for display.
 * Prevents raw ISO timestamp clutter like "v2026-07-16T05:11:52..."
 */
function formatVersionDisplay(ver) {
  if (!ver) return 'v1.0.0';
  const verStr = typeof ver === 'string' ? ver : (ver.version || ver.oscal_version || '1.0.0');
  const isDraft = typeof ver === 'object' ? Boolean(ver.is_draft) : verStr.endsWith('-draft');

  if (isDraft) {
    return '📝 Draft';
  }

  // Handle ISO timestamp string formatted as version (e.g. "2026-07-16T05:11:52.605669+00:00")
  if (/^\d{4}-\d{2}-\d{2}T/.test(verStr)) {
    try {
      const date = new Date(verStr.replace(/-draft$/, ''));
      if (!isNaN(date.getTime())) {
        const formattedDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return `v1.0 (${formattedDate} ${formattedTime})`;
      }
    } catch (e) {
      // fallback
    }
  }

  return verStr.startsWith('v') ? verStr : `v${verStr}`;
}

/**
 * Unified Header Version & Draft Selector Dropdown.
 * Replaces standalone status selector and right-side version history drawer.
 * Automatically displays "Draft" when unsaved edits exist, and lists all published versions.
 */
export default function VersionDropdown({
  activeVersion = '1.0.0',
  versions = [],
  hasDraft = false,
  isDirty = false,
  isEditing = false,
  onSelectVersion,
  onSaveVersion,
  onDeleteDraft,
  documentTitle = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const dropdownRef = useRef(null);

  const showDraftPill = hasDraft || isDirty;
  const currentSelectionIsDraft = selectedVersion === 'draft' || (selectedVersion === null && showDraftPill);
  const displayVersion = selectedVersion && selectedVersion !== 'draft' ? selectedVersion : activeVersion;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleVersionClick = (ver) => {
    // In edit mode, version switching is blocked
    if (isEditing) return;
    // Normalize: always pass a string or 'draft' to the callback
    const verStr = ver === 'draft' ? 'draft'
      : typeof ver === 'string' ? ver
      : (ver.version || ver.oscal_version || ver);
    setSelectedVersion(verStr);
    if (onSelectVersion) {
      onSelectVersion(verStr);
    }
    setIsOpen(false);
  };

  const handlePublishClick = () => {
    if (onSaveVersion) {
      onSaveVersion();
    }
    setIsOpen(false);
  };

  const handleDeleteDraftClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onDeleteDraft) {
      onDeleteDraft();
    }
    setSelectedVersion(null);
    setIsOpen(false);
  };

  // Filter out standalone draft from main versions list if rendered separately
  const publishedVersions = versions.filter(v => {
    if (typeof v === 'string') return !v.endsWith('-draft');
    return !v.is_draft && !v.version?.endsWith('-draft');
  });

  const draftVersions = versions.filter(v => {
    if (typeof v === 'string') return v.endsWith('-draft');
    return v.is_draft || v.version?.endsWith('-draft');
  });

  return (
    <div className="version-dropdown-container" ref={dropdownRef}>
      <button 
        type="button"
        data-testid="version-dropdown-toggle"
        className={`version-dropdown-toggle ${currentSelectionIsDraft ? 'is-draft' : ''} ${isEditing ? 'is-locked' : ''}`}
        onClick={() => { if (!isEditing) setIsOpen(!isOpen); }}
        title={isEditing ? 'Version switching is disabled during editing' : 'Click to view version history and draft state'}
        style={isEditing ? { cursor: 'default', opacity: 0.85 } : undefined}
      >
        {isEditing ? (
          <span className="version-badge version-badge--draft">
            📝 Draft (editing)
          </span>
        ) : currentSelectionIsDraft ? (
          <span className="version-badge version-badge--draft">
            📝 Draft
          </span>
        ) : (
          <span className="version-badge version-badge--published">
            {formatVersionDisplay(displayVersion)}
          </span>
        )}
        {!isEditing && <span className="version-dropdown-arrow">▼</span>}
        {isEditing && <span className="version-dropdown-arrow" style={{ opacity: 0.4 }}>🔒</span>}
      </button>

      {isOpen && (
        <div className="version-dropdown-menu">
          <div className="version-dropdown-header">
            <span>Version History</span>
            {versions.length > 0 && (
              <span className="version-count-badge">{versions.length} release{versions.length > 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="version-dropdown-body">
            {/* Draft Section if active draft exists */}
            {(showDraftPill || draftVersions.length > 0) && (
              <div 
                className={`version-dropdown-item version-dropdown-item--draft ${currentSelectionIsDraft ? 'active' : ''}`}
                onClick={() => handleVersionClick('draft')}
              >
                <div className="version-dropdown-item-header">
                  <span className="version-badge version-badge--draft">📝 Draft</span>
                  {onDeleteDraft && (
                    <button
                      type="button"
                      className="version-delete-draft-btn"
                      onClick={handleDeleteDraftClick}
                      title="Delete draft and revert to published version"
                    >
                      🗑️ Delete Draft
                    </button>
                  )}
                </div>
                <span className="version-dropdown-item-desc">
                  Temporarily saved (Draft)
                </span>
              </div>
            )}

            {/* Published Versions List */}
            {publishedVersions.length > 0 ? (
              <ul className="version-dropdown-list">
                {publishedVersions.map((ver, idx) => {
                  const verStr = typeof ver === 'string' ? ver : (ver.version || ver.oscal_version || `1.0.${idx}`);
                  const isSelected = !showDraftPill && verStr === activeVersion;
                  const dateStr = typeof ver === 'object' ? (ver.published || ver.last_modified || ver.date) : null;
                  const remarks = typeof ver === 'object' ? (ver.remarks || ver.title) : null;
                  const defaultRemarks = (ver.is_active || isSelected) ? 'Active version' : 'Historical version';

                  return (
                    <li 
                      key={(verStr || idx) + '-' + idx}
                      className={`version-dropdown-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleVersionClick(ver)}
                    >
                      <div className="version-dropdown-item-header">
                        <span className="version-badge version-badge--published">
                          {formatVersionDisplay(ver)}
                        </span>
                        {dateStr && (
                          <span className="version-date">
                            {new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div className="version-dropdown-item-desc">
                        {remarks || defaultRemarks}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !showDraftPill && draftVersions.length === 0 && (
                <div className="version-dropdown-empty">
                  No published versions recorded yet.
                </div>
              )
            )}
          </div>

          {/* Footer Action to Publish New Version — only when a draft exists */}
          {onSaveVersion && (showDraftPill || draftVersions.length > 0) && (
            <div className="version-dropdown-footer">
              <button 
                type="button"
                className="version-publish-btn"
                onClick={handlePublishClick}
              >
                🚀 Publish New Version
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

VersionDropdown.displayName = 'VersionDropdown';
