/** Browser origins allowed to call `/api/*`. Never fall back to `*`. */

export const CORS_ORIGINS = [
  'https://pipeview.galasse.dev',
  'https://pipeline-pulse-preview.dantonguerragalasse.workers.dev',
  'https://staging.pipeview.galasse.dev',
  'https://pipeline.galasse.dev',
  'https://staging.pipeline.galasse.dev',
  'https://portfolio.galasse.dev',
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
] as const;

export function allowCorsOrigin(origin: string | undefined): string {
  if (!origin) return '';
  return (CORS_ORIGINS as readonly string[]).includes(origin) ? origin : '';
}
