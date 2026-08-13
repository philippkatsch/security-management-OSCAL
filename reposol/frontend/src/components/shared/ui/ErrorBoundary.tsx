import React, { Component, ErrorInfo, ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <h2 className={styles.title}>Something went wrong</h2>
          <p className={styles.message}>An unexpected error occurred in the application.</p>
          {this.state.error && (
            <pre className={styles.details}>
              {this.state.error.message}
            </pre>
          )}
          <button className={styles.btn} onClick={this.handleReload}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
