import { useEffect, useState } from 'react';
import { shortSha } from '../../shared/deploy-meta';
import type { LabObject } from '../../shared/lab-object';
import { DEFAULT_LAB_KNOBS, labKnobsFromEnv } from '../../shared/lab-object';
import { LabStage } from '../components/LabStage';

function fallbackObject(): LabObject {
  const knobs = labKnobsFromEnv(
    import.meta.env.VITE_LAB_HUE,
    import.meta.env.VITE_LAB_SHAPE,
  );
  return {
    ...knobs,
    env: import.meta.env.VITE_DEPLOY_ENV || 'local',
    gitSha: import.meta.env.VITE_GIT_SHA || 'local',
    buildTime: import.meta.env.VITE_BUILD_TIME || 'local',
    githubRunUrl: import.meta.env.VITE_GITHUB_RUN_URL || null,
    previewUrl: window.location.href,
  };
}

function isEmbed(): boolean {
  return new URLSearchParams(window.location.search).get('embed') === '1';
}

export function LabPage() {
  const [lab, setLab] = useState<LabObject>(fallbackObject);
  const embed = isEmbed();

  useEffect(() => {
    document.title = embed ? 'Palco' : 'Palco · Pipeview';
    let cancelled = false;
    fetch('/api/lab-object')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as LabObject;
      })
      .then((data) => {
        if (!cancelled && data.hue && data.shape) setLab(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [embed]);

  const sha = shortSha(lab.gitSha);
  const knobs = lab.hue && lab.shape ? lab : DEFAULT_LAB_KNOBS;

  return (
    <div className={`lab-page${embed ? ' lab-page--embed' : ''}`}>
      {embed ? null : <p className="lab-kicker">sandbox · live-demo preview</p>}
      <LabStage
        hue={knobs.hue}
        shape={knobs.shape}
        size={embed ? 'sm' : 'lg'}
      />
      <dl className={`lab-stamp${embed ? ' lab-stamp--embed' : ''}`}>
        <div>
          <dt>hue</dt>
          <dd className="mono">{knobs.hue}</dd>
        </div>
        <div>
          <dt>shape</dt>
          <dd className="mono">{knobs.shape}</dd>
        </div>
        <div>
          <dt>sha</dt>
          <dd className="mono">{sha}</dd>
        </div>
        {embed ? null : (
          <>
            <div>
              <dt>env</dt>
              <dd className="mono">{lab.env}</dd>
            </div>
            <div>
              <dt>built</dt>
              <dd className="mono">{lab.buildTime}</dd>
            </div>
          </>
        )}
      </dl>
      {embed || !lab.githubRunUrl ? null : (
        <a
          className="btn ghost"
          href={lab.githubRunUrl}
          target="_blank"
          rel="noreferrer"
        >
          GitHub run →
        </a>
      )}
    </div>
  );
}
