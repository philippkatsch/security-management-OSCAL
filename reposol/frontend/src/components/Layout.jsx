import { useEffect, useState } from 'react';
import Navigation from './Navigation';

export default function Layout({ activeTab, onTabChange, noPadding, counts, children }) {
  const [healthStatus, setHealthStatus] = useState('checking');

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const response = await fetch('/health');
        if (response.ok) {
          const data = await response.json();
          if (active && data.status === 'ok') {
            setHealthStatus('online');
            return;
          }
        }
        if (active) setHealthStatus('offline');
      } catch (err) {
        if (active) setHealthStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="app-container">
      <Navigation activeTab={activeTab} onTabChange={onTabChange} counts={counts} />
      <div className="main-content">
        <header className="app-header">
          <div className="header-title">
            <h1>OSCAL Management System</h1>
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="health-status-container">
              <span className="health-label">Backend Status:</span>
              <span className={`health-badge ${healthStatus}`}>
                <span className="status-dot"></span>
                {healthStatus.toUpperCase()}
              </span>
            </div>
          </div>
        </header>
        <main className={`content-body ${noPadding ? 'no-padding' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
