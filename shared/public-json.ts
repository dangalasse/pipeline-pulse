/** Reject JSON trees that look like they grew a credential field. */

const SECRET_KEY =
  /^(token|secret|password|authorization|api[_-]?key|private[_-]?key|access[_-]?key|client[_-]?secret)$/i;

export function hasSecretLikeKeys(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasSecretLikeKeys(item, depth + 1));
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SECRET_KEY.test(key)) return true;
      if (hasSecretLikeKeys(nested, depth + 1)) return true;
    }
  }
  return false;
}

export const UPSTREAM_FAILED_MESSAGE = 'Upstream request failed.';
