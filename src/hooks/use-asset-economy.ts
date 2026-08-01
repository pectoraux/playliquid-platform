/**
 * Asset Economy hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  assets: '/api/asset-economy/assets',
  asset: (id: string) => `/api/asset-economy/assets/${id}`,
  install: (id: string) => `/api/asset-economy/assets/${id}/install`,
  rate: (id: string) => `/api/asset-economy/assets/${id}/rate`,
  evolve: (id: string) => `/api/asset-economy/assets/${id}/evolve`,
  fork: (id: string) => `/api/asset-economy/assets/${id}/fork`,
  feed: '/api/asset-economy/feed',
  creator: (id: string) => `/api/asset-economy/creator/${id}`,
  recommend: (id: string) => `/api/asset-economy/recommend/${id}`,
  seed: '/api/asset-economy/seed',
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

export function useAssets(type?: string, sort?: string) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (sort) params.set('sort', sort);
  return useQuery({
    queryKey: ['asset-economy', 'assets', type, sort],
    queryFn: () => getJson(`${API.assets}?${params}`) as Promise<{ assets: any[] }>,
  });
}

export function useAsset(id: string | null) {
  return useQuery({
    queryKey: ['asset-economy', 'asset', id],
    queryFn: () => getJson(API.asset(id!)) as Promise<{ asset: any }>,
    enabled: !!id,
  });
}

export function useInstallAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, ...rest }: { assetId: string; experienceId: string; experienceName: string; installedBy: string }) =>
      postJson(API.install(assetId), rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-economy'] }),
  });
}

export function useRateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, rating, userId }: { assetId: string; rating: number; userId: string }) =>
      postJson(API.rate(assetId), { rating, userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-economy'] }),
  });
}

export function useEvolveAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, ...rest }: any) => postJson(API.evolve(assetId), rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-economy'] }),
  });
}

export function useForkAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, ...rest }: any) => postJson(API.fork(assetId), rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-economy'] }),
  });
}

export function useAssetFeed() {
  return useQuery({
    queryKey: ['asset-economy', 'feed'],
    queryFn: () => getJson(API.feed) as Promise<{ feed: any }>,
  });
}

export function useCreatorAssets(creatorId = 'creator_demo') {
  return useQuery({
    queryKey: ['asset-economy', 'creator', creatorId],
    queryFn: () => getJson(API.creator(creatorId)) as Promise<{ assets: any[]; totalRevenue: number; totalInstalls: number; byType: Record<string, number> }>,
  });
}

export function useAssetRecommendations(experienceId: string | null) {
  return useQuery({
    queryKey: ['asset-economy', 'recommend', experienceId],
    queryFn: () => getJson(API.recommend(experienceId!)) as Promise<{ recommendations: any[] }>,
    enabled: !!experienceId,
  });
}

export function useSeedAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson(API.seed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-economy'] }),
  });
}
