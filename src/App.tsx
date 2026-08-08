import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeployMeta } from '../shared/deploy-meta';
import { isLiveSha, shortSha } from '../shared/deploy-meta';
import { LocaleToggle } from './components/LocaleToggle';
import { PipelineCanvas } from './components/PipelineCanvas';
import { useLiveDemo } from './lib/use-live-demo';
import { useLocale } from './lib/use-locale';

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: DeployMeta }
  | { status: 'error'; message: string };

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: string;
        },
      ) => string;
      reset: (id: string) => void;
    };
  }
}

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

export default function App() {
  const { locale, t, toggleHref, otherLabel, currentLabel } = useLocale();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const getTurnstileToken = useCallback(() => turnstileTokenRef.current, []);
  const resetTurnstile = useCallback(() => {
    turnstileTokenRef.current = null;
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  const {
    demo,
    nodeStatuses,
    nodeDetails,
    loading: demoLoading,
    error: demoError,
    aiReview,
    aiLoading,
    logLoading,
    nodeLog,
    startDemo,
    requestAiReview,
    fetchNodeLog,
    clearNodeLog,
  } = useLiveDemo({ locale, t, getTurnstileToken, resetTurnstile });

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

    fetch('/api/demo-config')
      .then(async (res) => res.json())
      .then((cfg: { turnstileSiteKey?: string | null }) => {
        if (!cancelled && cfg.turnstileSiteKey) {
          setSiteKey(cfg.turnstileSiteKey);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !hostRef.current) return;
    let cancelled = false;

    const mount = () => {
      if (cancelled || !window.turnstile || !hostRef.current) return;
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => {
          turnstileTokenRef.current = token;
        },
        'expired-callback': () => {
          turnstileTokenRef.current = null;
        },
        'error-callback': () => {
          turnstileTokenRef.current = null;
        },
      });
    };

    if (window.turnstile) {
      mount();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector(
      'script[data-turnstile]',
    ) as HTMLScriptElement | null;
    if (!existing) {
      const s = document.createElement('script');
      s.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = '1';
      s.onload = () => mount();
      document.head.appendChild(s);
    } else {
      const id = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(id);
          mount();
        }
      }, 200);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  const meta = state.status === 'ok' ? state.data : buildTimeMeta();
  const sha = shortSha(meta.gitSha);
  const live = isLiveSha(meta.gitSha);
  const actionsUrl = `https://github.com/${meta.githubRepo}/actions`;
  const commitUrl = live
    ? `https://github.com/${meta.githubRepo}/commit/${meta.gitSha}`
    : actionsUrl;

  const demoFailed =
    demo?.workflowStatus === 'failure' ||
    Object.values(demo?.nodeStatuses ?? {}).some((s) => s === 'failure');

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="top-bar">
        <LocaleToggle
          locale={locale}
          toggleHref={toggleHref}
          otherLabel={otherLabel}
          currentLabel={currentLabel}
          switchLanguage={t.switchLanguage}
        />
      </div>
      <header className="hero">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="brand">{t.title}</h1>
        <p className="lede">{t.lede}</p>
        <div className="cta-row">
          <button
            type="button"
            className="btn primary"
            onClick={() => void startDemo()}
            disabled={demoLoading}
          >
            {demoLoading ? t.runningDemo : t.runLiveDemo}
          </button>
          <a
            className="btn ghost"
            href={actionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t.viewActions}
          </a>
          <a
            className="btn ghost"
            href={`https://github.com/${meta.githubRepo}`}
            target="_blank"
            rel="noreferrer"
          >
            {t.repository}
          </a>
        </div>
        <div className="turnstile-wrap" aria-label={t.humanCheck}>
          <div ref={hostRef} />
        </div>
        {demoError ? <p className="demo-error">{demoError}</p> : null}
        {demo?.githubRunUrl ? (
          <p className="demo-run-link">
            <span className="muted">{t.lastRunLabel}: </span>
            <a href={demo.githubRunUrl} target="_blank" rel="noreferrer">
              {t.openGithubRun} →
            </a>
          </p>
        ) : null}
      </header>

      <section className="panel" aria-labelledby="deploy-heading">
        <div className="panel-head">
          <h2 id="deploy-heading">{t.thisDeploy}</h2>
          <span className={`pill env-${meta.env}`}>{meta.env}</span>
        </div>
        <dl className="meta-grid">
          <div>
            <dt>{t.gitSha}</dt>
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
            <dt>{t.builtAt}</dt>
            <dd className="mono">{meta.buildTime}</dd>
          </div>
          <div>
            <dt>{t.edgeClock}</dt>
            <dd className="mono">{meta.edgeTime}</dd>
          </div>
          <div>
            <dt>{t.cfRay}</dt>
            <dd className="mono">{meta.region ?? '—'}</dd>
          </div>
        </dl>
        {meta.githubRunUrl ? (
          <p className="run-link">
            <a href={meta.githubRunUrl} target="_blank" rel="noreferrer">
              {t.openRunLink}
            </a>
          </p>
        ) : null}
      </section>

      <section className="panel panel-canvas" aria-labelledby="belt-heading">
        <h2 id="belt-heading">{t.conveyorHeading}</h2>
        <PipelineCanvas
          locale={locale}
          t={t}
          nodeStatuses={nodeStatuses}
          nodeDetails={nodeDetails}
          runId={demo?.id}
          logLoading={logLoading}
          nodeLog={nodeLog}
          onFetchLog={fetchNodeLog}
          onClearLog={clearNodeLog}
        />
        {demoFailed ? (
          <div className="ai-review-block">
            <p className="demo-failed-label">{t.demoFailed}</p>
            <button
              type="button"
              className="btn ghost"
              onClick={() => void requestAiReview()}
              disabled={aiLoading}
            >
              {aiLoading ? t.aiReviewing : t.aiReview}
            </button>
            {aiReview ? (
              <div className="ai-review-result">
                <h3>{t.aiReviewTitle}</h3>
                {aiReview.summary ? (
                  <p>
                    <strong>{t.aiReviewTitle}:</strong> {aiReview.summary}
                  </p>
                ) : null}
                {aiReview.likelyCause ? (
                  <p>
                    <strong>Cause:</strong> {aiReview.likelyCause}
                  </p>
                ) : null}
                {aiReview.suggestedFix ? (
                  <p>
                    <strong>Fix:</strong> {aiReview.suggestedFix}
                  </p>
                ) : null}
                {aiReview.error || aiReview.message ? (
                  <p className="demo-error">
                    {aiReview.error ?? aiReview.message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <footer className="foot">
        <span>{t.footerSecrets}</span>
        <span className="mono">
          {state.status === 'loading' ? t.probingEdge : t.edgeOk}
        </span>
      </footer>
    </div>
  );
}
