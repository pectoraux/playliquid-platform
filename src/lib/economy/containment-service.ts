/**
 * ADR-005: Game Containment Configuration
 * -----------------------------------------
 * Every experience must fit inside the PlayLiquid frame.
 * This service manages containment configuration for each experience.
 *
 * For now, this is config + schema only.
 * Full HTML5/External adapter implementation is deferred.
 */

import { db } from '@/lib/db';

/**
 * Get or create containment config for an experience.
 */
export async function getContainmentConfig(experienceId: string): Promise<any> {
  let config = await db.gameContainmentConfigRecord.findUnique({
    where: { experienceId },
  });
  if (!config) {
    config = await db.gameContainmentConfigRecord.create({
      data: { experienceId },
    });
  }
  return {
    id: config.id,
    experienceId: config.experienceId,
    runtimeType: config.runtimeType,
    viewportMode: config.viewportMode,
    aspectRatio: config.aspectRatio,
    minViewportW: config.minViewportW,
    minViewportH: config.minViewportH,
    inputSchemes: JSON.parse(config.inputSchemes),
    orientation: config.orientation,
    externalUrl: config.externalUrl,
    html5BundleUrl: config.html5BundleUrl,
    sandboxLevel: config.sandboxLevel,
  };
}

/**
 * Update containment config.
 */
export async function updateContainmentConfig(experienceId: string, updates: {
  runtimeType?: string;
  viewportMode?: string;
  aspectRatio?: string;
  orientation?: string;
  externalUrl?: string;
  html5BundleUrl?: string;
  sandboxLevel?: string;
}): Promise<void> {
  const existing = await db.gameContainmentConfigRecord.findUnique({
    where: { experienceId },
  });
  if (!existing) {
    await db.gameContainmentConfigRecord.create({
      data: { experienceId, ...updates },
    });
  } else {
    await db.gameContainmentConfigRecord.update({
      where: { experienceId },
      data: updates,
    });
  }
}

/**
 * Runtime adapter types (for future implementation).
 */
export const RUNTIME_TYPES = {
  native: {
    label: 'Native Extension',
    description: 'Built with PlayLiquid extensions. Highest trust. Deterministic replay.',
    sandboxLevel: 'strict',
    supportsAttestation: true,
  },
  html5: {
    label: 'HTML5 Game',
    description: 'Uploaded HTML5 bundle. Brokered through PlayLiquid frame.',
    sandboxLevel: 'brokered',
    supportsAttestation: false,
  },
  external: {
    label: 'External Game',
    description: 'Externally hosted game. Embedded via signed postMessage.',
    sandboxLevel: 'cross-origin',
    supportsAttestation: false,
  },
} as const;
