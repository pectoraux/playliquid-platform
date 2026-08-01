/**
 * Civilization Engine hooks (TanStack Query)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  worlds: '/api/civ/worlds',
  world: (id: string) => `/api/civ/worlds/${id}`,
  spawn: (id: string) => `/api/civ/worlds/${id}/spawn`,
  tick: (id: string) => `/api/civ/worlds/${id}/tick`,
  entities: (id: string) => `/api/civ/worlds/${id}/entities`,
  events: (id: string) => `/api/civ/worlds/${id}/events`,
  assets: (id: string) => `/api/civ/worlds/${id}/assets`,
  history: (id: string) => `/api/civ/worlds/${id}/history`,
  stats: (id: string) => `/api/civ/worlds/${id}/stats`,
  discover: '/api/civ/discover',
  demo: '/api/civ/demo',
};

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useWorlds() {
  return useQuery({
    queryKey: ['civ', 'worlds'],
    queryFn: () => getJson(API.worlds) as Promise<{ worlds: any[] }>,
  });
}

export function useWorld(id: string | null) {
  return useQuery({
    queryKey: ['civ', 'world', id],
    queryFn: () => getJson(API.world(id!)) as Promise<{ world: any }>,
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useCreateWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { experienceId: string; name: string; description: string; creatorId?: string }) =>
      postJson(API.worlds, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['civ', 'worlds'] }),
  });
}

export function useSpawnCitizens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ worldId, count, roleDistribution }: { worldId: string; count: number; roleDistribution?: Record<string, number> }) =>
      postJson(API.spawn(worldId), { count, roleDistribution }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['civ'] }),
  });
}

export function useRunTicks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ worldId, ticks, useLLM }: { worldId: string; ticks: number; useLLM?: boolean }) =>
      postJson(API.tick(worldId), { ticks, useLLM }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['civ'] }),
  });
}

export function useEntities(worldId: string | null) {
  return useQuery({
    queryKey: ['civ', 'entities', worldId],
    queryFn: () => getJson(API.entities(worldId!)) as Promise<{ entities: any[] }>,
    enabled: !!worldId,
    refetchInterval: 3000,
  });
}

export function useWorldEvents(worldId: string | null) {
  return useQuery({
    queryKey: ['civ', 'events', worldId],
    queryFn: () => getJson(API.events(worldId!)) as Promise<{ events: any[] }>,
    enabled: !!worldId,
  });
}

export function useAssets(worldId: string | null) {
  return useQuery({
    queryKey: ['civ', 'assets', worldId],
    queryFn: () => getJson(API.assets(worldId!)) as Promise<{ assets: any[] }>,
    enabled: !!worldId,
  });
}

export function useHistory(worldId: string | null) {
  return useQuery({
    queryKey: ['civ', 'history', worldId],
    queryFn: () => getJson(API.history(worldId!)) as Promise<{ history: any[] }>,
    enabled: !!worldId,
  });
}

export function useWorldStats(worldId: string | null) {
  return useQuery({
    queryKey: ['civ', 'stats', worldId],
    queryFn: () => getJson(API.stats(worldId!)) as Promise<{ stats: any }>,
    enabled: !!worldId,
    refetchInterval: 3000,
  });
}

export function useWorldDiscovery(userId = 'demo-user') {
  return useQuery({
    queryKey: ['civ', 'discover', userId],
    queryFn: () => getJson(`${API.discover}?userId=${userId}`) as Promise<{ recommendations: any[] }>,
  });
}

export function useRunDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson(API.demo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['civ'] }),
  });
}
