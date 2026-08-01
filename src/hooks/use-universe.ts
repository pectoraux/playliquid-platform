/**
 * Universe API hooks (TanStack Query)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  marketplace: '/api/universe/marketplace',
  play: (id: string) => `/api/universe/play/${id}`,
  curator: '/api/universe/curator',
  rating: (id: string) => `/api/universe/rating/${id}`,
  analytics: (id: string) => `/api/universe/analytics/${id}`,
  feed: '/api/universe/feed',
  follow: '/api/universe/social/follow',
  stats: '/api/universe/social/stats',
  summary: (id: string) => `/api/universe/summary/${id}`,
  demo: '/api/universe/demo',
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

export function useMarketplace(userId = 'demo-user') {
  return useQuery({
    queryKey: ['universe', 'marketplace', userId],
    queryFn: () => getJson(`${API.marketplace}?userId=${userId}`) as Promise<{ home: any }>,
  });
}

export function useQuickPlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, userId, ticks }: { experienceId: string; userId: string; ticks?: number }) =>
      postJson(API.play(experienceId), { userId, ticks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['universe'] });
      qc.invalidateQueries({ queryKey: ['world', 'metrics'] });
    },
  });
}

export function useCurator(userId = 'demo-user') {
  return useQuery({
    queryKey: ['universe', 'curator', userId],
    queryFn: () => getJson(`${API.curator}?userId=${userId}`) as Promise<{ recommendations: any[]; error?: string }>,
  });
}

export function useRating(experienceId: string | null) {
  return useQuery({
    queryKey: ['universe', 'rating', experienceId],
    queryFn: () => getJson(API.rating(experienceId!)) as Promise<{ reputation: any }>,
    enabled: !!experienceId,
  });
}

export function useSubmitRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, score, reviewText, userId }: { experienceId: string; score: number; reviewText?: string; userId: string }) =>
      postJson(API.rating(experienceId), { score, reviewText, userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['universe', 'rating'] }),
  });
}

export function useCreatorAnalytics(creatorId: string | null) {
  return useQuery({
    queryKey: ['universe', 'analytics', creatorId],
    queryFn: () => getJson(API.analytics(creatorId!)) as Promise<{ analytics: any }>,
    enabled: !!creatorId,
  });
}

export function useActivityFeed(userId?: string) {
  return useQuery({
    queryKey: ['universe', 'feed', userId],
    queryFn: () => getJson(userId ? `${API.feed}?userId=${userId}` : API.feed) as Promise<{ feed: any[] }>,
    refetchInterval: 5000,
  });
}

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ followerId, targetUserId }: { followerId: string; targetUserId: string }) =>
      postJson(API.follow, { followerId, targetUserId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['universe'] }),
  });
}

export function useSocialStats(userId = 'demo-user') {
  return useQuery({
    queryKey: ['universe', 'stats', userId],
    queryFn: () => getJson(`${API.stats}?userId=${userId}`) as Promise<{ stats: any }>,
  });
}

export function useExperienceSummary(experienceId: string | null) {
  return useQuery({
    queryKey: ['universe', 'summary', experienceId],
    queryFn: () => getJson(API.summary(experienceId!)) as Promise<{ summary: string }>,
    enabled: !!experienceId,
  });
}

export function useSeedDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson(API.demo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['universe'] });
      qc.invalidateQueries({ queryKey: ['experiences'] });
    },
  });
}
