import { NextResponse } from 'next/server';
import { getWorldStats } from '@/lib/civ/scheduler';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const stats = await getWorldStats(id);
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
