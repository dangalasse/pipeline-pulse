import { useEffect, useState } from 'react';
import type { DeployMeta } from '../shared/deploy-meta';
import { isLiveSha, shortSha } from '../shared/deploy-meta';

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: DeployMeta }
  | { status: 'error'; message: string };

function buildTimeMeta(): DeployMeta {
  return {
    service: 'pipeline-pulse',
    env: import.meta.env.VITE_DEPLOY_ENV || 'local',
    gitSha: import.meta.env.VITE_GIT_SHA || 'local',
    buildTime: import.meta.env.VITE_BUILD_TIME || 'local',
    githubRunUrl: import.meta.env.VITE_GITHUB_RUN_URL || null,
    githubRepo: 'dangalasse/pipeline-pulse',
    edgeTime: new Date().toISOString(),
    region: null,
  };
}

const PIPELINE_STEPS = [
  { id: 'ci', label: 'CI', detail: 'lint · typecheck · test · build' },
  {
    id: 'preview',
    label: 'PR Preview',
    detail: 'Cloudflare Workers preview URL',
  },
  { id: 'staging', label: 'Staging', detail: 'push main → smoke /api/health' },
  { id: 'prod', label: 'Production', detail: 'tag v* · protected environment' },
] as const;

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const fallback = buildTimeMeta();

    fetch('/api/deploy-meta')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DeployMeta;
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({
          status: 'ok',
          data: { ...fallback, region: `offline:${message}` },
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const meta = state.status === 'ok' ? state.data : buildTimeMeta();
  const sha = shortSha(meta.gitSha);
  const live = isLiveSha(meta.gitSha);
  const actionsUrl = `https://github.com/${meta.githubRepo}/actions`;
  const commitUrl = live
    ? `https://github.com/${meta.githubRepo}/commit/${meta.gitSha}`
    : actionsUrl;

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="hero">
        <p className="eyebrow">galasse · devops showcase</p>
        <h1 className="brand">Pipeline Pulse</h1>
        <p className="lede">
          Live meta-dashboard for a full GitHub Actions conveyor — Cloudflare
          Workers at the edge.
        </p>
        <div className="cta-row">
          <a
            className="btn primary"
            href={actionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            View Actions
          </a>
          <a
            className="btn ghost"
            href={`https://github.com/${meta.githubRepo}`}
            target="_blank"
            rel="noreferrer"
          >
            Repository
          </a>
        </div>
      </header>

      <section className="panel" aria-labelledby="deploy-heading">
        <div className="panel-head">
          <h2 id="deploy-heading">This deploy</h2>
          <span className={`pill env-${meta.env}`}>{meta.env}</span>
        </div>
        <dl className="meta-grid">
          <div>
            <dt>Git SHA</dt>
            <dd>
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="mono"
              >
                {sha}
              </a>
            </dd>
          </div>
          <div>
            <dt>Built at</dt>
            <dd className="mono">{meta.buildTime}</dd>
          </div>
          <div>
            <dt>Edge clock</dt>
            <dd className="mono">{meta.edgeTime}</dd>
          </div>
          <div>
            <dt>CF-Ray</dt>
            <dd className="mono">{meta.region ?? '—'}</dd>
          </div>
        </dl>
        {meta.githubRunUrl ? (
          <p className="run-link">
            <a href={meta.githubRunUrl} target="_blank" rel="noreferrer">
              Open the workflow run that shipped this build →
            </a>
          </p>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="belt-heading">
        <h2 id="belt-heading">Conveyor belt</h2>
        <ol className="belt">
          {PIPELINE_STEPS.map((step, index) => (
            <li key={step.id} className="belt-step">
              <span className="step-index">{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="foot">
        <span>OIDC-ready secrets · Environments staging / production</span>
        <span className="mono">
          {state.status === 'loading' ? 'probing edge…' : 'edge ok'}
        </span>
      </footer>
    </div>
  );
}
