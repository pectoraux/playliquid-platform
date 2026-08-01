/**
 * Consumer Layer hooks (TanStack Query)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  discover: '/api/consumer/discover',
  game: (id: string) => `/api/consumer/game/${id}`,
  save: (id: string) => `/api/consumer/save/${id}`,
  saved: '/api/consumer/saved',
  leaderboard: '/api/consumer/leaderboard',
  studio: (id: string) => `/api/consumer/studio/${id}`,
  interact: '/api/consumer/interact',
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

async function deleteJson(url: string) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useDiscoverFeed(userId = 'demo-user') {
  return useQuery({
    queryKey: ['consumer', 'discover', userId],
    queryFn: () => getJson(`${API.discover}?userId=${userId}`) as Promise<{ feed: any }>,
    refetchInterval: 10000,
  });
}

export function useGamePage(experienceId: string | null, userId = 'demo-user') {
  return useQuery({
    queryKey: ['consumer', 'game', experienceId],
    queryFn: () => getJson(`${API.game(experienceId!)}?userId=${userId}`) as Promise<{ page: any }>,
    enabled: !!experienceId,
  });
}

export function useSaveSpark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, userId }: { experienceId: string; userId: string }) =>
      postJson(API.save(experienceId), { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consumer', 'saved'] });
      qc.invalidateQueries({ queryKey: ['consumer', 'game'] });
    },
  });
}

export function useUnsaveSpark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, userId }: { experienceId: string; userId: string }) =>
      deleteJson(`${API.save(experienceId)}?userId=${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consumer', 'saved'] });
      qc.invalidateQueries({ queryKey: ['consumer', 'game'] });
    },
  });
}

export function useSavedSparks(userId = 'demo-user') {
  return useQuery({
    queryKey: ['consumer', 'saved', userId],
    queryFn: () => getJson(`${API.saved}?userId=${userId}`) as Promise<{ saved: any[] }>,
  });
}

export function useGlobalLeaderboard() {
  return useQuery({
    queryKey: ['consumer', 'leaderboard'],
    queryFn: () => getJson(API.leaderboard) as Promise<{ leaderboard: any[] }>,
  });
}

export function useCreatorStudio(creatorId: string | null) {
  return useQuery({
    queryKey: ['consumer', 'studio', creatorId],
    queryFn: () => getJson(API.studio(creatorId!)) as Promise<{ studio: any }>,
    enabled: !!creatorId,
  });
}

export function useRecordInteraction() {
  return useMutation({
    mutationFn: ({ userId, experienceId, interaction, metadata }: { userId: string; experienceId: string; interaction: string; metadata?: Record<string, unknown> }) =>
      postJson(API.interact, { userId, experienceId, interaction, metadata }),
  });
}
