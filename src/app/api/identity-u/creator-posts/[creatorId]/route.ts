import { NextRequest, NextResponse } from 'next/server';
import { getCreatorPosts, createCreatorPost } from '@/lib/identity-universe/community-service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const posts = await getCreatorPosts(creatorId);
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const body = await req.json();
  const creator = await (await import('@/lib/db')).db.creatorRecord.findUnique({ where: { id: creatorId } });
  const result = await createCreatorPost({
    creatorId,
    creatorName: creator?.displayName ?? 'Unknown',
    type: body.type ?? 'update',
    title: body.title,
    body: body.body,
  });
  return NextResponse.json(result);
}
