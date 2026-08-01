import { NextResponse } from 'next/server';
import { getAchievementCatalog } from '@/lib/identity/achievement-service';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const catalog = getAchievementCatalog();

  if (userId) {
    const earned = await db.achievementRecord.findMany({ where: { userId } });
    const earnedIds = new Set(earned.map((e) => e.achievementId));
    return NextResponse.json({
      catalog: catalog.map((c) => ({ ...c, earned: earnedIds.has(c.id) })),
      earned: earned.map((e) => ({
        id: e.id,
        achievementId: e.achievementId,
        title: e.title,
        description: e.description,
        icon: e.icon,
        category: e.category,
        rarity: e.rarity,
        xpReward: e.xpReward,
        earnedAt: e.earnedAt.getTime(),
      })),
    });
  }

  return NextResponse.json({ catalog });
}
