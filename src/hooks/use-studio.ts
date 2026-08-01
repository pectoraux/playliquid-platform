/**
 * Studio API hooks (TanStack Query)
 * ----------------------------------
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExperienceBundle, ExperienceIntent } from '@/kernel/types';

const API = {
  drafts: '/api/studio/drafts',
  draft: (id: string) => `/api/studio/drafts/${id}`,
  experiences: '/api/studio/experiences',
  experience: (id: string) => `/api/studio/experiences/${id}`,
  publish: (id: string) => `/api/studio/experiences/${id}/publish`,
  fork: (id: string) => `/api/studio/experiences/${id}/fork`,
  bundle: (id: string) => `/api/studio/experiences/${id}/bundle`,
  aiCompose: '/api/studio/ai/compose',
  creator: '/api/studio/creator',
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}
async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}
async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Drafts ────────────────────────────────────────────────────────────────

export function useCreateDraft() {
  return useMutation({
    mutationFn: (params: { title: string; description: string; bundle: ExperienceBundle; intent: ExperienceIntent; parentExperienceId?: string }) =>
      postJson(API.drafts, params),
  });
}

export function useUpdateDraft() {
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => patchJson(API.draft(id), updates),
  });
}

export function useDrafts() {
  return useQuery({ queryKey: ['drafts'], queryFn: () => getJson(API.drafts) });
}

// ─── Experiences ───────────────────────────────────────────────────────────

export function useExperiences() {
  return useQuery({
    queryKey: ['experiences'],
    queryFn: () => getJson(API.experiences) as Promise<{ experiences: any[] }>,
  });
}

export function useExperience(id: string | null) {
  return useQuery({
    queryKey: ['experience', id],
    queryFn: () => getJson(API.experience(id!)) as Promise<{ experience: any }>,
    enabled: !!id,
  });
}

export function usePublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => postJson(API.publish(draftId), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiences'] });
      qc.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

export function useFork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (experienceId: string) => postJson(API.fork(experienceId), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiences'] }),
  });
}

export function useExperienceBundle(id: string | null) {
  return useQuery({
    queryKey: ['experience-bundle', id],
    queryFn: () => getJson(API.bundle(id!)) as Promise<{ bundle: ExperienceBundle }>,
    enabled: !!id,
  });
}

// ─── AI Composer ───────────────────────────────────────────────────────────

export function useAICompose() {
  return useMutation({
    mutationFn: ({ description, intent }: { description: string; intent: ExperienceIntent }) =>
      postJson(API.aiCompose, { description, intent }) as Promise<{ suggestion: any; error?: string }>,
  });
}

// ─── Creator ───────────────────────────────────────────────────────────────

export function useCreatorProfile(handle?: string) {
  return useQuery({
    queryKey: ['creator', handle],
    queryFn: () => getJson(handle ? `${API.creator}?handle=${handle}` : API.creator) as Promise<{ profile: any }>,
  });
}
