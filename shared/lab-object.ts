/** Allowlisted knobs for the sandbox palco. No free text, no HTML. */

export const LAB_HUES = ['cyan', 'amber', 'violet', 'rose'] as const;
export const LAB_SHAPES = ['cube', 'ring', 'bar'] as const;

export type LabHue = (typeof LAB_HUES)[number];
export type LabShape = (typeof LAB_SHAPES)[number];

export interface LabKnobs {
  hue: LabHue;
  shape: LabShape;
}

export interface LabObject extends LabKnobs {
  env: string;
  gitSha: string;
  buildTime: string;
  githubRunUrl: string | null;
  previewUrl: string;
}

export const DEFAULT_LAB_KNOBS: LabKnobs = { hue: 'cyan', shape: 'cube' };

export const PREVIEW_ORIGIN =
  'https://pipeline-pulse-preview.dantonguerragalasse.workers.dev';

export const PREVIEW_LAB_URL = `${PREVIEW_ORIGIN}/lab`;

export const PREVIEW_LAB_EMBED_URL = `${PREVIEW_LAB_URL}?embed=1`;

const HUE_SET = new Set<string>(LAB_HUES);
const SHAPE_SET = new Set<string>(LAB_SHAPES);

export function isLabHue(value: unknown): value is LabHue {
  return typeof value === 'string' && HUE_SET.has(value);
}

export function isLabShape(value: unknown): value is LabShape {
  return typeof value === 'string' && SHAPE_SET.has(value);
}

/**
 * Accept only allowlisted tokens. Extra keys are ignored.
 * `null` means the client sent a value outside the list.
 */
export function parseLabKnobs(input: unknown): LabKnobs | null {
  if (input == null) return { ...DEFAULT_LAB_KNOBS };
  if (typeof input !== 'object') return null;
  const rec = input as Record<string, unknown>;
  const hue = rec.hue === undefined ? DEFAULT_LAB_KNOBS.hue : rec.hue;
  const shape = rec.shape === undefined ? DEFAULT_LAB_KNOBS.shape : rec.shape;
  if (!isLabHue(hue) || !isLabShape(shape)) return null;
  return { hue, shape };
}

export function labKnobsFromEnv(
  hue: string | undefined,
  shape: string | undefined,
): LabKnobs {
  return (
    parseLabKnobs({
      hue: hue || DEFAULT_LAB_KNOBS.hue,
      shape: shape || DEFAULT_LAB_KNOBS.shape,
    }) ?? { ...DEFAULT_LAB_KNOBS }
  );
}
