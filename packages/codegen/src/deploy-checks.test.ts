import { describe, expect, it } from 'vitest';
import {
  createEmptyDocument,
  validate,
  type ArchvizDocument,
  type ResourceInstance,
} from '@archviz/core';
import { createAwsRegistry } from '@archviz/provider-aws';
import { generateMainTf } from './generate.js';

const registry = createAwsRegistry();

function resource(
  partial: Partial<ResourceInstance> & Pick<ResourceInstance, 'id' | 'type' | 'name'>,
): ResourceInstance {
  return { properties: {}, parentId: null, layout: { x: 0, y: 0 }, ...partial };
}

function doc(resources: ResourceInstance[], relationships: ArchvizDocument['relationships']): ArchvizDocument {
  return { ...createEmptyDocument('deploy-checks'), resources, relationships };
}

function codes(d: ArchvizDocument) {
  return validate(d, registry).diagnostics.map((x) => `${x.code}:${x.severity}`);
}

const taskDef = (props: Record<string, unknown> = {}) =>
  resource({
    id: 'td',
    type: 'aws/ecs-task-definition',
    name: 'api',
    properties: { family: 'api', cpu: '256', memory: '512', ...props },
  });
const role = resource({
  id: 'role',
  type: 'aws/iam-role',
  name: 'exec',
  properties: { trust_principal: 'ecs-tasks' },
});
const secret = resource({
  id: 'sec',
  type: 'aws/secrets-manager-secret',
  name: 'db',
  properties: { secret_name: 'app/db', source: 'generated-password' },
});
const vpcSubnet = (lbType: 'aws/alb' | 'aws/nlb') => [
  resource({ id: 'vpc', type: 'aws/vpc', name: 'vpc', properties: { cidr_block: '10.0.0.0/16' } }),
  resource({
    id: 'sn-a',
    type: 'aws/subnet',
    name: 'a',
    parentId: 'vpc',
    properties: { cidr_block: '10.0.1.0/24' },
  }),
  resource({
    id: 'sn-b',
    type: 'aws/subnet',
    name: 'b',
    parentId: 'vpc',
    properties: { cidr_block: '10.0.2.0/24' },
  }),
  resource({ id: 'lb', type: lbType, name: 'lb', parentId: 'sn-a' }),
];

describe('aws/ecs-secrets-exec-role', () => {
  it('warns when secrets are injected without an Execution Role', () => {
    const d = doc([taskDef({ image: 'app:1' }), secret], [
      { id: 'r1', relationship: 'uses-secret', sourceId: 'td', targetId: 'sec' },
    ]);
    expect(codes(d)).toContain('ecs-secrets-need-exec-role:warning');
    expect(generateMainTf(d, registry)).toContain(
      'WARNING: ECS Task Definition "api" injects secrets but has no Execution Role',
    );
  });

  it('is quiet once an Execution Role is connected', () => {
    const d = doc([taskDef({ image: 'app:1' }), secret, role], [
      { id: 'r1', relationship: 'uses-secret', sourceId: 'td', targetId: 'sec' },
      { id: 'r2', relationship: 'execution-role', sourceId: 'td', targetId: 'role' },
    ]);
    expect(codes(d)).not.toContain('ecs-secrets-need-exec-role:warning');
  });
});

describe('aws/ecs-image-source', () => {
  it('flags the nginx fallback as info and mirrors it into the .tf', () => {
    const d = doc([taskDef()], []);
    expect(codes(d)).toContain('ecs-image-fallback:info');
    expect(generateMainTf(d, registry)).toContain(
      'INFO: ECS Task Definition "api" has no ECR connection or Image URI',
    );
  });

  it('is quiet with an Image URI override', () => {
    expect(codes(doc([taskDef({ image: 'app:1' })], []))).not.toContain('ecs-image-fallback:info');
  });
});

describe('aws/lb-multi-az', () => {
  it('warns for an ALB on a single subnet and clears with a second one', () => {
    const single = doc(vpcSubnet('aws/alb'), []);
    expect(codes(single)).toContain('lb-needs-two-azs:warning');
    expect(generateMainTf(single, registry)).toContain(
      'WARNING: Application Load Balancer "lb" needs subnets in at least two Availability Zones',
    );

    const spanned = doc(vpcSubnet('aws/alb'), [
      { id: 'r1', relationship: 'runs-in', sourceId: 'lb', targetId: 'sn-b' },
    ]);
    expect(codes(spanned)).not.toContain('lb-needs-two-azs:warning');
  });

  it('treats a single-AZ NLB as info, not a warning (AWS allows it)', () => {
    const d = doc(vpcSubnet('aws/nlb'), []);
    const all = codes(d);
    expect(all).toContain('lb-single-az:info');
    expect(all).not.toContain('lb-needs-two-azs:warning');
  });
});
