import { describe, expect, it } from 'vitest';
import { createEmptyDocument, type ArchvizDocument, type Diagnostic } from '@archviz/core';
import { newConnectionWarnings } from './connectionWarnings';

const rel = (id: string) => ({ id, relationship: 'task-role', sourceId: 'a', targetId: 'b' });
const doc = (...ids: string[]): ArchvizDocument => ({
  ...createEmptyDocument('t'),
  relationships: ids.map(rel),
});
const diag = (relationshipId: string | undefined, severity: Diagnostic['severity']): Diagnostic => ({
  code: 'x',
  message: `${severity}:${relationshipId}`,
  severity,
  tier: 'semantic',
  relationshipId,
});

describe('newConnectionWarnings', () => {
  it('returns only warnings tied to the newly added edge', () => {
    const diagnostics = [
      diag('old', 'warning'),
      diag('new', 'warning'),
      diag('new', 'error'),
      diag(undefined, 'warning'),
    ];
    expect(newConnectionWarnings(doc('old'), doc('old', 'new'), diagnostics)).toEqual(['warning:new']);
  });

  it('is empty when no edge was added (e.g. connection.add was rejected)', () => {
    expect(newConnectionWarnings(doc('old'), doc('old'), [diag('old', 'warning')])).toEqual([]);
  });
});
