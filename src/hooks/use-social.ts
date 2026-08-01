/**
 * Social Universe hooks (TanStack Query)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  following: '/api/social/following',
  live: '/api/social/live',
  replays: '/api/social/replays',
  challenges: '/api/social/challenges',
  collections: '/api/social/collections',
  notifications: '/api/social/notifications',
  wallet: '/api/social/wallet',
  revenue: (id: string) => `/api/social/revenue/${id}`,
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

export function useFollowingFeed(userId = 'demo-user') {
  return useQuery({
    queryKey: ['social', 'following', userId],
    queryFn: () => getJson(`${API.following}?userId=${userId}`) as Promise<{ feed: any[] }>,
    refetchInterval: 10000,
  });
}

export function useLiveSessions() {
  return useQuery({
    queryKey: ['social', 'live'],
    queryFn: () => getJson(API.live) as Promise<{ sessions: any[] }>,
    refetchInterval: 10000,
  });
}

export function useGoLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; displayName: string; experienceId: string; experienceName: string; sessionId: string }) =>
      postJson(API.live, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'live'] }),
  });
}

export function useReplays(experienceId?: string) {
  const url = experienceId ? `${API.replays}?experienceId=${experienceId}` : API.replays;
  return useQuery({
    queryKey: ['social', 'replays', experienceId],
    queryFn: () => getJson(url) as Promise<{ replays: any[] }>,
  });
}

export function useChallenges(userId?: string) {
  const url = userId ? `${API.challenges}?userId=${userId}` : API.challenges;
  return useQuery({
    queryKey: ['social', 'challenges', userId],
    queryFn: () => getJson(url) as Promise<{ challenges: any[] }>,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.challenges, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'challenges'] }),
  });
}

export function useSubmitChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, userId, score }: { challengeId: string; userId: string; score: number }) =>
      postJson(`${API.challenges}/${challengeId}/submit`, { userId, score }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'challenges'] }),
  });
}

export function useCollections(userId?: string) {
  const url = userId ? `${API.collections}?userId=${userId}` : API.collections;
  return useQuery({
    queryKey: ['social', 'collections', userId],
    queryFn: () => getJson(url) as Promise<{ collections: any[] }>,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.collections, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'collections'] }),
  });
}

export function useNotifications(userId = 'demo-user') {
  return useQuery({
    queryKey: ['social', 'notifications', userId],
    queryFn: () => getJson(`${API.notifications}?userId=${userId}`) as Promise<{ notifications: any[]; unreadCount: number }>,
    refetchInterval: 5000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => postJson(`${API.notifications}?userId=${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'notifications'] }),
  });
}

export function usePlayerWallet(userId = 'demo-user') {
  return useQuery({
    queryKey: ['social', 'wallet', userId],
    queryFn: () => getJson(`${API.wallet}?userId=${userId}`) as Promise<{ wallet: any }>,
  });
}

export function useCreatorRevenue(creatorId: string | null) {
  return useQuery({
    queryKey: ['social', 'revenue', creatorId],
    queryFn: () => getJson(API.revenue(creatorId!)) as Promise<{ revenue: any }>,
    enabled: !!creatorId,
  });
}
