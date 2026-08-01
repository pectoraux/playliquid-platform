import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDraft, updateDraft, deleteDraft } from '@/lib/studio-service';

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  bundle: z.any().optional(),
  intent: z.any().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = getDraft(id);
  if (!draft) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const draft = updateDraft(id, parsed.data);
  if (!draft) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteDraft(id);
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
