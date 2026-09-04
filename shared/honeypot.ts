/** Wink JSON for scanner bait paths — never a real env dump. */

export const HONEYPOT_REPLIES = [
  { pt: 'tenta mais', en: 'try again' },
  { pt: 'ainda não', en: 'not yet' },
  { pt: 'quase lá', en: 'almost' },
  { pt: 'boa tentativa', en: 'nice try' },
] as const;

export interface HoneypotBody {
  ok: false;
  hint: string;
  hint_en: string;
  note: string;
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function buildHoneypotBody(pathname: string): HoneypotBody {
  const pick =
    HONEYPOT_REPLIES[Math.abs(hashStr(pathname)) % HONEYPOT_REPLIES.length] ??
    HONEYPOT_REPLIES[0];
  return {
    ok: false,
    hint: pick.pt,
    hint_en: pick.en,
    note: 'Fourth wall: scanners get a wink, not a foothold.',
  };
}

const FORBIDDEN_KEY =
  /token|secret|password|authorization|api[_-]?key|private[_-]?key/i;

export function honeypotLooksSafe(body: HoneypotBody): boolean {
  if (body.ok !== false) return false;
  return !Object.keys(body).some((key) => FORBIDDEN_KEY.test(key));
}
