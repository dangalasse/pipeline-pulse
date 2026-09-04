import { describe, expect, it } from 'vitest';
import { workerGithubToken } from './github-access';

describe('workerGithubToken', () => {
  it('ignores a token on the preview Worker', () => {
    expect(
      workerGithubToken({
        DEPLOY_ENV: 'preview',
        GITHUB_TOKEN: 'ghs_should_never_dispatch',
      }),
    ).toBeUndefined();
  });

  it('returns a trimmed token on production', () => {
    expect(
      workerGithubToken({
        DEPLOY_ENV: 'production',
        GITHUB_TOKEN: '  abc  ',
      }),
    ).toBe('abc');
  });
});
