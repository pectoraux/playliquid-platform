'use client';

import { useStudioStore } from '@/stores/studio-store';
import { bundleToNodes } from '@/components/studio/GraphEditor';
import { useExtensions } from '@/hooks/use-kernel';
import { StudioHome } from '@/components/studio/StudioHome';
import { CreationWizard } from '@/components/studio/CreationWizard';
import { StudioEditor } from '@/components/studio/StudioEditor';
import { ExperiencesView } from '@/components/studio/ExperiencesView';
import { CreatorProfile } from '@/components/studio/CreatorProfile';
import { WorldDashboard } from '@/components/world/WorldDashboard';
import { CivDashboard } from '@/components/civ/CivDashboard';
import { UniverseDashboard } from '@/components/universe/UniverseDashboard';
import { ConsumerUniverse } from '@/components/consumer/ConsumerUniverse';
import { IdentityDashboard } from '@/components/identity/IdentityDashboard';
import { IdentityUniverse } from '@/components/identity-universe/IdentityUniverse';
import { CreatorIntel } from '@/components/creator-intel/CreatorIntel';
import { AssetEconomy } from '@/components/asset-economy/AssetEconomy';
import { Multiverse } from '@/components/multiverse/Multiverse';
import { LivingCivilizations } from '@/components/living/LivingCivilizations';
import { AdrEconomy } from '@/components/economy/AdrEconomy';
import { CompetitivePlay } from '@/components/economy/CompetitivePlay';
import { useEffect, useMemo } from 'react';
import type { ExtensionManifest } from '@/kernel/types';
import { Playground } from '@/components/playground/Playground';

export default function Home() {
  const { view, draftId, bundle, setNodes, setEdges } = useStudioStore();
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
  // (handles draft loading, AI suggestions, fork, and demo loading)
  useEffect(() => {
    if (view === 'editor' && bundle.instances.length > 0 && manifestMap.size > 0) {
      // Only rebuild if node count doesn't match instance count
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
    case 'home':
      return <StudioHome />;
    case 'universe':
      return <ConsumerUniverse />;
    case 'identity':
      return <IdentityDashboard />;
    case 'identity-u':
      return <IdentityUniverse />;
    case 'creator-intel':
      return <CreatorIntel />;
    case 'asset-economy':
      return <AssetEconomy />;
    case 'multiverse':
      return <Multiverse />;
    case 'living':
      return <LivingCivilizations />;
    case 'adr-economy':
      return <AdrEconomy />;
    case 'competitive':
      return <CompetitivePlay />;
    case 'wizard':
      return <CreationWizard />;
    case 'editor':
      return <StudioEditor />;
    case 'experiences':
      return <ExperiencesView />;
    case 'creator':
      return <CreatorProfile />;
    case 'world':
      return <WorldDashboard />;
    case 'civ':
      return <CivDashboard />;
    case 'kernel-dev':
      return <Playground />;
    default:
      return <StudioHome />;
  }
}
