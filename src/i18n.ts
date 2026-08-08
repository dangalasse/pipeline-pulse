/** UI locale — mirrors edge-labs / portfolio `pt-BR` / `en-US`. */
export type Locale = 'pt-BR' | 'en-US';

export function normalizeLocale(raw: unknown): Locale {
  if (typeof raw !== 'string') {
    return 'pt-BR';
  }
  const v = raw.trim().toLowerCase().replace('_', '-');
  if (v === 'en' || v === 'en-us' || v.startsWith('en-')) {
    return 'en-US';
  }
  return 'pt-BR';
}

export function isEnglish(locale: Locale): boolean {
  return locale === 'en-US';
}

export interface UiCopy {
  eyebrow: string;
  title: string;
  lede: string;
  viewActions: string;
  repository: string;
  thisDeploy: string;
  gitSha: string;
  builtAt: string;
  edgeClock: string;
  cfRay: string;
  openRunLink: string;
  conveyorHeading: string;
  runLiveDemo: string;
  runningDemo: string;
  demoQueued: string;
  demoFailed: string;
  aiReview: string;
  aiReviewing: string;
  aiReviewTitle: string;
  openGithubRun: string;
  rateLimited: string;
  demoUnavailable: string;
  humanCheck: string;
  lastRunLabel: string;
  nodeDetailClose: string;
  workflowYaml: string;
  switchLanguage: string;
  localePt: string;
  localeEn: string;
  footerSecrets: string;
  probingEdge: string;
  edgeOk: string;
  statusIdle: string;
  statusPending: string;
  statusRunning: string;
  statusSuccess: string;
  statusFailure: string;
  statusSkipped: string;
}

const PT: UiCopy = {
  eyebrow: 'galasse · vitrine devops',
  title: 'Pipeline Pulse',
  lede: 'Esta página é o painel de uma esteira real: Actions no GitHub, Worker na Cloudflare. Clica num nó para ver o que corre — lint, security audit, testes, build.',
  viewActions: 'Ver Actions',
  repository: 'Repositório',
  thisDeploy: 'Este deploy',
  gitSha: 'Git SHA',
  builtAt: 'Build em',
  edgeClock: 'Relógio edge',
  cfRay: 'CF-Ray',
  openRunLink: 'Abrir o workflow run que publicou este build →',
  conveyorHeading: 'Esteira ao vivo',
  runLiveDemo: 'Correr demo ao vivo',
  runningDemo: 'Demo a correr…',
  demoQueued: 'Workflow na fila…',
  demoFailed: 'Demo falhou',
  aiReview: 'Revisão IA',
  aiReviewing: 'A pedir análise ao Edge Labs…',
  aiReviewTitle: 'Análise IA do erro',
  openGithubRun: 'Abrir run no GitHub',
  rateLimited: 'Limite da demo — vê o último run abaixo (1/IP/15min, 8/dia).',
  demoUnavailable:
    'Dispatch precisa de GITHUB_TOKEN (actions:write) atrás do Demo Gate. O último run real continua visível acima.',
  humanCheck: 'Verificação humana',
  lastRunLabel: 'Último run real',
  nodeDetailClose: 'Fechar',
  workflowYaml: 'Trecho do workflow',
  switchLanguage: 'Idioma',
  localePt: 'PT-BR',
  localeEn: 'ENG-US',
  footerSecrets: 'Secrets via OIDC · ambientes staging / production',
  probingEdge: 'a checar o edge…',
  edgeOk: 'edge ok',
  statusIdle: 'parado',
  statusPending: 'na fila',
  statusRunning: 'a correr',
  statusSuccess: 'ok',
  statusFailure: 'falhou',
  statusSkipped: 'saltado',
};

const EN: UiCopy = {
  eyebrow: 'galasse · devops showcase',
  title: 'Pipeline Pulse',
  lede: 'This page is the dashboard for a real conveyor: GitHub Actions, Cloudflare Worker. Click a node to see what runs — lint, security audit, tests, build.',
  viewActions: 'View Actions',
  repository: 'Repository',
  thisDeploy: 'This deploy',
  gitSha: 'Git SHA',
  builtAt: 'Built at',
  edgeClock: 'Edge clock',
  cfRay: 'CF-Ray',
  openRunLink: 'Open the workflow run that shipped this build →',
  conveyorHeading: 'Live conveyor',
  runLiveDemo: 'Run live demo',
  runningDemo: 'Demo running…',
  demoQueued: 'Workflow queued…',
  demoFailed: 'Demo failed',
  aiReview: 'AI review',
  aiReviewing: 'Requesting Edge Labs analysis…',
  aiReviewTitle: 'AI error analysis',
  openGithubRun: 'Open run on GitHub',
  rateLimited: 'Demo limit — see the last run below (1/IP/15min, 8/day).',
  demoUnavailable:
    'Dispatch needs GITHUB_TOKEN (actions:write) behind the Demo Gate. The last real run stays visible above.',
  humanCheck: 'Human check',
  lastRunLabel: 'Last real run',
  nodeDetailClose: 'Close',
  workflowYaml: 'Workflow snippet',
  switchLanguage: 'Language',
  localePt: 'PT-BR',
  localeEn: 'ENG-US',
  footerSecrets: 'OIDC-ready secrets · staging / production environments',
  probingEdge: 'checking edge…',
  edgeOk: 'edge ok',
  statusIdle: 'idle',
  statusPending: 'pending',
  statusRunning: 'running',
  statusSuccess: 'ok',
  statusFailure: 'failed',
  statusSkipped: 'skipped',
};

export function copyFor(locale: Locale): UiCopy {
  return isEnglish(locale) ? EN : PT;
}
