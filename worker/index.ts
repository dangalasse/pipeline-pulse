import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { DeployMeta } from '../shared/deploy-meta';
import {
  RateLimitError,
  createDemoRun,
  getDemoRun,
  serializeDemoRun,
} from './demo-run';

export interface Env {
  ASSETS: Fetcher;
  DEPLOY_ENV: string;
  GIT_SHA: string;
  BUILD_TIME: string;
  GITHUB_RUN_URL: string;
  GITHUB_REPO: string;
  GITHUB_TOKEN?: string;
}

const EDGE_ANALYZE_URL = 'https://edge.galasse.dev/analyze-error';

const CORS_ORIGINS = [
  'https://pipeline.galasse.dev',
  'https://staging.pipeline.galasse.dev',
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
      !origin || CORS_ORIGINS.includes(origin) ? origin : '',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'pipeline-pulse',
    env: c.env.DEPLOY_ENV,
    ts: new Date().toISOString(),
  }),
);

app.get('/api/deploy-meta', (c) => {
  const meta: DeployMeta = {
    service: 'pipeline-pulse',
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

app.post('/api/demo-run', async (c) => {
  const token = c.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return c.json(
      {
        error: 'unavailable',
        message:
          'Live demo requires GITHUB_TOKEN Worker secret. See README for setup.',
      },
      503,
    );
  }

  try {
    const record = await createDemoRun(token);
    return c.json(serializeDemoRun(record), 202);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return c.json({ error: 'rate_limited', message: err.message }, 429);
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'dispatch_failed', message }, 502);
  }
});

app.get('/api/demo-run/:id', async (c) => {
  const token = c.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return c.json(
      {
        error: 'unavailable',
        message:
          'Live demo requires GITHUB_TOKEN Worker secret. See README for setup.',
      },
      503,
    );
  }

  const record = await getDemoRun(token, c.req.param('id'));
  if (!record) {
    return c.json({ error: 'not_found', message: 'Demo run not found.' }, 404);
  }
  return c.json(serializeDemoRun(record));
});

app.post('/api/demo-ai-review', async (c) => {
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

  const edgeRes = await fetch(EDGE_ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: body.message,
      context: body.context ?? 'Pipeline Pulse live demo failure',
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

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
