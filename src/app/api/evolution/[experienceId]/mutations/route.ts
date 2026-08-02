import { NextResponse } from 'next/server';
import { getMutationsForExperience } from '@/lib/evolution/mutation-store';
import { diffBundles } from '@/lib/evolution/mutation-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const mutations = await getMutationsForExperience(experienceId);
  return NextResponse.json({
    mutations: mutations.map((m) => ({
      ...m,
      diff: diffBundles(m.beforeGraph, m.afterGraph),
    })),
  });
}
