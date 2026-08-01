import { NextResponse } from 'next/server';
import { publishDraft } from '@/lib/studio-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await publishDraft(id);
  if (result.errors.length > 0) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }
  return NextResponse.json({ experience: result.experience });
}
