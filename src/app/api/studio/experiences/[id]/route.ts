import { NextResponse } from 'next/server';
import { getExperience } from '@/lib/studio-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exp = await getExperience(id);
  if (!exp) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ experience: exp });
}
