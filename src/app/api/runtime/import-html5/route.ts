import { NextRequest, NextResponse } from 'next/server';
import { importHtml5Game, seedEngineGames, listImportedGames } from '@/lib/runtime/runtime-service';

// POST /api/runtime/import-html5
//   { mode: "import" | "seed-engine" | "seed-html5" | "list", name?, gameUrl?, manifest? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? 'import';

  if (mode === 'seed-engine') {
    const result = await seedEngineGames();
    return NextResponse.json({ ok: true, created: result.created });
  }

  if (mode === 'seed-html5') {
    // Import Orb Collector as the default HTML5 game
    const result = await importHtml5Game({
      name: 'Orb Collector (HTML5)',
      description: 'An imported HTML5 game running inside the PlayLiquid ContainmentFrame. Pure Canvas API + JavaScript.',
      gameUrl: '/imported-games/orb-collector/',
      manifest: {
        name: 'Orb Collector',
        version: '1.0.0',
        runtime: { type: 'html5', entry: 'index.html' },
        viewport: { aspectRatio: '16:9', orientation: 'landscape' },
        permissions: ['input', 'telemetry'],
      },
    });
    return NextResponse.json({ ok: true, experienceId: result.experienceId, created: true, message: 'Imported Orb Collector HTML5 game' });
  }

  if (mode === 'list') {
    const games = await listImportedGames();
    return NextResponse.json({ games });
  }

  // mode === 'import'
  if (!body.name || !body.gameUrl || !body.manifest) {
    return NextResponse.json({ error: 'name, gameUrl, and manifest are required for import mode' }, { status: 400 });
  }
  const result = await importHtml5Game({
    name: body.name,
    description: body.description,
    gameUrl: body.gameUrl,
    manifest: body.manifest,
    uploadedBy: body.uploadedBy,
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  const games = await listImportedGames();
  return NextResponse.json({ games });
}
