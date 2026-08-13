import { describe, expect, it, vi } from 'vitest';
import { fetchGithubJobLogBody, isRedirectStatus } from './github-job-logs';

describe('isRedirectStatus', () => {
  it('accepts 3xx used by GitHub logs', () => {
    expect(isRedirectStatus(302)).toBe(true);
    expect(isRedirectStatus(307)).toBe(true);
    expect(isRedirectStatus(200)).toBe(false);
    expect(isRedirectStatus(401)).toBe(false);
  });
});

describe('fetchGithubJobLogBody', () => {
  it('returns a 200 GitHub body as-is', async () => {
    const githubRes = new Response('plain logs', { status: 200 });
    const fetchImpl = vi.fn();
    const out = await fetchGithubJobLogBody(githubRes, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await out.text()).toBe('plain logs');
  });

  it('follows Location without Authorization', async () => {
    const githubRes = new Response(null, {
      status: 302,
      headers: {
        Location:
          'https://productionresultssa.blob.core.windows.net/logs/job.zip?sas=1',
      },
    });
    const blobRes = new Response('zip-bytes', { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValue(blobRes);

    const out = await fetchGithubJobLogBody(githubRes, fetchImpl);

    expect(out).toBe(blobRes);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toContain('blob.core.windows.net');
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['User-Agent']).toBe('pipeview-worker');
  });

  it('throws when GitHub 302 has no Location', async () => {
    const githubRes = new Response(null, { status: 302 });
    await expect(fetchGithubJobLogBody(githubRes)).rejects.toThrow(
      /missing Location/,
    );
  });
});
