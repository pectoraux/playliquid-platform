import { NextResponse } from 'next/server';
import { getTopCompositionPatterns } from '@/lib/intelligence/extension-genome-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 15);
  const context = url.searchParams.get('context') ?? undefined;
  const patterns = await getTopCompositionPatterns(limit, context ?? undefined);
  return NextResponse.json({ patterns });
}
