import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { DeployMeta } from '../shared/deploy-meta';
import {
  DemoGateError,
  clientIp,
  enforceTicketAndQuota,
  issueTicket,
  mintServiceAuth,
} from './demo-gate';
import {
  TokenMissingError,
  createDemoRun,
  fetchNodeJobLogs,
  getDemoRun,
  getLatestLiveDemoRun,
  isNodeId,
  serializeDemoRun,
} from './demo-run';

export interface Env {
  ASSETS: Fetcher;
  DEMO_GATE_KV: KVNamespace;
  DEPLOY_ENV: string;
  GIT_SHA: string;
  BUILD_TIME: string;
  GITHUB_RUN_URL: string;
  GITHUB_REPO: string;
  TURNSTILE_SITE_KEY: string;
  /** Optional — fine-grained PAT or GitHub App installation token behind the gate */
  GITHUB_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  DEMO_TICKET_SECRET?: string;
}

const EDGE_ANALYZE_URL = 'https://edge.galasse.dev/analyze-error';

const CORS_ORIGINS = [
  'https://pipeview.galasse.dev',
  'https://staging.pipeview.galasse.dev',
  'https://pipeline.galasse.dev',
  'https://staging.pipeline.galasse.dev',
  'https://portfolio.galasse.dev',
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
];

const app = new Hono<{ Bindings: Env }>();

app.use(
  '/api/*',
  cors({
    origin: (origin) =>
      !origin || CORS_ORIGINS.includes(origin) ? origin || '*' : '',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Demo-Ticket'],
  }),
);

function gateEnv(env: Env) {
  return {
    TURNSTILE_SECRET: env.TURNSTILE_SECRET,
    DEMO_TICKET_SECRET: env.DEMO_TICKET_SECRET,
    DEMO_GATE_KV: env.DEMO_GATE_KV,
  };
}

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'pipeview',
    env: c.env.DEPLOY_ENV,
    gate: Boolean(c.env.TURNSTILE_SECRET && c.env.DEMO_TICKET_SECRET),
    ts: new Date().toISOString(),
  }),
);

app.get('/api/demo-config', (c) =>
  c.json({
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
    gateReady: Boolean(c.env.TURNSTILE_SECRET && c.env.DEMO_TICKET_SECRET),
    dispatchReady: Boolean(c.env.GITHUB_TOKEN?.trim()),
  }),
);

app.get('/api/deploy-meta', (c) => {
  const meta: DeployMeta = {
    service: 'pipeview',
    env: c.env.DEPLOY_ENV,
    gitSha: c.env.GIT_SHA,
    buildTime: c.env.BUILD_TIME,
    githubRunUrl: c.env.GITHUB_RUN_URL || null,
    githubRepo: c.env.GITHUB_REPO,
    edgeTime: new Date().toISOString(),
    region: c.req.header('cf-ray') ?? null,
  };
  return c.json(meta);
});

/** Last real live-demo.yml run — public GitHub read, no secret. */
app.get('/api/demo-run/latest', async (c) => {
  try {
    const record = await getLatestLiveDemoRun(c.env.GITHUB_TOKEN?.trim());
    if (!record) {
      return c.json({
        id: null,
        githubRunId: null,
        githubRunUrl: null,
        workflowStatus: 'idle',
        nodeStatuses: null,
        createdAt: null,
        errorMessage: null,
        message: 'No live-demo runs yet.',
      });
    }
    return c.json(serializeDemoRun(record));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'latest_failed', message }, 502);
  }
});

app.post('/api/demo-ticket', async (c) => {
  let body: { turnstileToken?: string; aud?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: 'invalid_json', message: 'Expected JSON body.' },
      400,
    );
  }
  try {
    const issued = await issueTicket(
      gateEnv(c.env),
      body.aud ?? 'pipeview.dispatch',
      clientIp(c.req.raw),
      body.turnstileToken ?? '',
    );
    return c.json(issued);
  } catch (err) {
    if (err instanceof DemoGateError) {
      return c.json({ error: err.code, message: err.message }, err.status);
    }
    return c.json({ error: 'ticket_failed', message: String(err) }, 500);
  }
});

app.post('/api/demo-run', async (c) => {
  const token = c.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return c.json(
      {
        error: 'unavailable',
        message:
          'Live dispatch requires GITHUB_TOKEN (fine-grained actions:write) behind the demo gate. Last run is still visible above.',
      },
      503,
    );
  }

  try {
    await enforceTicketAndQuota(
      gateEnv(c.env),
      c.req.raw,
      'pipeview.dispatch',
      c.req.header('X-Demo-Ticket'),
    );
    const record = await createDemoRun(token);
    return c.json(serializeDemoRun(record), 202);
  } catch (err) {
    if (err instanceof DemoGateError) {
      return c.json({ error: err.code, message: err.message }, err.status);
    }
    if (err instanceof TokenMissingError) {
      return c.json({ error: 'unavailable', message: err.message }, 503);
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'dispatch_failed', message }, 502);
  }
});

app.get('/api/demo-run/:id', async (c) => {
  const record = await getDemoRun(
    c.env.GITHUB_TOKEN?.trim(),
    c.req.param('id'),
  );
  if (!record) {
    return c.json({ error: 'not_found', message: 'Demo run not found.' }, 404);
  }
  return c.json(serializeDemoRun(record));
});

