/**
 * Studio Store (Zustand)
 * ----------------------
 * Client-side state for the Studio creator experience.
 * Manages: the current view, the active draft, the wizard state,
 * the graph editor state (React Flow nodes/edges), and the runtime preview.
 */

import { create } from 'zustand';
import type { Edge, Node } from '@xyflow/react';
import type { ExperienceBundle, ExperienceIntent, WireSpec, ExtensionInstanceSpec } from '@/kernel/types';

// ─── Custom node data type ─────────────────────────────────────────────────

export interface ExtensionNodeData {
  extensionId: string;
  extensionName: string;
  category: string;
  icon: string;
  config: Record<string, unknown>;
  role?: ExtensionInstanceSpec['role'];
  inputs: Array<{ name: string; required: boolean; cardinality: string }>;
  outputs: Array<{ name: string }>;
  tokenDefinitions: Array<{ symbol: string }>;
  consumesTokens: string[];
  [key: string]: unknown;
}

export type ExtensionNode = Node<ExtensionNodeData>;

// ─── View State ────────────────────────────────────────────────────────────

export type StudioView =
  | 'home'
  | 'universe'
  | 'identity'
  | 'identity-u'
  | 'creator-intel'
  | 'asset-economy'
  | 'multiverse'
  | 'living'
  | 'adr-economy'
  | 'competitive'
  | 'extensions'
  | 'home-v2'
  | 'creator-studio'
  | 'network-intelligence'
  | 'wizard'
  | 'editor'
  | 'experiences'
  | 'creator'
  | 'world'
  | 'civ'
  | 'kernel-dev';

// ─── Wizard State ──────────────────────────────────────────────────────────

export interface WizardState {
  step: 1 | 2 | 3 | 4;  // 1=type, 2=emotions, 3=describe, 4=ai-suggest
  intent: ExperienceIntent;
  description: string;
  aiComposing: boolean;
  aiSuggestion: any | null;
  aiError: string | null;
}

const defaultIntent: ExperienceIntent = {
  kind: 'GAME',
  emotions: [],
  goals: [],
  audience: 'general',
  description: '',
};

// ─── Store ─────────────────────────────────────────────────────────────────

export interface StudioStore {
  view: StudioView;
  playExperienceId: string | null;
  sparkQueue: Array<{ experienceId: string; title: string; creatorName: string; creatorId: string; playCount: number; format: string; extensions: any[] }>;
  playSparkQueue: (sparks: Array<{ experienceId: string; title: string; creatorName: string; creatorId: string; playCount: number; format: string; extensions: any[] }>, startIndex?: number) => void;
  draftId: string | null;
  draftTitle: string;
  draftDescription: string;
  bundle: ExperienceBundle;
  intent: ExperienceIntent;
  parentExperienceId?: string;

  // React Flow state
  nodes: Node[];
  edges: Edge[];

  // Wizard
  wizard: WizardState;

  // Runtime preview
  sessionId: string | null;
  sessionStatus: 'idle' | 'starting' | 'active' | 'ended';
  compileResult: {
    valid: boolean;
    errors: Array<{ code: string; message: string }>;
    executionOrder: string[];
    deterministic: boolean;
    declaredTokens: Array<{ symbol: string; name: string }>;
    contentHash?: string;
  } | null;
  selectedInstanceId: string | null;
  isAutoTicking: boolean;

  // ── Actions ────────────────────────────────────────────────────────────
  setView: (v: StudioView) => void;
  playExperience: (experienceId: string) => void;
  setPlayExperienceId: (id: string | null) => void;
  playSparkQueue: (sparks: any[], startIndex?: number) => void;
  setDraft: (params: { id: string; title: string; description: string; bundle: ExperienceBundle; intent: ExperienceIntent; parentExperienceId?: string }) => void;
  setBundle: (b: ExperienceBundle) => void;
  setTitle: (t: string) => void;
  setDescription: (d: string) => void;
  setIntent: (i: ExperienceIntent) => void;
  setNodes: (n: Node[]) => void;
  setEdges: (e: Edge[]) => void;
  onNodesChange: (updater: (nodes: Node[]) => Node[]) => void;
  onEdgesChange: (updater: (edges: Edge[]) => Edge[]) => void;
  addInstance: (node: ExtensionNode) => void;
  removeInstance: (id: string) => void;
  updateInstanceConfig: (id: string, config: Record<string, unknown>) => void;
  setSelectedInstance: (id: string | null) => void;
  setCompileResult: (r: StudioStore['compileResult']) => void;
  setSessionId: (id: string | null) => void;
  setSessionStatus: (s: 'idle' | 'starting' | 'active' | 'ended') => void;
  setAutoTicking: (v: boolean) => void;

  // Wizard actions
  setWizardStep: (s: WizardState['step']) => void;
  setWizardIntent: (i: Partial<ExperienceIntent>) => void;
  setWizardDescription: (d: string) => void;
  setAIComposing: (v: boolean) => void;
  setAISuggestion: (s: any | null) => void;
  setAIError: (e: string | null) => void;
  resetWizard: () => void;
}

const emptyBundle: ExperienceBundle = {
  type: 'GAME',
  name: 'Untitled Experience',
  instances: [],
  wires: [],
};

