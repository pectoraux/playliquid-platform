/**
 * Experience Graph Compiler
 * --------------------------
 * The compiler is the single most important component of the kernel. It
 * validates that a bundle of extensions can be executed before any runtime
 * attempt. Composition errors are BUILD errors, not runtime crashes.
 *
 * Validations:
 *   1. All instances reference registered extensions
 *   2. All required inputs have at least one incoming wire
 *   3. Every wire references declared channels with assignable types
 *   4. No multi-emitter conflicts on single-cardinality inputs
 *   5. Topological sort succeeds (no cycles)
 *   6. Determinism partition is computed
 *   7. Declared tokens are collected
 */

import type {
  CompiledGraph,
  CompileError,
  ExperienceBundle,
  ExtensionManifest,
  WireSpec,
  TokenDefinition,
} from './types';
import { isAssignable, describeType } from './channel-type';

export interface ExtensionResolver {
  (extensionId: string): ExtensionManifest | undefined;
}

export function compileBundle(
  bundle: ExperienceBundle,
  resolve: ExtensionResolver,
): CompiledGraph {
  const errors: CompileError[] = [];
  const instances: CompiledGraph['instances'] = {};
  const inputSources: CompiledGraph['inputSources'] = {};

  // ── Phase 1: resolve all instances ──────────────────────────────────────
  for (const spec of bundle.instances) {
    const manifest = resolve(spec.extensionId);
    if (!manifest) {
      errors.push({
        code: 'UNRESOLVED_EXTENSION',
        message: `Instance "${spec.id}" references unknown extension "${spec.extensionId}"`,
        path: `instances[${spec.id}]`,
      });
      continue;
    }
    instances[spec.id] = { spec, manifest };
    inputSources[spec.id] = {};
  }

  if (errors.length > 0) {
    return emptyResult(errors, instances, inputSources);
  }

  // ── Phase 2: validate instance ids are unique ───────────────────────────
  const ids = bundle.instances.map((i) => i.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) {
    errors.push({
      code: 'DUPLICATE_INSTANCE_ID',
      message: `Instance id "${dup}" is used more than once`,
    });
  }

  // ── Phase 3: validate wires reference declared channels ─────────────────
  const validWires: WireSpec[] = [];
  for (let i = 0; i < bundle.wires.length; i++) {
    const w = bundle.wires[i];
    const path = `wires[${i}]`;
    const fromInst = instances[w.from.instance];
    const toInst = instances[w.to.instance];

    if (!fromInst) {
      errors.push({
        code: 'WIRE_FROM_UNKNOWN_INSTANCE',
        message: `Wire references unknown source instance "${w.from.instance}"`,
        path,
      });
      continue;
    }
    if (!toInst) {
      errors.push({
        code: 'WIRE_TO_UNKNOWN_INSTANCE',
        message: `Wire references unknown target instance "${w.to.instance}"`,
        path,
      });
      continue;
    }

    const fromChan = fromInst.manifest.outputs.find((c) => c.name === w.from.channel);
    const toChan = toInst.manifest.inputs.find((c) => c.name === w.to.channel);

    if (!fromChan) {
      errors.push({
        code: 'WIRE_FROM_UNKNOWN_CHANNEL',
        message: `Extension "${fromInst.manifest.id}" has no output channel "${w.from.channel}"`,
        path,
      });
      continue;
    }
    if (!toChan) {
      errors.push({
        code: 'WIRE_TO_UNKNOWN_CHANNEL',
        message: `Extension "${toInst.manifest.id}" has no input channel "${w.to.channel}"`,
        path,
      });
      continue;
    }

    // Type check
    if (!isAssignable(fromChan.type, toChan.type)) {
      errors.push({
        code: 'TYPE_MISMATCH',
        message: `Channel type mismatch: "${w.from.instance}.${w.from.channel}" is ${describeType(
          fromChan.type,
        )}, but "${w.to.instance}.${w.to.channel}" expects ${describeType(toChan.type)}`,
        path,
      });
      continue;
    }

    validWires.push(w);
    (inputSources[w.to.instance][w.to.channel] ??= []).push(w);
  }

  // ── Phase 4: required inputs must have at least one source ──────────────
  for (const [instId, { manifest }] of Object.entries(instances)) {
    for (const input of manifest.inputs) {
      if (input.required) {
        const sources = inputSources[instId]?.[input.name] ?? [];
        if (sources.length === 0) {
          errors.push({
            code: 'MISSING_REQUIRED_INPUT',
            message: `Instance "${instId}" (${manifest.id}) requires input "${input.name}" but no wire feeds it`,
            path: `instances[${instId}].inputs[${input.name}]`,
          });
        }
      }
      // Single-cardinality inputs may not have multiple sources
      const sources = inputSources[instId]?.[input.name] ?? [];
      if (input.cardinality === 'single' && sources.length > 1) {
        errors.push({
          code: 'MULTI_EMITTER_ON_SINGLE',
          message: `Input "${input.name}" on "${instId}" is single-cardinality but has ${sources.length} sources`,
          path: `instances[${instId}].inputs[${input.name}]`,
        });
      }
    }
  }

  // ── Phase 5: topological sort + cycle detection ─────────────────────────
  // Build adjacency: instance depends on the instances feeding its inputs.
  const deps: Record<string, Set<string>> = {};
  for (const instId of Object.keys(instances)) deps[instId] = new Set();
  for (const w of validWires) {
    deps[w.to.instance].add(w.from.instance);
  }

  const executionOrder: string[] = [];
  const visited: Record<string, 'visiting' | 'done'> = {};
  let hasCycle = false;

  function visit(id: string, stack: string[]) {
    if (visited[id] === 'done') return;
    if (visited[id] === 'visiting') {
      const cycleStart = stack.indexOf(id);
      const cycle = stack.slice(cycleStart).concat(id).join(' → ');
      errors.push({
        code: 'CYCLE_DETECTED',
        message: `Dependency cycle detected: ${cycle}`,
        path: `instances[${id}]`,
      });
      hasCycle = true;
      return;
    }
    visited[id] = 'visiting';
    stack.push(id);
    for (const dep of deps[id]) visit(dep, stack);
    stack.pop();
    visited[id] = 'done';
    executionOrder.push(id);
  }

  for (const id of Object.keys(instances)) visit(id, []);

  if (hasCycle || errors.length > 0) {
    return {
      valid: false,
      errors,
      executionOrder,
      instances,
      inputSources,
      deterministic: false,
      declaredTokens: collectTokens(instances),
    };
  }

  // ── Phase 6: determinism partition ──────────────────────────────────────
  // An extension is deterministic iff its manifest says so AND nothing it
  // depends on is non-deterministic. (Transitive closure.)
  const isDet = (id: string): boolean => {
    const m = instances[id].manifest;
    if (m.determinismMode !== 'deterministic') return false;
    for (const dep of deps[id]) if (!isDet(dep)) return false;
    return true;
  };
  let deterministic = true;
  for (const id of Object.keys(instances)) {
    if (!isDet(id)) deterministic = false;
  }

  return {
    valid: true,
    errors: [],
    executionOrder,
    instances,
    inputSources,
    deterministic,
    declaredTokens: collectTokens(instances),
    contentHash: hashBundle(bundle),
  };
}

