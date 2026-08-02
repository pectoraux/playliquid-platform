import { NextResponse } from 'next/server';
import { getCreatorOverview } from '@/lib/creator-os/creator-studio-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId') ?? 'creator_demo';
  const overview = await getCreatorOverview(creatorId);
  return NextResponse.json(overview);
}
