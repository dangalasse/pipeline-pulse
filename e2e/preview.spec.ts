import { expect, test } from '@playwright/test';
import { NODE_ORDER } from '../shared/pipeline-nodes';
import { hasSecretLikeKeys } from '../shared/public-json';

test.describe('preview palco', () => {
  test('lab is a free object with no form controls', async ({ page }) => {
    await page.goto('/lab');
    const stage = page.getByTestId('lab-stage');
    await expect(stage).toBeVisible();
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
    await expect(page.getByText(/sandbox · live-demo preview/i)).toHaveCount(0);
  });

  test('home shows snippet editor and live object', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('pipeline-canvas')).toBeVisible();
    await expect(page.getByTestId('lab-stage')).toBeVisible();
    const editor = page.getByTestId('lab-snippet');
    await expect(editor).toBeVisible();
    await page.getByTestId('lab-tab-css').click();
    const css = await editor.inputValue();
    await editor.fill(css.replaceAll('#5eead4', '#fbbf24'));
    await page.getByTestId('lab-tab-html').click();
    await expect(editor).toHaveValue(/class="cube"/);
    await page.getByTestId('lab-tab-js').click();
    await expect(editor).toHaveValue(/setProperty/);
    await expect(page.getByTestId('lab-stage')).toBeVisible();
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
  });

  test('lab-object ships a snippet, not hue knobs', async ({ request }) => {
    const res = await request.get('/api/lab-object');
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as {
      source?: string;
      sourceSha?: string;
      env: string;
      hue?: unknown;
      shape?: unknown;
    };
    expect(json.env).toBe('preview');
    expect(typeof json.source).toBe('string');
    expect(json.source?.length).toBeGreaterThan(0);
    expect(json.sourceSha).toMatch(/^[0-9a-f]{16}$/);
    expect(json.hue).toBeUndefined();
    expect(json.shape).toBeUndefined();
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
