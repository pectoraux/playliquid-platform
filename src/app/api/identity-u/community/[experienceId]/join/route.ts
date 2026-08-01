import { NextRequest, NextResponse } from 'next/server';
import { joinCommunity, getCommunity, ensureCommunity } from '@/lib/identity-universe/community-service';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json();
  const userId = body.userId ?? 'demo-user';

  const profile = await db.playerProfile.findUnique({ where: { userId } });
  const displayName = profile?.displayName ?? 'Unknown';

  let community = await getCommunity(experienceId);
  if (!community) {
    const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
    if (exp) {
      await ensureCommunity(experienceId, exp.title, exp.creatorId);
      community = await getCommunity(experienceId);
    }
  }
  if (community) {
    await joinCommunity(community.id, userId, displayName);
  }
  return NextResponse.json({ ok: true });
}
