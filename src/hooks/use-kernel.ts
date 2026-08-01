/**
 * Kernel API hooks (TanStack Query)
 * ----------------------------------
 * Thin wrappers around fetch calls to /api/kernel, /api/ledger, /api/tokens,
 * /api/telemetry. Used by the playground UI.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = {
  extensions: '/api/kernel/extensions',
  compile: '/api/kernel/compile',
  sessions: '/api/kernel/sessions',
  tick: (id: string) => `/api/kernel/sessions/${id}/tick`,
  action: (id: string) => `/api/kernel/sessions/${id}/action`,
  inspector: (id: string) => `/api/kernel/sessions/${id}/inspector`,
  settle: (id: string) => `/api/kernel/sessions/${id}/settle`,
  ledgerAccounts: '/api/ledger/accounts',
  ledgerTransactions: '/api/ledger/transactions',
  ledgerSeed: '/api/ledger/seed',
  tokenBalances: (sessionId: string) => `/api/tokens/balances?sessionId=${sessionId}`,
  tokenEvents: (sessionId: string) => `/api/tokens/events?sessionId=${sessionId}`,
  telemetryEvents: '/api/telemetry/events',
  telemetryGenomes: '/api/telemetry/genomes',
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Extensions ────────────────────────────────────────────────────────────

export function useExtensions() {
  return useQuery({
    queryKey: ['extensions'],
    queryFn: () => getJson(API.extensions) as Promise<{ extensions: any[] }>,
    staleTime: Infinity,
  });
}

// ─── Compile ───────────────────────────────────────────────────────────────

export function useCompile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bundle: any) => postJson(API.compile, { bundle }) as Promise<any>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['genomes'] }),
  });
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export function useStartSession() {
  return useMutation({
    mutationFn: (params: { experienceId: string; bundle: any; mode?: string; userId?: string }) =>
      postJson(API.sessions, params) as Promise<{ valid: boolean; sessionId?: string; errors?: any[] }>,
  });
}

export function useTick() {
  return useMutation({
    mutationFn: ({ sessionId, ticks }: { sessionId: string; ticks: number }) =>
      postJson(API.tick(sessionId), { ticks }) as Promise<{ snapshot: any }>,
  });
}

export function useAction() {
  return useMutation({
    mutationFn: ({ sessionId, instanceId, action, payload }: { sessionId: string; instanceId: string; action: string; payload?: unknown }) =>
      postJson(API.action(sessionId), { instanceId, action, payload }) as Promise<{ snapshot: any }>,
  });
}

export function useInspector(sessionId: string | null) {
  return useQuery({
    queryKey: ['inspector', sessionId],
    queryFn: () => getJson(API.inspector(sessionId!)) as Promise<{ snapshot: any }>,
    enabled: !!sessionId,
    refetchInterval: 1000,
  });
}

export function useSettle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => postJson(API.settle(sessionId), {}) as Promise<{ ok: boolean }>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['telemetry'] });
      qc.invalidateQueries({ queryKey: ['tokens'] });
    },
  });
}

// ─── Ledger ────────────────────────────────────────────────────────────────

export function useLedgerAccounts() {
  return useQuery({
    queryKey: ['ledger', 'accounts'],
    queryFn: () => getJson(API.ledgerAccounts) as Promise<{ accounts: any[] }>,
  });
}

export function useLedgerTransactions() {
  return useQuery({
    queryKey: ['ledger', 'transactions'],
    queryFn: () => getJson(API.ledgerTransactions) as Promise<{ transactions: any[] }>,
  });
}

export function useSeedLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountLiquid: number) => postJson(API.ledgerSeed, { amountLiquid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ledger'] }),
  });
}

// ─── Tokens ────────────────────────────────────────────────────────────────

export function useTokenBalances(sessionId: string | null) {
  return useQuery({
    queryKey: ['tokens', 'balances', sessionId],
    queryFn: () => getJson(API.tokenBalances(sessionId!)) as Promise<{ balances: any[]; sessionId: string }>,
    enabled: !!sessionId,
    refetchInterval: 1000,
  });
}

export function useTokenEvents(sessionId: string | null) {
  return useQuery({
    queryKey: ['tokens', 'events', sessionId],
    queryFn: () => getJson(API.tokenEvents(sessionId!)) as Promise<{ events: any[]; sessionId: string }>,
    enabled: !!sessionId,
    refetchInterval: 1500,
  });
}

// ─── Telemetry ─────────────────────────────────────────────────────────────

export function useTelemetryEvents() {
  return useQuery({
    queryKey: ['telemetry', 'events'],
    queryFn: () => getJson(API.telemetryEvents) as Promise<{ events: any[] }>,
  });
}

export function useTelemetryGenomes() {
  return useQuery({
    queryKey: ['telemetry', 'genomes'],
    queryFn: () => getJson(API.telemetryGenomes) as Promise<{ genomes: any[] }>,
  });
}
