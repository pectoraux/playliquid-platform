import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setMutationStatus } from '@/lib/evolution/mutation-store';

// Approve a proposal → mark proposal + mutation as APPROVED (creator review).
// Applying to production is a separate explicit step (see /mutations/[id]/apply).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await db.evolutionProposal.findUnique({ where: { id } });
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  await db.evolutionProposal.update({
    where: { id },
    data: { status: 'APPROVED', reviewedAt: new Date() },
  });

  if (proposal.mutationId) {
    await setMutationStatus(proposal.mutationId, 'APPROVED', true);
  }

  return NextResponse.json({ ok: true, status: 'APPROVED' });
}
