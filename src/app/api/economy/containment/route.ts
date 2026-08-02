import { NextResponse } from 'next/server';
import { getContainmentConfig } from '@/lib/economy/containment-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  if (!experienceId) return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  const config = await getContainmentConfig(experienceId);
  return NextResponse.json({ config });
}
