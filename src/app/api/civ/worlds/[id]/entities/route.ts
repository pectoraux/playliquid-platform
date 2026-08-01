import { NextResponse } from 'next/server';
import { getEntities } from '@/lib/civ/world-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entities = await getEntities(id);
  return NextResponse.json({ entities });
}
