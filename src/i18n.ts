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
  lede: 'Meta-dashboard ao vivo de uma esteira GitHub Actions completa — Cloudflare Workers na borda.',
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
  rateLimited: 'Aguarde ~1 minuto entre demos.',
  demoUnavailable:
    'Demo ao vivo indisponível — configure GITHUB_TOKEN no Worker.',
  nodeDetailClose: 'Fechar',
  workflowYaml: 'Trecho do workflow',
  switchLanguage: 'Idioma',
  localePt: 'PT-BR',
  localeEn: 'ENG-US',
  footerSecrets: 'Secrets OIDC · Ambientes staging / production',
  probingEdge: 'sondando edge…',
  edgeOk: 'edge ok',
  statusIdle: 'ocioso',
  statusPending: 'pendente',
  statusRunning: 'a correr',
  statusSuccess: 'ok',
  statusFailure: 'falhou',
  statusSkipped: 'ignorado',
};

const EN: UiCopy = {
  eyebrow: 'galasse · devops showcase',
  title: 'Pipeline Pulse',
  lede: 'Live meta-dashboard for a full GitHub Actions conveyor — Cloudflare Workers at the edge.',
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
  rateLimited: 'Wait ~1 minute between demos.',
  demoUnavailable:
    'Live demo unavailable — configure GITHUB_TOKEN on the Worker.',
  nodeDetailClose: 'Close',
  workflowYaml: 'Workflow snippet',
  switchLanguage: 'Language',
  localePt: 'PT-BR',
  localeEn: 'ENG-US',
  footerSecrets: 'OIDC-ready secrets · Environments staging / production',
  probingEdge: 'probing edge…',
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
