import { describe, expect, it } from 'vitest';
import {
  createEmptyDocument,
  validate,
  type ArchvizDocument,
  type ResourceInstance,
} from '@archviz/core';
import { defineResource, ResourceRegistry } from '@archviz/schema';
import { awsResources, createAwsRegistry, roleTrustValidator } from '@archviz/provider-aws';

function resource(
  partial: Partial<ResourceInstance> & Pick<ResourceInstance, 'id' | 'type' | 'name'>,
): ResourceInstance {
  return { properties: {}, parentId: null, layout: { x: 0, y: 0 }, ...partial };
}

const registry = createAwsRegistry();

function docWith(
  source: ResourceInstance,
  roleProps: Record<string, unknown>,
  relationship: string,
): ArchvizDocument {
  return {
    ...createEmptyDocument('role-trust'),
    resources: [source, resource({ id: 'role', type: 'aws/iam-role', name: 'app-role', properties: roleProps })],
    relationships: [{ id: 'r1', relationship, sourceId: source.id, targetId: 'role' }],
  };
}

const taskDef = resource({
  id: 'td',
  type: 'aws/ecs-task-definition',
  name: 'api',
  properties: { family: 'api', cpu: '256', memory: '512' },
});
const lambda = resource({ id: 'fn', type: 'aws/lambda-function', name: 'worker' });

function trustDiagnostics(doc: ArchvizDocument) {
  return validate(doc, registry).diagnostics.filter((d) => d.code === 'role-trust-mismatch');
}

describe('role-trust-mismatch', () => {
  it.each(['execution-role', 'task-role'])(
    'warns when an ECS %s trusts the default ec2 principal',
    (relationship) => {
      const diags = trustDiagnostics(docWith(taskDef, { trust_principal: 'ec2' }, relationship));
      expect(diags).toHaveLength(1);
      expect(diags[0]).toMatchObject({
        severity: 'warning',
        tier: 'semantic',
        resourceId: 'role',
        relationshipId: 'r1',
        property: 'trust_principal',
      });
      expect(diags[0]!.message).toContain('ecs-tasks.amazonaws.com');
      expect(diags[0]!.message).toContain('set Trusted Service to "ecs-tasks"');
    },
  );

  it('treats a role with no trust_principal or policy as the ec2 default', () => {
    expect(trustDiagnostics(docWith(taskDef, {}, 'task-role'))).toHaveLength(1);
  });

  it('is quiet when the preset matches', () => {
    expect(trustDiagnostics(docWith(taskDef, { trust_principal: 'ecs-tasks' }, 'task-role'))).toEqual([]);
    expect(trustDiagnostics(docWith(lambda, { trust_principal: 'lambda' }, 'assumes'))).toEqual([]);
  });

  it('warns for a Lambda execution role that trusts ECS', () => {
    const diags = trustDiagnostics(docWith(lambda, { trust_principal: 'ecs-tasks' }, 'assumes'));
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('lambda.amazonaws.com');
  });

  it('reads custom JSON, including multi-service principals', () => {
    const policy = (service: unknown) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Action: 'sts:AssumeRole', Principal: { Service: service } }],
      });

    expect(
      trustDiagnostics(
        docWith(
          taskDef,
          { trust_principal: 'custom', assume_role_policy: policy(['lambda.amazonaws.com', 'ecs-tasks.amazonaws.com']) },
          'task-role',
        ),
      ),
    ).toEqual([]);

    const diags = trustDiagnostics(
      docWith(taskDef, { trust_principal: 'custom', assume_role_policy: policy('lambda.amazonaws.com') }, 'task-role'),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('add "ecs-tasks.amazonaws.com" to its custom trust policy');
  });

  it('skips custom JSON it cannot parse rather than guessing', () => {
    expect(
      trustDiagnostics(docWith(taskDef, { trust_principal: 'custom', assume_role_policy: '{not json' }, 'task-role')),
    ).toEqual([]);
  });

  it('does not block export', () => {
    const result = validate(docWith(taskDef, { trust_principal: 'ec2' }, 'task-role'), registry);
    expect(result.diagnostics.some((d) => d.code === 'role-trust-mismatch')).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('extends to a new workload by data alone (assumedBy on its connection)', () => {
    // A resource the AWS provider doesn't ship — no validator code changes.
    const stateMachine = defineResource({
      id: 'aws/sfn-state-machine',
      provider: 'aws',
      display: { label: 'State Machine', icon: 'sfn', category: 'integration', kind: 'node' },
      capabilities: [],
      nesting: { allowedParents: [] },
      connections: [
        {
          relationship: 'assumes',
          targets: [{ type: 'aws/iam-role' }],
          materialize: { strategy: 'annotation' },
          label: 'Execution Role',
          assumedBy: 'states.amazonaws.com',
        },
      ],
      properties: [],
      terraform: { resourceType: 'aws_sfn_state_machine', attributes: {} },
    });
    const extended = new ResourceRegistry();
    extended.registerAll([...awsResources, stateMachine]);
    extended.registerValidator(roleTrustValidator);

    const sfn = resource({ id: 'sfn', type: 'aws/sfn-state-machine', name: 'flow' });
    const diags = validate(docWith(sfn, { trust_principal: 'lambda' }, 'assumes'), extended)
      .diagnostics.filter((d) => d.code === 'role-trust-mismatch');
    expect(diags).toHaveLength(1);
    // No preset exists for states.amazonaws.com, so the hint points at custom JSON.
    expect(diags[0]!.message).toContain('add "states.amazonaws.com" to its custom trust policy');
  });
});
