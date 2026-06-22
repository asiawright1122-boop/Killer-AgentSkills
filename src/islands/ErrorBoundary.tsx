import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export const PUBLIC_ERROR_BOUNDARY_DETAIL = 'The page hit a runtime error. Please retry the action.';

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error?: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error.message, errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded-xl text-center">
          <p className="text-red-600 dark:text-red-400 font-semibold mb-2">Something went wrong</p>
          <p className="text-sm text-red-500 dark:text-red-500/80 mb-4">{PUBLIC_ERROR_BOUNDARY_DETAIL}</p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
