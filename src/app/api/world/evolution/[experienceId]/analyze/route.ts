import { NextResponse } from 'next/server';
import { analyzeAndPropose } from '@/lib/world/evolution-agent';

export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const result = await analyzeAndPropose(experienceId);
  if (result.error) {
    return NextResponse.json({ error: result.error, proposal: result.proposal }, { status: result.proposal ? 200 : 422 });
  }
  return NextResponse.json({ proposal: result.proposal });
}
