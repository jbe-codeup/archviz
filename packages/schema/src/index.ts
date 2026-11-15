export type {
  ResourceCategory,
  ResourceKind,
  ResourceDisplay,
  PropertyType,
  PropertyValidate,
  PropertyDefinition,
  NestingParentRule,
  NestingRules,
  ConnectionTarget,
  ConnectionCardinality,
  MaterializeStrategy,
  ConnectionRule,
  AttrExpr,
  TerraformMapping,
  TerraformNestedBlock,
  ResourceDefinition,
  ResourceDefinitionJSON,
} from './types.js';

export type { DiagnosticSeverity, DiagnosticTier, Diagnostic } from './diagnostics.js';
export type {
  ValidationResource,
  ValidationRelationship,
  ValidationDocument,
  DocumentValidator,
} from './validators.js';

export { defineResource } from './define-resource.js';
export { prop, ref, refParent, refRel, literal, self } from './exprs.js';
export { ResourceRegistry } from './registry.js';
export {
  serializeDefinitions,
  deserializeDefinitions,
  definitionsToJsonString,
  definitionsFromJsonString,
} from './serialize.js';
