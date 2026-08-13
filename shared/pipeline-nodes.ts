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
      'npm audit (nível high+) nas dependências. Gates mais pesados (e2e Playwright, UFW, métricas 401) ficam no TOTE — aqui é a fatia que cabe neste repo.',
    explainEn:
      'npm audit (high+) on dependencies. Heavier gates (Playwright e2e, UFW, 401 metrics) live in TOTE — this is the slice that fits this repo.',
    yaml: `- name: Dependency audit (high+)
  run: npm audit --audit-level=high

# TOTE (separate repo): scripts/security-gates.sh + Playwright e2e`,
  },
  {
    id: 'test',
    labelPt: 'Testes',
    labelEn: 'Test',
    jobName: 'Test',
    explainPt:
      'Vitest nos contratos compartilhados e na lógica pura. Não é e2e de browser — isso está no TOTE.',
    explainEn:
      'Vitest on shared contracts and pure logic. Not browser e2e — that lives in TOTE.',
    yaml: `- name: Unit tests (Vitest)
  run: npm test`,
  },
  {
    id: 'ai-review',
    labelPt: 'Revisão IA',
    labelEn: 'AI Review',
    jobName: 'AI Review',
    explainPt:
      'Se algo falha, a UI manda o log para o Edge Labs (POST /analyze-error) e pede um coaching SRE.',
    explainEn:
      'On failure, the UI sends the log to Edge Labs (POST /analyze-error) for SRE coaching.',
    yaml: `# UI → Worker → Edge Labs
POST /api/demo-ai-review
  → https://edge.galasse.dev/analyze-error
  { message, context, locale }`,
  },
  {
    id: 'preview',
    labelPt: 'Preview',
    labelEn: 'Preview',
    jobName: 'Build',
    explainPt:
      'No PR, sobe um Worker de preview e comenta a URL. O botão “demo ao vivo” desta página para no build — não faz deploy.',
    explainEn:
      'On a PR, a preview Worker goes up and the URL is commented. The “live demo” button on this page stops at build — no deploy.',
    yaml: `# live-demo.yml — this node is the Build job (no deploy).
# preview.yml (PR only) is the real Workers preview:
- name: Deploy Workers preview
  uses: cloudflare/wrangler-action@v3
  with:
    command: deploy --env preview`,
  },
  {
    id: 'staging',
    labelPt: 'Staging',
    labelEn: 'Staging',
    explainPt:
      'Push em main sobe o Worker de staging e faz smoke em /api/health.',
    explainEn: 'Push to main ships the staging Worker and smokes /api/health.',
    yaml: `# deploy.yml — staging job
deploy-staging:
  if: github.ref == 'refs/heads/main'
  environment: staging
  steps:
    - run: curl -fsS $STAGING_URL/api/health`,
  },
  {
    id: 'prod',
    labelPt: 'Produção',
    labelEn: 'Prod',
    explainPt:
      'Tag v* entra no environment production (protegido) e faz o smoke final.',
    explainEn:
      'A v* tag hits the protected production environment and final smoke.',
    yaml: `deploy-production:
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
