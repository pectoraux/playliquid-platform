/**
 * Multiverse hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  civilizations: '/api/multiverse/civilizations',
  civilization: (id: string) => `/api/multiverse/civilizations/${id}`,
  diplomacy: '/api/multiverse/diplomacy',
  migrate: '/api/multiverse/migrate',
  trade: '/api/multiverse/trade',
  chronicle: '/api/multiverse/chronicle',
  council: (id: string) => `/api/multiverse/council/${id}`,
  recommend: '/api/multiverse/recommend',
  seed: '/api/multiverse/seed',
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

export function useCivilizations() {
  return useQuery({
    queryKey: ['multiverse', 'civilizations'],
    queryFn: () => getJson(API.civilizations) as Promise<{ civilizations: any[] }>,
  });
}

export function useCivilization(worldId: string | null) {
  return useQuery({
    queryKey: ['multiverse', 'civilization', worldId],
    queryFn: () => getJson(API.civilization(worldId!)) as Promise<{ identity: any; relations: any[]; trades: any[] }>,
    enabled: !!worldId,
  });
}

export function useFormRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.diplomacy, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['multiverse'] }),
  });
}

export function useMigrate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.migrate, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['multiverse'] }),
  });
}

export function useMigrations(userId = 'demo-user') {
  return useQuery({
    queryKey: ['multiverse', 'migrations', userId],
    queryFn: () => getJson(`${API.migrate}?userId=${userId}`) as Promise<{ migrations: any[] }>,
  });
}

export function useExecuteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.trade, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['multiverse'] }),
  });
}

export function useChronicle(worldId?: string) {
  const url = worldId ? `${API.chronicle}?worldId=${worldId}` : API.chronicle;
  return useQuery({
    queryKey: ['multiverse', 'chronicle', worldId],
    queryFn: () => getJson(url) as Promise<{ events: any[] }>,
  });
}

export function useAICouncil(worldId: string | null) {
  return useQuery({
    queryKey: ['multiverse', 'council', worldId],
    queryFn: () => getJson(API.council(worldId!)) as Promise<{ insights: any[] }>,
    enabled: !!worldId,
  });
}

export function useRecommendedCivs(userId = 'demo-user') {
  return useQuery({
    queryKey: ['multiverse', 'recommend', userId],
    queryFn: () => getJson(`${API.recommend}?userId=${userId}`) as Promise<{ recommendations: any[] }>,
  });
}

export function useSeedMultiverse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson(API.seed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['multiverse'] }),
  });
}
