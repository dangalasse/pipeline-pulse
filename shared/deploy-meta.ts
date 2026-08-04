/** Shared contract between Worker API and React UI. */
export interface DeployMeta {
  service: string;
  env: string;
  gitSha: string;
  buildTime: string;
  githubRunUrl: string | null;
  githubRepo: string;
  edgeTime: string;
  region: string | null;
}

export function shortSha(sha: string): string {
  if (!sha || sha === 'local') return 'local';
  return sha.slice(0, 7);
}

export function isLiveSha(sha: string): boolean {
  return Boolean(sha) && sha !== 'local' && /^[0-9a-f]{7,40}$/i.test(sha);
}
