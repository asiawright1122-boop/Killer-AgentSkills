import React, { type ComponentType } from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * HOC that wraps a component with an ErrorBoundary.
 * Use this to protect client-side islands from crashing the whole page.
 *
 * Usage: export default withErrorBoundary(MyComponent)
 */
export default function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  fallback?: React.ReactNode,
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundary.displayName = `WithErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}
