/** Localize GitHub Actions step names / conclusions for the UI locale. */

import type { Locale } from '../i18n';
import { isEnglish } from '../i18n';

const STEP_PT: Record<string, string> = {
  'Set up job': 'Preparar job',
  'Complete job': 'Concluir job',
  Install: 'Instalar dependências',
  'Lint (Biome)': 'Lint (Biome)',
  Typecheck: 'Verificação de tipos',
  'Unit tests (Vitest)': 'Testes unitários (Vitest)',
  'Dependency audit (high+)': 'Auditoria de dependências (high+)',
  'AI review gate (demo)': 'Gate de revisão IA (demo)',
  'Build (Vite)': 'Build (Vite)',
  Build: 'Build',
};

const STATUS_PT: Record<string, string> = {
  success: 'sucesso',
  failure: 'falhou',
  cancelled: 'cancelado',
  skipped: 'omitido',
  completed: 'concluído',
  in_progress: 'em curso',
  queued: 'na fila',
  pending: 'pendente',
  waiting: 'à espera',
  requested: 'pedido',
};

function translateActionStep(name: string): string {
  const post = name.match(/^Post (.+)$/i);
  if (post) {
    return `Pós: ${translateActionStep(post[1])}`;
  }
  const run = name.match(/^Run (.+)$/i);
  if (run) {
    const target = run[1];
    if (target.startsWith('actions/checkout')) {
      return 'Checkout do repositório';
    }
    if (target.startsWith('actions/setup-node')) {
      return 'Configurar Node.js';
    }
    if (target.startsWith('cloudflare/wrangler-action')) {
      return 'Deploy com Wrangler';
    }
    return `Executar ${target}`;
  }
  return STEP_PT[name] ?? name;
}

export function localizeStepName(name: string, locale: Locale): string {
  if (isEnglish(locale)) return name;
  return translateActionStep(name);
}

export function localizeStepStatus(
  status: string,
  conclusion: string | null,
  locale: Locale,
): string {
  const raw = conclusion ?? status;
  if (isEnglish(locale)) return raw;
  return STATUS_PT[raw] ?? raw;
}
