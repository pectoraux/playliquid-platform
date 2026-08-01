/**
 * Creator Intelligence hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  aiTeam: '/api/creator-intel/ai-team',
  insights: '/api/creator-intel/insights',
  accept: (id: string) => `/api/creator-intel/insights/${id}/accept`,
  dismiss: (id: string) => `/api/creator-intel/insights/${id}/dismiss`,
  evolution: (id: string) => `/api/creator-intel/evolution/${id}`,
  reputation: (id: string) => `/api/creator-intel/reputation/${id}`,
  economy: (id: string) => `/api/creator-intel/economy/${id}`,
  marketplace: '/api/creator-intel/marketplace',
  seedMarketplace: '/api/creator-intel/marketplace/seed',
};

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : '{}' });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export function useRunAITeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorId, experienceId }: { creatorId: string; experienceId: string }) =>
      postJson(API.aiTeam, { creatorId, experienceId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creator-intel', 'insights'] }),
  });
}

export function useInsights(creatorId = 'creator_demo', experienceId?: string) {
  const url = experienceId ? `${API.insights}?creatorId=${creatorId}&experienceId=${experienceId}` : `${API.insights}?creatorId=${creatorId}`;
  return useQuery({
    queryKey: ['creator-intel', 'insights', creatorId, experienceId],
    queryFn: () => getJson(url) as Promise<{ insights: any[] }>,
  });
}

export function useAcceptInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postJson(API.accept(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creator-intel', 'insights'] }),
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postJson(API.dismiss(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creator-intel', 'insights'] }),
  });
}

export function useEvolution(experienceId: string | null) {
  return useQuery({
    queryKey: ['creator-intel', 'evolution', experienceId],
    queryFn: () => getJson(API.evolution(experienceId!)) as Promise<{ current: any; next: any; plan: any }>,
    enabled: !!experienceId,
  });
}

export function useCreatorReputation(creatorId = 'creator_demo') {
  return useQuery({
    queryKey: ['creator-intel', 'reputation', creatorId],
    queryFn: () => getJson(API.reputation(creatorId)) as Promise<{ reputation: any }>,
  });
}

export function useGameEconomy(experienceId: string | null) {
  return useQuery({
    queryKey: ['creator-intel', 'economy', experienceId],
    queryFn: () => getJson(API.economy(experienceId!)) as Promise<{ economy: any }>,
    enabled: !!experienceId,
  });
}

export function useMarketplace(type?: string) {
  const url = type ? `${API.marketplace}?type=${type}` : API.marketplace;
  return useQuery({
    queryKey: ['creator-intel', 'marketplace', type],
    queryFn: () => getJson(url) as Promise<{ items: any[] }>,
  });
}

export function useSeedMarketplace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson(API.seedMarketplace),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creator-intel', 'marketplace'] }),
  });
}
