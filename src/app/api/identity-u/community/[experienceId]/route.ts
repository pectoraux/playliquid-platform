import { NextResponse } from 'next/server';
import { getCommunity, ensureCommunity } from '@/lib/identity-universe/community-service';

export async function GET(req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  let community = await getCommunity(experienceId);
  if (!community) {
    const exp = await (await import('@/lib/db')).db.experienceRecord.findUnique({ where: { id: experienceId } });
    if (exp) {
      await ensureCommunity(experienceId, exp.title, exp.creatorId);
      community = await getCommunity(experienceId);
    }
  }
  return NextResponse.json({ community });
}
