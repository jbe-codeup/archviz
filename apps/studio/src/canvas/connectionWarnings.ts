import type { ArchvizDocument, Diagnostic } from '@archviz/core';

/**
 * Warning messages caused by edges that exist in `after` but not `before`.
 * Validators tag edge-caused diagnostics with `relationshipId`, so any rule a
 * provider registers gets an on-connect toast with no Studio changes.
 */
export function newConnectionWarnings(
  before: ArchvizDocument,
  after: ArchvizDocument,
  diagnostics: readonly Diagnostic[],
): string[] {
  const existing = new Set(before.relationships.map((r) => r.id));
  const added = new Set(after.relationships.filter((r) => !existing.has(r.id)).map((r) => r.id));
  if (added.size === 0) return [];
  return diagnostics
    .filter((d) => d.severity === 'warning' && d.relationshipId && added.has(d.relationshipId))
    .map((d) => d.message);
}
