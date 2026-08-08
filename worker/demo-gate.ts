/**
 * Shared Demo Gate — Turnstile → HMAC ticket → KV quotas.
 * Same contract mirrored in edge-labs and tote-vitrine Nest.
 */

export type DemoAudience =
  | 'pipeline.dispatch'
  | 'edge.analyze'
  | 'edge.coach'
  | 'vitrine.session';

export interface QuotaPolicy {
  ipLimit: number;
  ipWindowSec: number;
  globalLimit: number;
  globalWindowSec: number;
}

export const QUOTA_BY_AUD: Record<DemoAudience, QuotaPolicy> = {
  'pipeline.dispatch': {
    ipLimit: 1,
    ipWindowSec: 15 * 60,
    globalLimit: 8,
    globalWindowSec: 24 * 60 * 60,
  },
  'edge.analyze': {
    ipLimit: 5,
    ipWindowSec: 60 * 60,
    globalLimit: 80,
    globalWindowSec: 24 * 60 * 60,
  },
  'edge.coach': {
    ipLimit: 5,
    ipWindowSec: 60 * 60,
    globalLimit: 80,
    globalWindowSec: 24 * 60 * 60,
  },
  'vitrine.session': {
    ipLimit: 1,
    ipWindowSec: 30 * 60,
    globalLimit: 200,
    globalWindowSec: 24 * 60 * 60,
  },
};

const TICKET_TTL_SEC = 12 * 60;
const VALID_AUDS = new Set<string>(Object.keys(QUOTA_BY_AUD));

export interface DemoGateEnv {
  TURNSTILE_SECRET?: string;
  DEMO_TICKET_SECRET?: string;
  DEMO_GATE_KV: KVNamespace;
}

export interface TicketClaims {
  aud: DemoAudience;
  exp: number;
  ipHash: string;
  jti: string;
}

export class DemoGateError extends Error {
  constructor(
    public readonly status: 403 | 429 | 503,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DemoGateError';
  }
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return toHex(sig);
}

