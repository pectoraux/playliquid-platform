'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  useCivilizations, useCivilization, useFormRelation, useMigrate,
  useMigrations, useChronicle, useAICouncil, useRecommendedCivs, useSeedMultiverse,
} from '@/hooks/use-multiverse';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Globe, Users, Coins, Loader2, Sparkles, Rocket,
  TrendingUp, Trophy, Clock, Bot, Heart, Package, Zap,
  ChevronRight, MapPin, Crown, Handshake, Swords,
} from 'lucide-react';
import { toast } from 'sonner';

export function Multiverse() {
  const { setView } = useStudioStore();
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);

  if (selectedWorldId) {
    return <CivilizationDetail worldId={selectedWorldId} onBack={() => setSelectedWorldId(null)} />;
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center text-white">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Multiverse</h1>
              <p className="text-[10px] text-muted-foreground">Civilization Network</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        <Tabs defaultValue="explore">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="explore" className="text-xs gap-1.5"><Globe className="w-3.5 h-3.5" /> Explore</TabsTrigger>
            <TabsTrigger value="recommend" className="text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" /> For You</TabsTrigger>
            <TabsTrigger value="chronicle" className="text-xs gap-1.5"><Clock className="w-3.5 h-3.5" /> Chronicle</TabsTrigger>
            <TabsTrigger value="migrate" className="text-xs gap-1.5"><MapPin className="w-3.5 h-3.5" /> Migrations</TabsTrigger>
            <TabsTrigger value="council" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> AI Council</TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="mt-4"><ExploreTab onSelect={setSelectedWorldId} /></TabsContent>
          <TabsContent value="recommend" className="mt-4"><RecommendTab onSelect={setSelectedWorldId} /></TabsContent>
          <TabsContent value="chronicle" className="mt-4"><ChronicleTab /></TabsContent>
          <TabsContent value="migrate" className="mt-4"><MigrationsTab onSelect={setSelectedWorldId} /></TabsContent>
          <TabsContent value="council" className="mt-4"><CouncilTab onSelect={setSelectedWorldId} /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Multiverse v0.50 — Worlds become civilizations
      </footer>
    </div>
  );
}

// ─── Explore Tab ───────────────────────────────────────────────────────────

function ExploreTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, isLoading } = useCivilizations();
  const seed = useSeedMultiverse();
  const civs = data?.civilizations ?? [];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (civs.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center space-y-3">
        <Globe className="w-8 h-8 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No civilizations yet</p>
        <Button onClick={() => seed.mutateAsync()} disabled={seed.isPending} className="bg-purple-500 hover:bg-purple-600 text-white">
          {seed.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Initialize Multiverse
        </Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {civs.map((civ) => (
        <Card key={civ.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(civ.worldId)}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{civ.civilizationIcon}</span>
              <div className="flex-1">
                <div className="text-sm font-bold">{civ.worldName}</div>
                <div className="text-[10px] text-muted-foreground">{civ.civilizationLabel} · {civ.era}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px]">
                  <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" /> {civ.population}</span>
                  <span className="flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" /> {civ.influenceScore}</span>
                  <span className="flex items-center gap-0.5"><Handshake className="w-2.5 h-2.5" /> {civ.alliancesCount}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Recommend Tab ─────────────────────────────────────────────────────────

function RecommendTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data } = useRecommendedCivs();
  const recs = data?.recommendations ?? [];

  return (
    <div className="space-y-2">
      {recs.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">No recommendations yet. Initialize the Multiverse first.</p></CardContent></Card>
      ) : (
        recs.map((rec: any) => (
          <Card key={rec.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(rec.worldId)}>
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-2xl">{rec.civilizationIcon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{rec.worldName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className="text-[8px] h-3.5 bg-purple-500 text-white">{rec.score}% match</Badge>
                  {rec.reasons.slice(0, 2).map((r: string, i: number) => (
                    <span key={i} className="text-[9px] text-muted-foreground">{r}</span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ─── Chronicle Tab ─────────────────────────────────────────────────────────

function ChronicleTab() {
  const { data } = useChronicle();
  const events = data?.events ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-purple-500" /> Multiverse Chronicle</CardTitle>
        <CardDescription className="text-xs">The global history of civilizations</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No chronicle events yet</p>
            ) : (
              events.map((e: any) => (
                <div key={e.id} className="flex gap-3 p-2 rounded-lg border border-border">
                  <span className="text-lg">{e.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium">{e.title}</div>
                    <p className="text-[10px] text-muted-foreground">{e.narrative}</p>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {e.worldName ? `${e.worldName} · ` : ''}{new Date(e.createdAt).toLocaleDateString()}
                      {e.isGlobal && <Badge className="ml-1 text-[7px] h-3 bg-purple-500 text-white">GLOBAL</Badge>}
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

// ─── Migrations Tab ────────────────────────────────────────────────────────

function MigrationsTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data } = useMigrations('demo-user');
  const migrate = useMigrate();
  const { data: civData } = useCivilizations();
  const migrations = data?.migrations ?? [];
  const civs = civData?.civilizations ?? [];

  const handleMigrate = async (worldId: string, worldName: string) => {
    try {
      await migrate.mutateAsync({
        userId: 'demo-user',
        displayName: 'Demo Player',
        toWorldId: worldId,
        toWorldName: worldName,
        migrationType: 'visit',
      });
      toast.success(`Migrated to ${worldName}!`, { description: 'Your identity and reputation travel with you' });
    } catch (e) {
      toast.error('Migration failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> Player Migration</CardTitle>
          <CardDescription className="text-xs">Travel between civilizations — your identity, assets, and reputation follow you</CardDescription>
        </CardHeader>
      </Card>

      {/* Available destinations */}
      <div>
        <h3 className="text-xs font-semibold mb-2">Available Destinations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {civs.map((civ: any) => (
            <Card key={civ.id}>
              <CardContent className="p-2 flex items-center gap-2">
                <span className="text-xl">{civ.civilizationIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{civ.worldName}</div>
                  <div className="text-[9px] text-muted-foreground">{civ.population} citizens · {civ.civilizationLabel}</div>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleMigrate(civ.worldId, civ.worldName)} disabled={migrate.isPending}>
                  <MapPin className="w-3 h-3" /> Visit
                </Button>
              </CardContent>
            </Card>
          ))}
          {civs.length === 0 && <p className="text-xs text-muted-foreground">No civilizations available</p>}
        </div>
      </div>

      {/* Migration history */}
      {migrations.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2">Your Journeys</h3>
          <div className="space-y-1">
            {migrations.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                <MapPin className="w-3 h-3 text-purple-500" />
                <span className="flex-1">{m.fromWorldName ? `${m.fromWorldName} → ${m.toWorldName}` : `→ ${m.toWorldName}`}</span>
                <Badge variant="outline" className="text-[8px] h-3.5">{m.migrationType}</Badge>
                <span className="text-[9px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Council Tab ───────────────────────────────────────────────────────────

function CouncilTab({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: civData } = useCivilizations();
  const civs = civData?.civilizations ?? [];
  const [selectedWorld, setSelectedWorld] = useState<string | null>(civs[0]?.worldId ?? null);
  const { data: councilData } = useAICouncil(selectedWorld);
  const insights = councilData?.insights ?? [];

  const AGENT_ICONS: Record<string, string> = {
    governor: '🏛️', economy: '💰', culture: '🎭', defense: '⚔️', historian: '📖',
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-purple-500" /> AI Civilization Council</CardTitle>
          <CardDescription className="text-xs">5 AI agents govern each civilization</CardDescription>
        </CardHeader>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {civs.map((civ: any) => (
          <button key={civ.worldId} onClick={() => setSelectedWorld(civ.worldId)} className={`px-3 py-1.5 rounded-lg border-2 text-xs shrink-0 ${selectedWorld === civ.worldId ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'border-border'}`}>
            {civ.civilizationIcon} {civ.worldName}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {insights.map((insight: any, i: number) => (
          <Card key={i}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">{AGENT_ICONS[insight.agent] ?? '🤖'}</span>
                <div className="flex-1">
                  <div className="text-xs font-medium capitalize">{insight.agent} Agent</div>
                  <div className="text-sm font-medium mt-0.5">{insight.title}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{insight.body}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ChevronRight className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] text-purple-600 dark:text-purple-400">{insight.recommendation}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {insights.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Select a civilization to see AI Council insights</p>}
      </div>
    </div>
  );
}

// ─── Civilization Detail ──────────────────────────────────────────────────

function CivilizationDetail({ worldId, onBack }: { worldId: string; onBack: () => void }) {
  const { data, isLoading } = useCivilization(worldId);
  const formRelation = useFormRelation();
  const migrate = useMigrate();
  const { data: civData } = useCivilizations();
  const identity = data?.identity;
  const relations = data?.relations ?? [];
  const trades = data?.trades ?? [];
  const allCivs = civData?.civilizations ?? [];
  const otherCivs = allCivs.filter((c: any) => c.worldId !== worldId);

  const handleAlliance = async (targetId: string, targetName: string) => {
    try {
      await formRelation.mutateAsync({
        fromWorldId: worldId,
        fromWorldName: identity?.worldName ?? '',
        toWorldId: targetId,
        toWorldName: targetName,
        type: 'ALLIANCE',
      });
      toast.success(`Alliance formed with ${targetName}!`);
    } catch (e) {
      toast.error('Diplomacy failed', { description: (e as Error).message });
    }
  };

  const handleTrade = async (targetId: string, targetName: string) => {
    try {
      await formRelation.mutateAsync({
        fromWorldId: worldId,
        fromWorldName: identity?.worldName ?? '',
        toWorldId: targetId,
        toWorldName: targetName,
        type: 'TRADE_AGREEMENT',
      });
      toast.success(`Trade agreement with ${targetName}!`);
    } catch (e) {
      toast.error('Trade failed', { description: (e as Error).message });
    }
  };

  const handleMigrate = async () => {
    try {
      await migrate.mutateAsync({
        userId: 'demo-user',
        displayName: 'Demo Player',
        toWorldId: worldId,
        toWorldName: identity?.worldName ?? '',
        migrationType: 'visit',
      });
      toast.success(`Migrated to ${identity?.worldName}!`);
    } catch (e) {
      toast.error('Migration failed');
    }
  };

  if (isLoading || !identity) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8"><ArrowLeft className="w-4 h-4" /> Back</Button>
          <span className="text-sm font-semibold">{identity.worldName}</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Passport */}
        <Card className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 border-purple-300">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <span className="text-5xl">{identity.civilizationIcon}</span>
              <div className="flex-1">
                <h1 className="text-lg font-bold">{identity.worldName}</h1>
                <p className="text-xs text-muted-foreground">{identity.civilizationLabel} · {identity.era} era</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Founded by {identity.founderName}</p>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <PassportStat label="Citizens" value={identity.population} icon={Users} />
                  <PassportStat label="Influence" value={identity.influenceScore} icon={TrendingUp} />
                  <PassportStat label="Alliances" value={identity.alliancesCount} icon={Handshake} />
                  <PassportStat label="Visitors" value={identity.visitors} icon={Globe} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={handleMigrate} size="sm" className="bg-purple-500 hover:bg-purple-600 text-white">
                <MapPin className="w-3.5 h-3.5" /> Migrate Here
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Culture DNA */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Culture DNA</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(identity.cultureDNA).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="capitalize text-muted-foreground">{key}</span>
                    <span className="font-mono font-semibold">{value as number}</span>
                  </div>
                  <Progress value={value as number} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Relations */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Handshake className="w-4 h-4" /> Diplomacy</CardTitle></CardHeader>
          <CardContent>
            {relations.length > 0 ? (
              <div className="space-y-1 mb-3">
                {relations.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                    <span className="flex-1">{r.toWorldName}</span>
                    <Badge variant="outline" className="text-[8px] h-3.5">{r.type.replace(/_/g, ' ')}</Badge>
                    <span className="text-[9px] text-muted-foreground">strength: {r.strength}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground mb-3">No active relations yet</p>
            )}
            <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Form Relations</div>
            <div className="space-y-1">
              {otherCivs.slice(0, 5).map((civ: any) => (
                <div key={civ.worldId} className="flex items-center gap-2 p-1.5 rounded border border-border">
                  <span className="text-sm">{civ.civilizationIcon}</span>
                  <span className="text-xs flex-1">{civ.worldName}</span>
                  <Button size="sm" variant="outline" className="h-5 text-[9px]" onClick={() => handleAlliance(civ.worldId, civ.worldName)}>🤝 Ally</Button>
                  <Button size="sm" variant="outline" className="h-5 text-[9px]" onClick={() => handleTrade(civ.worldId, civ.worldName)}>📦 Trade</Button>
                </div>
              ))}
              {otherCivs.length === 0 && <p className="text-[10px] text-muted-foreground">No other civilizations to interact with</p>}
            </div>
          </CardContent>
        </Card>

        {/* Trade History */}
        {trades.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Trade History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {trades.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="text-[10px] flex items-center gap-2 p-1.5 rounded border border-border">
                    <span>{t.fromWorldName} → {t.toWorldName}</span>
                    <Badge variant="outline" className="text-[8px] h-3.5">{t.resourceType}</Badge>
                    {t.amount > 0 && <span className="font-mono text-amber-600 dark:text-amber-400">{(t.amount / 1_000_000).toFixed(1)}L</span>}
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

function PassportStat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-purple-500" />
      <div>
        <div className="text-xs font-bold">{value}</div>
        <div className="text-[9px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
