'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  useAdvanceTime, useCivFeed, useTimeline, useMissions, useSeason, useWhatChanged, useGlobalFeed,
} from '@/hooks/use-living';
import { useCivilizations } from '@/hooks/use-multiverse';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Globe, Clock, Loader2, Sparkles, Play, Newspaper,
  Target, TrendingUp, Users, Zap, ChevronRight, Sunrise,
} from 'lucide-react';
import { toast } from 'sonner';

export function LivingCivilizations() {
  const { setView } = useStudioStore();
  const { data: civData } = useCivilizations();
  const civs = civData?.civilizations ?? [];
  const [selectedWorld, setSelectedWorld] = useState<string | null>(civs[0]?.worldId ?? null);
  const advance = useAdvanceTime();

  const handleAdvance = async (ticks: number) => {
    if (!selectedWorld) return;
    try {
      const result = await advance.mutateAsync({ worldId: selectedWorld, ticks });
      toast.success(`${ticks} day${ticks > 1 ? 's' : ''} passed`, {
        description: `${result.eventsGenerated} events · ${result.seasonChanged ? `Season changed to ${result.newSeason}` : 'Same season'}`,
      });
    } catch (e) {
      toast.error('Time advance failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('universe')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 flex items-center justify-center text-white">
              <Sunrise className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Living Civilizations</h1>
              <p className="text-[10px] text-muted-foreground">The universe has a heartbeat</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        {/* World selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {civs.map((civ: any) => (
            <button key={civ.worldId} onClick={() => setSelectedWorld(civ.worldId)}
              className={`px-3 py-1.5 rounded-lg border-2 text-xs shrink-0 ${selectedWorld === civ.worldId ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border'}`}>
              {civ.civilizationIcon} {civ.worldName}
            </button>
          ))}
        </div>

        {/* Time controls */}
        <div className="flex items-center gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={() => handleAdvance(1)} disabled={advance.isPending || !selectedWorld} className="h-8">
            {advance.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Advance 1 Day
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleAdvance(7)} disabled={advance.isPending || !selectedWorld} className="h-8">
            Advance 1 Week
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleAdvance(14)} disabled={advance.isPending || !selectedWorld} className="h-8">
            Advance 2 Weeks
          </Button>
        </div>

        {selectedWorld ? (
          <Tabs defaultValue="changed">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
              <TabsTrigger value="changed" className="text-xs gap-1.5"><Sunrise className="w-3.5 h-3.5" /> What Changed</TabsTrigger>
              <TabsTrigger value="feed" className="text-xs gap-1.5"><Newspaper className="w-3.5 h-3.5" /> Feed</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs gap-1.5"><Clock className="w-3.5 h-3.5" /> Timeline</TabsTrigger>
              <TabsTrigger value="missions" className="text-xs gap-1.5"><Target className="w-3.5 h-3.5" /> Missions</TabsTrigger>
              <TabsTrigger value="season" className="text-xs gap-1.5"><Globe className="w-3.5 h-3.5" /> Season</TabsTrigger>
            </TabsList>

            <TabsContent value="changed" className="mt-4"><WhatChangedTab worldId={selectedWorld} /></TabsContent>
            <TabsContent value="feed" className="mt-4"><FeedTab worldId={selectedWorld} /></TabsContent>
            <TabsContent value="timeline" className="mt-4"><TimelineTab worldId={selectedWorld} /></TabsContent>
            <TabsContent value="missions" className="mt-4"><MissionsTab worldId={selectedWorld} /></TabsContent>
            <TabsContent value="season" className="mt-4"><SeasonTab worldId={selectedWorld} /></TabsContent>
          </Tabs>
        ) : (
          <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">Select a civilization above</p></CardContent></Card>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Living Civilizations v0.51 — The universe moves even when you're away
      </footer>
    </div>
  );
}

// ─── What Changed Tab (THE key feature) ────────────────────────────────────

function WhatChangedTab({ worldId }: { worldId: string }) {
  const { data, isLoading } = useWhatChanged(worldId);

  if (isLoading || !data) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sunrise className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-semibold">While You Were Away</span>
          </div>
          <p className="text-sm">{data.summary}</p>
          {data.seasonChanged && (
            <Badge className="mt-2 bg-emerald-500 text-white text-[10px]">🍂 Season Changed!</Badge>
          )}
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-2 text-center">
          <div className={`text-lg font-bold ${data.populationChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {data.populationChange >= 0 ? '+' : ''}{data.populationChange}
          </div>
          <div className="text-[9px] text-muted-foreground">Population</div>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <div className="text-lg font-bold text-amber-500">+{(data.economyChange / 1_000_000).toFixed(1)}L</div>
          <div className="text-[9px] text-muted-foreground">Trade</div>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <div className="text-lg font-bold">{data.newEvents.length}</div>
          <div className="text-[9px] text-muted-foreground">Events</div>
        </CardContent></Card>
      </div>

      {/* Events */}
      {data.newEvents.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2">What Happened</h3>
          <div className="space-y-2">
            {data.newEvents.map((event: any) => (
              <Card key={event.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{event.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{event.title}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{event.body}</p>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{new Date(event.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Missions */}
      {(data.newMissions.length > 0 || data.completedMissions.length > 0) && (
        <div>
          <h3 className="text-xs font-semibold mb-2">Missions</h3>
          <div className="space-y-1">
            {data.completedMissions.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs">
                <span className="text-sm">{m.icon}</span>
                <span className="flex-1">✅ {m.title}</span>
                <Badge className="text-[8px] h-3.5 bg-emerald-500 text-white">COMPLETED</Badge>
              </div>
            ))}
            {data.newMissions.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs">
                <span className="text-sm">{m.icon}</span>
                <span className="flex-1">🆕 {m.title}</span>
                <Badge variant="outline" className="text-[8px] h-3.5">NEW</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feed Tab ──────────────────────────────────────────────────────────────

function FeedTab({ worldId }: { worldId: string }) {
  const { data } = useCivFeed(worldId);
  const feed = data?.feed ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Newspaper className="w-4 h-4 text-emerald-500" /> Civilization Feed</CardTitle>
        <CardDescription className="text-xs">Everything that happened in this world</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No events yet. Advance time to generate them!</p>
            ) : (
              feed.map((item: any) => (
                <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg border border-border">
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium">{item.title}</div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.body}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                      {item.isGlobal && <Badge className="text-[7px] h-3 bg-purple-500 text-white">GLOBAL</Badge>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Timeline Tab ──────────────────────────────────────────────────────────

function TimelineTab({ worldId }: { worldId: string }) {
  const { data } = useTimeline(worldId);
  const timeline = data?.timeline ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-500" /> World Timeline</CardTitle>
        <CardDescription className="text-xs">Day-by-day history of this civilization</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No history yet. Advance time to build it!</p>
            ) : (
              timeline.map((tick: any) => (
                <div key={tick.id} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {tick.tickNumber}
                    </div>
                    {tick !== timeline[timeline.length - 1] && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[8px] h-3.5 capitalize">{tick.season}</Badge>
                      <span className="text-[9px] text-muted-foreground">Day {tick.seasonDay}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{tick.narrative}</p>
                    {tick.eventsGenerated > 0 && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400">⚡ {tick.eventsGenerated} events</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Missions Tab ──────────────────────────────────────────────────────────

function MissionsTab({ worldId }: { worldId: string }) {
  const { data } = useMissions(worldId);
  const missions = data?.missions ?? [];

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-amber-500" /> Civilization Missions</CardTitle>
          <CardDescription className="text-xs">Community objectives that advance the civilization</CardDescription>
        </CardHeader>
      </Card>

      {missions.length === 0 ? (
        <Card><CardContent className="py-6 text-center"><p className="text-sm text-muted-foreground">No active missions. Advance time to generate seasonal missions!</p></CardContent></Card>
      ) : (
        missions.map((mission: any) => (
          <Card key={mission.id}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{mission.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{mission.title}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{mission.description}</p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Progress: {mission.goalCurrent} / {mission.goalTarget}</span>
                      <span className="font-mono font-semibold">{mission.progress}%</span>
                    </div>
                    <Progress value={mission.progress} className="h-1.5" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[8px] h-3.5">{mission.type}</Badge>
                    {mission.season && <Badge variant="outline" className="text-[8px] h-3.5 capitalize">{mission.season}</Badge>}
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400">🎁 {mission.rewardDescription}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ─── Season Tab ────────────────────────────────────────────────────────────

function SeasonTab({ worldId }: { worldId: string }) {
  const { data } = useSeason(worldId);
  const season = data?.season;

  if (!season) return <p className="text-sm text-muted-foreground">No active season. Advance time to begin!</p>;

  return (
    <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-300">
      <CardContent className="p-4 text-center">
        <div className="text-5xl mb-2">{season.icon}</div>
        <h2 className="text-lg font-bold">{season.label}</h2>
        <p className="text-[10px] text-muted-foreground">Year {season.year} · {season.theme ?? season.description}</p>
        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">{season.description}</p>
        <Separator className="my-3" />
        <div className="grid grid-cols-3 gap-3 text-[10px]">
          <div>
            <div className="text-muted-foreground">Pop Growth</div>
            <div className="font-mono font-semibold">{(season.effects.populationGrowth * 100 - 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Trade Bonus</div>
            <div className="font-mono font-semibold">{(season.effects.tradeBonus * 100 - 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Event Rate</div>
            <div className="font-mono font-semibold">{(season.effects.eventChance * 100).toFixed(0)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
