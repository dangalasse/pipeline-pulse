/** Strip ANSI + obvious credentials from text shown in the demo UI or sent to Edge Labs. */

export const LOG_MAX_BYTES = 32 * 1024;
export const LOG_MAX_LINES = 200;
export const AI_CONTEXT_MAX_BYTES = 2 * 1024;

const REDACT = '[REDACTED]';

export function stripAnsi(text: string): string {
  const esc = String.fromCharCode(27);
  return text.split(esc).reduce((acc, part, i) => {
    if (i === 0) return part;
    const m = part.match(/^\[[0-9;]*[a-zA-Z]/);
    return acc + (m ? part.slice(m[0].length) : part);
  }, '');
}

function applyRedactPatterns(text: string): string {
  let out = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bghp_[A-Za-z0-9_]{20,}\b/g, REDACT],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, REDACT],
    [/\bgho_[A-Za-z0-9_]{20,}\b/g, REDACT],
    [/\bghs_[A-Za-z0-9_]{20,}\b/g, REDACT],
    [/\bnpm_[A-Za-z0-9]{20,}\b/g, REDACT],
    [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACT],
    [/\bBearer\s+[A-Za-z0-9._\-/=+]{8,}/gi, `Bearer ${REDACT}`],
    [/\bAKIA[0-9A-Z]{16}\b/g, REDACT],
    [/\b(token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, `$1=${REDACT}`],
    [/([?&](?:sig|sas|se|sv)=)[^&\s]+/gi, `$1${REDACT}`],
    [/(\bLocation:\s+)\S+/gi, `$1${REDACT}`],
    [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      REDACT,
    ],
  ];
  for (const [re, replacement] of replacements) {
    out = out.replace(re, replacement);
  }
  return out;
}

export function redactSecrets(text: string): string {
  return applyRedactPatterns(text);
}

export function sanitizeLogText(text: string): string {
  return redactSecrets(stripAnsi(text));
}

export function truncateLog(text: string): {
  text: string;
  truncated: boolean;
} {
  const lines = text.split(/\r?\n/);
  let truncated = false;
  let sliced = lines;
  if (sliced.length > LOG_MAX_LINES) {
    sliced = sliced.slice(-LOG_MAX_LINES);
    truncated = true;
  }
  let joined = sliced.join('\n');
  if (joined.length > LOG_MAX_BYTES) {
    joined = joined.slice(-LOG_MAX_BYTES);
    truncated = true;
  }
  return { text: joined, truncated };
}

export function clampRedacted(text: string, maxBytes: number): string {
  const cleaned = sanitizeLogText(text);
  if (cleaned.length <= maxBytes) return cleaned;
  return cleaned.slice(0, maxBytes);
}
