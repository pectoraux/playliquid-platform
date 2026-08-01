import { NextResponse } from 'next/server';
import { listExtensions } from '@/kernel/extensions';

/**
 * GET /api/kernel/extensions
 * Lists all registered extensions with their manifests.
 */
export async function GET() {
  const extensions = listExtensions().map(({ manifest }) => ({
    id: manifest.id,
    slug: manifest.slug,
    name: manifest.name,
    description: manifest.description,
    author: manifest.author,
    category: manifest.category,
    kind: manifest.kind,
    trustLevel: manifest.trustLevel,
    determinismMode: manifest.determinismMode,
    inputs: manifest.inputs,
    outputs: manifest.outputs,
    tokenDefinitions: manifest.tokenDefinitions ?? [],
    consumesTokens: manifest.consumesTokens ?? [],
    permissions: manifest.permissions,
    version: manifest.version,
  }));
  return NextResponse.json({ extensions });
}
