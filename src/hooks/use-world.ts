/**
 * World Engine API hooks (TanStack Query)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  discover: '/api/world/discover',
  trending: '/api/world/discover/trending',
  player: '/api/world/player',
  metrics: '/api/world/metrics',
  recomputeMetrics: (id: string) => `/api/world/metrics/${id}/recompute`,
  economy: '/api/world/economy',
  royalty: (id: string) => `/api/world/economy/royalty/${id}`,
  follow: (id: string) => `/api/world/social/${id}/follow`,
  comments: (id: string) => `/api/world/social/${id}/comments`,
  community: (id: string) => `/api/world/social/${id}/community`,
  analyze: (id: string) => `/api/world/evolution/${id}/analyze`,
  proposals: (id: string) => `/api/world/evolution/${id}/proposals`,
  approve: (id: string) => `/api/world/evolution/proposals/${id}/approve`,
  reject: (id: string) => `/api/world/evolution/proposals/${id}/reject`,
  simulate: (id: string) => `/api/world/lab/${id}/simulate`,
  runs: (id: string) => `/api/world/lab/${id}/runs`,
  genomes: '/api/world/genomes',
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

async function deleteJson(url: string) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Discovery ─────────────────────────────────────────────────────────────

export function useRecommendations(userId = 'demo-user') {
  return useQuery({
    queryKey: ['world', 'recommendations', userId],
    queryFn: () => getJson(`${API.discover}?userId=${userId}&limit=12`) as Promise<{ recommendations: any[] }>,
  });
}

export function useTrending() {
  return useQuery({
    queryKey: ['world', 'trending'],
    queryFn: () => getJson(API.trending) as Promise<{ trending: any[] }>,
  });
}

// ─── Player ────────────────────────────────────────────────────────────────

export function usePlayerIdentity(userId = 'demo-user') {
  return useQuery({
    queryKey: ['world', 'player', userId],
    queryFn: () => getJson(`${API.player}?userId=${userId}`) as Promise<{ identity: any }>,
  });
}

// ─── Metrics ───────────────────────────────────────────────────────────────

export function useAllMetrics() {
  return useQuery({
    queryKey: ['world', 'metrics'],
    queryFn: () => getJson(API.metrics) as Promise<{ metrics: any[] }>,
  });
}

export function useRecomputeMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (experienceId: string) => postJson(API.recomputeMetrics(experienceId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['world', 'metrics'] }),
  });
}

// ─── Economy ───────────────────────────────────────────────────────────────

export function useEconomySummary() {
  return useQuery({
    queryKey: ['world', 'economy'],
    queryFn: () => getJson(API.economy) as Promise<{ summary: any }>,
  });
}

export function useRoyaltyGraph(experienceId: string | null) {
  return useQuery({
    queryKey: ['world', 'royalty', experienceId],
    queryFn: () => getJson(API.royalty(experienceId!)) as Promise<{ shares: any[] }>,
    enabled: !!experienceId,
  });
}

// ─── Social ────────────────────────────────────────────────────────────────

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, userId }: { experienceId: string; userId: string }) =>
      postJson(API.follow(experienceId), { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['world', 'community'] }),
  });
}

export function useComments(experienceId: string | null) {
  return useQuery({
    queryKey: ['world', 'comments', experienceId],
    queryFn: () => getJson(API.comments(experienceId!)) as Promise<{ comments: any[] }>,
    enabled: !!experienceId,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, body, userId }: { experienceId: string; body: string; userId: string }) =>
      postJson(API.comments(experienceId), { body, userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['world', 'comments'] }),
  });
}

export function useCommunity(experienceId: string | null) {
  return useQuery({
    queryKey: ['world', 'community', experienceId],
    queryFn: () => getJson(API.community(experienceId!)) as Promise<{ community: any }>,
    enabled: !!experienceId,
  });
}

// ─── Evolution ─────────────────────────────────────────────────────────────

export function useAnalyze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (experienceId: string) => postJson(API.analyze(experienceId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['world', 'proposals'] }),
  });
}

export function useProposals(experienceId: string | null) {
  return useQuery({
    queryKey: ['world', 'proposals', experienceId],
    queryFn: () => getJson(API.proposals(experienceId!)) as Promise<{ proposals: any[] }>,
    enabled: !!experienceId,
  });
}

export function useApproveProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => postJson(API.approve(proposalId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['world', 'proposals'] });
      qc.invalidateQueries({ queryKey: ['experiences'] });
      qc.invalidateQueries({ queryKey: ['world', 'economy'] });
    },
  });
}

export function useRejectProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => postJson(API.reject(proposalId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['world', 'proposals'] }),
  });
}

// ─── Simulation Lab ────────────────────────────────────────────────────────

export function useRunSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experienceId, playerCount, variantLabel, variantConfig }: { experienceId: string; playerCount: number; variantLabel?: string; variantConfig?: Record<string, unknown> }) =>
      postJson(API.simulate(experienceId), { playerCount, variantLabel, variantConfig }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['world', 'runs'] });
      qc.invalidateQueries({ queryKey: ['world', 'metrics'] });
    },
  });
}

export function useSimulationRuns(experienceId: string | null) {
  return useQuery({
    queryKey: ['world', 'runs', experienceId],
    queryFn: () => getJson(API.runs(experienceId!)) as Promise<{ runs: any[] }>,
    enabled: !!experienceId,
  });
}

// ─── Genomes ───────────────────────────────────────────────────────────────

export function useGenomes() {
  return useQuery({
    queryKey: ['world', 'genomes'],
    queryFn: () => getJson(API.genomes) as Promise<{ genomes: any[] }>,
  });
}