app.get('/api/demo-run/:id/nodes/:nodeId/logs', async (c) => {
  const token = c.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return c.json(
      {
        error: 'unavailable',
        message:
          'Job logs require GITHUB_TOKEN behind the Demo Gate (same as dispatch).',
      },
      503,
    );
  }

  const nodeIdRaw = c.req.param('nodeId');
  if (!isNodeId(nodeIdRaw)) {
    return c.json(
      { error: 'bad_node', message: `Unknown node "${nodeIdRaw}".` },
      400,
    );
  }

  try {
    await enforceTicketAndQuota(
      gateEnv(c.env),
      c.req.raw,
      'pipeview.logs',
      c.req.header('X-Demo-Ticket'),
    );
  } catch (err) {
    if (err instanceof DemoGateError) {
      return c.json({ error: err.code, message: err.message }, err.status);
    }
    return c.json({ error: 'gate_error', message: String(err) }, 500);
  }

  const record = await getDemoRun(token, c.req.param('id'));
  if (!record) {
    return c.json({ error: 'not_found', message: 'Demo run not found.' }, 404);
  }

  try {
    const logs = await fetchNodeJobLogs(token, record, nodeIdRaw);
    return c.json({
      nodeId: logs.nodeId,
      truncated: logs.truncated,
      text: logs.text,
      lines: logs.text.split(/\r?\n/).length,
      fetchedAt: logs.fetchedAt,
      githubJobId: logs.githubJobId,
    });
  } catch (err) {
    if (err instanceof TokenMissingError) {
      return c.json({ error: 'unavailable', message: err.message }, 503);
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'logs_failed', message }, 502);
  }
});

app.post('/api/demo-ai-review', async (c) => {
  try {
    await enforceTicketAndQuota(
      gateEnv(c.env),
      c.req.raw,
      'edge.analyze',
      c.req.header('X-Demo-Ticket'),
    );
  } catch (err) {
    if (err instanceof DemoGateError) {
      return c.json({ error: err.code, message: err.message }, err.status);
    }
    return c.json({ error: 'gate_error', message: String(err) }, 500);
  }

  let body: { message?: string; context?: string; locale?: string };
  try {
    body = await c.req.json<{
      message?: string;
      context?: string;
      locale?: string;
    }>();
  } catch {
    return c.json(
      { error: 'invalid_json', message: 'Expected JSON body.' },
      400,
    );
  }

  if (!body.message?.trim()) {
    return c.json(
      { error: 'missing_message', message: 'Field "message" is required.' },
      400,
    );
  }

  const secret = c.env.DEMO_TICKET_SECRET;
  if (!secret) {
    return c.json(
      { error: 'gate_unconfigured', message: 'DEMO_TICKET_SECRET missing.' },
      503,
    );
  }

  const auth = await mintServiceAuth(secret, 'pipeview');

  const edgeRes = await fetch(EDGE_ANALYZE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Service': 'pipeview',
      'X-Demo-Service-Ts': auth.ts,
      'X-Demo-Service-Sig': auth.sig,
    },
    body: JSON.stringify({
      message: body.message,
      context: body.context ?? 'Pipeview live demo failure',
      locale: body.locale ?? 'pt-BR',
    }),
  });

  const text = await edgeRes.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return c.json(
      {
        error: 'edge_unparseable',
        message: 'Edge Labs returned non-JSON.',
        status: edgeRes.status,
        raw: text.slice(0, 500),
      },
      502,
    );
  }

  return c.json(payload, edgeRes.ok ? 200 : 502);
});

/** WHY: bait paths for scanners — playful, no secrets, no privilege path. */
const HONEYPOT_PATHS = new Set([
  '/.env',
  '/.env.local',
  '/.git/config',
  '/wp-admin',
  '/wp-login.php',
  '/admin',
  '/admin/login',
  '/api/v1/secrets',
  '/api/secrets',
  '/phpmyadmin',
  '/server-status',
  '/actuator/env',
]);

const HONEYPOT_REPLIES = [
  { pt: 'tenta mais', en: 'try again' },
  { pt: 'ainda não', en: 'not yet' },
  { pt: 'quase lá', en: 'almost' },
  { pt: 'boa tentativa', en: 'nice try' },
];

function honeypotReply(pathname: string): Response {
  const pick =
    HONEYPOT_REPLIES[Math.abs(hashStr(pathname)) % HONEYPOT_REPLIES.length] ??
    HONEYPOT_REPLIES[0];
  return Response.json(
    {
      ok: false,
      hint: pick.pt,
      hint_en: pick.en,
      note: 'Fourth wall: scanners get a wink, not a foothold.',
    },
    {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function guessMime(pathname: string): string | null {
  const path = pathname === '/' || pathname === '' ? '/index.html' : pathname;
  const lower = path.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('/'))
    return 'text/html; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs'))
    return 'text/javascript; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (!lower.includes('.')) return 'text/html; charset=utf-8';
  return null;
}

async function serveAssets(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(request);
  const ct = res.headers.get('content-type') ?? '';
  if (ct && !ct.includes('application/octet-stream')) {
    return res;
  }
  const guessed = guessMime(url.pathname);
  if (!guessed) {
    return res;
  }
  const headers = new Headers(res.headers);
  headers.set('Content-Type', guessed);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname;
    // Brand rename: keep legacy hostnames working via redirect (HTML) / dual CORS (API).
    if (
      (host === 'pipeline.galasse.dev' ||
        host === 'staging.pipeline.galasse.dev') &&
      !url.pathname.startsWith('/api/')
    ) {
      const targetHost =
        host === 'staging.pipeline.galasse.dev'
          ? 'staging.pipeview.galasse.dev'
          : 'pipeview.galasse.dev';
      url.hostname = targetHost;
      return Response.redirect(url.toString(), 301);
    }
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (HONEYPOT_PATHS.has(path) || HONEYPOT_PATHS.has(url.pathname)) {
      return honeypotReply(path);
    }
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    return serveAssets(request, env);
  },
};
