import { NextResponse } from 'next/server';
import { createCollection, getCollections, addToCollection } from '@/lib/social/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? undefined;
  const collections = await getCollections(userId);
  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.action === 'add') {
    await addToCollection(body.collectionId, body.experienceId);
    return NextResponse.json({ ok: true });
  }
  const result = await createCollection(body);
  return NextResponse.json(result);
}
