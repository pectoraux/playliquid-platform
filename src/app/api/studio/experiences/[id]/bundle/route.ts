import { NextResponse } from 'next/server';
import { getExperienceBundle } from '@/lib/studio-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getExperienceBundle(id);
  if (!bundle) return NextResponse.json({ error: 'bundle not found' }, { status: 404 });
  return NextResponse.json({ bundle });
}