async function hmacVerify(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSign(secret, payload);
  if (expected.length !== signature.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return ok === 0;
}

export async function hashIp(ip: string, secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${secret}:${ip}`),
  );
  return toHex(digest).slice(0, 32);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
): Promise<boolean> {
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  body.set('remoteip', ip);
  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

function encodeTicket(claims: TicketClaims, signature: string): string {
  const json = JSON.stringify(claims);
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64}.${signature}`;
}

function decodeTicket(raw: string): { claims: TicketClaims; signature: string } | null {
  const [b64, signature] = raw.split('.');
  if (!b64 || !signature) return null;
  try {
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json = atob(padded + pad);
    const claims = JSON.parse(json) as TicketClaims;
    return { claims, signature };
  } catch {
    return null;
  }
}

export async function issueTicket(
  env: DemoGateEnv,
  aud: string,
  ip: string,
  turnstileToken: string,
): Promise<{ ticket: string; expiresAt: string }> {
  if (!env.TURNSTILE_SECRET || !env.DEMO_TICKET_SECRET) {
    throw new DemoGateError(
      503,
      'gate_unconfigured',
      'Demo gate secrets are not configured (TURNSTILE_SECRET / DEMO_TICKET_SECRET).',
    );
  }
  if (!VALID_AUDS.has(aud)) {
    throw new DemoGateError(403, 'bad_audience', 'Unknown demo audience.');
  }
  const ok = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!ok) {
    throw new DemoGateError(
      403,
      'turnstile_failed',
      'Human check failed — refresh and try again.',
    );
  }
  const claims: TicketClaims = {
    aud: aud as DemoAudience,
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SEC,
    ipHash: await hashIp(ip, env.DEMO_TICKET_SECRET),
    jti: crypto.randomUUID(),
  };
  const payload = JSON.stringify(claims);
  const signature = await hmacSign(env.DEMO_TICKET_SECRET, payload);
  return {
    ticket: encodeTicket(claims, signature),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

async function consumeJti(kv: KVNamespace, jti: string, ttlSec: number): Promise<void> {
  const key = `jti:${jti}`;
  const existing = await kv.get(key);
  if (existing) {
    throw new DemoGateError(403, 'ticket_replay', 'Demo ticket already used.');
  }
  await kv.put(key, '1', { expirationTtl: Math.max(60, ttlSec) });
}

async function bumpQuota(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  if (Number.isFinite(count) && count >= limit) {
    throw new DemoGateError(
      429,
      'quota_exceeded',
      'Demo limit reached — see the last real run below (or try again later).',
    );
  }
  await kv.put(key, String(count + 1), {
    expirationTtl: Math.max(60, windowSec),
  });
}

/**
 * Validate one-shot ticket and enforce IP + global quotas for `aud`.
 */
export async function enforceTicketAndQuota(
  env: DemoGateEnv,
  request: Request,
  expectedAud: DemoAudience,
  ticketHeader: string | null | undefined,
): Promise<void> {
  if (!env.DEMO_TICKET_SECRET) {
    throw new DemoGateError(
      503,
      'gate_unconfigured',
      'Demo gate secrets are not configured.',
    );
  }
  if (!ticketHeader) {
    throw new DemoGateError(
      403,
      'ticket_required',
      'Missing X-Demo-Ticket — complete the human check first.',
    );
  }
  const decoded = decodeTicket(ticketHeader);
  if (!decoded) {
    throw new DemoGateError(403, 'ticket_invalid', 'Malformed demo ticket.');
  }
  const { claims, signature } = decoded;
  const payload = JSON.stringify(claims);
  const valid = await hmacVerify(env.DEMO_TICKET_SECRET, payload, signature);
  if (!valid) {
    throw new DemoGateError(403, 'ticket_invalid', 'Demo ticket signature failed.');
  }
  if (claims.aud !== expectedAud) {
    throw new DemoGateError(403, 'ticket_aud', 'Demo ticket audience mismatch.');
  }
  if (claims.exp < Math.floor(Date.now() / 1000)) {
    throw new DemoGateError(403, 'ticket_expired', 'Demo ticket expired — refresh the check.');
  }
  const ip = clientIp(request);
  const ipHash = await hashIp(ip, env.DEMO_TICKET_SECRET);
  if (claims.ipHash !== ipHash) {
    throw new DemoGateError(403, 'ticket_ip', 'Demo ticket bound to another client.');
  }

  const remainingTtl = Math.max(60, claims.exp - Math.floor(Date.now() / 1000));
  await consumeJti(env.DEMO_GATE_KV, claims.jti, remainingTtl);

  const policy = QUOTA_BY_AUD[expectedAud];
  const day = new Date().toISOString().slice(0, 10);
  await bumpQuota(
    env.DEMO_GATE_KV,
    `q:ip:${expectedAud}:${ipHash}`,
    policy.ipLimit,
    policy.ipWindowSec,
  );
  await bumpQuota(
    env.DEMO_GATE_KV,
    `q:global:${expectedAud}:${day}`,
    policy.globalLimit,
    policy.globalWindowSec,
  );
}

export function gateErrorResponse(err: unknown, cors: HeadersInit = {}): Response {
  if (err instanceof DemoGateError) {
    return new Response(
      JSON.stringify({
        error: err.code,
        message: err.message,
      }),
      {
        status: err.status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...cors,
        },
      },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return new Response(JSON.stringify({ error: 'gate_error', message }), {
    status: 500,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...cors,
    },
  });
}

/** Short-lived HMAC for trusted Worker→Worker calls (pipeline → edge). */
export async function mintServiceAuth(
  secret: string,
  service: string,
): Promise<{ ts: string; sig: string }> {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await hmacSign(secret, `${service}:${ts}`);
  return { ts, sig };
}

export async function verifyServiceAuth(
  secret: string,
  service: string,
  ts: string | null,
  sig: string | null,
  maxSkewSec = 60,
): Promise<boolean> {
  if (!ts || !sig) return false;
  const n = Number(ts);
  if (!Number.isFinite(n)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - n) > maxSkewSec) return false;
  return hmacVerify(secret, `${service}:${ts}`, sig);
}
