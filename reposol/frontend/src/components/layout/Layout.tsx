import React, { useEffect, useState } from 'react';
import styles from './Layout.module.css';
import { Navigation } from './Navigation';
import { Outlet } from 'react-router-dom';

export interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [healthStatus, setHealthStatus] = useState('checking');
  const [showDevNotice, setShowDevNotice] = useState(true);

  const dismissDevNotice = () => {
    setShowDevNotice(false);
  };

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
    <div className={styles['app-container']}>
      <Navigation />
      <div className={styles['main-content']}>
        {showDevNotice && (
          <div className={styles['development-notice-banner']} role="alert">
            <div className={styles['development-notice-content']}>
              <div className={styles['development-notice-badge']}>
                <span className={styles['notice-pulse-icon']}>🚧</span>
                <span>DEVELOPMENT MODE</span>
              </div>
              <div className={styles['development-notice-text']}>
                <strong>Important Storage Notice:</strong> Reposol is currently under active development. If you wish to retain your data permanently, please <strong>regularly download your documents and back them up locally.</strong>
              </div>
            </div>
            <div className={styles['development-notice-actions']}>
              <button 
                className={styles['development-notice-dismiss']} 
                onClick={dismissDevNotice} 
                title="Dismiss notice for this session"
                aria-label="Dismiss notice"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <header className={styles['app-header']}>
          <div className={styles['header-title']}>
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
        <main className={`content-body`}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
