/**
 * Extension Registry
 * -------------------
 * The registry is the platform's catalog of known extensions. The compiler
 * uses it to resolve `extensionId` → manifest; the runtime uses it to find
 * the factory that instantiates each extension.
 */

import type { ExtensionManifest } from '../types';
import type { ExtensionFactory } from '../runtime';

import { physicsManifest, physicsFactory } from './physics';
import { movementManifest, movementFactory } from './movement';
import { scoreManifest, scoreFactory } from './score';
import { coinCollectorManifest, coinCollectorFactory } from './coin-collector';
import { farmManifest, farmFactory } from './farm';
import { cookingManifest, cookingFactory } from './cooking';

export interface RegistryEntry {
  manifest: ExtensionManifest;
  factory: ExtensionFactory;
}

const REGISTRY: Record<string, RegistryEntry> = {
  [physicsManifest.id]: { manifest: physicsManifest, factory: physicsFactory },
  [movementManifest.id]: { manifest: movementManifest, factory: movementFactory },
  [scoreManifest.id]: { manifest: scoreManifest, factory: scoreFactory },
  [coinCollectorManifest.id]: { manifest: coinCollectorManifest, factory: coinCollectorFactory },
  [farmManifest.id]: { manifest: farmManifest, factory: farmFactory },
  [cookingManifest.id]: { manifest: cookingManifest, factory: cookingFactory },
};

export function listExtensions(): RegistryEntry[] {
  return Object.values(REGISTRY);
}

export function getManifest(extensionId: string): ExtensionManifest | undefined {
  return REGISTRY[extensionId]?.manifest;
}

export function getFactory(extensionId: string): ExtensionFactory | undefined {
  return REGISTRY[extensionId]?.factory;
}

export function resolveExtension(extensionId: string): ExtensionManifest | undefined {
  return getManifest(extensionId);
}

export function getAllFactories(): Record<string, ExtensionFactory> {
  const out: Record<string, ExtensionFactory> = {};
  for (const [id, entry] of Object.entries(REGISTRY)) out[id] = entry.factory;
  return out;
}
