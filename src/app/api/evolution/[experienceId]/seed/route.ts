import { NextResponse } from 'next/server';
import { submitFeedback } from '@/lib/evolution/feedback-store';
import type { FeedbackType } from '@/lib/evolution/evolution-types';
import { runEvolutionEngine } from '@/lib/evolution/evolution-engine';

const SAMPLE_COMMENTS: Record<FeedbackType, string[]> = {
  FUN: ['The speed mechanic is addictive!', 'Love the storm effects.', 'Coin collecting feels great.'],
  CONFUSING: ['Not sure what the goal is.', 'The weather changes feel random.', 'Hard to tell which building does what.'],
  TOO_HARD: ['Storms hit too often early on.', 'Can\'t make enough coins to progress.', 'Difficulty spikes are brutal.'],
  BUG: ['Got stuck after a storm.', 'Score didn\'t register once.'],
  SUGGESTION: ['Would love a shield power-up.', 'Add daily challenges.', 'Multiplayer would be amazing.'],
};

const TYPES: FeedbackType[] = ['FUN', 'CONFUSING', 'TOO_HARD', 'BUG', 'SUGGESTION'];

export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;

  // Submit 8 varied feedback entries
  const count = 8;
  for (let i = 0; i < count; i++) {
    const type = TYPES[i % TYPES.length];
    const comments = SAMPLE_COMMENTS[type];
    await submitFeedback({
      experienceId,
      playerId: `seed_player_${i}`,
      type,
      funScore: type === 'FUN' ? 3.5 + Math.random() * 1.5 : 1.5 + Math.random() * 2,
      difficultyScore: type === 'TOO_HARD' ? 4 + Math.random() : 2 + Math.random() * 2,
      emotionScore: 2 + Math.random() * 3,
      comment: comments[i % comments.length],
    });
  }

  // Run an evolution analysis to generate an initial proposal
  const analysis = await runEvolutionEngine(experienceId);

  return NextResponse.json({
    ok: true,
    seededFeedback: count,
    proposal: analysis.proposal,
    proposalError: analysis.error,
  });
}
