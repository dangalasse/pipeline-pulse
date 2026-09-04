import { describe, expect, it } from 'vitest';
import { buildHoneypotBody, honeypotLooksSafe } from './honeypot';

describe('buildHoneypotBody', () => {
  it('is a wink, not an env dump', () => {
    const body = buildHoneypotBody('/.env');
    expect(body.ok).toBe(false);
    expect(body.hint).toBeTruthy();
    expect(body.note).toMatch(/wink/i);
    expect(honeypotLooksSafe(body)).toBe(true);
    expect(
      Object.keys(body).some((k) => /token|secret|password/i.test(k)),
    ).toBe(false);
  });

  it('is stable per path', () => {
    expect(buildHoneypotBody('/admin')).toEqual(buildHoneypotBody('/admin'));
  });
});