function collectTokens(
  instances: CompiledGraph['instances'],
): TokenDefinition[] {
  const seen = new Set<string>();
  const out: TokenDefinition[] = [];
  for (const { manifest } of Object.values(instances)) {
    for (const t of manifest.tokenDefinitions ?? []) {
      if (seen.has(t.symbol)) continue;
      seen.add(t.symbol);
      out.push(t);
    }
  }
  return out;
}

function emptyResult(
  errors: CompileError[],
  instances: CompiledGraph['instances'],
  inputSources: CompiledGraph['inputSources'],
): CompiledGraph {
  return {
    valid: false,
    errors,
    executionOrder: [],
    instances,
    inputSources,
    deterministic: false,
    declaredTokens: collectTokens(instances),
  };
}

/**
 * Simple content hash. In production this would be SHA-256 of canonical JSON.
 * For v0.1 a stable hash suffices.
 */
function hashBundle(bundle: ExperienceBundle): string {
  const canonical = JSON.stringify({
    type: bundle.type,
    instances: bundle.instances
      .map((i) => ({ id: i.id, extensionId: i.extensionId, role: i.role }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    wires: bundle.wires
      .map((w) => ({
        from: `${w.from.instance}.${w.from.channel}`,
        to: `${w.to.instance}.${w.to.channel}`,
      }))
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
  });
  // FNV-1a 32-bit, sufficient as a fingerprint
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
