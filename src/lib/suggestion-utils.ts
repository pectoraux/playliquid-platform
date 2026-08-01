/**
 * Suggestion → Bundle converter
 * ------------------------------
 * Pure function — no SDK dependency. Safe for client-side import.
 */

import type { ExperienceBundle, ExtensionInstanceSpec, WireSpec } from '@/kernel/types';
import type { AISuggestion } from './ai-composer-types';

export function suggestionToBundle(suggestion: AISuggestion, type: 'GAME' | 'SPARK' = 'GAME'): ExperienceBundle {
  const instances: ExtensionInstanceSpec[] = suggestion.instances.map((i) => ({
    id: i.instanceId,
    extensionId: i.extensionId,
    config: i.config,
    role: i.role as ExtensionInstanceSpec['role'],
  }));
  const wires: WireSpec[] = suggestion.wires.map((w) => ({
    from: w.from,
    to: w.to,
  }));
  return { type, instances, wires };
}
