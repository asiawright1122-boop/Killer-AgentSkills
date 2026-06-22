import { describe, expect, it } from 'vitest';
import ErrorBoundary, { PUBLIC_ERROR_BOUNDARY_DETAIL } from './ErrorBoundary';

function collectText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';

  const props = (node as { props?: { children?: unknown } }).props;
  const children = props?.children;
  if (Array.isArray(children)) return children.map(collectText).join(' ');
  return collectText(children);
}

describe('ErrorBoundary', () => {
  it('renders a generic public error instead of the thrown exception message', () => {
    const boundary = new ErrorBoundary({ children: null });
    (boundary as any).state = ErrorBoundary.getDerivedStateFromError(
      new Error('<thinking>private renderer notes</thinking>Public-looking failure'),
    );

    const text = collectText(boundary.render());

    expect(text).toContain('Something went wrong');
    expect(text).toContain(PUBLIC_ERROR_BOUNDARY_DETAIL);
    expect(text).not.toMatch(/thinking|private renderer notes|Public-looking failure/i);
  });
});
