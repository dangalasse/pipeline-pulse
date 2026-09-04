import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoGateError, enforceTicketAndQuota, issueTicket } from './demo-gate';

const emptyKv = {
  get: async () => null,
  put: async () => undefined,
} as unknown as KVNamespace;

describe('demo gate fail-closed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuses to mint a ticket without secrets', async () => {
    await expect(
      issueTicket(
        { DEMO_GATE_KV: emptyKv },
        'pipeview.dispatch',
        '127.0.0.1',
        'turnstile-token',
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'DemoGateError',
        status: 503,
        code: 'gate_unconfigured',
      }),
    );
  });

  it('rejects a dummy Turnstile failure without calling production', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain('challenges.cloudflare.com');
      expect(url).not.toContain('pipeview.galasse.dev');
      return Response.json({ success: false });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      issueTicket(
        {
          TURNSTILE_SECRET: 'dummy-turnstile',
          DEMO_TICKET_SECRET: 'dummy-ticket',
          DEMO_GATE_KV: emptyKv,
        },
        'pipeview.dispatch',
        '127.0.0.1',
        'dummy-token',
      ),
    ).rejects.toMatchObject({
      name: 'DemoGateError',
      status: 403,
      code: 'turnstile_failed',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('refuses enforce without DEMO_TICKET_SECRET', async () => {
    const request = new Request('https://pipeview.galasse.dev/api/demo-run', {
      method: 'POST',
    });
    await expect(
      enforceTicketAndQuota(
        { DEMO_GATE_KV: emptyKv },
        request,
        'pipeview.dispatch',
        'ticket',
      ),
    ).rejects.toBeInstanceOf(DemoGateError);
  });
});
