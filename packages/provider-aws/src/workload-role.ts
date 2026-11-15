import type {
  ConnectionRule,
  Diagnostic,
  DocumentValidator,
  ValidationDocument,
  ValidationResource,
} from '@archviz/schema';

/**
 * Whether this edge only works when the source workload has an IAM role to
 * attach policies to (SQS/S3/DynamoDB access via api-iam/sqs-iam).
 */
function edgeNeedsWorkloadRole(rule: ConnectionRule, targetType: string): boolean {
  const strategy = rule.materialize?.strategy;
  if (strategy === 'sqs-iam' || strategy === 'api-iam') return true;
  if (strategy === 'reads-from') {
    return (
      targetType === 'aws/sqs-queue' ||
      targetType === 'aws/s3-bucket' ||
      targetType === 'aws/dynamodb-table'
    );
  }
  return false;
}

/**
 * The IAM role a workload assumes: a direct `assumes` edge, a task
 * definition's `task-role`, or — for an ECS service — the task role of the
 * task definition it runs. Single source of truth shared by the
 * missing-workload-role validator and codegen's api-iam/sqs-iam
 * materializers.
 */
export function resolveWorkloadRoleId(
  source: Pick<ValidationResource, 'id' | 'type'>,
  doc: ValidationDocument,
): string | null {
  const assumes = doc.relationships.find(
    (r) => r.sourceId === source.id && r.relationship === 'assumes',
  );
  if (assumes) return assumes.targetId;

  if (source.type === 'aws/ecs-task-definition') {
    const taskRole = doc.relationships.find(
      (r) => r.sourceId === source.id && r.relationship === 'task-role',
    );
    return taskRole?.targetId ?? null;
  }

  if (source.type === 'aws/ecs-service') {
    const runsTask = doc.relationships.find(
      (r) => r.sourceId === source.id && r.relationship === 'runs-task',
    );
    if (!runsTask) return null;
    const taskRole = doc.relationships.find(
      (r) => r.sourceId === runsTask.targetId && r.relationship === 'task-role',
    );
    return taskRole?.targetId ?? null;
  }

  return null;
}

function workloadRoleHint(sourceType: string): string {
  if (sourceType === 'aws/ecs-service' || sourceType === 'aws/ecs-task-definition') {
    return 'connect an IAM Role to the Task Definition via "Task Role"';
  }
  if (sourceType === 'aws/lambda-function') {
    return 'connect an IAM Role via "Execution Role"';
  }
  if (sourceType === 'aws/ec2-instance') {
    return 'connect an IAM Role via "IAM Role"';
  }
  return 'connect an IAM Role the workload can assume';
}

/**
 * API-access edges (SQS/S3/DynamoDB reads-from / writes-to) need a resolvable
 * workload IAM role — same class of diagram error as Lambda missing its
 * Execution Role, so Export/Plan block instead of emitting HCL that grants
 * nothing.
 */
export const workloadRoleValidator: DocumentValidator = {
  id: 'aws/workload-role',
  validate(doc, registry) {
    const diagnostics: Diagnostic[] = [];

    for (const rel of doc.relationships) {
      const source = doc.resources.find((r) => r.id === rel.sourceId);
      const target = doc.resources.find((r) => r.id === rel.targetId);
      if (!source || !target) continue;

      const rule = registry.findConnectionRule(source.type, rel.relationship, target.type);
      if (!rule || !edgeNeedsWorkloadRole(rule, target.type)) continue;
      if (resolveWorkloadRoleId(source, doc)) continue;

      const sourceLabel = registry.get(source.type)?.display.label ?? source.type;
      const targetLabel = registry.get(target.type)?.display.label ?? target.type;
      const edgeLabel = rule.label ?? rel.relationship.replace(/-/g, ' ');

      diagnostics.push({
        code: 'missing-workload-role',
        message: `${sourceLabel} "${source.name}" ${edgeLabel.toLowerCase()} ${targetLabel} but has no assumed role — ${workloadRoleHint(source.type)} to grant access`,
        severity: 'error',
        tier: 'structural',
        resourceId: source.id,
        relationshipId: rel.id,
      });
    }

    return diagnostics;
  },
};
