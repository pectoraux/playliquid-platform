'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  useAssets, useAsset, useInstallAsset, useRateAsset, useAssetFeed,
  useCreatorAssets, useAssetRecommendations, useSeedAssets,
} from '@/hooks/use-asset-economy';
import { useExperiences } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Package, Star, Download, GitFork, Coins, Loader2,
  Sparkles, TrendingUp, Zap, ChevronRight, Trophy, Clock, Bot,
} from 'lucide-react';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, string> = {
  character: '🧙', mechanic: '⚙️', 'ai-agent': '🤖', template: '📐', item: '🗡️', 'world-seed': '🌍',
};

export function AssetEconomy() {
  const { setView } = useStudioStore();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  if (selectedAssetId) {
    return <AssetDetailView assetId={selectedAssetId} onBack={() => setSelectedAssetId(null)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('universe')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Asset Economy</h1>
              <p className="text-[10px] text-muted-foreground">Ownable, tradeable, evolving assets</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        <Tabs defaultValue="discover">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="discover" className="text-xs gap-1.5"><Package className="w-3.5 h-3.5" /> Discover</TabsTrigger>
            <TabsTrigger value="recommend" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> AI Picks</TabsTrigger>
            <TabsTrigger value="studio" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> My Assets</TabsTrigger>
            <TabsTrigger value="trending" className="text-xs gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Trending</TabsTrigger>
            <TabsTrigger value="types" className="text-xs gap-1.5"><Zap className="w-3.5 h-3.5" /> Browse</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="mt-4"><DiscoverTab onSelect={setSelectedAssetId} /></TabsContent>
          <TabsContent value="recommend" className="mt-4"><RecommendTab onSelect={setSelectedAssetId} /></TabsContent>
          <TabsContent value="studio" className="mt-4"><CreatorAssetsTab onSelect={setSelectedAssetId} /></TabsContent>
          <TabsContent value="trending" className="mt-4"><TrendingTab onSelect={setSelectedAssetId} /></TabsContent>
          <TabsContent value="types" className="mt-4"><BrowseTab onSelect={setSelectedAssetId} /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Asset Economy v0.49 — Assets become economies
      </footer>
    </div>
  );
}

// ─── Discover Tab (Feed) ───────────────────────────────────────────────────

function DiscoverTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, isLoading } = useAssetFeed();
  const feed = data?.feed;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!feed || feed.trending.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center space-y-3">
        <Package className="w-8 h-8 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No assets yet</p>
        <SeedButton />
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <FeedSection title="🔥 Trending Intelligence" subtitle="Most used this week" sparks={feed.trending} onSelect={onSelect} />
      <FeedSection title="🆕 New Releases" subtitle="Latest assets from creators" sparks={feed.newReleases} onSelect={onSelect} />
      <FeedSection title="⭐ Top Rated" subtitle="Community favorites" sparks={feed.topRated} onSelect={onSelect} />
      <FeedSection title="📦 Most Installed" subtitle="Widely adopted assets" sparks={feed.mostInstalled} onSelect={onSelect} />
    </div>
  );
}

