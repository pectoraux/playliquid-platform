import { NextResponse } from 'next/server';
import { getVersions } from '@/lib/creator-os/creator-studio-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  if (!experienceId) return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  const versions = await getVersions(experienceId);
  return NextResponse.json({ versions });
}
