/**
 * Playground Store (Zustand)
 * ---------------------------
 * Client-side state for the kernel playground: the bundle being composed,
 * the active session, compile results, and the selected tab.
 */

import { create } from 'zustand';
import type { ExperienceBundle, WireSpec, ExtensionInstanceSpec } from '@/kernel/types';

export interface PlaygroundState {
  // ── Bundle being composed ────────────────────────────────────────────────
  bundle: ExperienceBundle;
  // ── Active session ───────────────────────────────────────────────────────
  sessionId: string | null;
  sessionStatus: 'idle' | 'starting' | 'active' | 'ended';
  // ── Compile result ───────────────────────────────────────────────────────
  compileResult: {
    valid: boolean;
    errors: Array<{ code: string; message: string }>;
    executionOrder: string[];
    deterministic: boolean;
    declaredTokens: Array<{ symbol: string; name: string; scope: string }>;
    contentHash?: string;
  } | null;
  // ── UI ───────────────────────────────────────────────────────────────────
  activeTab: 'graph' | 'inspector' | 'ledger' | 'tokens' | 'telemetry';
  selectedInstance: string | null;
  isAutoTicking: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  setBundle: (b: ExperienceBundle) => void;
  setBundleType: (t: 'GAME' | 'SPARK') => void;
  setBundleName: (n: string) => void;
  addInstance: (inst: ExtensionInstanceSpec) => void;
  removeInstance: (id: string) => void;
  addWire: (w: WireSpec) => void;
  removeWire: (index: number) => void;
  clearBundle: () => void;
  loadBundle: (b: ExperienceBundle) => void;

  setSessionId: (id: string | null) => void;
  setSessionStatus: (s: 'idle' | 'starting' | 'active' | 'ended') => void;
  setCompileResult: (r: PlaygroundState['compileResult']) => void;
  setActiveTab: (t: PlaygroundState['activeTab']) => void;
  setSelectedInstance: (id: string | null) => void;
  setAutoTicking: (v: boolean) => void;
}

const emptyBundle: ExperienceBundle = {
  type: 'GAME',
  name: 'Untitled Experience',
  instances: [],
  wires: [],
};

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  bundle: emptyBundle,
  sessionId: null,
  sessionStatus: 'idle',
  compileResult: null,
  activeTab: 'graph',
  selectedInstance: null,
  isAutoTicking: false,

  setBundle: (b) => set({ bundle: b }),
  setBundleType: (t) => set((s) => ({ bundle: { ...s.bundle, type: t } })),
  setBundleName: (n) => set((s) => ({ bundle: { ...s.bundle, name: n } })),
  addInstance: (inst) =>
    set((s) => ({
      bundle: { ...s.bundle, instances: [...s.bundle.instances, inst] },
      compileResult: null,
    })),
  removeInstance: (id) =>
    set((s) => ({
      bundle: {
        ...s.bundle,
        instances: s.bundle.instances.filter((i) => i.id !== id),
        wires: s.bundle.wires.filter((w) => w.from.instance !== id && w.to.instance !== id),
      },
      compileResult: null,
      selectedInstance: s.selectedInstance === id ? null : s.selectedInstance,
    })),
  addWire: (w) =>
    set((s) => ({
      bundle: { ...s.bundle, wires: [...s.bundle.wires, w] },
      compileResult: null,
    })),
  removeWire: (index) =>
    set((s) => ({
      bundle: { ...s.bundle, wires: s.bundle.wires.filter((_, i) => i !== index) },
      compileResult: null,
    })),
  clearBundle: () =>
    set({ bundle: { ...emptyBundle }, compileResult: null, sessionId: null, sessionStatus: 'idle' }),
  loadBundle: (b) =>
    set({ bundle: b, compileResult: null, sessionId: null, sessionStatus: 'idle' }),

  setSessionId: (id) => set({ sessionId: id }),
  setSessionStatus: (s) => set({ sessionStatus: s }),
  setCompileResult: (r) => set({ compileResult: r }),
  setActiveTab: (t) => set({ activeTab: t }),
  setSelectedInstance: (id) => set({ selectedInstance: id }),
  setAutoTicking: (v) => set({ isAutoTicking: v }),
}));
