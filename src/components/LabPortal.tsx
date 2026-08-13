import { useId, useState } from 'react';
import { shortSha } from '../../shared/deploy-meta';
import type {
  LabHue,
  LabKnobs,
  LabObject,
  LabShape,
} from '../../shared/lab-object';
import {
  PREVIEW_LAB_EMBED_URL,
  PREVIEW_LAB_URL,
} from '../../shared/lab-object';
import { LabPicker } from './LabPicker';

interface LabPortalProps {
  knobs: LabKnobs;
  shipped: LabObject | null;
  previewReady: boolean;
  demoLoading: boolean;
  hueLabel: string;
  shapeLabel: string;
  tuneLabel: string;
  closeTuneLabel: string;
  openStageLabel: string;
  waitingLabel: string;
  sharedLabel: string;
  portalLabel: string;
  onHue: (hue: LabHue) => void;
  onShape: (shape: LabShape) => void;
}

export function LabPortal({
  knobs,
  shipped,
  previewReady,
  demoLoading,
  hueLabel,
  shapeLabel,
  tuneLabel,
  closeTuneLabel,
  openStageLabel,
  waitingLabel,
  sharedLabel,
  portalLabel,
  onHue,
  onShape,
}: LabPortalProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const portalKey = `${shipped?.gitSha ?? 'pending'}-${previewReady ? '1' : '0'}`;
  const stamp = shipped
    ? `${shipped.hue} · ${shipped.shape} · ${shortSha(shipped.gitSha)}`
    : null;

  return (
    <div className="portal">
      <iframe
        key={portalKey}
        className="portal-frame"
        title={portalLabel}
        src={PREVIEW_LAB_EMBED_URL}
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
      <div className="portal-bar">
        <span className="mono muted">{stamp ?? waitingLabel}</span>
        <button
          type="button"
          className="btn ghost portal-tune"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? closeTuneLabel : tuneLabel}
        </button>
        <a
          className="btn ghost"
          href={PREVIEW_LAB_URL}
          target="_blank"
          rel="noreferrer"
        >
          {openStageLabel}
        </a>
      </div>
      {open ? (
        <div id={panelId} className="portal-tune-panel">
          <p className="muted portal-hint">{sharedLabel}</p>
          <LabPicker
            hue={knobs.hue}
            shape={knobs.shape}
            disabled={demoLoading}
            hueLabel={hueLabel}
            shapeLabel={shapeLabel}
            onHue={onHue}
            onShape={onShape}
          />
        </div>
      ) : null}
    </div>
  );
}
