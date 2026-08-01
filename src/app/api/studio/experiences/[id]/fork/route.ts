import { NextResponse } from 'next/server';
import { forkExperience } from '@/lib/studio-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await forkExperience(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ draft: result.draft });
}
