import { NextResponse } from 'next/server';
import { getCreatorRevenue } from '@/lib/social/social-service';

export async function GET(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const revenue = await getCreatorRevenue(creatorId);
  return NextResponse.json({ revenue });
}
