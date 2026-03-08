import { describe, it, expect } from 'vitest';
import { ApiError, jsonResponse, errorResponse, withErrorHandling } from './api-utils';

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
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true });
  });

  it('should support custom status and headers', async () => {
    const res = jsonResponse({ created: true }, 201, { 'X-Custom': 'yes' });
    expect(res.status).toBe(201);
    expect(res.headers.get('X-Custom')).toBe('yes');
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
    const res = errorResponse(err);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: 'oops' });
  });

  it('should handle non-Error values', async () => {
    const res = errorResponse('string error');
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('should use fallback status for non-ApiError', async () => {
    const res = errorResponse(new Error('fail'), 503);
    expect(res.status).toBe(503);
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
    const handler = withErrorHandling(async () => {
      throw new Error('unexpected');
    });
    const res = await handler(dummyRequest, {});
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ success: false, error: 'unexpected' });
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
