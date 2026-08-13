import type { LabHue, LabShape } from '../../shared/lab-object';

interface LabStageProps {
  hue: LabHue;
  shape: LabShape;
  size?: 'sm' | 'lg';
}

export function LabStage({ hue, shape, size = 'lg' }: LabStageProps) {
  return (
    <div
      className={`lab-stage lab-stage--${size}`}
      data-hue={hue}
      data-shape={shape}
      data-lab-stage="1"
    >
      <div className={`lab-object lab-object--${shape}`} aria-hidden="true">
        {shape === 'cube' ? (
          <>
            <span className="lab-cube-face lab-cube-face--front" />
            <span className="lab-cube-face lab-cube-face--back" />
            <span className="lab-cube-face lab-cube-face--left" />
            <span className="lab-cube-face lab-cube-face--right" />
            <span className="lab-cube-face lab-cube-face--top" />
            <span className="lab-cube-face lab-cube-face--bottom" />
          </>
        ) : null}
      </div>
    </div>
  );
}