function FeedSection({ title, subtitle, sparks, onSelect }: { title: string; subtitle: string; sparks: any[]; onSelect: (id: string) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-[10px] text-muted-foreground mb-2">{subtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sparks.map((asset) => <AssetCard key={asset.id} asset={asset} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

// ─── Asset Card ────────────────────────────────────────────────────────────

function AssetCard({ asset, onSelect }: { asset: any; onSelect: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer group" onClick={() => onSelect(asset.id)}>
      <div className="aspect-video bg-gradient-to-br from-emerald-200 via-teal-200 to-cyan-200 dark:from-emerald-900 dark:via-teal-900 dark:to-cyan-900 flex items-center justify-center">
        <span className="text-3xl group-hover:scale-110 transition-transform">{asset.icon}</span>
      </div>
      <div className="p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium truncate">{asset.name}</span>
          <Badge variant="outline" className="text-[8px] h-3.5">{asset.type}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1">{asset.description}</p>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><Download className="w-2.5 h-2.5" /> {asset.installCount}</span>
          <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> {asset.rating.toFixed(1)}</span>
          {asset.royaltyBps > 0 && <span className="text-amber-600 dark:text-amber-400">{asset.royaltyBps / 100}% royalty</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Asset Detail View ─────────────────────────────────────────────────────

function AssetDetailView({ assetId, onBack }: { assetId: string; onBack: () => void }) {
  const { data, isLoading } = useAsset(assetId);
  const install = useInstallAsset();
  const rate = useRateAsset();
  const { data: expData } = useExperiences();
  const asset = data?.asset;

  const handleInstall = async (expId: string, expName: string) => {
    try {
      await install.mutateAsync({ assetId, experienceId: expId, experienceName: expName, installedBy: 'demo-user' });
      toast.success(`Installed in ${expName}!`);
    } catch (e) {
      toast.error('Install failed', { description: (e as Error).message });
    }
  };

  if (isLoading || !asset) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8"><ArrowLeft className="w-4 h-4" /> Back</Button>
          <span className="text-sm font-semibold truncate">{asset.name}</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-200 to-teal-200 dark:from-emerald-900 dark:to-teal-900 flex items-center justify-center shrink-0">
                <span className="text-4xl">{asset.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold">{asset.name}</h1>
                  <Badge variant="outline">v{asset.version}</Badge>
                  <Badge variant="outline" className="capitalize">{asset.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{asset.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>by {asset.creatorName}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Download className="w-2.5 h-2.5" /> {asset.installCount} installs</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> {asset.rating.toFixed(1)} ({asset.ratingCount})</span>
                  {asset.royaltyBps > 0 && <><span>·</span><span className="text-amber-600 dark:text-amber-400">{asset.royaltyBps / 100}% royalty</span></>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reputation */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Asset Reputation</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <ReputationBar label="Quality" value={asset.qualityScore} />
              <ReputationBar label="Performance" value={asset.performanceScore} />
              <ReputationBar label="Adoption" value={asset.adoptionScore} />
              <ReputationBar label="Fairness" value={asset.fairnessScore} />
              <ReputationBar label="Innovation" value={asset.innovationScore} />
            </div>
          </CardContent>
        </Card>

        {/* Install */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Install in a Game</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(expData?.experiences ?? []).slice(0, 5).map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between p-2 rounded border border-border">
                  <span className="text-xs">{exp.title}</span>
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleInstall(exp.id, exp.title)} disabled={install.isPending}>
                    <Download className="w-3 h-3" /> Install
                  </Button>
                </div>
              ))}
              {(!expData?.experiences || expData.experiences.length === 0) && <p className="text-xs text-muted-foreground">Publish a game first</p>}
            </div>
          </CardContent>
        </Card>

        {/* Lineage */}
        {(asset.parent || asset.children?.length > 0) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Asset Lineage</CardTitle></CardHeader>
            <CardContent>
              {asset.parent && <div className="text-xs mb-1">↳ Evolved from: <span className="font-medium">{asset.parent.name} v{asset.parent.version}</span></div>}
              {asset.children?.map((c: any, i: number) => (
                <div key={i} className="text-xs">↳ Forked into: <span className="font-medium">{c.name} v{c.version}</span></div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Events */}
        {asset.events?.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {asset.events.slice(0, 8).map((e: any, i: number) => (
                  <div key={i} className="text-[10px] text-muted-foreground">
                    <span className="font-medium">{e.actorName}</span> {e.eventType} {e.detail ? `— ${e.detail}` : ''}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function ReputationBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-1">
        <Progress value={value} className="h-1.5 flex-1" />
        <span className="text-[10px] font-mono">{value}</span>
      </div>
    </div>
  );
}

// ─── AI Recommendations Tab ────────────────────────────────────────────────

function RecommendTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: expData } = useExperiences();
  const [expId, setExpId] = useState<string | null>(expData?.experiences[0]?.id ?? null);
  const { data, isLoading } = useAssetRecommendations(expId);
  const recs = data?.recommendations ?? [];

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-amber-500" /> AI Asset Recommendations</CardTitle>
          <CardDescription className="text-xs">Personalized asset suggestions based on your game's data</CardDescription>
        </CardHeader>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(expData?.experiences ?? []).map((exp: any) => (
          <button key={exp.id} onClick={() => setExpId(exp.id)} className={`px-3 py-1.5 rounded-lg border-2 text-xs shrink-0 ${expId === exp.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}>
            {exp.title}
          </button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="space-y-2">
          {recs.map((rec: any, i: number) => (
            <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(rec.asset.id)}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-2xl">{rec.asset.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{rec.asset.name}</div>
                  <p className="text-[10px] text-muted-foreground">{rec.reason}</p>
                  <Badge className="text-[8px] h-3.5 mt-0.5 bg-emerald-500 text-white">{rec.expectedImpact}</Badge>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
          {recs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Select a game to get recommendations</p>}
        </div>
      )}
    </div>
  );
}

// ─── Creator Assets Tab ────────────────────────────────────────────────────

function CreatorAssetsTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data } = useCreatorAssets();
  const assets = data?.assets ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><div className="text-lg font-bold text-amber-500">{(data?.totalRevenue ?? 0) / 1_000_000}L</div><div className="text-[10px] text-muted-foreground">Total Revenue</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-lg font-bold">{data?.totalInstalls ?? 0}</div><div className="text-[10px] text-muted-foreground">Total Installs</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-lg font-bold">{assets.length}</div><div className="text-[10px] text-muted-foreground">Assets</div></CardContent></Card>
      </div>

      <div className="space-y-1">
        {assets.map((a: any) => (
          <Card key={a.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => onSelect(a.id)}>
            <CardContent className="p-2 flex items-center gap-3">
              <span className="text-xl">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{a.name} <span className="text-[9px] text-muted-foreground">v{a.version}</span></div>
                <div className="text-[10px] text-muted-foreground">{a.installCount} installs · ⭐{a.rating.toFixed(1)} · {(a.totalRevenue / 1_000_000).toFixed(1)}L earned</div>
              </div>
              <Badge variant="outline" className="text-[8px] h-3.5">{a.type}</Badge>
            </CardContent>
          </Card>
        ))}
        {assets.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No assets yet. Create or seed assets to get started.</p>}
      </div>
    </div>
  );
}

// ─── Trending Tab ──────────────────────────────────────────────────────────

function TrendingTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data } = useAssets(undefined, 'trending');
  const assets = data?.assets ?? [];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {assets.map((a) => <AssetCard key={a.id} asset={a} onSelect={onSelect} />)}
      {assets.length === 0 && <SeedButton />}
    </div>
  );
}

// ─── Browse Tab ────────────────────────────────────────────────────────────

function BrowseTab({ onSelect }: { onSelect: (id: string) => void }) {
  const [type, setType] = useState<string | undefined>(undefined);
  const { data } = useAssets(type, 'most-installed');
  const assets = data?.assets ?? [];
  const types = ['', 'character', 'mechanic', 'ai-agent', 'template', 'item', 'world-seed'];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {types.map((t) => (
          <button key={t} onClick={() => setType(t || undefined)} className={`px-3 py-1.5 rounded-lg border-2 text-xs shrink-0 ${type === (t || undefined) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border'}`}>
            {t ? `${TYPE_ICONS[t] ?? '📦'} ${t}` : 'All Types'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {assets.map((a) => <AssetCard key={a.id} asset={a} onSelect={onSelect} />)}
        {assets.length === 0 && <SeedButton />}
      </div>
    </div>
  );
}

function SeedButton() {
  const seed = useSeedAssets();
  return (
    <Button onClick={() => seed.mutateAsync()} disabled={seed.isPending} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
      {seed.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Seed Assets
    </Button>
  );
}
