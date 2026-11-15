import type { Diagnostic } from './diagnostics.js';
import type { ResourceRegistry } from './registry.js';

/*
 * Minimal document shape a validator sees. Kept structural (rather than
 * importing @archviz/core's ArchvizDocument) so provider packages can ship
 * validators while depending only on @archviz/schema. Core's document types
 * satisfy these interfaces as-is.
 */
export interface ValidationResource {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  parentId?: string | null;
}

export interface ValidationRelationship {
  id: string;
  relationship: string;
  sourceId: string;
  targetId: string;
}

export interface ValidationDocument {
  resources: readonly ValidationResource[];
  relationships: readonly ValidationRelationship[];
}

/**
 * A document-wide rule a provider registers on the registry. Core's
 * validate() runs every registered validator, so Studio, MCP and codegen all
 * surface the result without per-rule wiring.
 *
 * Set `relationshipId` on diagnostics an edge caused — Studio toasts new
 * warnings on the edge that was just drawn.
 */
export interface DocumentValidator {
  /** Unique id, e.g. 'aws/role-trust'. */
  id: string;
  validate(doc: ValidationDocument, registry: ResourceRegistry): Diagnostic[];
}
