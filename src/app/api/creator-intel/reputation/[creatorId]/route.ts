import { NextResponse } from 'next/server';
import { getCreatorReputation } from '@/lib/creator-intel/evolution-service';

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const reputation = await getCreatorReputation(creatorId);
  return NextResponse.json({ reputation });
}
