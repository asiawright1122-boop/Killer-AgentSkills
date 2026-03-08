import { test, expect } from '@playwright/test';

const devUrl = 'http://localhost:4321';

test.describe('API Endpoints E2E', () => {
  test('GET /api/health should return health status', async ({ request }) => {
    const res = await request.get(`${devUrl}/api/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('checks');
    expect(['healthy', 'degraded']).toContain(body.status);
    expect(body.checks).toHaveProperty('kv');
    expect(body.checks).toHaveProperty('d1');
  });

  test('GET /api/skills should return skills list', async ({ request }) => {
    const res = await request.get(`${devUrl}/api/skills`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Should return an object with skills array or similar structure
    expect(typeof body).toBe('object');
  });

  test('GET /api/categories should return categories', async ({ request }) => {
    const res = await request.get(`${devUrl}/api/categories`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('POST /api/skills/submit should reject empty body', async ({ request }) => {
    const res = await request.post(`${devUrl}/api/skills/submit`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('GET /api/skills/search should accept query params', async ({ request }) => {
    const res = await request.get(`${devUrl}/api/skills/search?q=mcp&limit=5`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe('object');
  });
});
