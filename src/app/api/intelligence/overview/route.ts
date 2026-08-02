import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAllExperienceIntelligence } from '@/lib/intelligence/genome-service';
import { getCreatorIntelligenceLeaderboard } from '@/lib/intelligence/creator-intelligence-service';
import { getTopCompositionPatterns } from '@/lib/intelligence/extension-genome-service';
import { getGlobalDiscoveryGraph } from '@/lib/intelligence/discovery-graph-service';

/**
 * GET /api/intelligence/overview
 * Network-level intelligence summary for the dashboard header.
 */
export async function GET() {
  const [genomes, creators, patterns, coPlayEdges] = await Promise.all([
    getAllExperienceIntelligence(5),
    getCreatorIntelligenceLeaderboard(5),
    getTopCompositionPatterns(5),
    getGlobalDiscoveryGraph(5),
  ]);

  const totalExperiences = await db.experienceRecord.count({ where: { status: 'PUBLISHED' } });
  const totalCreators = await db.creatorRecord.count({ where: { experiences: { some: { status: 'PUBLISHED' } } } });
  const totalPatterns = await db.extensionCompositionPatternRecord.count();
  const totalCoPlayEdges = await db.coPlayEdgeRecord.count();
  const totalFeedback = await db.experienceFeedbackRecord.count();

  const avgQuality = genomes.length > 0
    ? Math.round(genomes.reduce((s, g) => s + g.qualityScore, 0) / genomes.length)
    : 0;

  return NextResponse.json({
    totals: {
      experiences: totalExperiences,
      creators: totalCreators,
      compositionPatterns: totalPatterns,
      coPlayEdges: totalCoPlayEdges,
      feedbackEntries: totalFeedback,
    },
    avgQualityScore: avgQuality,
    topGenomes: genomes,
    topCreators: creators,
    topPatterns: patterns,
    topCoPlayEdges: coPlayEdges,
  });
}
