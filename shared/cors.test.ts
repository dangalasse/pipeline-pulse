import { describe, expect, it } from 'vitest';
import { allowCorsOrigin } from './cors';

describe('allowCorsOrigin', () => {
  it('echoes an allowlisted origin', () => {
    expect(allowCorsOrigin('https://pipeview.galasse.dev')).toBe(
      'https://pipeview.galasse.dev',
    );
    expect(allowCorsOrigin('https://portfolio.galasse.dev')).toBe(
      'https://portfolio.galasse.dev',
    );
  });

  it('never falls back to * when Origin is missing or unknown', () => {
    expect(allowCorsOrigin(undefined)).toBe('');
    expect(allowCorsOrigin('')).toBe('');
    expect(allowCorsOrigin('https://evil.example')).toBe('');
    expect(allowCorsOrigin(undefined)).not.toBe('*');
    expect(allowCorsOrigin('https://evil.example')).not.toBe('*');
  });
});
