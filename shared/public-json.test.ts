import { describe, expect, it } from 'vitest';
import { serializeDemoRun } from '../worker/demo-run';
import { hasSecretLikeKeys } from './public-json';

describe('hasSecretLikeKeys', () => {
  it('allows health-shaped payloads', () => {
    expect(
      hasSecretLikeKeys({
        ok: true,
        service: 'pipeview',
        env: 'preview',
        gate: true,
        ts: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('flags credential field names', () => {
    expect(hasSecretLikeKeys({ token: 'x' })).toBe(true);
    expect(hasSecretLikeKeys({ nested: { password: 'x' } })).toBe(true);
  });

  it('allows demo-config booleans without token material', () => {
    expect(
      hasSecretLikeKeys({
        turnstileSiteKey: '0xpublic',
        gateReady: true,
        dispatchReady: false,
      }),
    ).toBe(false);
  });
});

describe('serializeDemoRun', () => {
  it('exposes only the public demo-run shape', () => {
    const json = serializeDemoRun({
      id: 'demo-1',
      githubRunId: 1,
      githubRunUrl:
        'https://github.com/dangalasse/pipeline-pulse/actions/runs/1',
      workflowStatus: 'completed',
      nodeStatuses: {
        push: 'success',
        ci: 'success',
        security: 'success',
        test: 'success',
        'ai-review': 'success',
        preview: 'success',
        staging: 'success',
        prod: 'success',
      },
      nodeDetails: {},
      createdAt: 1,
      errorMessage: 'token=should-not-leak',
    });
    expect(hasSecretLikeKeys(json)).toBe(false);
    expect(json.errorMessage).not.toContain('should-not-leak');
    expect(Object.keys(json).sort()).toEqual(
      [
        'createdAt',
        'errorMessage',
        'githubRunId',
        'githubRunUrl',
        'id',
        'nodeDetails',
        'nodeStatuses',
        'workflowStatus',
      ].sort(),
    );
  });
});
