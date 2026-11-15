import type {
  Diagnostic,
  DocumentValidator,
  ValidationResource,
} from '@archviz/schema';

/**
 * `trust_principal` presets on aws/iam-role → the service they trust.
 * Shared with the codegen iam-role emitter so the two can't drift.
 */
export const TRUST_PRESET_SERVICES: Readonly<Record<string, string>> = {
  ec2: 'ec2.amazonaws.com',
  lambda: 'lambda.amazonaws.com',
  'ecs-tasks': 'ecs-tasks.amazonaws.com',
};

/**
 * Whether the role's trust comes from its assume_role_policy JSON rather
 * than a preset: Custom, or a legacy diagram with only assume_role_policy.
 */
export function usesCustomTrustPolicy(properties: Record<string, unknown>): boolean {
  const preset = properties.trust_principal;
  const policy = properties.assume_role_policy;
  return (
    preset === 'custom' ||
    (preset === undefined && typeof policy === 'string' && policy.trim().length > 0)
  );
}

/**
 * Services an aws/iam-role trusts, or null when that can't be determined
 * (unparseable custom JSON).
 */
export function trustedServices(role: ValidationResource): string[] | null {
  if (!usesCustomTrustPolicy(role.properties)) {
    const service = TRUST_PRESET_SERVICES[String(role.properties.trust_principal || 'ec2')];
    return service ? [service] : null;
  }
  const policy = role.properties.assume_role_policy;
  if (typeof policy !== 'string') return null;

  try {
    const parsed = JSON.parse(policy) as { Statement?: unknown };
    const statements = Array.isArray(parsed.Statement) ? parsed.Statement : [parsed.Statement];
    const services: string[] = [];
    for (const st of statements as Array<{ Effect?: string; Principal?: { Service?: unknown } }>) {
      if (!st || st.Effect === 'Deny') continue;
      const svc = st.Principal?.Service;
      if (typeof svc === 'string') services.push(svc);
      else if (Array.isArray(svc)) services.push(...svc.filter((s): s is string => typeof s === 'string'));
    }
    return services;
  } catch {
    return null;
  }
}

function presetFor(service: string): string | undefined {
  return Object.entries(TRUST_PRESET_SERVICES).find(([, s]) => s === service)?.[0];
}

/**
 * Any connection that declares `assumedBy` must point at a role that trusts
 * that service. Data-driven: supporting a new workload (Step Functions,
 * CodeBuild, …) only needs `assumedBy` on its connection definition.
 */
export const roleTrustValidator: DocumentValidator = {
  id: 'aws/role-trust',
  validate(doc, registry) {
    const diagnostics: Diagnostic[] = [];

    for (const rel of doc.relationships) {
      const source = doc.resources.find((r) => r.id === rel.sourceId);
      const role = doc.resources.find((r) => r.id === rel.targetId);
      if (!source || !role || role.type !== 'aws/iam-role') continue;

      const rule = registry.findConnectionRule(source.type, rel.relationship, role.type);
      const expected = rule?.assumedBy;
      if (!expected) continue;

      const trusted = trustedServices(role);
      if (!trusted || trusted.includes(expected)) continue;

      const sourceLabel = registry.get(source.type)?.display.label ?? source.type;
      const edgeLabel = rule.label ?? rel.relationship.replace(/-/g, ' ');
      const current = trusted.length > 0 ? trusted.join(', ') : 'no service';
      const preset = presetFor(expected);
      // A preset only fixes it when one exists and the role isn't hand-written.
      const fix =
        preset && !usesCustomTrustPolicy(role.properties)
          ? `set Trusted Service to "${preset}"`
          : `add "${expected}" to its custom trust policy`;

      diagnostics.push({
        code: 'role-trust-mismatch',
        message: `IAM Role "${role.name}" is the ${edgeLabel} of ${sourceLabel} "${source.name}" but trusts ${current}, not ${expected} — ${fix}`,
        // Valid Terraform, wrong at deploy time — warn, don't block export.
        severity: 'warning',
        tier: 'semantic',
        resourceId: role.id,
        relationshipId: rel.id,
        property: 'trust_principal',
      });
    }

    return diagnostics;
  },
};
