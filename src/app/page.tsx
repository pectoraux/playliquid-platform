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
import { PlayView } from '@/components/runtime/PlayView';
import { SparkPlayer } from '@/components/runtime/SparkPlayer';
import { GamePlayer } from '@/components/runtime/GamePlayer';
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
    case 'play':
      if (sparkQueue.length > 0) {
        return <SparkPlayer sparks={sparkQueue} initialIndex={Math.max(0, sparkQueue.findIndex((s) => s.experienceId === playExperienceId))} />;
      }
      return playExperienceId ? <GamePlayer experienceId={playExperienceId} /> : <ConsumerHomeV3 />;

    // ── Creator ──
    case 'creator-studio':
      return <CreatorStudio />;
    case 'wizard':
      return <CreationWizard />;
    case 'editor':
      return <StudioEditor />;
    case 'experiences':
      return <ExperiencesView />;
    case 'creator':
      return <CreatorProfile />;

    // ── V3-wrapped legacy views ──
    case 'extensions':
      return <V3ShellWrapper title="Extensions"><ExtensionUniverse /></V3ShellWrapper>;
    case 'adr-economy':
      return <V3ShellWrapper title="Wallet"><PlayView experienceId="" /></V3ShellWrapper>;
    case 'competitive':
      return <V3ShellWrapper title="Compete"><PlayView experienceId="" /></V3ShellWrapper>;
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
