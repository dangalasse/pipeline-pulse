import { describe, expect, it } from 'vitest';
import {
  AI_CONTEXT_MAX_BYTES,
  clampRedacted,
  redactSecrets,
  sanitizeLogText,
  stripAnsi,
  truncateLog,
} from './redact';

describe('redactSecrets', () => {
  it('redacts GitHub, npm, AWS, JWT and Bearer material', () => {
    const ghp = `ghp_${'A'.repeat(36)}`;
    const pat = `github_pat_${'B'.repeat(22)}`;
    const gho = `gho_${'C'.repeat(36)}`;
    const ghs = `ghs_${'D'.repeat(36)}`;
    const npm = `npm_${'E'.repeat(36)}`;
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturexx';
    const blob = [
      ghp,
      pat,
      gho,
      ghs,
      npm,
      jwt,
      'Bearer abcdefghijklmnop',
      'AKIAIOSFODNN7EXAMPLE',
      'token=super-secret-value',
      'api_key: also-secret',
    ].join('\n');
    const out = redactSecrets(blob);
    expect(out).not.toContain(ghp);
    expect(out).not.toContain(pat);
    expect(out).not.toContain(gho);
    expect(out).not.toContain(ghs);
    expect(out).not.toContain(npm);
    expect(out).not.toContain(jwt);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('super-secret-value');
    expect(out).not.toContain('also-secret');
    expect(out).not.toContain('abcdefghijklmnop');
  });

  it('redacts Azure-style SAS query params', () => {
    const url =
      'https://example.blob.core.windows.net/logs/job.zip?sas=secretblob&sig=abc%2Bdef&se=2026-01-01';
    const out = redactSecrets(url);
    expect(out).not.toContain('secretblob');
    expect(out).not.toContain('abc%2Bdef');
    expect(out).toMatch(/sas=\[REDACTED\]/);
    expect(out).toMatch(/sig=\[REDACTED\]/);
  });

  it('redacts Location header lines in job logs', () => {
    const log =
      'Location: https://productionresultssa.blob.core.windows.net/logs/job.zip?sas=secretblob';
    const out = redactSecrets(log);
    expect(out).toBe('Location: [REDACTED]');
    expect(out).not.toContain('blob.core.windows.net');
  });
});

describe('sanitizeLogText', () => {
  it('strips ANSI then redacts', () => {
    const esc = String.fromCharCode(27);
    const raw = `${esc}[31mtoken=visible-secret${esc}[0m`;
    const out = sanitizeLogText(raw);
    expect(out).not.toContain(esc);
    expect(out).not.toContain('visible-secret');
  });
});

describe('stripAnsi + truncateLog', () => {
  it('keeps a short log intact', () => {
    expect(stripAnsi('plain')).toBe('plain');
    expect(truncateLog('ok')).toEqual({ text: 'ok', truncated: false });
  });

  it('truncates by line count', () => {
    const text = Array.from({ length: 250 }, (_, i) => `line-${i}`).join('\n');
    const { truncated, text: out } = truncateLog(text);
    expect(truncated).toBe(true);
    expect(out.split('\n').length).toBe(200);
  });
});

describe('clampRedacted', () => {
  it('caps payload size after redaction', () => {
    const out = clampRedacted(
      `token=${'x'.repeat(5000)}`,
      AI_CONTEXT_MAX_BYTES,
    );
    expect(out.length).toBeLessThanOrEqual(AI_CONTEXT_MAX_BYTES);
    expect(out).not.toContain('xxxxx');
  });
});
