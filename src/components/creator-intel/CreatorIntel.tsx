'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  useRunAITeam, useInsights, useAcceptInsight, useDismissInsight,
  useEvolution, useCreatorReputation, useGameEconomy,
  useMarketplace, useSeedMarketplace,
} from '@/hooks/use-creator-intel';
import { useExperiences } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Loader2, Sparkles, Rocket, TrendingUp, Coins, Package,
  Check, X, Zap, Users, Palette, Scale, BookOpen, Bot,
} from 'lucide-react';
import { toast } from 'sonner';

const AGENT_ICONS: Record<string, string> = {
  designer: '🎨', economy: '💰', balance: '⚖️', community: '👥', growth: '📈', narrative: '📖',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30',
  suggestion: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
  warning: 'border-orange-300 bg-orange-50 dark:bg-orange-950/30',
  critical: 'border-red-300 bg-red-50 dark:bg-red-950/30',
};

export function CreatorIntel() {
  const { setView } = useStudioStore();
  const { data: expData } = useExperiences();
  const experiences = expData?.experiences ?? [];
  const [selectedExp, setSelectedExp] = useState<string | null>(experiences[0]?.id ?? null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('universe')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">AI</div>
            <div>
              <h1 className="text-sm font-semibold">Creator Intelligence</h1>
              <p className="text-[10px] text-muted-foreground">Your AI-native studio team</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        {/* Experience selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {experiences.map((exp: any) => (
            <button key={exp.id} onClick={() => setSelectedExp(exp.id)}
              className={`px-3 py-1.5 rounded-lg border-2 text-xs shrink-0 ${selectedExp === exp.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}>
              {exp.title}
            </button>
          ))}
        </div>

        <Tabs defaultValue="team">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="team" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> AI Team</TabsTrigger>
            <TabsTrigger value="evolution" className="text-xs gap-1.5"><Rocket className="w-3.5 h-3.5" /> Evolution</TabsTrigger>
            <TabsTrigger value="economy" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Economy</TabsTrigger>
            <TabsTrigger value="reputation" className="text-xs gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Reputation</TabsTrigger>
            <TabsTrigger value="marketplace" className="text-xs gap-1.5"><Package className="w-3.5 h-3.5" /> Market</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="mt-4">{selectedExp && <AITeamTab experienceId={selectedExp} />}</TabsContent>
          <TabsContent value="evolution" className="mt-4">{selectedExp && <EvolutionTab experienceId={selectedExp} />}</TabsContent>
          <TabsContent value="economy" className="mt-4">{selectedExp && <EconomyTab experienceId={selectedExp} />}</TabsContent>
          <TabsContent value="reputation" className="mt-4"><ReputationTab /></TabsContent>
          <TabsContent value="marketplace" className="mt-4"><MarketplaceTab /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Creator Intelligence v0.48 — Your AI studio team
      </footer>
    </div>
  );
}

// ─── AI Team Tab ───────────────────────────────────────────────────────────

function AITeamTab({ experienceId }: { experienceId: string }) {
  const { data } = useInsights('creator_demo', experienceId);
  const runTeam = useRunAITeam();
  const accept = useAcceptInsight();
  const dismiss = useDismissInsight();

  const insights = data?.insights ?? [];

  // Group by agent type
  const grouped: Record<string, any[]> = {};
  for (const i of insights) {
    (grouped[i.agentType] ??= []).push(i);
  }

  const handleRun = async () => {
    try {
      const result = await runTeam.mutateAsync({ creatorId: 'creator_demo', experienceId });
      toast.success(`AI Team analyzed!`, { description: `${result.insights.length} insights generated` });
    } catch (e) {
      toast.error('Analysis failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={handleRun} disabled={runTeam.isPending} className="w-full bg-amber-500 hover:bg-amber-600 text-white h-9">
        {runTeam.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Running AI Team...</> : <><Sparkles className="w-4 h-4" /> Run AI Team Analysis</>}
      </Button>

      {insights.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">Click "Run AI Team" to generate insights</p></CardContent></Card>
      ) : (
        Object.entries(grouped).map(([agentType, agentInsights]) => (
          <Card key={agentType}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-lg">{AGENT_ICONS[agentType] ?? '🤖'}</span>
                {agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent
                <Badge variant="outline" className="text-[9px] h-4">{agentInsights.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agentInsights.map((insight: any) => (
                <div key={insight.id} className={`p-2 rounded-lg border ${SEVERITY_COLORS[insight.severity] ?? ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-medium">{insight.title}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{insight.body}</p>
                      {insight.actionSuggestion && (
                        <div className="flex items-center gap-1 mt-1">
                          <Zap className="w-2.5 h-2.5 text-amber-500" />
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">{insight.actionSuggestion}</span>
                        </div>
                      )}
                      {insight.expectedImpact && (
                        <div className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">📈 {insight.expectedImpact}</div>
                      )}
                    </div>
                    {insight.status === 'PENDING' && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-500" onClick={() => accept.mutate(insight.id)}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => dismiss.mutate(insight.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {insight.status !== 'PENDING' && (
                      <Badge variant="outline" className="text-[8px] h-3.5 shrink-0">{insight.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ─── Evolution Tab ─────────────────────────────────────────────────────────

function EvolutionTab({ experienceId }: { experienceId: string }) {
  const { data } = useEvolution(experienceId);
  const evolution = data;

  if (!evolution) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Rocket className="w-4 h-4 text-amber-500" /> Game Evolution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{evolution.current.icon}</span>
            <div>
              <div className="text-sm font-bold">{evolution.current.label}</div>
              <p className="text-[10px] text-muted-foreground">{evolution.current.description}</p>
            </div>
          </div>
          {evolution.next && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Next: {evolution.next.icon} {evolution.next.label}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {evolution.plan && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolution Plan</CardTitle>
            <CardDescription className="text-xs">
              Projected: +{Math.round(evolution.plan.projectedRetention * 100)}% retention · +{evolution.plan.projectedRevenue.toFixed(0)}L revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {evolution.plan.steps.map((step: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded border border-border">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'}`}>
                    {step.status === 'PENDING' ? i + 1 : '✓'}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium">{step.step}</div>
                    <p className="text-[10px] text-muted-foreground">{step.description}</p>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400">{step.projectedImpact}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Economy Tab ───────────────────────────────────────────────────────────

function EconomyTab({ experienceId }: { experienceId: string }) {
  const { data } = useGameEconomy(experienceId);
  const economy = data?.economy;

  if (!economy) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Creator Share</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {(economy.creatorShare / 1_000_000).toFixed(2)} L
          </div>
          <div className="text-[10px] text-muted-foreground">from {(economy.minuteVolume / 1_000_000).toFixed(1)}L total volume</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <EconStat label="Players" value={economy.players} />
        <EconStat label="Daily Active" value={economy.dailyActive} />
        <EconStat label="Tokens" value={economy.tokensInCirculation} />
        <EconStat label="Market Actions" value={economy.marketActions} />
      </div>

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Leaderboard Activity</span><Badge variant="outline">{economy.leaderboardActivity}</Badge></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Prize Pool Health</span><Badge variant="outline">{economy.prizePoolHealth}</Badge></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Retention Rate</span><span className="font-mono">{economy.retention}%</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

function EconStat({ label, value }: { label: string; value: number }) {
  return (
    <Card><CardContent className="p-2 text-center"><div className="text-sm font-bold">{value}</div><div className="text-[9px] text-muted-foreground">{label}</div></CardContent></Card>
  );
}

// ─── Reputation Tab ────────────────────────────────────────────────────────

function ReputationTab() {
  const { data } = useCreatorReputation();
  const rep = data?.reputation;

  if (!rep) return <p className="text-sm text-muted-foreground">Loading...</p>;

  const dims = [
    { label: 'Innovation', value: rep.innovation, icon: '💡', color: 'bg-violet-500' },
    { label: 'Player Love', value: rep.playerLove, icon: '❤️', color: 'bg-rose-500' },
    { label: 'Fair Economy', value: rep.fairEconomy, icon: '⚖️', color: 'bg-amber-500' },
    { label: 'Community', value: rep.community, icon: '👥', color: 'bg-emerald-500' },
    { label: 'Evolution Speed', value: rep.evolutionSpeed, icon: '⚡', color: 'bg-blue-500' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Creator Reputation</CardTitle>
        <CardDescription className="text-xs">Multi-dimensional reputation across the platform</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-amber-500">{rep.overall}</div>
          <div className="text-[10px] text-muted-foreground">Overall Score</div>
        </div>
        <div className="space-y-3">
          {dims.map((d) => (
            <div key={d.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1"><span>{d.icon}</span>{d.label}</span>
                <span className="font-mono font-semibold">{d.value}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${d.color}`} style={{ width: `${d.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Marketplace Tab ───────────────────────────────────────────────────────

function MarketplaceTab() {
  const { data } = useMarketplace();
  const seed = useSeedMarketplace();
  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center space-y-3">
        <Package className="w-8 h-8 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Marketplace is empty</p>
        <Button onClick={() => seed.mutateAsync()} disabled={seed.isPending} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
          {seed.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Seed Marketplace
        </Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item: any) => (
        <Card key={item.id}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  <Badge variant="outline" className="text-[8px] h-3.5">{item.type}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                  <span className="text-muted-foreground">Used by {item.usedByCount}</span>
                  <span className="text-amber-600 dark:text-amber-400">⭐ {item.rating}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">+{item.revenueImpact}% revenue</span>
                  <Badge variant="outline" className="text-[8px] h-3.5">{item.priceRoyaltyBps / 100}% royalty</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
