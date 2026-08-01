import { NextResponse } from 'next/server';
import { getCreatorAnalytics } from '@/lib/universe/analytics-service';

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const analytics = await getCreatorAnalytics(creatorId);
  if (!analytics) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ analytics });
}
