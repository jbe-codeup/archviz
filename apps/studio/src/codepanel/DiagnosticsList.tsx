import { useMemo } from 'react';
import type { Diagnostic, DiagnosticSeverity } from '@archviz/core';
import { useStudioServices } from '../state/StudioServices';

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };

function SeverityIcon({ severity }: { severity: DiagnosticSeverity }) {
  return (
    <svg
      className={`diagnostics__icon diagnostics__icon--${severity}`}
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      {severity === 'error' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" strokeLinecap="round" />
        </>
      ) : severity === 'warning' ? (
        <>
          <path d="M12 3 2.5 20h19L12 3Z" strokeLinejoin="round" />
          <path d="M12 9.5v4.5M12 17h.01" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5h.01" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/**
 * Diagnostics, errors first; clicking one selects the offending resource and
 * edge on the canvas (same selection the Properties panel follows).
 */
export function DiagnosticsList({ diagnostics }: { diagnostics: readonly Diagnostic[] }) {
  const { store } = useStudioServices();

  const sorted = useMemo(
    () => [...diagnostics].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [diagnostics],
  );
  const counts = useMemo(() => {
    const c: Record<DiagnosticSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const d of diagnostics) c[d.severity] += 1;
    return c;
  }, [diagnostics]);

  const locate = (d: Diagnostic) => {
    if (!d.resourceId && !d.relationshipId) return;
    store.send({
      type: 'selection.set',
      ids: d.resourceId ? [d.resourceId] : [],
      edgeIds: d.relationshipId ? [d.relationshipId] : [],
    });
  };

  return (
    <div className="diagnostics">
      <div className="diagnostics__title">
        <span>Diagnostics</span>
        {diagnostics.length === 0 ? (
          <span className="diagnostics__count diagnostics__count--clean">clean</span>
        ) : (
          (['error', 'warning', 'info'] as const).map(
            (sev) =>
              counts[sev] > 0 && (
                <span key={sev} className={`diagnostics__count diagnostics__count--${sev}`}>
                  <SeverityIcon severity={sev} />
                  {counts[sev]}
                </span>
              ),
          )
        )}
      </div>
      <ul>
        {sorted.map((d, i) => (
          <li key={`${d.code}-${d.resourceId ?? ''}-${d.relationshipId ?? ''}-${i}`}>
            <button
              type="button"
              className={`diagnostics__item diagnostics__item--${d.severity}`}
              onClick={() => locate(d)}
              disabled={!d.resourceId && !d.relationshipId}
              title={
                d.resourceId || d.relationshipId
                  ? `${d.code} — click to select on canvas`
                  : d.code
              }
            >
              <SeverityIcon severity={d.severity} />
              <span>{d.message}</span>
            </button>
          </li>
        ))}
        {diagnostics.length === 0 && <li className="diagnostics__empty">No issues</li>}
      </ul>
    </div>
  );
}
