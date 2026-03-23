import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-layout">
          <div className="app-error-content">
            <AlertTriangle size={28} color="var(--color-error)" />
            <h1>Something went wrong</h1>
            <p>The app hit an unexpected error. Refresh the page and try again.</p>
            <div className="app-error-actions">
              <button type="button" className="app-error-reload-btn" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
