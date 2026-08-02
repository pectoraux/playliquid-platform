import { NextRequest, NextResponse } from 'next/server';
import { recommendComposition } from '@/lib/intelligence/extension-genome-service';

// POST /api/intelligence/extension-patterns/recommend
//   { extensions: ["pl.physics", "pl.score"] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const extensions: string[] = Array.isArray(body.extensions) ? body.extensions : [];
  const result = await recommendComposition(extensions);
  return NextResponse.json(result);
}
