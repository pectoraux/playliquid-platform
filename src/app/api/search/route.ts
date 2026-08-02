import { NextRequest, NextResponse } from 'next/server';
import { searchExperiences } from '@/lib/social/social-v2';

// GET /api/search?q=query → { results: SearchResult[] }
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(50, Math.max(1, Number(limitParam) || 20)) : 20;

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchExperiences(q, limit);
  return NextResponse.json({ results });
}
