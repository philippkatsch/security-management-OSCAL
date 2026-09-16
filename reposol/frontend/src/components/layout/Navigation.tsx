import React, { useState } from 'react';
import styles from './Navigation.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAtomValue, useAtom } from 'jotai';
import { documentCountsAtom } from '@stores/documentAtoms';
import { masterEditEnabledAtom, isMasterModeAtom } from '@stores/workspaceAtoms';
import { getWorkspaceId } from '@lib/api';
import { toast } from 'react-hot-toast';
import { useConfirm } from '@components/shared/ui/ConfirmProvider';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
  isDev?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        id: 'dashboard',
        path: '/',
        label: 'Overview',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
        )
      }
    ]
  },

  {
    title: 'Design & Tailor',
    items: [
      { 
        id: 'catalogs', 
        path: '/catalogs',
        label: 'Catalogs', 
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        ) 
      },
      { 
        id: 'profiles', 
        path: '/profiles',
        label: 'Profiles', 
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) 
      }
    ]
  },
  {
    title: 'Implement',
    items: [
      { 
        id: 'component-definitions', 
        path: '/component-definitions',
        label: 'Components', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ) 
      },
      { 
        id: 'ssps', 
        path: '/ssps',
        label: 'SSPs', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        ) 
      }
    ]
  },
  {
    title: 'Assess & Audit',
    items: [
      { 
        id: 'assessment-plans',
        path: '/assessment-plans', 
        label: 'Assessment Plans', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ) 
      },
      { 
        id: 'assessment-results', 
        path: '/assessment-results',
        label: 'Assessment Results', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) 
      },
      { 
        id: 'poams', 
        path: '/poams',
        label: 'POA&Ms', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) 
      }
    ]
  },
  {
    title: 'Tools & Crosswalks',
    items: [
      {
        id: 'control-mappings',
        path: '/control-mappings',
        label: 'Control Mappings',
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <path d="M16 3h5v5" />
            <path d="M8 21H3v-5" />
            <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
            <path d="M21 3L14.5 9.5" />
            <path d="M3 21l6.5-6.5" />
          </svg>
        )
      },
      { 
        id: 'traceability',
        path: '/traceability', 
        label: 'Traceability', 
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['nav-svg']}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ) 
      }
    ]
  }
];

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useAtomValue(documentCountsAtom);
  const masterEditEnabled = useAtomValue(masterEditEnabledAtom);
  const [isMasterMode, setIsMasterMode] = useAtom(isMasterModeAtom);
  const { confirm } = useConfirm();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.path !== '/' && path.startsWith(item.path)) {
          return item.id;
        }
      }
    }

    
    const parts = path.split('/');
    if (parts.length > 1) {
      const match = parts[1];
      if (match === 'catalog') return 'catalogs';
      if (match === 'profile') return 'profiles';
      if (match === 'control-mapping') return 'control-mappings';
      if (match === 'component-definition') return 'component-definitions';
      if (match === 'ssp') return 'ssps';
      if (match === 'poam') return 'poams';
      if (match === 'assessment-plan') return 'assessment-plans';
      if (match === 'assessment-result') return 'assessment-results';
      return match;
    }

    return 'dashboard';
  };

  const activeTab = getActiveTab();

  return (
    <nav className={`${styles['navigation-sidebar']} navigation-sidebar ${isCollapsed ? `${styles['collapsed']} collapsed` : ''}`} aria-label="Main Navigation">
      <div className={styles['nav-brand']}>
        <div 
          className={`${styles['brand-left']} brand-left clickable-brand`}
          onClick={() => navigate('/')}
          title="Go to Dashboard"
        >
          <span className={styles['brand-logo']}>🛡️</span>
          <span className={styles['brand-name']}>Reposol</span>
        </div>
        <button 
          className={`${styles['btn-sidebar-toggle']} btn-sidebar-toggle`}
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['toggle-chevron']}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['toggle-chevron']}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>
      </div>

      <div className={styles['nav-scroll-container']}>
        {navSections.map((section, sIndex) => (
          <div key={sIndex} className={styles['nav-section']}>
            <h2 className={styles['nav-section-title']}>{section.title}</h2>
            <ul className={styles['nav-list']}>
              {section.items.map((item) => {
                const count = counts[item.id as keyof typeof counts] !== undefined ? counts[item.id as keyof typeof counts] : 0;
                const showBadge = count > 0 && item.id !== 'dashboard';
                return (
                  <li key={item.id} className={styles['nav-item']}>
                    <button
                      className={`${styles['nav-button']} ${activeTab === item.id ? `${styles['active']} active` : ''}`}
                      onClick={() => {
                        const wsId = getWorkspaceId();
                        const target = wsId ? `${item.path}?w=${wsId}` : item.path;
                        navigate(target);
                      }}
                      title={isCollapsed ? `${item.label} (${count})${item.isDev ? ' - Under Active Development' : ''}` : item.isDev ? 'Under Active Development' : ''}
                      aria-current={activeTab === item.id ? 'page' : undefined}
                    >
                      <span className={styles['nav-icon']}>{item.icon}</span>
                      <span className={styles['nav-label']}>{item.label}</span>
                      {item.isDev && (
                        <span className={styles['nav-dev-badge']} title="Under Active Development">
                          🚧 Dev
                        </span>
                      )}
                      {showBadge && (
                        <span className={styles['nav-badge-count']} aria-label={`${count} documents`}>
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles['nav-footer']}>
        {/* Master Template Mode — only visible when backend has ALLOW_MASTER_EDIT=true */}
        {masterEditEnabled && (
          isMasterMode ? (
            <div
              className={styles['master-mode-badge']}
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: '#ffffff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginBottom: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4px'
              }}
              title="You are editing global Master Templates. Changes affect seed data for all new user sessions."
            >
              <span>👑 Master Templates</span>
              <button
                type="button"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '10px',
                  padding: '2px 6px',
                  lineHeight: '1'
                }}
                onClick={() => {
                  setIsMasterMode(false);
                  window.location.reload();
                }}
                title="Exit Master Mode and return to your session workspace"
              >
                Exit ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${sharedStyles['btn-secondary']} ${sharedStyles['btn-sm']}`}
              style={{
                width: '100%',
                marginBottom: '8px',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                opacity: 0.7
              }}
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Enter Master Template Mode?',
                  message: 'Changes will affect the global seed templates for all new user sessions.',
                  confirmLabel: 'Enter Master Mode',
                  variant: 'warning'
                });
                if (confirmed) {
                  setIsMasterMode(true);
                  window.location.reload();
                }
              }}
              title="Enter Master Template Mode to edit global seed data (requires ALLOW_MASTER_EDIT=true on backend)"
            >
              👑 Master Templates
            </button>
          )
        )}
        <div className={styles['env-panel']} title="Environment: conda (darkspell) | OSCAL Schema: 1.1.2">
          <div className={styles['env-row']}>
            <div className={styles['env-info']}>
              <span className={styles['env-dot']} title="Environment active"></span>
              <span className={styles['env-text']}>
                conda: <strong className={styles['env-name']}>darkspell</strong>
              </span>
            </div>
            <div className={styles['env-actions']}>
              <button
                type="button"
                className={`${styles['btn-share-workspace']} btn-share-workspace`}
                onClick={() => {
                  const wsId = getWorkspaceId();
                  const shareUrl = `${window.location.origin}${window.location.pathname}?w=${wsId}${window.location.hash}`;
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Workspace link copied to clipboard!');
                }}
                title="Share Workspace Link"
                aria-label="Share Workspace Link"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
              <ThemeToggle
                compact={true}
                className={styles['env-theme-toggle']}
              />
            </div>
          </div>
          <span className={styles['env-version']}>OSCAL v1.1.2</span>
        </div>
      </div>

    </nav>
  );
}

export default Navigation;
