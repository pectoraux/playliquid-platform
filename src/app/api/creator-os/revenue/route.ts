import { NextResponse } from 'next/server';
import { getExtensionEconomy } from '@/lib/creator-os/creator-studio-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId') ?? 'creator_demo';
  const economy = await getExtensionEconomy(creatorId);
  return NextResponse.json({ economy });
}
