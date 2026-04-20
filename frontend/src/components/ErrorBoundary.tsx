import React from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Unhandled UI error", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <AlertTriangle size={36} aria-hidden="true" />
            <h1>Something broke in the dashboard</h1>
            <p>
              We hit an unexpected UI error. Reload the page to recover and check if the last
              action needs to be repeated.
            </p>
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
