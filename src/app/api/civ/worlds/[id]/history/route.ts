import { NextResponse } from 'next/server';
import { getHistory } from '@/lib/civ/world-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await getHistory(id);
  return NextResponse.json({ history });
}
