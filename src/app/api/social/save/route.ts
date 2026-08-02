import { NextRequest, NextResponse } from 'next/server';
import { toggleSave, isSaved, getSavedExperiences } from '@/lib/social/engagement-service';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { experienceId, listType, userId } = body;
  if (!experienceId) return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  const result = await toggleSave(experienceId, listType ?? 'watch-later', userId ?? 'demo-user');
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  const listType = url.searchParams.get('listType') ?? 'watch-later';
  const userId = url.searchParams.get('userId') ?? 'demo-user';

  if (experienceId) {
    const saved = await isSaved(experienceId, listType, userId);
    return NextResponse.json({ saved });
  }

  const savedExps = await getSavedExperiences(listType, userId);
  return NextResponse.json({ experiences: savedExps });
}
