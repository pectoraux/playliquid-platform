'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  useWorlds, useWorld, useEntities, useWorldEvents, useHistory,
  useWorldStats, useRunTicks, useSpawnCitizens, useRunDemo, useWorldDiscovery,
  useAssets,
} from '@/hooks/use-civ';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Globe, Users, Coins, FlaskConical, BookOpen, Play,
  Loader2, Sparkles, TrendingUp, Award, MapPin, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

export function CivDashboard() {
  const { setView } = useStudioStore();
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const runDemo = useRunDemo();

  const handleDemo = async () => {
    try {
      const result = await runDemo.mutateAsync();
      setSelectedWorldId(result.worldId);
      toast.success('Farm Kingdom Civilization created!', {
        description: `${result.citizens} citizens, ${result.ticksRun} ticks, ${result.eventsGenerated} events`,
      });
    } catch (e) {
      toast.error('Demo failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('home')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Studio
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white text-sm">
              🌍
            </div>
            <div>
              <h1 className="text-sm font-semibold">Civilization Engine</h1>
              <p className="text-[10px] text-muted-foreground">Autonomous worlds · AI agents · Emergent events</p>
            </div>
          </div>
          <div className="ml-auto">
            <Button onClick={handleDemo} disabled={runDemo.isPending} className="bg-amber-500 hover:bg-amber-600 text-white h-8">
              {runDemo.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</> : <><Sparkles className="w-3.5 h-3.5" /> Farm Kingdom Universe</>}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        <WorldSelector selectedId={selectedWorldId} onSelect={setSelectedWorldId} />

        {selectedWorldId ? (
          <WorldView worldId={selectedWorldId} />
        ) : (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Select a world above, or run the Farm Kingdom Universe demo</p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Civilization Engine v0.3 — Worlds live, agents decide, events emerge
      </footer>
    </div>
  );
}

// ─── World Selector ────────────────────────────────────────────────────────

function WorldSelector({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { data } = useWorlds();
  const worlds = data?.worlds ?? [];

  if (worlds.length === 0) {
    return (
      <Card className="mb-4">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">No worlds yet. Click "Farm Kingdom Universe" to create one.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
      {worlds.map((w: any) => (
        <button
          key={w.id}
          onClick={() => onSelect(w.id)}
          className={`px-3 py-2 rounded-lg border-2 text-left min-w-48 shrink-0 transition-all ${
            selectedId === w.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border hover:border-amber-300'
          }`}
        >
          <div className="text-sm font-medium truncate">{w.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[9px] h-4">{w.status}</Badge>
            <span className="text-[10px] text-muted-foreground">{w.population} citizens</span>
            <span className="text-[10px] text-muted-foreground">{w.tickCount} ticks</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── World View ────────────────────────────────────────────────────────────

function WorldView({ worldId }: { worldId: string }) {
  const { data: worldData } = useWorld(worldId);
  const { data: statsData } = useWorldStats(worldId);
  const spawn = useSpawnCitizens();
  const tick = useRunTicks();

  const world = worldData?.world;
  const stats = statsData?.stats;

  const handleSpawn = async (count: number) => {
    try {
      await spawn.mutateAsync({ worldId, count });
      toast.success(`Spawned ${count} citizens`);
    } catch (e) {
      toast.error('Spawn failed', { description: (e as Error).message });
    }
  };

  const handleTick = async (ticks: number) => {
    try {
      const result = await tick.mutateAsync({ worldId, ticks });
      toast.success(`${ticks} ticks complete`, {
        description: `${result.eventsGenerated} events, ${result.decisions} decisions`,
      });
    } catch (e) {
      toast.error('Tick failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      {/* World header + stats */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{world?.name ?? 'Loading...'}</CardTitle>
              <CardDescription className="text-xs">{world?.description}</CardDescription>
            </div>
            <Badge variant={world?.status === 'ACTIVE' ? 'default' : 'outline'} className="text-[10px] h-5">
              {world?.status}
            </Badge>
          </div>
        </CardHeader>
        {stats && (
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
              <Stat label="Population" value={stats.population} icon={Users} color="text-blue-500" />
              <Stat label="Avg Wealth" value={`${(stats.averageWealth / 1_000_000).toFixed(2)}`} icon={Coins} color="text-amber-500" />
              <Stat label="Mood" value={Math.round(stats.mood)} icon={TrendingUp} color={stats.mood > 0 ? 'text-emerald-500' : 'text-red-500'} />
              <Stat label="Events" value={stats.eventCount} icon={Sparkles} color="text-purple-500" />
              <Stat label="Assets" value={stats.assetCount} icon={MapPin} color="text-teal-500" />
              <Stat label="Ticks" value={stats.tickCount} icon={Clock} color="text-slate-500" />
            </div>
            {stats.wealthiestEntity && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-muted-foreground">Wealthiest:</span>
                <span className="font-medium">{stats.wealthiestEntity.name}</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {(stats.wealthiestEntity.wealth / 1_000_000).toFixed(2)} Liquid
                </span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => handleSpawn(10)} disabled={spawn.isPending} className="h-8">
          <Users className="w-3.5 h-3.5" /> Spawn 10
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleSpawn(50)} disabled={spawn.isPending} className="h-8">
          Spawn 50
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTick(10)} disabled={tick.isPending} className="h-8">
          {tick.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Tick 10
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTick(50)} disabled={tick.isPending} className="h-8">
          Tick 50
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTick(200)} disabled={tick.isPending} className="h-8">
          Tick 200
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="citizens">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 max-w-2xl">
          <TabsTrigger value="citizens" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" /> Citizens</TabsTrigger>
          <TabsTrigger value="events" className="text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Events</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5"><BookOpen className="w-3.5 h-3.5" /> History</TabsTrigger>
          <TabsTrigger value="economy" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Economy</TabsTrigger>
          <TabsTrigger value="discover" className="text-xs gap-1.5"><Globe className="w-3.5 h-3.5" /> Discover</TabsTrigger>
        </TabsList>

        <TabsContent value="citizens" className="mt-4"><CitizensTab worldId={worldId} /></TabsContent>
        <TabsContent value="events" className="mt-4"><EventsTab worldId={worldId} /></TabsContent>
        <TabsContent value="history" className="mt-4"><HistoryTab worldId={worldId} /></TabsContent>
        <TabsContent value="economy" className="mt-4"><EconomyTab worldId={worldId} /></TabsContent>
        <TabsContent value="discover" className="mt-4"><DiscoverTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

// ─── Citizens Tab ──────────────────────────────────────────────────────────

function CitizensTab({ worldId }: { worldId: string }) {
  const { data } = useEntities(worldId);
  const entities = data?.entities ?? [];

  const ROLE_COLORS: Record<string, string> = {
    CITIZEN: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    MERCHANT: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    BUILDER: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    EXPLORER: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    COMPETITOR: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Citizens ({entities.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-1.5">
            {entities.slice(0, 50).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <Badge className={`text-[9px] h-4 ${ROLE_COLORS[e.type] ?? ''}`}>{e.type}</Badge>
                <span className="text-sm font-medium flex-1 truncate">{e.name}</span>
                <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                  {(e.wealth / 1_000_000).toFixed(2)} LQ
                </span>
                <span className="text-[10px] text-muted-foreground">rep: {e.reputation}</span>
              </div>
            ))}
            {entities.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No citizens yet</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Events Tab ────────────────────────────────────────────────────────────

function EventsTab({ worldId }: { worldId: string }) {
  const { data } = useWorldEvents(worldId);
  const events = data?.events ?? [];

  const TYPE_COLORS: Record<string, string> = {
    economic: 'bg-amber-500',
    social: 'bg-blue-500',
    environmental: 'bg-emerald-500',
    competitive: 'bg-rose-500',
    crisis: 'bg-red-500',
    discovery: 'bg-purple-500',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Emergent Events ({events.length})</CardTitle>
        <CardDescription className="text-xs">Events generated from world state by the Events Engine</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {events.map((e: any) => (
              <div key={e.id} className="p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[e.type] ?? 'bg-slate-500'}`} />
                  <span className="text-sm font-medium">{e.name}</span>
                  <Badge variant="outline" className="text-[9px] h-4 ml-auto">tick {e.tick}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{e.storyText}</p>
              </div>
            ))}
            {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No events yet. Run ticks to generate them.</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── History Tab ───────────────────────────────────────────────────────────

function HistoryTab({ worldId }: { worldId: string }) {
  const { data } = useHistory(worldId);
  const history = data?.history ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">World Chronicle</CardTitle>
        <CardDescription className="text-xs">The living history of this civilization</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {history.map((h: any) => (
              <div key={h.id} className="flex gap-3 p-2 rounded-lg">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {h.tick}
                  </div>
                  {h !== history[history.length - 1] && <div className="w-0.5 flex-1 bg-border mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{h.title}</span>
                    <Badge variant="outline" className="text-[8px] h-3.5">{h.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.narrative}</p>
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Economy Tab ───────────────────────────────────────────────────────────

function EconomyTab({ worldId }: { worldId: string }) {
  const { data: worldData } = useWorld(worldId);
  const { data: statsData } = useWorldStats(worldId);
  const { data: assetsData } = useAssets(worldId);

  const world = worldData?.world;
  const stats = statsData?.stats;
  const assets = assetsData?.assets ?? [];

  const macroState = world?.macroState;
  const resources = macroState?.resources ?? {};
  const prices = macroState?.prices ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resources & Prices</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(resources).map(([r, supply]: [string, any]) => (
                <div key={r} className="flex items-center gap-2 text-xs">
                  <span className="font-mono w-20">{r}</span>
                  <div className="flex-1">
                    <Progress value={Math.min(100, supply / 20)} className="h-2" />
                  </div>
                  <span className="font-mono w-12 text-right">{supply}</span>
                  <span className="font-mono w-12 text-right text-amber-600 dark:text-amber-400">
                    {(prices[r] ?? 0).toFixed(1)}L
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Wealth Distribution</CardTitle></CardHeader>
          <CardContent>
            {stats && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Wealth</div>
                  <div className="text-xl font-bold text-amber-500">
                    {(stats.totalWealth / 1_000_000).toFixed(1)} Liquid
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Average Wealth</div>
                  <div className="text-lg font-semibold">{(stats.averageWealth / 1_000_000).toFixed(2)} Liquid</div>
                </div>
                {stats.wealthiestEntity && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Wealthiest Citizen</div>
                    <div className="text-sm font-medium">{stats.wealthiestEntity.name}</div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      {(stats.wealthiestEntity.wealth / 1_000_000).toFixed(2)} Liquid
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {assets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assets ({assets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {assets.slice(0, 20).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 p-1.5 rounded border border-border text-xs">
                    <Badge variant="outline" className="text-[9px] h-4">{a.type}</Badge>
                    <span className="flex-1 truncate">{a.name}</span>
                    {a.forSale && <Badge className="text-[9px] h-4 bg-emerald-500 text-white">FOR SALE</Badge>}
                    <span className="font-mono text-amber-600 dark:text-amber-400">{(a.askingPrice ?? a.purchasePrice) / 1_000_000}L</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Discover Tab ──────────────────────────────────────────────────────────

function DiscoverTab() {
  const { data } = useWorldDiscovery();
  const recs = data?.recommendations ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">World Discovery</CardTitle>
        <CardDescription className="text-xs">Recommended worlds based on your identity + world genome + economic opportunities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recs.map((r: any) => (
            <div key={r.worldId} className="p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-sm">{r.name}</span>
                <Badge className="text-[10px] h-5 bg-amber-500 text-white">{r.score}%</Badge>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                <span>{r.population} citizens</span>
                <span>·</span>
                <span>mood: {Math.round(r.mood)}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.reasons.map((reason: string, i: number) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{reason}</span>
                ))}
              </div>
            </div>
          ))}
          {recs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No worlds to recommend yet</p>}
        </div>
      </CardContent>
    </Card>
  );
}
