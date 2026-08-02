/**
 * Phase 22 — Compatibility Validator
 * ----------------------------------
 * Validates a GameSpecification against PlayLiquid's capabilities.
 * Returns what's supported, what's missing, and any warnings.
 */

import {
  PLAYLIQUID_CAPABILITIES,
  type CompatibilityCheck,
  type GameSpecification,
} from './game-spec-schema';

/**
 * Validate a GameSpecification against the PlayLiquid platform.
 */
export function validateCompatibility(spec: GameSpecification): CompatibilityCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  const supportedExtensions: string[] = [];
  const supportedInputs: string[] = [];

  // ── Runtime ──
  const runtime: CompatibilityCheck['runtime'] = spec.format === 'spark' ? 'native' : 'native';

  // ── Container ──
  const container = spec.orientation === 'portrait' ? '9:16 Portrait' : '16:9 Landscape';

  // ── Input ──
  for (const input of spec.controls) {
    if (PLAYLIQUID_CAPABILITIES.inputs.includes(input)) {
      supportedInputs.push(input);
    } else {
      missing.push(`Input "${input}" not directly supported (use keyboard/touch)`);
    }
  }

  // ── Extensions ──
  for (const ext of spec.extensions) {
    if (PLAYLIQUID_CAPABILITIES.extensions.includes(ext)) {
      supportedExtensions.push(ext);
    } else {
      // Some extensions are conceptual (not yet implemented as native extensions)
      warnings.push(`Extension "${ext}" is conceptual — will be simulated via the engine template`);
    }
  }

  // ── Telemetry ──
  const telemetry = true; // Always supported via the engine

  // ── Evolution Ready ──
  const evolutionReady = spec.telemetry.length > 0 && supportedExtensions.length > 0;

  // ── Format-specific checks ──
  if (spec.format === 'spark') {
    if (spec.orientation !== 'portrait') {
      warnings.push('Sparks should be portrait (9:16) for mobile-first experience');
    }
    if (!spec.controls.includes('touch')) {
      warnings.push('Sparks should support touch input');
    }
    if (spec.extensions.length > PLAYLIQUID_CAPABILITIES.sparkConstraints.maxMechanics) {
      warnings.push(`Sparks work best with ≤${PLAYLIQUID_CAPABILITIES.sparkConstraints.maxMechanics} core mechanics (you have ${spec.extensions.length})`);
    }
  } else {
    if (spec.orientation !== 'landscape') {
      warnings.push('Games should be landscape (16:9) for desktop');
    }
  }

  // ── Missing capabilities ──
  if (!spec.engineTemplateId) {
    missing.push('No engine template selected');
  }

  const passed = missing.length === 0;

  return {
    runtime,
    container,
    input: supportedInputs,
    telemetry,
    extensions: supportedExtensions,
    evolutionReady,
    missing,
    warnings,
    passed,
  };
}

/**
 * Suggest fixes for missing capabilities.
 */
export function suggestFixes(check: CompatibilityCheck): string[] {
  const fixes: string[] = [];
  for (const m of check.missing) {
    if (m.includes('Input')) {
      fixes.push('Use keyboard or touch input instead');
    }
    if (m.includes('engine template')) {
      fixes.push('Let the AI pick the closest engine template');
    }
  }
  return fixes;
}
