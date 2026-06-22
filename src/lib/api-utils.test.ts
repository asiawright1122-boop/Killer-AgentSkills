import { afterEach, describe, it, expect, vi } from 'vitest';
import { ApiError, jsonResponse, errorResponse, withErrorHandling } from './api-utils';
import { findHiddenReasoningPublicOutputMatches } from './public-ai-output';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('ApiError', () => {
  it('should create error with default status 500', () => {
    const err = new ApiError('something broke');
    expect(err.message).toBe('something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBeUndefined();
    expect(err.name).toBe('ApiError');
  });

  it('should create error with custom status and code', () => {
    const err = new ApiError('not found', 404, 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('jsonResponse', () => {
  it('should return JSON response with correct content type', async () => {
    const res = jsonResponse({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true });
  });

  it('should support custom status and headers', async () => {
    const res = jsonResponse({ created: true }, 201, { 'X-Custom': 'yes', 'X-Robots-Tag': 'noindex' });
    expect(res.status).toBe(201);
    expect(res.headers.get('X-Custom')).toBe('yes');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('should sanitize hidden reasoning markers before serializing public JSON', async () => {
    const res = jsonResponse({
      '<thinking>private key</thinking>name': '<analysis>private notes</analysis>Public value',
      nested: {
        text: 'Scratchpad:\nprivate scratch\n\nPublic detail',
      },
    });

    const body = (await res.json()) as Record<string, any>;
    expect(body.name).toBe('Public value');
    expect(body.nested.text).toBe('Public detail');
    expect(findHiddenReasoningPublicOutputMatches(JSON.stringify(body))).toEqual([]);
  });
});

describe('errorResponse', () => {
  it('should handle ApiError with status and code', async () => {
    const err = new ApiError('bad input', 400, 'VALIDATION');
    const res = errorResponse(err);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: 'bad input', code: 'VALIDATION' });
  });

  it('should handle ApiError without code', async () => {
    const err = new ApiError('forbidden', 403);
    const res = errorResponse(err);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: 'forbidden' });
    expect(body.code).toBeUndefined();
  });

  it('should handle generic Error', async () => {
    const err = new Error('oops');
    const consoleError = mockConsoleError();
    const res = errorResponse(err);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: 'Internal server error' });
    expect(consoleError).toHaveBeenCalledWith('[API Error]', err);
  });

  it('should handle non-Error values', async () => {
    const consoleError = mockConsoleError();
    const res = errorResponse('string error');
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(consoleError).toHaveBeenCalledWith('[API Error]', 'string error');
  });

  it('should use fallback status for non-ApiError', async () => {
    const err = new Error('fail');
    const consoleError = mockConsoleError();
    const res = errorResponse(err, 503);
    expect(res.status).toBe(503);
    expect(consoleError).toHaveBeenCalledWith('[API Error]', err);
  });

  it('should sanitize hidden reasoning markers from error messages', async () => {
    const err = new Error('Hidden reasoning:\nprivate notes\n\nPublic failure');
    const consoleError = mockConsoleError();
    const res = errorResponse(err);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Internal server error');
    expect(findHiddenReasoningPublicOutputMatches(JSON.stringify(body))).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith('[API Error]', err);
  });
});

describe('withErrorHandling', () => {
  const dummyRequest = new Request('https://example.com/api/test');

  it('should pass through successful responses', async () => {
    const handler = withErrorHandling(async () => {
      return jsonResponse({ ok: true });
    });
    const res = await handler(dummyRequest, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true });
  });

  it('should catch ApiError and return structured error', async () => {
    const handler = withErrorHandling(async () => {
      throw new ApiError('bad request', 400, 'INVALID');
    });
    const res = await handler(dummyRequest, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: 'bad request', code: 'INVALID' });
  });

  it('should catch generic errors and return 500', async () => {
    const consoleError = mockConsoleError();
    const err = new Error('unexpected');
    const handler = withErrorHandling(async () => {
      throw err;
    });
    const res = await handler(dummyRequest, {});
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: 'Internal server error' });
    expect(consoleError).toHaveBeenCalledWith('[API Error]', err);
  });

  it('should forward request and context to handler', async () => {
    const handler = withErrorHandling(async (req, ctx) => {
      return jsonResponse({ url: req.url, hasCtx: !!(ctx as Record<string, unknown>).env });
    });
    const res = await handler(dummyRequest, { env: true });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ url: 'https://example.com/api/test', hasCtx: true });
  });
});
