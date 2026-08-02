import { NextRequest, NextResponse } from 'next/server';
import { importHtml5Game, seedNativeNeonRunner, seedOrbCollectorHtml5, listImportedGames } from '@/lib/runtime/runtime-service';

// POST /api/runtime/import-html5
//   { mode: "import" | "seed-native" | "seed-html5" | "list", name?, gameUrl?, manifest? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? 'import';

  if (mode === 'seed-native') {
    const result = await seedNativeNeonRunner();
    return NextResponse.json({ ok: true, ...result, message: result.created ? 'Created Neon Runner native experience' : 'Neon Runner already exists' });
  }

  if (mode === 'seed-html5') {
    const result = await seedOrbCollectorHtml5();
    return NextResponse.json({ ok: true, ...result, message: result.created ? 'Imported Orb Collector HTML5 game' : 'Orb Collector already exists' });
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
