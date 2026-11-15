export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** Structural errors block gestures/export; semantic issues are warnings while drawing. */
export type DiagnosticTier = 'structural' | 'semantic';

export interface Diagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  tier: DiagnosticTier;
  resourceId?: string;
  relationshipId?: string;
  property?: string;
}
