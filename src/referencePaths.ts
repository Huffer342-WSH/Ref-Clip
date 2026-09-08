import * as path from 'node:path';

/** Relative links use forward slashes and an explicit dot prefix. */
export function relativeFilePath(base: string, file: string, paths: typeof path = path): string {
  const relative = paths.relative(base, file);
  // Different Windows drives cannot be represented by a relative path.
  if (paths.isAbsolute(relative)) { return file; }
  const normalized = relative.split(paths.sep).join('/');
  if (!normalized) { return './'; }
  return normalized.startsWith('../') ? normalized : `./${normalized}`;
}
