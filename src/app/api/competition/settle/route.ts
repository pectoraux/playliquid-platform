import { NextRequest, NextResponse } from 'next/server';
import { settlePrizePool } from '@/lib/competition/prize-settlement-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await settlePrizePool(body.experienceId, body.cycleLabel);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
