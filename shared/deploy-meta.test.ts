import { describe, expect, it } from 'vitest';
import { isLiveSha, shortSha } from './deploy-meta';

describe('shortSha', () => {
  it('truncates a full git sha', () => {
    expect(shortSha('abcdef1234567890')).toBe('abcdef1');
  });

  it('keeps local marker', () => {
    expect(shortSha('local')).toBe('local');
  });
});

describe('isLiveSha', () => {
  it('accepts hex shas', () => {
    expect(isLiveSha('abc1234')).toBe(true);
  });

  it('rejects local and empty', () => {
    expect(isLiveSha('local')).toBe(false);
    expect(isLiveSha('')).toBe(false);
  });
});
