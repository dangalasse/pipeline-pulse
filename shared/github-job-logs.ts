/** GitHub job-logs 302 to Azure Blob. Do not send the GitHub token there. */

export function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

/**
 * Follow the GitHub logs redirect without Authorization.
 * Workers `redirect: 'follow'` forwards the GitHub bearer token to Azure,
 * which then returns 401 InvalidAuthenticationInfo.
 */
export async function fetchGithubJobLogBody(
  githubRes: Response,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!isRedirectStatus(githubRes.status)) return githubRes;
  const location = githubRes.headers.get('Location');
  if (!location) {
    throw new Error('GitHub job logs redirect missing Location');
  }
  return fetchImpl(location, {
    headers: { 'User-Agent': 'pipeview-worker' },
    redirect: 'follow',
  });
}
