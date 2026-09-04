export type NodeId =
  | 'push'
  | 'ci'
  | 'security'
  | 'test'
  | 'ai-review'
  | 'preview'
  | 'staging'
  | 'prod';

export type NodeStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'success'
  | 'failure'
  | 'skipped';

export interface PipelineNode {
  id: NodeId;
  labelPt: string;
  labelEn: string;
  explainPt: string;
  explainEn: string;
  yaml: string;
  /** GitHub Actions job name used in live-demo.yml for status mapping */
  jobName?: string;
}

export const PIPELINE_NODES: PipelineNode[] = [
  {
    id: 'push',
    labelPt: 'Push',
    labelEn: 'Push',
    explainPt:
      'Gatilho da esteira — push em main, tag v* ou workflow_dispatch da UI.',
    explainEn:
      'Pipeline trigger — push to main, v* tag, or workflow_dispatch from the UI.',
    yaml: `# deploy.yml / ci.yml
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
  workflow_dispatch:`,
  },
  {
    id: 'ci',
    labelPt: 'CI',
    labelEn: 'CI',
    jobName: 'CI',
    explainPt:
      'Lint com Biome e typecheck TypeScript no app e no Worker — o primeiro freio antes de investir tempo em testes.',
    explainEn:
      'Biome lint and TypeScript typecheck for the app and Worker — the first brake before spending time on tests.',
    yaml: `- name: Lint (Biome)
  run: npm run lint

- name: Typecheck
  run: npm run typecheck`,
  },
  {
    id: 'security',
    labelPt: 'Security',
    labelEn: 'Security',
    jobName: 'Security',
    explainPt:
      'npm audit (high+) e contratos Vitest de redacção, honeypot e gate fail-closed. Playwright do palco corre no job Preview, contra o Worker sandbox.',
    explainEn:
      'npm audit (high+) plus Vitest contracts for redaction, honeypot, and fail-closed gate. Palco Playwright runs in the Preview job against the sandbox Worker.',
    yaml: `- name: Dependency audit (high+, production)
  run: npm audit --omit=dev --audit-level=high

- name: Security contracts
  run: npm run test:security`,
  },
  {
    id: 'test',
    labelPt: 'Testes',
    labelEn: 'Test',
    jobName: 'Test',
    explainPt:
      'Vitest nos contratos compartilhados (lab knobs, logs GitHub, redacção). O browser E2E do palco não entra aqui — só depois do deploy preview.',
    explainEn:
      'Vitest on shared contracts (lab knobs, GitHub logs, redaction). Palco browser e2e is not here — it runs after the preview deploy.',
    yaml: `- name: Unit tests (Vitest)
  run: npm test`,
  },
  {
    id: 'ai-review',
    labelPt: 'Revisão IA',
    labelEn: 'AI Review',
    jobName: 'AI Review',
    explainPt:
      'No live-demo: probe HTTP em /api/health e assert de que /api/demo-ai-review exige ticket. Coaching na UI (Edge Labs) só com Turnstile — logs redigidos, sem payload de CI.',
    explainEn:
      'In live-demo: HTTP probe of /api/health and assert /api/demo-ai-review requires a ticket. UI coaching (Edge Labs) stays Turnstile-gated — redacted logs, no CI payload.',
    yaml: `# live-demo.yml — contract probe (no Edge Labs body)
curl /api/health
curl -X POST /api/demo-ai-review  # expect 403/503

# UI (on failure, gated):
POST /api/demo-ai-review
  → https://edge.galasse.dev/analyze-error`,
  },
  {
    id: 'preview',
    labelPt: 'Preview',
    labelEn: 'Preview',
    jobName: 'Preview',
    explainPt:
      'O live-demo publica o palco (cor + forma da allowlist) no Worker de preview e corre Playwright no mesmo URL. Staging/prod reais não saem deste botão.',
    explainEn:
      'Live-demo ships the stage (allowlisted color + shape) to the preview Worker and runs Playwright against that URL. Real staging/prod do not come from this button.',
    yaml: `# live-demo.yml — Preview job
- name: Pin lab knobs   # cyan|amber|violet|rose × cube|ring|bar
- run: npm run build
- wrangler deploy --env preview
    --var LAB_HUE LAB_SHAPE
- curl /api/lab-object  # smoke: hue/shape must match`,
  },
  {
    id: 'staging',
    labelPt: 'Staging',
    labelEn: 'Staging',
    jobName: 'Staging',
    explainPt:
      'No live-demo este nó é um stand-in: smoke de headers, health e honeypot no Worker preview. O staging real só sobe com push em main via deploy.yml.',
    explainEn:
      'In live-demo this node is a stand-in: header/health/honeypot smoke against the preview Worker. Real staging only ships on push to main via deploy.yml.',
    yaml: `# live-demo.yml — sandbox stand-in
- run: scripts/sandbox-smoke.sh staging
  # URL = pipeline-pulse-preview…workers.dev
  # fails if env is staging|production

# deploy.yml (not this button)
deploy-staging:
  if: github.ref == 'refs/heads/main'
  environment: staging`,
  },
  {
    id: 'prod',
    labelPt: 'Produção',
    labelEn: 'Prod',
    jobName: 'Production',
    explainPt:
      'Stand-in no live-demo: os mesmos smokes + lab-object na allowlist e dispatchReady=false no preview. Produção real só com tag v* e environment protegido.',
    explainEn:
      'Live-demo stand-in: same smokes plus allowlisted lab-object and dispatchReady=false on preview. Real production is a v* tag and the protected environment.',
    yaml: `# live-demo.yml — sandbox stand-in
- run: scripts/sandbox-smoke.sh production
- run: python3 scripts/assert-live-demo-jobs.py

# deploy.yml (not this button)
deploy-production:
  if: startsWith(github.ref, 'refs/tags/v')
  environment: production`,
  },
];

export const NODE_ORDER: NodeId[] = PIPELINE_NODES.map((n) => n.id);

export function labelFor(node: PipelineNode, english: boolean): string {
  return english ? node.labelEn : node.labelPt;
}

export function explainFor(node: PipelineNode, english: boolean): string {
  return english ? node.explainEn : node.explainPt;
}
