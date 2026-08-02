import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/evolution/creator/experiences?creatorId=...
// Returns the creator's published experiences with enough data for the
// Evolution dashboard's experience picker. Falls back to ALL published
// experiences if the specified creator has none (demo mode), so the
// Evolution dashboard always has something to show.
export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creatorId') ?? 'creator_demo';

  let experiences = await db.experienceRecord.findMany({
    where: { creatorId, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  // Demo fallback: if the creator has no published experiences, show all
  // published experiences so the Evolution dashboard is explorable.
  if (experiences.length === 0) {
    experiences = await db.experienceRecord.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  const out = await Promise.all(experiences.map(async (exp) => {
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    const mutationCount = await db.experienceMutationRecord.count({ where: { experienceId: exp.id } });
    const proposalCount = await db.evolutionProposal.count({ where: { experienceId: exp.id } });
    const feedbackCount = await db.experienceFeedbackRecord.count({ where: { experienceId: exp.id } });
    return {
      experienceId: exp.id,
      title: exp.title,
      format: exp.format,
      playCount: metrics?.totalSessions ?? exp.playCount,
      completionRate: metrics ? Math.round(metrics.completionRate * 100) : 0,
      mutationCount,
      proposalCount,
      feedbackCount,
      publishedAt: exp.publishedAt?.getTime() ?? exp.createdAt.getTime(),
    };
  }));

  return NextResponse.json({ experiences: out });
}
