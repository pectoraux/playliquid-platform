import { NextResponse } from 'next/server';
import { getGamePage } from '@/lib/consumer/game-page-service';

export async function GET(req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const page = await getGamePage(experienceId, userId);
  if (!page) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ page });
}
