/**
 * Identity Layer hooks (TanStack Query)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  player: '/api/identity/player',
  companionInsight: '/api/identity/companion/insight',
  companionChat: '/api/identity/companion/chat',
  companionMessages: '/api/identity/companion/messages',
  achievements: '/api/identity/achievements',
  checkAchievements: (userId: string) => `/api/identity/achievements/check/${userId}`,
  inventory: (userId: string) => `/api/identity/inventory/${userId}`,
  passport: (userId: string) => `/api/identity/passport/${userId}`,
  creator: (creatorId: string) => `/api/identity/creator/${creatorId}`,
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

export function usePlayerIdentity(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity', 'player', userId],
    queryFn: () => getJson(`${API.player}?userId=${userId}`) as Promise<{ identity: any }>,
    refetchInterval: 5000,
  });
}

export function useCompanionInsight(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity', 'companion-insight', userId],
    queryFn: () => getJson(`${API.companionInsight}?userId=${userId}`) as Promise<{ insight: string; suggestions: string[]; type: string }>,
    refetchInterval: 30000,
  });
}

export function useChatWithCompanion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, message }: { userId: string; message: string }) =>
      postJson(API.companionChat, { userId, message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'companion-messages'] }),
  });
}

export function useCompanionMessages(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity', 'companion-messages', userId],
    queryFn: () => getJson(`${API.companionMessages}?userId=${userId}`) as Promise<{ messages: any[] }>,
    refetchInterval: 3000,
  });
}

export function useAchievements(userId?: string) {
  return useQuery({
    queryKey: ['identity', 'achievements', userId],
    queryFn: () => getJson(userId ? `${API.achievements}?userId=${userId}` : API.achievements) as Promise<{ catalog: any[]; earned?: any[] }>,
  });
}

export function useCheckAchievements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => postJson(API.checkAchievements(userId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'achievements'] });
      qc.invalidateQueries({ queryKey: ['identity', 'player'] });
    },
  });
}

export function useInventory(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity', 'inventory', userId],
    queryFn: () => getJson(API.inventory(userId)) as Promise<{ inventory: any[] }>,
  });
}

export function useWorldPassport(userId = 'demo-user') {
  return useQuery({
    queryKey: ['identity', 'passport', userId],
    queryFn: () => getJson(API.passport(userId)) as Promise<{ passport: any }>,
  });
}

export function useCreatorIdentity(creatorId: string | null) {
  return useQuery({
    queryKey: ['identity', 'creator', creatorId],
    queryFn: () => getJson(API.creator(creatorId!)) as Promise<{ identity: any }>,
    enabled: !!creatorId,
  });
}
