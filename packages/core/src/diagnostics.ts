import type { Diagnostic } from '@archviz/schema';

// Defined in @archviz/schema so provider validators can produce them.
export type { DiagnosticSeverity, DiagnosticTier, Diagnostic } from '@archviz/schema';

export interface ConstraintResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export function ok(): ConstraintResult {
  return { ok: true, diagnostics: [] };
}

export function fail(...diagnostics: Diagnostic[]): ConstraintResult {
  return { ok: false, diagnostics };
}

export function mergeResults(...results: ConstraintResult[]): ConstraintResult {
  const diagnostics = results.flatMap((r) => r.diagnostics);
  return {
    ok: diagnostics.every((d) => d.severity !== 'error'),
    diagnostics,
  };
}

export function hasStructuralErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.tier === 'structural' && d.severity === 'error');
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
