import { NextResponse } from 'next/server';
import { getWorldEvents } from '@/lib/civ/event-engine';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events = await getWorldEvents(id);
  return NextResponse.json({ events });
}
