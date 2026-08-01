import { NextResponse } from 'next/server';
import { getWorld } from '@/lib/civ/world-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const world = await getWorld(id);
  if (!world) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ world });
}
