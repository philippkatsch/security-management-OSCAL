import React, { useState, useRef, useEffect } from 'react';
import styles from './Version.module.css';

/**
 * Formats a version object or string cleanly for display.
 * Prevents raw ISO timestamp clutter like "v2026-07-16T05:11:52..."
 */
function formatVersionDisplay(ver: any) {
  if (!ver) return 'v1.0.0';
  const verStr = typeof ver === 'string' ? ver : (ver.version || ver.oscal_version || '1.0.0');
  const isDraft = typeof ver === 'object' ? Boolean(ver.is_draft) : verStr.endsWith('-draft');

  if (isDraft) {
    return 'Draft';
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
}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showDraftPill = hasDraft || isDirty;
  const currentSelectionIsDraft = selectedVersion === 'draft' || (selectedVersion === null && showDraftPill);
  const displayVersion = selectedVersion && selectedVersion !== 'draft' ? selectedVersion : activeVersion;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleVersionClick = (ver: any) => {
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

  const handleDeleteDraftClick = (e?: React.MouseEvent) => {
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
  const publishedVersions = versions.filter((v: any) => {
    if (typeof v === 'string') return !v.endsWith('-draft');
    return !v?.is_draft && !v?.version?.endsWith?.('-draft');
  });

  const draftVersions = versions.filter((v: any) => {
    if (typeof v === 'string') return v.endsWith('-draft');
    return v?.is_draft || v?.version?.endsWith?.('-draft');
  });

  return (
    <div className={styles['version-dropdown-container']} ref={dropdownRef}>
      <button 
        type="button"
        data-testid="version-dropdown-toggle"
        className={`${styles['version-dropdown-toggle']} ${currentSelectionIsDraft ? styles['is-draft'] : ''} ${isEditing ? styles['is-locked'] : ''}`}
        onClick={() => { if (!isEditing) setIsOpen(!isOpen); }}
        title={isEditing ? 'Version switching is disabled during editing' : 'Click to view version history and draft state'}
        style={isEditing ? { cursor: 'default', opacity: 0.85 } : undefined}
      >
        {isEditing ? (
          <span className={`${styles['version-badge']} ${styles['version-badge--draft']}`}>
            <span className={`${styles['indicator-dot']} ${styles['indicator-dot--draft']}`} />
            Draft (editing)
          </span>
        ) : currentSelectionIsDraft ? (
          <span className={`${styles['version-badge']} ${styles['version-badge--draft']}`}>
            <span className={`${styles['indicator-dot']} ${styles['indicator-dot--draft']}`} />
            Draft
          </span>
        ) : (
          <span className={`${styles['version-badge']} ${styles['version-badge--published']}`}>
            {formatVersionDisplay(displayVersion)}
          </span>
        )}
        {!isEditing && <span className={styles['version-dropdown-arrow']}>▾</span>}
      </button>

      {isOpen && (
        <div className={styles['version-dropdown-menu']}>
          <div className={styles['version-dropdown-header']}>
            <span className={styles['version-header-title']}>Version History</span>
            {versions.length > 0 && (
              <span className={styles['version-count-badge']}>
                {versions.length} {versions.length === 1 ? 'version' : 'versions'}
              </span>
            )}
          </div>

          <div className={styles['version-dropdown-body']}>
            {/* Draft Section if active draft exists */}
            {(showDraftPill || draftVersions.length > 0) && (
              <div 
                className={`${styles['version-dropdown-item']} ${styles['version-dropdown-item--draft']} version-dropdown-item version-dropdown-item--draft ${currentSelectionIsDraft ? styles['selected'] : ''}`}
                onClick={() => handleVersionClick('draft')}
              >
                <div className={styles['version-dropdown-item-header']}>
                  <span className={`${styles['version-badge']} ${styles['version-badge--draft']}`}>
                    <span className={`${styles['indicator-dot']} ${styles['indicator-dot--draft']}`} />
                    Draft
                  </span>
                  {onDeleteDraft && (
                    <button
                      type="button"
                      className={styles['version-delete-draft-btn']}
                      onClick={handleDeleteDraftClick}
                      title="Discard draft and revert to published version"
                    >
                      Discard Draft
                    </button>
                  )}
                </div>
                <div className={styles['version-dropdown-item-desc']}>
                  Unpublished working changes
                </div>
              </div>
            )}

            {/* Published Versions List */}
            {publishedVersions.length > 0 ? (
              <ul className={styles['version-dropdown-list']}>
                {publishedVersions.map((ver: any, idx: number) => {
                  const verStr = typeof ver === 'string' ? ver : (ver.version || ver.oscal_version || `1.0.${idx}`);
                  const isSelected = !showDraftPill && verStr === activeVersion;
                  const dateStr = typeof ver === 'object' && ver !== null ? (ver.published || ver.last_modified || ver.date) : null;
                  const remarks = typeof ver === 'object' && ver !== null ? (ver.remarks || ver.title) : null;

                  return (
                    <li 
                      key={(verStr || idx) + '-' + idx}
                      className={`${styles['version-dropdown-item']} version-dropdown-item ${isSelected ? styles['selected'] : ''}`}
                      onClick={() => handleVersionClick(ver)}
                    >
                      <div className={styles['version-dropdown-item-header']}>
                        <div className={styles['version-item-title-wrap']}>
                          <span className={`${styles['version-badge']} ${styles['version-badge--published']}`}>
                            {formatVersionDisplay(ver)}
                          </span>
                          {isSelected && (
                            <span className={styles['version-active-tag']}>Active</span>
                          )}
                        </div>
                        {dateStr && (
                          <span className={styles['version-date']}>
                            {new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {remarks && (
                        <div className={styles['version-dropdown-item-desc']}>
                          {remarks}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              !showDraftPill && draftVersions.length === 0 && (
                <div className={styles['version-dropdown-empty']}>
                  No published versions recorded yet.
                </div>
              )
            )}
          </div>

          {/* Footer Action to Publish New Version */}
          {onSaveVersion && (showDraftPill || draftVersions.length > 0) && (
            <div className={styles['version-dropdown-footer']}>
              <button 
                type="button"
                className={styles['version-publish-btn']}
                onClick={handlePublishClick}
              >
                Publish New Version
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

VersionDropdown.displayName = 'VersionDropdown';

