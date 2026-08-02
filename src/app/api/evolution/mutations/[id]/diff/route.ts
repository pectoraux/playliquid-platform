import { NextResponse } from 'next/server';
import { getMutation } from '@/lib/evolution/mutation-store';
import { diffBundles } from '@/lib/evolution/mutation-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mutation = await getMutation(id);
  if (!mutation) return NextResponse.json({ error: 'Mutation not found' }, { status: 404 });
  return NextResponse.json({
    mutation,
    diff: diffBundles(mutation.beforeGraph, mutation.afterGraph),
  });
}
