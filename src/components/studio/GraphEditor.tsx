'use client';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStudioStore, type ExtensionNodeData, edgesToWires, wiresToEdges } from '@/stores/studio-store';
import type { ExtensionManifest } from '@/kernel/types';
import { Badge } from '@/components/ui/badge';
import { memo, useCallback } from 'react';

const CATEGORY_COLORS: Record<string, string> = {
  PHYSICS: 'border-sky-300 dark:border-sky-700',
  MECHANIC: 'border-violet-300 dark:border-violet-700',
  ECONOMY: 'border-amber-300 dark:border-amber-700',
  AI: 'border-rose-300 dark:border-rose-700',
  SOCIAL: 'border-emerald-300 dark:border-emerald-700',
  RENDER: 'border-slate-300 dark:border-slate-600',
};

// ─── Custom Node Component ─────────────────────────────────────────────────

const ExtensionNode = memo(({ data, selected }: { data: ExtensionNodeData; selected?: boolean }) => {
  const borderClass = CATEGORY_COLORS[data.category] ?? 'border-border';
  return (
    <div
      className={`rounded-xl border-2 bg-card shadow-sm transition-all ${borderClass} ${
        selected ? 'ring-2 ring-amber-400 shadow-md' : ''
      }`}
      style={{ minWidth: 200, maxWidth: 240 }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
        <span className="text-xl">{data.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{data.extensionName}</div>
          <Badge variant="outline" className="text-[8px] h-3 px-1">{data.category}</Badge>
        </div>
      </div>

      {/* Outputs (right side handles) */}
      {data.outputs.length > 0 && (
        <div className="px-3 py-1.5 space-y-1">
          <div className="text-[8px] uppercase text-emerald-600 dark:text-emerald-400 font-semibold">Outputs</div>
          {data.outputs.map((out) => (
            <div key={out.name} className="relative flex items-center justify-end pr-3">
              <span className="text-[10px] font-mono">{out.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={out.name}
                className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-white dark:!border-slate-900"
                style={{ right: -6 }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Inputs (left side handles) */}
      {data.inputs.length > 0 && (
        <div className="px-3 py-1.5 space-y-1 border-t border-border/50">
          <div className="text-[8px] uppercase text-blue-600 dark:text-blue-400 font-semibold">Inputs</div>
          {data.inputs.map((inp) => (
            <div key={inp.name} className="relative flex items-center pl-3">
              <Handle
                type="target"
                position={Position.Left}
                id={inp.name}
                className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white dark:!border-slate-900"
                style={{ left: -6 }}
              />
              <span className="text-[10px] font-mono">{inp.name}</span>
              {inp.required && <span className="text-[10px] text-red-500 ml-1">●</span>}
            </div>
          ))}
        </div>
      )}

      {/* Tokens */}
      {(data.tokenDefinitions.length > 0 || data.consumesTokens.length > 0) && (
        <div className="px-3 py-1.5 border-t border-border/50">
          <div className="flex gap-1 flex-wrap">
            {data.tokenDefinitions.map((t) => (
              <span key={t.symbol} className="text-[8px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono font-semibold">
                +{t.symbol}
              </span>
            ))}
            {data.consumesTokens.map((t) => (
              <span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-mono font-semibold">
                -{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
ExtensionNode.displayName = 'ExtensionNode';

const nodeTypes = { extension: ExtensionNode };

// ─── Graph Editor ──────────────────────────────────────────────────────────

interface Props {
  onAddExtension: (manifest: ExtensionManifest) => void;
}

export function GraphEditor({ }: Props) {
  const {
    nodes,
    edges,
    bundle,
    setNodes,
    setEdges,
    setBundle,
    setSelectedInstance,
  } = useStudioStore();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes) as Node[];
      setNodes(updated);
    },
    [nodes, setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updated = applyEdgeChanges(changes, edges);
      setEdges(updated);
      // Sync edges → bundle wires
      setBundle({ ...bundle, wires: edgesToWires(updated) });
    },
    [edges, bundle, setEdges, setBundle],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      const updated = addEdge({ ...conn, animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 } }, edges);
      setEdges(updated);
      setBundle({ ...bundle, wires: edgesToWires(updated) });
    },
    [edges, bundle, setEdges, setBundle],
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedInstance(node.id);
  }, [setSelectedInstance]);

  const onPaneClick = useCallback(() => {
    setSelectedInstance(null);
  }, [setSelectedInstance]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        defaultEdgeOptions={{
          style: { stroke: '#f59e0b', strokeWidth: 2 },
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/20"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#ccc" />
        <Controls className="!bg-card !border-border !shadow-md" showInteractive={false} />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={(n) => {
            const cat = (n.data as ExtensionNodeData)?.category;
            const colors: Record<string, string> = {
              PHYSICS: '#0ea5e9',
              MECHANIC: '#8b5cf6',
              ECONOMY: '#f59e0b',
              AI: '#f43f5e',
              SOCIAL: '#10b981',
              RENDER: '#64748b',
            };
            return colors[cat ?? ''] ?? '#94a3b8';
          }}
          maskColor="rgba(0,0,0,0.05)"
        />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <div className="text-4xl opacity-40">🎨</div>
            <p className="text-sm font-medium text-muted-foreground">Empty canvas</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Drag extensions from the left panel, or use the AI Composer to generate a graph from your description.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: create a node from a manifest ──────────────────────────────────

export function createExtensionNode(manifest: ExtensionManifest, position?: { x: number; y: number }): Node<ExtensionNodeData> {
  const id = `${manifest.slug}-${Date.now().toString(36).slice(-4)}`;
  return {
    id,
    type: 'extension',
    position: position ?? {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100,
    },
    data: {
      extensionId: manifest.id,
      extensionName: manifest.name,
      category: manifest.category,
      icon: manifest.icon ?? '📦',
      config: {},
      role: manifest.category.toLowerCase() as any,
      inputs: manifest.inputs.map((i) => ({
        name: i.name,
        required: i.required,
        cardinality: i.cardinality,
      })),
      outputs: manifest.outputs.map((o) => ({ name: o.name })),
      tokenDefinitions: manifest.tokenDefinitions ?? [],
      consumesTokens: manifest.consumesTokens ?? [],
    },
  };
}

// ─── Helper: build nodes+edges from a bundle ────────────────────────────────

export function bundleToNodes(bundle: { instances: any[]; wires: any[] }, manifests: Map<string, ExtensionManifest>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = bundle.instances.map((inst, i) => {
    const manifest = manifests.get(inst.extensionId);
    if (!manifest) return null;
    const cols = 3;
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      id: inst.id,
      type: 'extension',
      position: { x: 100 + col * 280, y: 80 + row * 220 },
      data: {
        extensionId: manifest.id,
        extensionName: manifest.name,
        category: manifest.category,
        icon: manifest.icon ?? '📦',
        config: inst.config ?? {},
        role: inst.role,
        inputs: manifest.inputs.map((inp) => ({ name: inp.name, required: inp.required, cardinality: inp.cardinality })),
        outputs: manifest.outputs.map((o) => ({ name: o.name })),
        tokenDefinitions: manifest.tokenDefinitions ?? [],
        consumesTokens: manifest.consumesTokens ?? [],
      },
    };
  }).filter(Boolean) as Node[];

  const edges = wiresToEdges(bundle.wires).map((e) => ({
    ...e,
    animated: true,
    style: { stroke: '#f59e0b', strokeWidth: 2 },
  }));

  return { nodes, edges };
}
