import { NextResponse } from 'next/server';
import { getProposalsV2 } from '@/lib/evolution/evolution-engine';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const proposals = await getProposalsV2(experienceId);
  return NextResponse.json({ proposals });
}
