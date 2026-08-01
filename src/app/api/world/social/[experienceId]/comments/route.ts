import { NextRequest, NextResponse } from 'next/server';
import { addComment, getComments } from '@/lib/world/social-service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const comments = await getComments(experienceId);
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json();
  const userId = body.userId ?? 'demo-user';
  const comment = await addComment(userId, experienceId, body.body ?? '');
  return NextResponse.json({ comment });
}
