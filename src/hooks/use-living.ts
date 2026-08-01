/**
 * Living Civilizations hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  advance: '/api/living/advance',
  feed: '/api/living/feed',
  timeline: '/api/living/timeline',
  missions: '/api/living/missions',
  season: '/api/living/season',
  changed: '/api/living/changed',
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

export function useAdvanceTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ worldId, ticks }: { worldId: string; ticks: number }) =>
      postJson(API.advance, { worldId, ticks }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['living'] }),
  });
}

export function useCivFeed(worldId: string | null) {
  return useQuery({
    queryKey: ['living', 'feed', worldId],
    queryFn: () => getJson(`${API.feed}?worldId=${worldId}`) as Promise<{ feed: any[] }>,
    enabled: !!worldId,
    refetchInterval: 5000,
  });
}

export function useGlobalFeed() {
  return useQuery({
    queryKey: ['living', 'global-feed'],
    queryFn: () => getJson(`${API.feed}?global=true`) as Promise<{ feed: any[] }>,
    refetchInterval: 10000,
  });
}

export function useTimeline(worldId: string | null) {
  return useQuery({
    queryKey: ['living', 'timeline', worldId],
    queryFn: () => getJson(`${API.timeline}?worldId=${worldId}`) as Promise<{ timeline: any[] }>,
    enabled: !!worldId,
  });
}

export function useMissions(worldId: string | null) {
  return useQuery({
    queryKey: ['living', 'missions', worldId],
    queryFn: () => getJson(`${API.missions}?worldId=${worldId}`) as Promise<{ missions: any[] }>,
    enabled: !!worldId,
  });
}

export function useSeason(worldId: string | null) {
  return useQuery({
    queryKey: ['living', 'season', worldId],
    queryFn: () => getJson(`${API.season}?worldId=${worldId}`) as Promise<{ season: any }>,
    enabled: !!worldId,
  });
}

export function useWhatChanged(worldId: string | null, hours = 24) {
  return useQuery({
    queryKey: ['living', 'changed', worldId, hours],
    queryFn: () => getJson(`${API.changed}?worldId=${worldId}&hours=${hours}`) as Promise<any>,
    enabled: !!worldId,
  });
}
