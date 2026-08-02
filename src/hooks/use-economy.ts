/**
 * Living Economy hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  resources: '/api/economy/resources',
  market: '/api/economy/market',
  routes: '/api/economy/routes',
  buildings: '/api/economy/buildings',
  roles: '/api/economy/roles',
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

export function useResources(worldId: string | null) {
  return useQuery({
    queryKey: ['economy', 'resources', worldId],
    queryFn: () => getJson(`${API.resources}?worldId=${worldId}`) as Promise<{ resources: any[] }>,
    enabled: !!worldId,
    refetchInterval: 5000,
  });
}

export function useMarketHistory(worldId: string | null) {
  return useQuery({
    queryKey: ['economy', 'market', worldId],
    queryFn: () => getJson(`${API.market}?worldId=${worldId}`) as Promise<{ history: any[] }>,
    enabled: !!worldId,
  });
}

export function useMarketTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.market, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['economy'] }),
  });
}

export function useTradeRoutes(worldId: string | null) {
  return useQuery({
    queryKey: ['economy', 'routes', worldId],
    queryFn: () => getJson(`${API.routes}?worldId=${worldId}`) as Promise<{ routes: any[] }>,
    enabled: !!worldId,
  });
}

export function useCreateTradeRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: any) => postJson(API.routes, params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['economy'] }),
  });
}

export function useBuildings(worldId: string | null) {
  return useQuery({
    queryKey: ['economy', 'buildings', worldId],
    queryFn: () => getJson(`${API.buildings}?worldId=${worldId}`) as Promise<{ buildings: any[] }>,
    enabled: !!worldId,
  });
}

export function usePlayerRoles(userId = 'demo-user') {
  return useQuery({
    queryKey: ['economy', 'roles', userId],
    queryFn: () => getJson(`${API.roles}?userId=${userId}`) as Promise<{ roles: any[] }>,
  });
}
