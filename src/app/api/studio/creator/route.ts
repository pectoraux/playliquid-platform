import { NextResponse } from 'next/server';
import { getCreatorProfile } from '@/lib/studio-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const handle = url.searchParams.get('handle');
  const id = url.searchParams.get('id');

  let profile;
  if (id) {
    profile = await getCreatorProfile(id);
  } else if (handle) {
    const { getCreatorByHandle } = await import('@/lib/studio-service');
    profile = await getCreatorByHandle(handle);
  } else {
    // Default to demo creator
    profile = await getCreatorProfile('creator_demo');
  }

  if (!profile) return NextResponse.json({ error: 'creator not found' }, { status: 404 });
  return NextResponse.json({ profile });
}
