'use client';

import { useStudioStore } from '@/stores/studio-store';
import { bundleToNodes } from '@/components/studio/GraphEditor';
import { useExtensions } from '@/hooks/use-kernel';
import { CreationWizard } from '@/components/studio/CreationWizard';
import { StudioEditor } from '@/components/studio/StudioEditor';
import { ExperiencesView } from '@/components/studio/ExperiencesView';
import { CreatorProfile } from '@/components/studio/CreatorProfile';
import { ExtensionUniverse } from '@/components/extensions/ExtensionUniverse';
import { V3ShellWrapper } from '@/components/consumer-v2/V3ShellWrapper';
import { ConsumerHomeV3 } from '@/components/consumer-v2/ConsumerHomeV3';
import { CreatorStudio } from '@/components/creator-os/CreatorStudio';
import { NetworkIntelligence } from '@/components/intelligence/NetworkIntelligence';
import { SparkPlayer } from '@/components/runtime/SparkPlayer';
import { GamePlayer } from '@/components/runtime/GamePlayer';
import { CreatorChannel } from '@/components/runtime/CreatorChannel';
import { useEffect, useMemo } from 'react';
import type { ExtensionManifest } from '@/kernel/types';
import { Playground } from '@/components/playground/Playground';

export default function Home() {
  const { view, playExperienceId, sparkQueue, draftId, bundle, setNodes, setEdges } = useStudioStore();
  const { data: extData } = useExtensions();

  // Build manifest lookup map
  const manifestMap = useMemo(() => {
    const m = new Map<string, ExtensionManifest>();
    for (const ext of extData?.extensions ?? []) {
      m.set(ext.id, ext as any);
    }
    return m;
  }, [extData]);

  // When entering the editor, sync the React Flow nodes/edges from the bundle
  useEffect(() => {
    if (view === 'editor' && bundle.instances.length > 0 && manifestMap.size > 0) {
      const currentNodes = useStudioStore.getState().nodes;
      if (currentNodes.length !== bundle.instances.length) {
        const { nodes, edges } = bundleToNodes(bundle, manifestMap);
        setNodes(nodes);
        setEdges(edges);
      }
    }
  }, [view, bundle, manifestMap, setNodes, setEdges]);

  // Reset nodes/edges when entering editor with empty bundle
  useEffect(() => {
    if (view === 'editor' && bundle.instances.length === 0) {
      const currentNodes = useStudioStore.getState().nodes;
      if (currentNodes.length > 0) {
        setNodes([]);
        setEdges([]);
      }
    }
  }, [view, bundle.instances.length, setNodes, setEdges]);

  switch (view) {
    // ── V3 Consumer Shell ──
    case 'home':
    case 'home-v2':
    case 'home-v3':
      return <ConsumerHomeV3 />;

    // ── Play views ──
    case 'play': {
      // Check if the requested experience is a spark (in the spark queue)
      const sparkIndex = sparkQueue.findIndex((s) => s.experienceId === playExperienceId);
      if (sparkQueue.length > 0 && sparkIndex >= 0) {
        return <SparkPlayer sparks={sparkQueue} initialIndex={sparkIndex} />;
      }
      // Otherwise it's a game — use the GamePlayer
      return playExperienceId ? <GamePlayer experienceId={playExperienceId} /> : <ConsumerHomeV3 />;
    }

    // ── Creator ──
    case 'creator-studio':
      return <CreatorStudio />;
    case 'creator-channel':
      return playExperienceId ? <CreatorChannel creatorId={playExperienceId} /> : <ConsumerHomeV3 />;
    case 'wizard':
      return <CreationWizard />;
    case 'editor':
      return <StudioEditor />;
    case 'experiences':
      return <ExperiencesView />;
    case 'creator':
      return <CreatorProfile />;

    // ── V3-wrapped views ──
    case 'extensions':
      return <V3ShellWrapper title="Extensions"><ExtensionUniverse /></V3ShellWrapper>;
    case 'adr-economy':
      return <V3ShellWrapper title="Wallet"><WalletPage /></V3ShellWrapper>;
    case 'competitive':
      return <V3ShellWrapper title="Compete"><CompetePage /></V3ShellWrapper>;
    case 'network-intelligence':
      return <V3ShellWrapper title="Network Intelligence"><NetworkIntelligence /></V3ShellWrapper>;
    case 'kernel-dev':
      return <Playground />;

    // ── All legacy views redirect to V3 home ──
    case 'universe':
    case 'identity':
    case 'identity-u':
    case 'creator-intel':
    case 'asset-economy':
    case 'multiverse':
    case 'living':
    case 'world':
    case 'civ':
    default:
      return <ConsumerHomeV3 />;
  }
}

// ─── Simple V3 pages for Wallet and Compete ────────────────────────────────

function WalletPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold mb-4">Wallet</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="text-[10px] text-muted-foreground mb-1">Liquid Balance</div>
          <div className="text-2xl font-bold text-amber-500">0 L</div>
        </div>
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="text-[10px] text-muted-foreground mb-1">Purchased Minutes</div>
          <div className="text-2xl font-bold">0 min</div>
        </div>
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="text-[10px] text-muted-foreground mb-1">Prize Earnings</div>
          <div className="text-2xl font-bold text-emerald-500">0 L</div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <h3 className="text-sm font-medium mb-2">Recent Transactions</h3>
        <p className="text-xs text-muted-foreground">No transactions yet. Purchase Liquid to start competing.</p>
      </div>
      <button className="mt-4 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium">
        Purchase Liquid
      </button>
    </div>
  );
}

function CompetePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold mb-4">Compete</h2>
      <p className="text-sm text-muted-foreground mb-6">Enter tournaments and competitive sessions to win prizes.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Neon Runner Championship', prize: '500L', entrants: 124, status: 'Open' },
          { title: 'Sky Defense Showdown', prize: '1,200L', entrants: 89, status: 'Live' },
          { title: 'Coin Rush Sprint', prize: '250L', entrants: 56, status: 'Soon' },
        ].map((t, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/40 overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-amber-300 to-orange-400 dark:from-amber-800 dark:to-orange-900 flex items-center justify-center">
              <span className="text-3xl">🏆</span>
            </div>
            <div className="p-3">
              <h3 className="text-sm font-bold">{t.title}</h3>
              <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                <span className="text-amber-600 dark:text-amber-400 font-medium">Prize: {t.prize}</span>
                <span>{t.entrants} entrants</span>
              </div>
              <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-medium ${t.status === 'Live' ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>
                {t.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
