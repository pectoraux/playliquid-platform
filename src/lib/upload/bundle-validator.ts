/**
 * Phase 23 — Bundle Validator
 * ---------------------------
 * Validates an uploaded HTML5 game bundle:
 *   - Checks for required files (index.html)
 *   - Detects runtime type (canvas, phaser, three.js, unity-webgl)
 *   - Scans for PlayLiquid bridge integration (pl:input, pl:telemetry)
 *   - Returns a compatibility report
 */

export interface BundleValidation {
  valid: boolean;
  runtime: 'html5' | 'unknown';
  engine: 'canvas' | 'phaser' | 'three.js' | 'unity-webgl' | 'plain';
  files: string[];
  hasIndex: boolean;
  hasManifest: boolean;
  hasInputBridge: boolean;
  hasTelemetryBridge: boolean;
  detectedExtensions: string[];
  warnings: string[];
  errors: string[];
  thumbnailUrl: string | null;
}

const REQUIRED_FILES = ['index.html'];
const OPTIONAL_FILES = ['manifest.json', 'game-manifest.json', 'style.css', 'game.js'];

/**
 * Validate a list of files from an extracted bundle.
 */
export function validateBundle(files: string[], fileContents: Record<string, string>): BundleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const detectedExtensions: string[] = [];

  // ── Check required files ──
  const hasIndex = files.some((f) => f.toLowerCase().endsWith('index.html'));
  if (!hasIndex) {
    errors.push('Missing index.html — every HTML5 game must have an entry point');
  }

  const hasManifest = files.some((f) =>
    f.toLowerCase().endsWith('manifest.json') || f.toLowerCase().endsWith('game-manifest.json'),
  );

  // ── Detect runtime engine ──
  let engine: BundleValidation['engine'] = 'plain';
  const allContent = Object.values(fileContents).join('\n').toLowerCase();

  if (allContent.includes('phaser')) {
    engine = 'phaser';
  } else if (allContent.includes('three.js') || allContent.includes('three.min.js') || allContent.includes('import * as three')) {
    engine = 'three.js';
  } else if (allContent.includes('unity') || allContent.includes('unityloader')) {
    engine = 'unity-webgl';
  } else if (allContent.includes('getcontext(') || allContent.includes('<canvas')) {
    engine = 'canvas';
  }

  // ── Check for PlayLiquid bridges ──
  const hasInputBridge = allContent.includes('pl:input') || allContent.includes("type === 'pl:input'");
  const hasTelemetryBridge = allContent.includes('pl:telemetry') || allContent.includes("type: 'pl:telemetry'");

  if (!hasInputBridge) {
    warnings.push('No pl:input bridge detected — keyboard/touch input from the ContainmentFrame will not be forwarded to the game');
  }
  if (!hasTelemetryBridge) {
    warnings.push('No pl:telemetry bridge detected — game events will not be sent to the PlayLiquid Evolution System');
  }

  // ── Detect extensions from content ──
  if (allContent.includes('physics') || allContent.includes('velocity') || allContent.includes('gravity')) {
    detectedExtensions.push('physics');
  }
  if (allContent.includes('score') || allContent.includes('points')) {
    detectedExtensions.push('score');
  }
  if (allContent.includes('collision') || allContent.includes('collide')) {
    detectedExtensions.push('collision');
  }
  if (allContent.includes('enemy') || allContent.includes('ai') || allContent.includes('npc')) {
    detectedExtensions.push('enemy-ai');
  }
  if (allContent.includes('coin') || allContent.includes('collect')) {
    detectedExtensions.push('collection');
  }

  // ── Thumbnail detection ──
  const thumbnailFile = files.find((f) =>
    f.toLowerCase().includes('thumbnail') ||
    f.toLowerCase().includes('preview') ||
    f.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/) !== null,
  );
  const thumbnailUrl = thumbnailFile ? `/uploaded-games/${thumbnailFile}` : null;

  // ── Check for suspicious patterns ──
  if (allContent.includes('eval(') && !allContent.includes('json.parse')) {
    warnings.push('eval() detected — this may be flagged for security review');
  }
  if (allContent.includes('document.cookie')) {
    warnings.push('Cookie access detected — this may be restricted in the ContainmentFrame sandbox');
  }

  const valid = errors.length === 0;

  return {
    valid,
    runtime: hasIndex ? 'html5' : 'unknown',
    engine,
    files,
    hasIndex,
    hasManifest,
    hasInputBridge,
    hasTelemetryBridge,
    detectedExtensions,
    warnings,
    errors,
    thumbnailUrl,
  };
}

/**
 * Generate a manifest from the bundle if one doesn't exist.
 */
export function generateManifest(name: string, validation: BundleValidation): Record<string, unknown> {
  return {
    name,
    version: '1.0.0',
    runtime: { type: 'html5', entry: 'index.html' },
    viewport: { aspectRatio: '16:9', orientation: 'landscape' },
    permissions: ['input', 'telemetry'],
    engine: validation.engine,
    detectedExtensions: validation.detectedExtensions,
    generatedAt: new Date().toISOString(),
  };
}
