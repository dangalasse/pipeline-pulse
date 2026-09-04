/** Preview Workers never dispatch or fetch job logs — even if a secret was copied by mistake. */

export function workerGithubToken(env: {
  DEPLOY_ENV: string;
  GITHUB_TOKEN?: string;
}): string | undefined {
  if (env.DEPLOY_ENV === 'preview') return undefined;
  const token = env.GITHUB_TOKEN?.trim();
  return token || undefined;
}
