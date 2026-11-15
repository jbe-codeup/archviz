import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validate, type ArchvizDocument } from '@archviz/core';
import { createAwsRegistry } from '@archviz/provider-aws';

/**
 * Locks fixtures/diagnostics-examples/ to the diagnostics each example is
 * meant to demonstrate. Regenerate with:
 *   node scripts/write-diagnostics-examples.mjs
 */
const EXPECTED: Record<string, string[]> = {
  'role-trust-mismatch.archviz.json': ['role-trust-mismatch:warning'],
  'missing-workload-role.archviz.json': [
    'missing-required-connection:error',
    'missing-workload-role:error',
  ],
  'ecs-deploy-checks.archviz.json': [
    'ecs-image-fallback:info',
    'ecs-secrets-need-exec-role:warning',
  ],
  'lb-single-az.archviz.json': ['lb-needs-two-azs:warning', 'lb-single-az:info'],
  'diagnostics-showcase.archviz.json': [
    'ecs-image-fallback:info',
    'ecs-secrets-need-exec-role:warning',
    'lb-needs-two-azs:warning',
    'lb-single-az:info',
    'missing-required-connection:error',
    'missing-workload-role:error',
    'role-trust-mismatch:warning',
  ],
};

const dir = fileURLToPath(new URL('../../../fixtures/diagnostics-examples/', import.meta.url));
const registry = createAwsRegistry();

describe('diagnostics example fixtures', () => {
  it('covers every example file on disk', () => {
    expect(readdirSync(dir).filter((f) => f.endsWith('.archviz.json')).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it.each(Object.entries(EXPECTED))('%s produces exactly %j', (file, expected) => {
    const doc = JSON.parse(readFileSync(`${dir}${file}`, 'utf8')) as ArchvizDocument;
    const actual = [
      ...new Set(validate(doc, registry).diagnostics.map((d) => `${d.code}:${d.severity}`)),
    ].sort();
    expect(actual).toEqual([...expected].sort());
  });
});
