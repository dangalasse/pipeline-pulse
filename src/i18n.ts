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
  liveSteps: string;
  viewLog: string;
  loadingLog: string;
  logTruncated: string;
  logUnavailable: string;
  nodeNotInRun: string;
  stepDuration: string;
  labHeading: string;
  labLede: string;
  labHue: string;
  labShape: string;
  labOpenStage: string;
  labWaiting: string;
  labShared: string;
  labTune: string;
  labTuneClose: string;
  labPortal: string;
}

const PT: UiCopy = {
  eyebrow: 'galasse · vitrine devops',
  title: 'Pipeview',
  lede: 'Esteira real: GitHub Actions → Worker. O palco ao vivo é o preview; produção só muda com tag.',
  viewActions: 'Ver no Actions',
  repository: 'Repositório',
  thisDeploy: 'Este deploy',
  gitSha: 'Git SHA',
  builtAt: 'Published at',
  edgeClock: 'Edge clock',
  cfRay: 'CF-Ray',
  openRunLink: 'Abrir o workflow que publicou este build →',
  conveyorHeading: 'Esteira ao vivo',
  runLiveDemo: 'Iniciar demo ao vivo',
  runningDemo: 'Demo running…',
  demoQueued: 'Workflow na fila…',
  demoFailed: 'A demo encontrou um erro',
  aiReview: 'Pedir AI review',
  aiReviewing: 'Solicitando análise ao Edge Labs…',
  aiReviewTitle: 'AI review do erro',
  openGithubRun: 'Abrir o run no GitHub',
  rateLimited:
    'Limite da demo por agora — o último run continua visível abaixo (1/IP/15min, 8/dia).',
  demoUnavailable:
    'O dispatch precisa de GITHUB_TOKEN (actions:write) atrás do Demo Gate. O último run real continua visível acima.',
  humanCheck: 'Verificação humana',
  lastRunLabel: 'Último run real',
  nodeDetailClose: 'Fechar',
  workflowYaml: 'Snippet do workflow',
  switchLanguage: 'Idioma',
  localePt: 'PT-BR',
  localeEn: 'ENG-US',
  footerSecrets: 'Secrets via OIDC · ambientes staging / production',
  probingEdge: 'checking edge…',
  edgeOk: 'edge ok',
  statusIdle: 'idle',
  statusPending: 'queued',
  statusRunning: 'running',
  statusSuccess: 'ok',
  statusFailure: 'failed',
  statusSkipped: 'skipped',
  liveSteps: 'Steps deste run',
  viewLog: 'Ver log',
  loadingLog: 'Carregando log…',
  logTruncated:
    'Log truncado (últimas linhas, máx. 32 KiB) — secrets redacted.',
  logUnavailable:
    'Esta etapa não tem job neste live-demo (staging/prod ficam no deploy.yml).',
  nodeNotInRun: 'Esta etapa não rodou neste live-demo.',
  stepDuration: 'duration',
  labHeading: 'Palco da demo',
  labLede:
    'Cor e forma passam pelo CI e aparecem no palco de preview — não em produção.',
  labHue: 'Cor',
  labShape: 'Forma',
  labOpenStage: 'Abrir',
  labWaiting: 'Aguardando o Preview.',
  labShared: 'Palco compartilhado: o último live-demo que passou.',
  labTune: 'Ajustar',
  labTuneClose: 'Fechar',
  labPortal: 'Palco ao vivo (preview)',
};

const EN: UiCopy = {
  eyebrow: 'galasse · devops showcase',
  title: 'Pipeview',
  lede: 'Real conveyor: GitHub Actions → Worker. The live stage is preview; production only moves on a tag.',
  viewActions: 'View on Actions',
  repository: 'Repository',
  thisDeploy: 'This deploy',
  gitSha: 'Git SHA',
  builtAt: 'Published at',
  edgeClock: 'Edge clock',
  cfRay: 'CF-Ray',
  openRunLink: 'Open the workflow that shipped this build →',
  conveyorHeading: 'Live conveyor',
  runLiveDemo: 'Start a live demo',
  runningDemo: 'Demo in progress…',
  demoQueued: 'Workflow queued…',
  demoFailed: 'The demo hit an error',
  aiReview: 'Ask for an AI review',
  aiReviewing: 'Requesting analysis from Edge Labs…',
  aiReviewTitle: 'AI reading of the error',
  openGithubRun: 'Open the run on GitHub',
  rateLimited:
    'Demo limit for now — the latest run stays visible below (1/IP/15min, 8/day).',
  demoUnavailable:
    'Dispatch needs GITHUB_TOKEN (actions:write) behind the Demo Gate. The latest real run stays visible above.',
  humanCheck: 'Human check',
  lastRunLabel: 'Latest real run',
  nodeDetailClose: 'Close',
  workflowYaml: 'Workflow snippet',
  switchLanguage: 'Language',
  localePt: 'PT-BR',
  localeEn: 'ENG-US',
  footerSecrets: 'OIDC-ready secrets · staging / production environments',
  probingEdge: 'checking the edge…',
  edgeOk: 'edge ok',
  statusIdle: 'waiting',
  statusPending: 'queued',
  statusRunning: 'running',
  statusSuccess: 'ok',
  statusFailure: 'failed',
  statusSkipped: 'skipped',
  liveSteps: 'Steps in this run',
  viewLog: 'View log',
  loadingLog: 'Loading log…',
  logTruncated: 'Log truncated (last lines, max 32 KiB) — secrets redacted.',
  logUnavailable:
    'This stage has no job in the live-demo (staging/prod live in deploy.yml).',
  nodeNotInRun: 'This stage did not run in this live-demo.',
  stepDuration: 'duration',
  labHeading: 'Demo stage',
  labLede:
    'Color and shape go through CI and land on the preview stage — not production.',
  labHue: 'Color',
  labShape: 'Shape',
  labOpenStage: 'Open',
  labWaiting: 'Waiting for Preview.',
  labShared: 'Shared stage: the last live-demo that passed.',
  labTune: 'Tune',
  labTuneClose: 'Close',
  labPortal: 'Live stage (preview)',
};

export function copyFor(locale: Locale): UiCopy {
  return isEnglish(locale) ? EN : PT;
}
