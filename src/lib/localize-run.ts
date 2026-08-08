/** Localize GitHub Actions step labels for the UI.
 * Technical GitHub wording stays in English — natural for a DevOps portfolio.
 */

import type { Locale } from '../i18n';

export function localizeStepName(name: string, _locale: Locale): string {
  return name;
}

export function localizeStepStatus(
  status: string,
  conclusion: string | null,
  _locale: Locale,
): string {
  return conclusion ?? status;
}
