import { useState } from 'react';

const navSections = [
  {
    title: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
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
        label: 'Catalogs', 
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        ) 
      },
      { 
        id: 'profiles', 
        label: 'Profiles', 
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) 
      },
      { 
        id: 'component-definitions', 
        label: 'Components', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ) 
      },
      {
        id: 'control-mappings',
        label: 'Control Mappings',
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M16 3h5v5" />
            <path d="M8 21H3v-5" />
            <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
            <path d="M21 3L14.5 9.5" />
            <path d="M3 21l6.5-6.5" />
          </svg>
        )
      }
    ]
  },
  {
    title: 'Implement',
    items: [
      { 
        id: 'ssps', 
        label: 'SSPs', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
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
        label: 'Assessment Plans', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ) 
      },
      { 
        id: 'assessment-results', 
        label: 'Assessment Results', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) 
      },
      { 
        id: 'poams', 
        label: 'POA&Ms', 
        isDev: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) 
      }
    ]
  }
];

export default function Navigation({ activeTab, onTabChange, counts = {} }) {
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

  return (
    <nav className={`navigation-sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="Main Navigation">
      <div className="nav-brand">
        <div 
          className="brand-left clickable-brand" 
          onClick={() => onTabChange('dashboard')}
          title="Go to Dashboard"
        >
          <span className="brand-logo">🛡️</span>
          <span className="brand-name">Reposol</span>
        </div>
        <button 
          className="btn-sidebar-toggle" 
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="toggle-chevron">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="toggle-chevron">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>
      </div>

      <div className="nav-scroll-container">
        {navSections.map((section, sIndex) => (
          <div key={sIndex} className="nav-section">
            <h2 className="nav-section-title">{section.title}</h2>
            <ul className="nav-list">
              {section.items.map((item) => {
                const count = counts[item.id] !== undefined ? counts[item.id] : 0;
                const showBadge = count > 0 && item.id !== 'dashboard';
                return (
                  <li key={item.id} className="nav-item">
                    <button
                      className={`nav-button ${activeTab === item.id ? 'active' : ''}`}
                      onClick={() => onTabChange(item.id)}
                      title={isCollapsed ? `${item.label} (${count})${item.isDev ? ' - Under Active Development' : ''}` : item.isDev ? 'Under Active Development' : ''}
                      aria-current={activeTab === item.id ? 'page' : undefined}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                      {item.isDev && (
                        <span className="nav-dev-badge" title="Under Active Development">
                          🚧 Dev
                        </span>
                      )}
                      {showBadge && (
                        <span className="nav-badge-count" aria-label={`${count} documents`}>
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

      <div className="nav-footer">
        {(() => {
          const urlParams = new URLSearchParams(window.location.search);
          const currentW = (
            urlParams.get('w') ||
            urlParams.get('workspace_id') ||
            urlParams.get('workspace') ||
            localStorage.getItem('reposol_workspace_id')
          );
          if (currentW === 'master' || currentW === 'templates') {
            return (
              <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: '#ffffff', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)' }}>
                👑 Master Templates Mode (Local Admin)
              </div>
            );
          }
          return null;
        })()}
        <button
          type="button"
          className="btn-secondary btn-sm"
          style={{ width: '100%', marginBottom: '8px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={() => {
            import('../lib/api.js').then(({ getWorkspaceId }) => {
              const wsId = getWorkspaceId();
              const shareUrl = `${window.location.origin}${window.location.pathname}?w=${wsId}${window.location.hash}`;
              navigator.clipboard.writeText(shareUrl);
              alert(`Workspace link copied to clipboard!\n\n${shareUrl}`);
            });
          }}
          title="Copy shareable workspace URL to clipboard"
        >
          🔗 Share Workspace Link
        </button>
        <div className="env-panel" title="Environment: conda (darkspell) | OSCAL Schema: 1.1.2">
          <div className="env-info">
            <span className="env-dot"></span>
            <span className="env-text">
              conda: <strong className="env-name">darkspell</strong>
            </span>
          </div>
          <span className="env-version">OSCAL v1.1.2</span>
        </div>
      </div>
    </nav>
  );
}
