import { NextResponse } from 'next/server';
import { getProposals } from '@/lib/world/evolution-agent';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const proposals = await getProposals(experienceId);
  return NextResponse.json({ proposals });
}
