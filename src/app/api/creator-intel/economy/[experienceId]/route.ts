import { NextResponse } from 'next/server';
import { getGameEconomy } from '@/lib/creator-intel/evolution-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const economy = await getGameEconomy(experienceId);
  if (!economy) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ economy });
}
