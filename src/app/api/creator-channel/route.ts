import { NextRequest, NextResponse } from 'next/server';
import { getCreatorChannel } from '@/lib/social/social-service';

// GET /api/creator-channel?creatorId=X&viewerId=Y → { channel: CreatorChannel }
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId');
  const viewerId = url.searchParams.get('viewerId') ?? 'demo-user';

  if (!creatorId) {
    return NextResponse.json(
      { error: 'creatorId is required' },
      { status: 400 }
    );
  }

  const channel = await getCreatorChannel(creatorId, viewerId);

  if (!channel) {
    return NextResponse.json(
      { error: 'Creator not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ channel });
}
