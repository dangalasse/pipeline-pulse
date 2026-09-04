/** Palco snippet — HTML/CSS/JS shipped by live-demo, rendered in a sandboxed iframe. */

export const LAB_SOURCE_MAX_BYTES = 8192;
export const KV_LAB_PENDING = 'lab:pending';
export const KV_LAB_SOURCE = 'lab:source';

export const PREVIEW_ORIGIN =
  'https://pipeline-pulse-preview.dantonguerragalasse.workers.dev';

export const PREVIEW_LAB_URL = `${PREVIEW_ORIGIN}/lab`;

export const PREVIEW_LAB_EMBED_URL = `${PREVIEW_LAB_URL}?embed=1`;

/** Cyan cube — the object the editor opens with. */
export const DEFAULT_LAB_SOURCE = `<style>
  :root { --lab: #5eead4; }
  html, body {
    margin: 0; min-height: 100%; background: transparent;
    display: grid; place-items: center;
  }
  .cube {
    width: 110px; height: 110px;
    position: relative; transform-style: preserve-3d;
    animation: spin 9s linear infinite;
  }
  .face {
    position: absolute; inset: 0;
    background: color-mix(in srgb, var(--lab) 82%, #04110c);
    border: 1px solid color-mix(in srgb, var(--lab) 70%, white);
  }
  .f { transform: translateZ(55px); }
  .k { transform: rotateY(180deg) translateZ(55px); }
  .l { transform: rotateY(-90deg) translateZ(55px); }
  .r { transform: rotateY(90deg) translateZ(55px); }
  .t { transform: rotateX(90deg) translateZ(55px); }
  .b { transform: rotateX(-90deg) translateZ(55px); }
  @keyframes spin { to { transform: rotateX(18deg) rotateY(360deg); } }
  @media (prefers-reduced-motion: reduce) { .cube { animation: none; } }
</style>
<div class="cube" id="obj">
  <span class="face f"></span><span class="face k"></span>
  <span class="face l"></span><span class="face r"></span>
  <span class="face t"></span><span class="face b"></span>
</div>
<script>
  // Recolor from the CSS pane (:root { --lab: #5eead4; })
  const lab = getComputedStyle(document.documentElement)
    .getPropertyValue('--lab')
    .trim();
  if (lab) document.documentElement.style.setProperty('--lab', lab);
</script>
`;

export interface LabObject {
  source: string;
  sourceSha: string;
  env: string;
  gitSha: string;
  buildTime: string;
  githubRunUrl: string | null;
  previewUrl: string;
}

const SECRET_MARK =
  /\b(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9_]{20,}|ghs_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/;

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Accept a snippet string (or `{ source }`).
 * `null` means empty, too large, or credential-like material.
 */
export function parseLabSource(input: unknown): string | null {
  let raw: string | null = null;
  if (typeof input === 'string') {
    raw = input;
  } else if (input && typeof input === 'object') {
    const rec = input as Record<string, unknown>;
    if (typeof rec.source === 'string') raw = rec.source;
  }
  if (raw == null) return null;
  if (raw.trim().length < 1) return null;
  if (byteLength(raw) > LAB_SOURCE_MAX_BYTES) return null;
  if (SECRET_MARK.test(raw)) return null;
  return raw;
}

export async function hashLabSource(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export type LabPane = 'html' | 'css' | 'js';

export interface LabParts {
  html: string;
  css: string;
  js: string;
}

/** Split a snippet into the three editor panes (style/script extracted). */
export function splitLabSource(source: string): LabParts {
  let css = '';
  let js = '';
  const html = source
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>\n?/gi, (_m, body: string) => {
      css = css ? `${css}\n${body}` : body;
      return '';
    })
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>\n?/gi, (_m, body: string) => {
      js = js ? `${js}\n${body}` : body;
      return '';
    });
  return { html, css, js };
}

/** Reassemble panes into the snippet stored in KV / posted to demo-run. */
export function composeLabSource(parts: LabParts): string {
  let out = '';
  if (parts.css.length > 0) {
    out += `<style>${parts.css}</style>\n`;
  }
  out += parts.html;
  if (parts.js.length > 0) {
    if (out.length > 0 && !out.endsWith('\n')) out += '\n';
    out += `<script>${parts.js}</script>\n`;
  }
  return out;
}

/** Wrap a fragment so srcdoc always has a document; leave full HTML alone. */
export function sourceToSrcDoc(source: string): string {
  const trimmed = source.trim();
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return source;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:transparent!important;display:grid;place-items:center}</style></head><body>${source}</body></html>`;
}
