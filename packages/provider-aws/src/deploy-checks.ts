import type {
  Diagnostic,
  DocumentValidator,
  ValidationDocument,
  ValidationResource,
} from '@archviz/schema';

/*
 * Deploy-time checks: the Terraform is valid, but the result is wrong or
 * surprising at apply/runtime. These used to live as WARNING comments inside
 * the generated .tf (aws-emitters.ts); as validators they reach Studio
 * Diagnostics too, and generate() derives the .tf comment from the same
 * diagnostic.
 */

function outgoing(doc: ValidationDocument, sourceId: string, relationship: string) {
  return doc.relationships.filter(
    (r) => r.sourceId === sourceId && r.relationship === relationship,
  );
}

/** Secrets injected into a task definition need an Execution Role to be pulled. */
export const ecsSecretsExecRoleValidator: DocumentValidator = {
  id: 'aws/ecs-secrets-exec-role',
  validate(doc) {
    const diagnostics: Diagnostic[] = [];
    for (const td of doc.resources) {
      if (td.type !== 'aws/ecs-task-definition') continue;
      if (outgoing(doc, td.id, 'uses-secret').length === 0) continue;
      if (outgoing(doc, td.id, 'execution-role').length > 0) continue;
      diagnostics.push({
        code: 'ecs-secrets-need-exec-role',
        message: `ECS Task Definition "${td.name}" injects secrets but has no Execution Role — ECS cannot pull them at task start. Connect an IAM Role via "Execution Role".`,
        severity: 'warning',
        tier: 'semantic',
        resourceId: td.id,
      });
    }
    return diagnostics;
  },
};

/** No ECR connection and no Image URI: codegen falls back to public nginx. */
export const ecsImageSourceValidator: DocumentValidator = {
  id: 'aws/ecs-image-source',
  validate(doc) {
    const diagnostics: Diagnostic[] = [];
    for (const td of doc.resources) {
      if (td.type !== 'aws/ecs-task-definition') continue;
      const override = typeof td.properties.image === 'string' ? td.properties.image.trim() : '';
      if (override) continue;
      if (outgoing(doc, td.id, 'pulls-image').length > 0) continue;
      diagnostics.push({
        code: 'ecs-image-fallback',
        // Deliberate fallback (handy for demos/LocalStack), so info, not warning.
        message: `ECS Task Definition "${td.name}" has no ECR connection or Image URI — Terraform will deploy public nginx. Connect an ECR Repository ("Pulls image from") or set Image URI for real deploys.`,
        severity: 'info',
        tier: 'semantic',
        resourceId: td.id,
        property: 'image',
      });
    }
    return diagnostics;
  },
};

/** Subnets a load balancer spans: containment parent + "runs-in" edges. */
function subnetCount(lb: ValidationResource, doc: ValidationDocument): number {
  const ids = new Set<string>();

  let current: ValidationResource | undefined = lb;
  while (current?.parentId) {
    const parent = doc.resources.find((r) => r.id === current!.parentId);
    if (!parent) break;
    if (parent.type === 'aws/subnet') {
      ids.add(parent.id);
      break;
    }
    current = parent;
  }

  for (const rel of outgoing(doc, lb.id, 'runs-in')) {
    const target = doc.resources.find((r) => r.id === rel.targetId);
    if (target?.type === 'aws/subnet') ids.add(target.id);
  }

  return ids.size;
}

/**
 * An ALB requires subnets in at least two AZs (apply fails with one). An NLB
 * is allowed a single subnet by AWS, so that's only an info about missing
 * cross-AZ redundancy.
 */
export const lbMultiAzValidator: DocumentValidator = {
  id: 'aws/lb-multi-az',
  validate(doc) {
    const diagnostics: Diagnostic[] = [];
    for (const lb of doc.resources) {
      if (lb.type !== 'aws/alb' && lb.type !== 'aws/nlb') continue;
      if (subnetCount(lb, doc) !== 1) continue; // 0 is already a nesting error
      if (lb.type === 'aws/alb') {
        diagnostics.push({
          code: 'lb-needs-two-azs',
          message: `Application Load Balancer "${lb.name}" needs subnets in at least two Availability Zones — add an "Also spans Subnet" connection to a second subnet.`,
          severity: 'warning',
          tier: 'semantic',
          resourceId: lb.id,
        });
      } else {
        diagnostics.push({
          code: 'lb-single-az',
          message: `Network Load Balancer "${lb.name}" spans a single Availability Zone — AWS allows this, but there is no cross-AZ redundancy. Add an "Also spans Subnet" connection for high availability.`,
          severity: 'info',
          tier: 'semantic',
          resourceId: lb.id,
        });
      }
    }
    return diagnostics;
  },
};