export const useStudioStore = create<StudioStore>((set) => ({
  view: 'home-v2',  // front door is the YouTube-style consumer home
  playExperienceId: null,
  sparkQueue: [],
  draftId: null,
  draftTitle: 'Untitled Experience',
  draftDescription: '',
  bundle: emptyBundle,
  intent: defaultIntent,
  nodes: [],
  edges: [],
  wizard: {
    step: 1,
    intent: defaultIntent,
    description: '',
    aiComposing: false,
    aiSuggestion: null,
    aiError: null,
  },
  sessionId: null,
  sessionStatus: 'idle',
  compileResult: null,
  selectedInstanceId: null,
  isAutoTicking: false,

  setView: (v) => set({ view: v }),
  playExperience: (experienceId) => set({ playExperienceId: experienceId, view: 'play' }),
  setPlayExperienceId: (id) => set({ playExperienceId: id }),
  playSparkQueue: (sparks, startIndex = 0) => set({ sparkQueue: sparks, playExperienceId: sparks[startIndex]?.experienceId ?? null, view: 'play' }),
  setDraft: (params) =>
    set({
      draftId: params.id,
      draftTitle: params.title,
      draftDescription: params.description,
      bundle: params.bundle,
      intent: params.intent,
      parentExperienceId: params.parentExperienceId,
      view: 'editor',
      compileResult: null,
      sessionId: null,
      sessionStatus: 'idle',
    }),
  setBundle: (b) => set({ bundle: b, compileResult: null }),
  setTitle: (t) => set({ draftTitle: t }),
  setDescription: (d) => set({ draftDescription: d }),
  setIntent: (i) => set({ intent: i }),
  setNodes: (n) => set({ nodes: n }),
  setEdges: (e) => set({ edges: e }),
  onNodesChange: (updater) => set((s) => ({ nodes: updater(s.nodes) })),
  onEdgesChange: (updater) => set((s) => ({ edges: updater(s.edges) })),
  addInstance: (node: ExtensionNode) =>
    set((s) => {
      const instSpec: ExtensionInstanceSpec = {
        id: node.id,
        extensionId: node.data.extensionId,
        config: node.data.config,
        role: node.data.role,
      };
      const bundle = { ...s.bundle, instances: [...s.bundle.instances, instSpec] };
      return { nodes: [...s.nodes, node as Node], bundle, compileResult: null };
    }),
  removeInstance: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      bundle: {
        ...s.bundle,
        instances: s.bundle.instances.filter((i) => i.id !== id),
        wires: s.bundle.wires.filter((w) => w.from.instance !== id && w.to.instance !== id),
      },
      selectedInstanceId: s.selectedInstanceId === id ? null : s.selectedInstanceId,
      compileResult: null,
    })),
  updateInstanceConfig: (id, config) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...(n.data as Record<string, unknown>), config: { ...((n.data as { config?: Record<string, unknown> }).config ?? {}), ...config } } }
          : n,
      ),
      bundle: {
        ...s.bundle,
        instances: s.bundle.instances.map((i) => (i.id === id ? { ...i, config: { ...(i.config ?? {}), ...config } } : i)),
      },
      compileResult: null,
    })),
  setSelectedInstance: (id) => set({ selectedInstanceId: id }),
  setCompileResult: (r) => set({ compileResult: r }),
  setSessionId: (id) => set({ sessionId: id }),
  setSessionStatus: (st) => set({ sessionStatus: st }),
  setAutoTicking: (v) => set({ isAutoTicking: v }),

  // Wizard
  setWizardStep: (step) => set((s) => ({ wizard: { ...s.wizard, step } })),
  setWizardIntent: (i) => set((s) => ({ wizard: { ...s.wizard, intent: { ...s.wizard.intent, ...i } } })),
  setWizardDescription: (d) => set((s) => ({ wizard: { ...s.wizard, description: d } })),
  setAIComposing: (v) => set((s) => ({ wizard: { ...s.wizard, aiComposing: v } })),
  setAISuggestion: (sug) => set((s) => ({ wizard: { ...s.wizard, aiSuggestion: sug } })),
  setAIError: (e) => set((s) => ({ wizard: { ...s.wizard, aiError: e } })),
  resetWizard: () =>
    set({
      wizard: {
        step: 1,
        intent: defaultIntent,
        description: '',
        aiComposing: false,
        aiSuggestion: null,
        aiError: null,
      },
    }),
}));

// ─── Helper: sync React Flow edges to bundle wires ─────────────────────────

export function edgesToWires(edges: Edge[]): WireSpec[] {
  return edges
    .filter((e) => e.sourceHandle && e.targetHandle)
    .map((e) => ({
      from: { instance: e.source, channel: e.sourceHandle! },
      to: { instance: e.target, channel: e.targetHandle! },
    }));
}

export function wiresToEdges(wires: WireSpec[]): Edge[] {
  return wires.map((w, i) => ({
    id: `wire-${i}`,
    source: w.from.instance,
    sourceHandle: w.from.channel,
    target: w.to.instance,
    targetHandle: w.to.channel,
  }));
}
