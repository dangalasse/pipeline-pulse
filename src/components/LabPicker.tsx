import type { LabHue, LabShape } from '../../shared/lab-object';
import { LAB_HUES, LAB_SHAPES } from '../../shared/lab-object';

interface LabPickerProps {
  hue: LabHue;
  shape: LabShape;
  disabled?: boolean;
  hueLabel: string;
  shapeLabel: string;
  onHue: (hue: LabHue) => void;
  onShape: (shape: LabShape) => void;
}

export function LabPicker({
  hue,
  shape,
  disabled,
  hueLabel,
  shapeLabel,
  onHue,
  onShape,
}: LabPickerProps) {
  return (
    <div className="lab-picker lab-picker--compact">
      <fieldset className="lab-fieldset" disabled={disabled}>
        <legend>{hueLabel}</legend>
        <div className="lab-swatches">
          {LAB_HUES.map((option) => (
            <button
              key={option}
              type="button"
              className={`lab-swatch${option === hue ? ' is-on' : ''}`}
              data-hue={option}
              aria-pressed={option === hue}
              aria-label={option}
              onClick={() => onHue(option)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="lab-fieldset" disabled={disabled}>
        <legend>{shapeLabel}</legend>
        <div className="lab-shapes">
          {LAB_SHAPES.map((option) => (
            <button
              key={option}
              type="button"
              className={`lab-shape-btn${option === shape ? ' is-on' : ''}`}
              aria-pressed={option === shape}
              onClick={() => onShape(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
