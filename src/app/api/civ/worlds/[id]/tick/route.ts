import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runWorldTicks } from '@/lib/civ/scheduler';

const schema = z.object({
  ticks: z.number().int().min(1).max(1000),
  useLLM: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const result = await runWorldTicks({ worldId: id, ticks: parsed.data.ticks, useLLM: parsed.data.useLLM });
  return NextResponse.json(result);
}
