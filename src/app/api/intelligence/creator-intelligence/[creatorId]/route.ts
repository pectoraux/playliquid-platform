import { NextResponse } from 'next/server';
import { computeCreatorIntelligence, getCreatorIntelligence } from '@/lib/intelligence/creator-intelligence-service';

export async function POST(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const result = await computeCreatorIntelligence(creatorId);
  if (!result) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  return NextResponse.json({ intelligence: result });
}

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const result = await getCreatorIntelligence(creatorId);
  if (!result) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  return NextResponse.json({ intelligence: result });
}
