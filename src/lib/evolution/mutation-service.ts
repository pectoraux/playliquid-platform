/**
 * Phase 20.3 — Graph Mutation System
 * ----------------------------------
 * The AI never directly edits experiences. It creates graph mutations.
 *
 * A Mutation is a structured, reviewable transformation of an ExperienceBundle:
 *   ADD_EXTENSION | REMOVE_EXTENSION | UPDATE_CONFIG | REWIRE_CONNECTION | CHANGE_ECONOMY
 *
 * Each mutation captures a before/after graph snapshot and must be
 * creator-approved before it can be applied to production.
 *
 * This module is pure (no DB, no LLM): it takes a bundle + a change spec
 * and produces a new bundle. Persistence + approval state lives in
 * mutation-store.ts.
 */

import type {
  ExperienceBundle,
  ExtensionInstanceSpec,
  WireSpec,
} from '@/kernel/types';
import type { GraphChangeSpec, MutationType } from './evolution-types';

export interface ApplyResult {
  ok: boolean;
  bundle?: ExperienceBundle;
  error?: string;
}

/**
 * Apply a single GraphChangeSpec to a bundle, returning a NEW bundle.
 * Does not mutate the input.
 */
export function applyChange(
  bundle: ExperienceBundle,
  change: GraphChangeSpec,
): ApplyResult {
  switch (change.mutationType) {
    case 'UPDATE_CONFIG':
      return applyUpdateConfig(bundle, change);
    case 'ADD_EXTENSION':
      return applyAddExtension(bundle, change);
    case 'REMOVE_EXTENSION':
      return applyRemoveExtension(bundle, change);
    case 'REWIRE_CONNECTION':
      return applyRewire(bundle, change);
    case 'CHANGE_ECONOMY':
      return applyChangeEconomy(bundle, change);
    default:
      return { ok: false, error: `Unknown mutation type: ${(change as GraphChangeSpec).mutationType}` };
  }
}

/**
 * Apply a sequence of changes (left to right). Each change operates on the
 * result of the previous one.
 */
export function applyChanges(
  bundle: ExperienceBundle,
  changes: GraphChangeSpec[],
): ApplyResult {
  let current = bundle;
  for (const c of changes) {
    const r = applyChange(current, c);
    if (!r.ok || !r.bundle) return r;
    current = r.bundle;
  }
  return { ok: true, bundle: current };
}

// ─── Individual mutations ──────────────────────────────────────────────────

function applyUpdateConfig(bundle: ExperienceBundle, change: GraphChangeSpec): ApplyResult {
  if (!change.instance) return { ok: false, error: 'UPDATE_CONFIG requires `instance`' };
  if (!change.config) return { ok: false, error: 'UPDATE_CONFIG requires `config`' };
  const exists = bundle.instances.some((i) => i.id === change.instance);
  if (!exists) return { ok: false, error: `Instance "${change.instance}" not found` };

  const instances = bundle.instances.map((inst) =>
    inst.id === change.instance
      ? { ...inst, config: { ...(inst.config ?? {}), ...change.config } }
      : inst,
  );
  return { ok: true, bundle: { ...bundle, instances } };
}

function applyAddExtension(bundle: ExperienceBundle, change: GraphChangeSpec): ApplyResult {
  if (!change.extensionId) return { ok: false, error: 'ADD_EXTENSION requires `extensionId`' };
  // Generate a stable instance id from the extension id + count
  const count = bundle.instances.filter((i) => i.extensionId === change.extensionId).length;
  const instanceId = change.instance ?? `${change.extensionId.split('.').pop()}-${count + 1}`;
  if (bundle.instances.some((i) => i.id === instanceId)) {
    return { ok: false, error: `Instance id "${instanceId}" already exists` };
  }
  const newInstance: ExtensionInstanceSpec = {
    id: instanceId,
    extensionId: change.extensionId,
    config: change.config ?? {},
  };
  return {
    ok: true,
    bundle: { ...bundle, instances: [...bundle.instances, newInstance] },
  };
}

function applyRemoveExtension(bundle: ExperienceBundle, change: GraphChangeSpec): ApplyResult {
  if (!change.instance) return { ok: false, error: 'REMOVE_EXTENSION requires `instance`' };
  const exists = bundle.instances.some((i) => i.id === change.instance);
  if (!exists) return { ok: false, error: `Instance "${change.instance}" not found` };

  const instances = bundle.instances.filter((i) => i.id !== change.instance);
  // Remove any wires that referenced the removed instance
  const wires = bundle.wires.filter(
    (w) => w.from.instance !== change.instance && w.to.instance !== change.instance,
  );
  return { ok: true, bundle: { ...bundle, instances, wires } };
}

