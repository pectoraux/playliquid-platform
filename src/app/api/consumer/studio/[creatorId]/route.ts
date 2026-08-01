import { NextResponse } from 'next/server';
import { getCreatorStudio } from '@/lib/consumer/creator-studio-service';

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const studio = await getCreatorStudio(creatorId);
  if (!studio) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ studio });
}
