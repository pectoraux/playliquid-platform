/**
 * Identity Universe hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  community: (id: string) => `/api/identity-u/community/${id}`,
  joinCommunity: (id: string) => `/api/identity-u/community/${id}/join`,
  posts: '/api/identity-u/community/posts',
  lifecycle: (id: string) => `/api/identity-u/lifecycle/${id}`,
  coaching: (id: string) => `/api/identity-u/coaching/${id}`,
  achievementContext: (id: string) => `/api/identity-u/achievements/${id}/context`,
  creatorPosts: (id: string) => `/api/identity-u/creator-posts/${id}`,
  feed: '/api/identity-u/feed',
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

export function useCommunity(experienceId: string | null) {
  return useQuery({
    queryKey: ['identity-u', 'community', experienceId],
    queryFn: () => getJson(API.community(experienceId!)) as Promise<{ community: any }>,
    enabled: !!experienceId,
  });
}

export function useJoinCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, userId }: { experienceId: string; userId: string }) =>
      postJson(API.joinCommunity(experienceId), { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity-u', 'community'] }),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.posts, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity-u', 'community'] }),
  });
}

export function useLifecycle(experienceId: string | null) {
  return useQuery({
    queryKey: ['identity-u', 'lifecycle', experienceId],
    queryFn: () => getJson(API.lifecycle(experienceId!)) as Promise<{ timeline: any[] }>,
    enabled: !!experienceId,
  });
}

export function useCoaching(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity-u', 'coaching', userId],
    queryFn: () => getJson(API.coaching(userId)) as Promise<{ insights: any[] }>,
  });
}

export function useAchievementContext(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity-u', 'achievement-context', userId],
    queryFn: () => getJson(API.achievementContext(userId)) as Promise<{ achievements: any[] }>,
  });
}

export function useCreatorPosts(creatorId: string | null) {
  return useQuery({
    queryKey: ['identity-u', 'creator-posts', creatorId],
    queryFn: () => getJson(API.creatorPosts(creatorId!)) as Promise<{ posts: any[] }>,
    enabled: !!creatorId,
  });
}

export function useEvolvedFeed(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity-u', 'feed', userId],
    queryFn: () => getJson(`${API.feed}?userId=${userId}`) as Promise<{ feed: any }>,
  });
}
