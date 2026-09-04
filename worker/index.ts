import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { allowCorsOrigin } from '../shared/cors';
import type { DeployMeta } from '../shared/deploy-meta';
import { buildHoneypotBody } from '../shared/honeypot';
import {
  PREVIEW_LAB_URL,
  labKnobsFromEnv,
  parseLabKnobs,
} from '../shared/lab-object';
import { UPSTREAM_FAILED_MESSAGE } from '../shared/public-json';
import { AI_CONTEXT_MAX_BYTES, clampRedacted } from '../shared/redact';
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
import { workerGithubToken } from './github-access';

export interface Env {
  ASSETS: Fetcher;
  DEMO_GATE_KV: KVNamespace;
  DEPLOY_ENV: string;
  GIT_SHA: string;
  BUILD_TIME: string;
  GITHUB_RUN_URL: string;
  GITHUB_REPO: string;
  TURNSTILE_SITE_KEY: string;
  LAB_HUE?: string;
  LAB_SHAPE?: string;
  /** Optional — fine-grained PAT or GitHub App installation token behind the gate */
  GITHUB_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  DEMO_TICKET_SECRET?: string;
}

const EDGE_ANALYZE_URL = 'https://edge.galasse.dev/analyze-error';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '/api/*',
  cors({
    origin: (origin) => allowCorsOrigin(origin),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Demo-Ticket'],
  }),
);

function gateEnv(env: Env) {
  return {
    TURNSTILE_SECRET: env.TURNSTILE_SECRET,
    DEMO_TICKET_SECRET: env.DEMO_TICKET_SECRET,
    DEMO_GATE_KV: env.DEMO_GATE_KV,
    deployEnv: env.DEPLOY_ENV,
  };
}

function jsonUpstream(
  c: Context<{ Bindings: Env }>,
  code: string,
  status: 500 | 502 = 502,
) {
  return c.json({ error: code, message: UPSTREAM_FAILED_MESSAGE }, status);
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
    dispatchReady: Boolean(workerGithubToken(c.env)),
  }),
);

app.get('/api/lab-object', (c) => {
  const knobs = labKnobsFromEnv(c.env.LAB_HUE, c.env.LAB_SHAPE);
  return c.json({
    ...knobs,
    env: c.env.DEPLOY_ENV,
    gitSha: c.env.GIT_SHA,
    buildTime: c.env.BUILD_TIME,
    githubRunUrl: c.env.GITHUB_RUN_URL || null,
    previewUrl: PREVIEW_LAB_URL,
  });
});

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
    const record = await getLatestLiveDemoRun(workerGithubToken(c.env));
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
  } catch {
    return jsonUpstream(c, 'latest_failed');
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
    return jsonUpstream(c, 'ticket_failed', 500);
  }
});

app.post('/api/demo-run', async (c) => {
  const token = workerGithubToken(c.env);
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
    let raw: unknown = null;
    const contentType = c.req.header('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        raw = await c.req.json();
      } catch {
        return c.json(
          { error: 'invalid_json', message: 'Expected JSON body.' },
          400,
        );
      }
    }
    const knobs = parseLabKnobs(raw);
    if (!knobs) {
      return c.json(
        {
          error: 'bad_lab',
          message: 'hue and shape must be from the allowlist.',
        },
        400,
      );
    }
    const record = await createDemoRun(token, knobs);
    return c.json(serializeDemoRun(record), 202);
  } catch (err) {
    if (err instanceof DemoGateError) {
      return c.json({ error: err.code, message: err.message }, err.status);
    }
    if (err instanceof TokenMissingError) {
      return c.json({ error: 'unavailable', message: err.message }, 503);
    }
    return jsonUpstream(c, 'dispatch_failed');
  }
});

app.get('/api/demo-run/:id', async (c) => {
  const record = await getDemoRun(workerGithubToken(c.env), c.req.param('id'));
  if (!record) {
    return c.json({ error: 'not_found', message: 'Demo run not found.' }, 404);
  }
  return c.json(serializeDemoRun(record));
});

app.get('/api/demo-run/:id/nodes/:nodeId/logs', async (c) => {
  const token = workerGithubToken(c.env);
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
    return jsonUpstream(c, 'gate_error', 500);
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
    return jsonUpstream(c, 'logs_failed');
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
    return jsonUpstream(c, 'gate_error', 500);
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
      {
        error: 'gate_unconfigured',
        message: 'Demo gate secrets are not configured.',
      },
      503,
    );
  }

  const auth = await mintServiceAuth(secret, 'pipeview');
  const message = clampRedacted(body.message, 4000);
  const context = clampRedacted(
    body.context ?? 'Pipeview live demo failure',
    AI_CONTEXT_MAX_BYTES,
  );

  const edgeRes = await fetch(EDGE_ANALYZE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Service': 'pipeview',
      'X-Demo-Service-Ts': auth.ts,
      'X-Demo-Service-Sig': auth.sig,
    },
    body: JSON.stringify({
      message,
      context,
      locale: body.locale ?? 'pt-BR',
    }),
  });

  const text = await edgeRes.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return jsonUpstream(c, 'edge_unparseable');
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

function honeypotReply(pathname: string): Response {
  const headers = new Headers({
    'Cache-Control': 'no-store',
  });
  applySecurityHeaders(headers, false);
  return Response.json(buildHoneypotBody(pathname), {
    status: 404,
    headers,
  });
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

const FRAME_ANCESTORS = [
  "'self'",
  'https://pipeview.galasse.dev',
  'https://staging.pipeview.galasse.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
].join(' ');

async function serveAssets(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(request);
  const ct = res.headers.get('content-type') ?? '';
  if (ct && !ct.includes('application/octet-stream')) {
    return withSecurityHeaders(res, ct);
  }
  const guessed = guessMime(url.pathname);
  if (!guessed) {
    return withSecurityHeaders(res);
  }
  const headers = new Headers(res.headers);
  headers.set('Content-Type', guessed);
  applySecurityHeaders(headers, guessed.includes('text/html'));
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function applySecurityHeaders(headers: Headers, html: boolean): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (html) {
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set(
      'Content-Security-Policy',
      `frame-ancestors ${FRAME_ANCESTORS}`,
    );
  }
}

function withSecurityHeaders(res: Response, contentType?: string): Response {
  const headers = new Headers(res.headers);
  const ct = contentType ?? headers.get('content-type') ?? '';
  applySecurityHeaders(headers, ct.includes('text/html'));
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
      return withSecurityHeaders(await app.fetch(request, env, ctx));
    }
    return serveAssets(request, env);
  },
};
