#!/usr/bin/env node
/**
 * Writes importable example diagrams under fixtures/diagnostics-examples/,
 * one per diagnostic the AWS validators produce, plus a combined showcase.
 * Each file is a plain ArchvizDocument — load it in Studio via "Import".
 *
 * The expected diagnostics per example live in EXAMPLES below and are locked
 * by packages/codegen/src/diagnostics-examples.test.ts; this script refuses
 * to write a file whose actual diagnostics differ.
 *
 * Usage: node scripts/write-diagnostics-examples.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAwsRegistry } from '@archviz/provider-aws';
import { validate } from '@archviz/core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'fixtures/diagnostics-examples');
const registry = createAwsRegistry();

const res = (id, type, name, { properties = {}, parentId = null, x = 0, y = 0 } = {}) => ({
  id,
  type,
  name,
  properties,
  parentId,
  layout: { x, y },
});
const rel = (id, relationship, sourceId, targetId) => ({ id, relationship, sourceId, targetId });

const doc = (name, resources, relationships) => ({
  version: 1,
  meta: {
    name,
    provider: 'aws',
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
  resources,
  relationships,
});

// --- building blocks -------------------------------------------------------

const roleTrust = {
  resources: [
    res('td-trust', 'aws/ecs-task-definition', 'api-task', {
      properties: { family: 'api', cpu: '256', memory: '512', image: 'myorg/api:1' },
      x: 80,
      y: 80,
    }),
    // Default EC2 trust — wrong for an ECS Execution Role.
    res('role-trust', 'aws/iam-role', 'api-exec-role', {
      properties: { trust_principal: 'ec2' },
      x: 560,
      y: 80,
    }),
  ],
  relationships: [rel('rel-trust', 'execution-role', 'td-trust', 'role-trust')],
};

const workloadRole = {
  resources: [
    // No "assumes" role: writes-to SQS has nowhere to attach IAM.
    res('fn-noperm', 'aws/lambda-function', 'worker', {
      properties: {
        function_name: 'worker',
        runtime: 'nodejs20.x',
        handler: 'index.handler',
        filename: 'function.zip',
      },
      x: 80,
      y: 320,
    }),
    res('q-jobs', 'aws/sqs-queue', 'jobs', {
      properties: { queue_name: 'jobs' },
      x: 560,
      y: 320,
    }),
  ],
  relationships: [rel('rel-write', 'writes-to', 'fn-noperm', 'q-jobs')],
};

const ecsDeploy = {
  resources: [
    // No image/ECR (info) and injected secret without an Execution Role (warning).
    res('td-deploy', 'aws/ecs-task-definition', 'web-task', {
      properties: { family: 'web', cpu: '256', memory: '512' },
      x: 80,
      y: 560,
    }),
    res('secret-db', 'aws/secrets-manager-secret', 'db-password', {
      properties: { secret_name: 'app/db-password', source: 'generated-password' },
      x: 560,
      y: 560,
    }),
  ],
  relationships: [rel('rel-secret', 'uses-secret', 'td-deploy', 'secret-db')],
};

const singleAzLbs = {
  resources: [
    res('vpc-1', 'aws/vpc', 'main-vpc', {
      properties: { cidr_block: '10.0.0.0/16' },
      x: 60,
      y: 800,
    }),
    res('subnet-a', 'aws/subnet', 'subnet-a', {
      properties: { cidr_block: '10.0.1.0/24' },
      parentId: 'vpc-1',
      x: 40,
      y: 60,
    }),
    res('alb-1', 'aws/alb', 'public-alb', {
      properties: { load_balancer_type: 'application' },
      parentId: 'subnet-a',
      x: 30,
      y: 40,
    }),
    res('nlb-1', 'aws/nlb', 'tcp-nlb', {
      properties: { load_balancer_type: 'network' },
      parentId: 'subnet-a',
      x: 330,
      y: 40,
    }),
  ],
  relationships: [],
};

const merge = (...parts) => ({
  resources: parts.flatMap((p) => p.resources),
  relationships: parts.flatMap((p) => p.relationships),
});

// --- examples + the diagnostics each one must produce -----------------------

const EXAMPLES = [
  {
    file: 'role-trust-mismatch.archviz.json',
    doc: doc('Example: role trust mismatch', roleTrust.resources, roleTrust.relationships),
    expected: ['role-trust-mismatch:warning'],
  },
  {
    file: 'missing-workload-role.archviz.json',
    doc: doc('Example: missing workload role', workloadRole.resources, workloadRole.relationships),
    // The missing role also trips Lambda's required "Execution Role" connection.
    expected: ['missing-required-connection:error', 'missing-workload-role:error'],
  },
  {
    file: 'ecs-deploy-checks.archviz.json',
    doc: doc('Example: ECS deploy checks', ecsDeploy.resources, ecsDeploy.relationships),
    expected: ['ecs-image-fallback:info', 'ecs-secrets-need-exec-role:warning'],
  },
  {
    file: 'lb-single-az.archviz.json',
    doc: doc('Example: single-AZ load balancers', singleAzLbs.resources, singleAzLbs.relationships),
    expected: ['lb-needs-two-azs:warning', 'lb-single-az:info'],
  },
  {
    file: 'diagnostics-showcase.archviz.json',
    doc: (() => {
      const all = merge(roleTrust, workloadRole, ecsDeploy, singleAzLbs);
      return doc('Example: diagnostics showcase', all.resources, all.relationships);
    })(),
    expected: [
      'ecs-image-fallback:info',
      'ecs-secrets-need-exec-role:warning',
      'lb-needs-two-azs:warning',
      'lb-single-az:info',
      'missing-required-connection:error',
      'missing-workload-role:error',
      'role-trust-mismatch:warning',
    ],
  },
];

mkdirSync(outDir, { recursive: true });
let failed = false;
for (const { file, doc: d, expected } of EXAMPLES) {
  const actual = [...new Set(validate(d, registry).diagnostics.map((x) => `${x.code}:${x.severity}`))].sort();
  const want = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(want)) {
    console.error(`✗ ${file}\n  expected ${JSON.stringify(want)}\n  actual   ${JSON.stringify(actual)}`);
    failed = true;
    continue;
  }
  writeFileSync(path.join(outDir, file), `${JSON.stringify(d, null, 2)}\n`);
  console.log(`✓ ${file} — ${actual.join(', ')}`);
}
if (failed) process.exit(1);
