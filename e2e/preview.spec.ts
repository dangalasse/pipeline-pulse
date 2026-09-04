import { expect, test } from '@playwright/test';
import { LAB_HUES, LAB_SHAPES } from '../shared/lab-object';
import { NODE_ORDER } from '../shared/pipeline-nodes';
import { hasSecretLikeKeys } from '../shared/public-json';

test.describe('preview palco', () => {
  test('lab shows allowlisted knobs and no free-text inputs', async ({
    page,
  }) => {
    await page.goto('/lab');
    const stage = page.locator(
      '[data-testid="lab-stage"], [data-lab-stage="1"]',
    );
    await expect(stage).toBeVisible();
    const hue = await stage.getAttribute('data-hue');
    const shape = await stage.getAttribute('data-shape');
    expect(LAB_HUES as readonly string[]).toContain(hue);
    expect(LAB_SHAPES as readonly string[]).toContain(shape);
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
  });

  test('canvas exposes every conveyor node', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('pipeline-canvas')).toBeVisible();
    for (const id of NODE_ORDER) {
      await expect(page.getByTestId(`pipeline-node-${id}`)).toBeVisible();
    }
  });

  test('health JSON has no credential fields', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.env).toBe('preview');
    expect(hasSecretLikeKeys(json)).toBe(false);
    expect(JSON.stringify(json)).not.toMatch(
      /ghp_|github_pat_|gho_|ghs_|Bearer /i,
    );
  });

  test('lab-object stays on the allowlist', async ({ request }) => {
    const res = await request.get('/api/lab-object');
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as {
      hue: string;
      shape: string;
      env: string;
    };
    expect(LAB_HUES as readonly string[]).toContain(json.hue);
    expect(LAB_SHAPES as readonly string[]).toContain(json.shape);
    expect(json.env).toBe('preview');
    expect(hasSecretLikeKeys(json)).toBe(false);
  });

  test('HTML document carries browser hardening headers', async ({ page }) => {
    const res = await page.goto('/lab');
    expect(res?.ok()).toBeTruthy();
    const headers = res?.headers() ?? {};
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['content-security-policy'] ?? '').toMatch(/frame-ancestors/);
  });

  test('/.env is a wink, not an env file', async ({ request }) => {
    const res = await request.get('/.env');
    expect(res.status()).toBe(404);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(false);
    expect(hasSecretLikeKeys(json)).toBe(false);
  });
});
