export type NodeId =
  | 'push'
  | 'ci'
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
    explainPt: 'Biome lint + typecheck TypeScript (app + worker).',
    explainEn: 'Biome lint + TypeScript typecheck (app + worker).',
    yaml: `- name: Lint (Biome)
  run: npm run lint

- name: Typecheck
  run: npm run typecheck`,
  },
  {
    id: 'test',
    labelPt: 'Testes',
    labelEn: 'Test',
    jobName: 'Test',
    explainPt: 'Vitest — contratos partilhados e lógica pura.',
    explainEn: 'Vitest — shared contracts and pure logic.',
    yaml: `- name: Unit tests
  run: npm test`,
  },
  {
    id: 'ai-review',
    labelPt: 'Revisão IA',
    labelEn: 'AI Review',
    jobName: 'AI Review',
    explainPt:
      'Em falha, a UI encaminha logs ao Edge Labs (POST /analyze-error) para coaching SRE.',
    explainEn:
      'On failure, the UI forwards logs to Edge Labs (POST /analyze-error) for SRE coaching.',
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
      'PR deploya Worker preview + comenta URL. Live demo para no build (sem deploy).',
    explainEn:
      'PR deploys a preview Worker + comments URL. Live demo stops at build (no deploy).',
    yaml: `# preview.yml (PR only)
- name: Deploy Workers preview
  uses: cloudflare/wrangler-action@v3
  with:
    command: deploy --env preview`,
  },
  {
    id: 'staging',
    labelPt: 'Staging',
    labelEn: 'Staging',
    explainPt: 'Push main → staging Worker + smoke /api/health.',
    explainEn: 'Push main → staging Worker + smoke /api/health.',
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
    explainPt: 'Tag v* → ambiente production protegido + smoke final.',
    explainEn: 'Tag v* → protected production environment + final smoke.',
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
