import { Hono } from 'hono';
import type { DeployMeta } from '../shared/deploy-meta';

export interface Env {
  ASSETS: Fetcher;
  DEPLOY_ENV: string;
  GIT_SHA: string;
  BUILD_TIME: string;
  GITHUB_RUN_URL: string;
  GITHUB_REPO: string;
}

const app = new Hono<{ Bindings: Env }>();

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