function applyRewire(bundle: ExperienceBundle, change: GraphChangeSpec): ApplyResult {
  if (!change.wire) return { ok: false, error: 'REWIRE_CONNECTION requires `wire`' };
  const w = change.wire;

  if (w.remove) {
    if (!w.from || !w.to) return { ok: false, error: 'remove requires from + to' };
    const wires = bundle.wires.filter(
      (existing) =>
        !(
          existing.from.instance === w.from!.instance &&
          existing.from.channel === w.from!.channel &&
          existing.to.instance === w.to!.instance &&
          existing.to.channel === w.to!.channel
        ),
    );
    return { ok: true, bundle: { ...bundle, wires } };
  }

  if (!w.from || !w.to) return { ok: false, error: 'add wire requires from + to' };
  // Validate endpoints exist
  const fromInst = bundle.instances.some((i) => i.id === w.from!.instance);
  const toInst = bundle.instances.some((i) => i.id === w.to!.instance);
  if (!fromInst) return { ok: false, error: `Source instance "${w.from.instance}" not found` };
  if (!toInst) return { ok: false, error: `Target instance "${w.to.instance}" not found` };

  const newWire: WireSpec = {
    from: { instance: w.from.instance, channel: w.from.channel },
    to: { instance: w.to.instance, channel: w.to.channel },
  };
  // Avoid duplicate wires
  const exists = bundle.wires.some(
    (existing) =>
      existing.from.instance === newWire.from.instance &&
      existing.from.channel === newWire.from.channel &&
      existing.to.instance === newWire.to.instance &&
      existing.to.channel === newWire.to.channel,
  );
  if (exists) return { ok: true, bundle };

  return { ok: true, bundle: { ...bundle, wires: [...bundle.wires, newWire] } };
}

function applyChangeEconomy(bundle: ExperienceBundle, change: GraphChangeSpec): ApplyResult {
  // CHANGE_ECONOMY is a specialization of UPDATE_CONFIG that targets economy-
  // related config keys (prices, rewards, multipliers). We model it as a
  // config patch on a named instance (or all instances if `instance` is "*").
  if (!change.config) return { ok: false, error: 'CHANGE_ECONOMY requires `config`' };

  if (change.instance && change.instance !== '*') {
    return applyUpdateConfig(bundle, { ...change, mutationType: 'UPDATE_CONFIG' });
  }

  // Apply to all instances (broadcast an economy patch)
  const instances = bundle.instances.map((inst) => ({
    ...inst,
    config: { ...(inst.config ?? {}), ...change.config },
  }));
  return { ok: true, bundle: { ...bundle, instances } };
}

// ─── Diff helpers (for the UI: "before → after") ───────────────────────────

export interface MutationDiff {
  addedInstances: string[];
  removedInstances: string[];
  configChanges: Array<{
    instance: string;
    key: string;
    before: unknown;
    after: unknown;
  }>;
  wireChanges: {
    added: WireSpec[];
    removed: WireSpec[];
  };
  mutationTypes: MutationType[];
}

export function diffBundles(before: ExperienceBundle, after: ExperienceBundle): MutationDiff {
  const beforeIds = new Set(before.instances.map((i) => i.id));
  const afterIds = new Set(after.instances.map((i) => i.id));

  const addedInstances = [...afterIds].filter((id) => !beforeIds.has(id));
  const removedInstances = [...beforeIds].filter((id) => !afterIds.has(id));

  const configChanges: MutationDiff['configChanges'] = [];
  for (const afterInst of after.instances) {
    const beforeInst = before.instances.find((i) => i.id === afterInst.id);
    if (!beforeInst) continue;
    const beforeConfig = beforeInst.config ?? {};
    const afterConfig = afterInst.config ?? {};
    const allKeys = new Set([...Object.keys(beforeConfig), ...Object.keys(afterConfig)]);
    for (const key of allKeys) {
      if (JSON.stringify(beforeConfig[key]) !== JSON.stringify(afterConfig[key])) {
        configChanges.push({
          instance: afterInst.id,
          key,
          before: beforeConfig[key],
          after: afterConfig[key],
        });
      }
    }
  }

  const wireKey = (w: WireSpec) =>
    `${w.from.instance}:${w.from.channel}->${w.to.instance}:${w.to.channel}`;
  const beforeWires = new Map(before.wires.map((w) => [wireKey(w), w]));
  const afterWires = new Map(after.wires.map((w) => [wireKey(w), w]));
  const addedWires = [...afterWires.entries()].filter(([k]) => !beforeWires.has(k)).map(([, w]) => w);
  const removedWires = [...beforeWires.entries()].filter(([k]) => !afterWires.has(k)).map(([, w]) => w);

  const mutationTypes: MutationType[] = [];
  if (addedInstances.length) mutationTypes.push('ADD_EXTENSION');
  if (removedInstances.length) mutationTypes.push('REMOVE_EXTENSION');
  if (configChanges.length) mutationTypes.push('UPDATE_CONFIG');
  if (addedWires.length || removedWires.length) mutationTypes.push('REWIRE_CONNECTION');

  return {
    addedInstances,
    removedInstances,
    configChanges,
    wireChanges: { added: addedWires, removed: removedWires },
    mutationTypes,
  };
}
