'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Network, Loader2, Sparkles, Brain, GitBranch, Trophy,
  Zap, TrendingUp, AlertCircle, CheckCircle2, ChevronRight, Bot,
  Users, Coins, Activity, RefreshCw, Wand2, Target,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Overview {
  totals: { experiences: number; creators: number; compositionPatterns: number; coPlayEdges: number; feedbackEntries: number };
  avgQualityScore: number;
  topGenomes: GenomeEntry[];
  topCreators: CreatorEntry[];
  topPatterns: PatternEntry[];
  topCoPlayEdges: CoPlayEdgeEntry[];
}

interface GenomeEntry {
  experienceId: string;
  experienceName: string;
  mechanics: string[];
  compositionDepth: number;
  hasEconomy: boolean;
  hasCompetition: boolean;
  hasAI: boolean;
  emotionalProfile: Record<string, number>;
  dominantEmotion: string | null;
  economyProfile: { entryPriceXof: number; monetization: string; retention: number; tokenVelocity: number };
  audienceProfile: { avgSkill: number; socialBehavior: string; segment: string; size: number };
  noveltyScore: number;
  qualityScore: number;
  maturityScore: number;
}

interface CreatorEntry {
  creatorId: string;
  creatorName: string;
  retentionQuality: number;
  evolutionVelocity: number;
  extensionAdoption: number;
  fairness: number;
  communityHealth: number;
  economicSustainability: number;
  overallIntelligence: number;
  tier: string;
  signals: string[];
}

interface PatternEntry {
  patternSignature: string;
  extensions: string[];
  extensionNames: string[];
  occurrenceCount: number;
  avgCompletion: number;
  avgRetention: number;
  avgReputation: number;
  context: string;
  recommendation: string | null;
}

interface CoPlayEdgeEntry {
  experienceA: string;
  experienceB: string;
  experienceBName: string;
  sharedPlayers: number;
  coPlayScore: number;
  sharedExtensions: string[];
  sharedMechanics: string[];
}

interface AgentInsight {
  id: string;
  creatorId: string;
  experienceId?: string;
  experienceName?: string;
  agentType: 'design' | 'economy' | 'growth' | 'community';
  insightType: string;
  title: string;
  body: string;
  actionSuggestion?: string;
  expectedImpact?: string;
  confidence: number;
  severity: string;
  status: string;
  surfacedAt: number;
}

const AGENT_META: Record<string, { name: string; icon: string; color: string }> = {
  design: { name: 'Design Agent', icon: '🎨', color: 'text-violet-500' },
  economy: { name: 'Economy Agent', icon: '💰', color: 'text-emerald-500' },
  growth: { name: 'Growth Agent', icon: '📈', color: 'text-amber-500' },
  community: { name: 'Community Agent', icon: '👥', color: 'text-pink-500' },
};

const TIER_COLORS: Record<string, string> = {
  emerging: 'bg-muted text-muted-foreground',
  growing: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  established: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  leading: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'border-blue-300 bg-blue-50 dark:bg-blue-950/30',
  suggestion: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
  warning: 'border-orange-300 bg-orange-50 dark:bg-orange-950/30',
  critical: 'border-red-300 bg-red-50 dark:bg-red-950/30',
};

// ─── fetch helpers (retry for dev cold-start) ──────────────────────────────

async function fetchJSON<T = any>(url: string, retries = 2): Promise<T> {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return fetchJSON<T>(url, retries - 1);
    }
    throw err;
  }
}

async function postJSON<T = any>(url: string, body?: unknown, retries = 2): Promise<T> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return postJSON<T>(url, body, retries - 1);
    }
    throw err;
  }
}

// ─── Main component ────────────────────────────────────────────────────────

export function NetworkIntelligence() {
  const { setView } = useStudioStore();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchJSON<Overview>('/api/intelligence/overview');
      setOverview(d);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const seed = async () => {
    setSeeding(true);
    try {
      await postJSON('/api/intelligence/seed');
      await load();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('home-v2')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-fuchsia-600 flex items-center justify-center text-white">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Network Intelligence</h1>
              <p className="text-[10px] text-muted-foreground">The intelligence layer coordinating experiences, creators & players</p>
            </div>
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={seed} disabled={seeding}>
              {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {seeding ? 'Computing…' : 'Recompute All'}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {/* Totals */}
            {overview && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Experiences" value={overview.totals.experiences} icon={GitBranch} color="text-violet-500" />
                <StatCard label="Creators" value={overview.totals.creators} icon={Users} color="text-amber-500" />
                <StatCard label="Patterns" value={overview.totals.compositionPatterns} icon={Zap} color="text-emerald-500" />
                <StatCard label="Co-Play Edges" value={overview.totals.coPlayEdges} icon={Network} color="text-cyan-500" />
                <StatCard label="Avg Quality" value={`${overview.avgQualityScore}`} icon={Target} color="text-pink-500" />
              </div>
            )}

            <Tabs defaultValue="genomes">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
                <TabsTrigger value="genomes" className="text-xs gap-1.5"><Brain className="w-3.5 h-3.5" /> Genomes</TabsTrigger>
                <TabsTrigger value="discovery" className="text-xs gap-1.5"><Network className="w-3.5 h-3.5" /> Discovery</TabsTrigger>
                <TabsTrigger value="creators" className="text-xs gap-1.5"><Trophy className="w-3.5 h-3.5" /> Creators</TabsTrigger>
                <TabsTrigger value="patterns" className="text-xs gap-1.5"><Zap className="w-3.5 h-3.5" /> Patterns</TabsTrigger>
                <TabsTrigger value="agents" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> Agents</TabsTrigger>
              </TabsList>

              <TabsContent value="genomes" className="mt-4"><GenomesSection genomes={overview?.topGenomes ?? []} /></TabsContent>
              <TabsContent value="discovery" className="mt-4"><DiscoverySection edges={overview?.topCoPlayEdges ?? []} /></TabsContent>
              <TabsContent value="creators" className="mt-4"><CreatorsSection creators={overview?.topCreators ?? []} /></TabsContent>
              <TabsContent value="patterns" className="mt-4"><PatternsSection patterns={overview?.topPatterns ?? []} /></TabsContent>
              <TabsContent value="agents" className="mt-4"><AgentsSection /></TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Network Intelligence — Coordinating millions of experiences, creators & players
      </footer>
    </div>
  );
}

// ─── Genomes section ───────────────────────────────────────────────────────

function GenomesSection({ genomes }: { genomes: GenomeEntry[] }) {
  if (genomes.length === 0) {
    return <EmptyState icon={Brain} title="No genomes computed yet" hint="Click 'Recompute All' to compute the Experience Genome for every published experience." />;
  }
  return (
    <div className="space-y-2">
      {genomes.map((g) => <GenomeCard key={g.experienceId} genome={g} />)}
    </div>
  );
}

function GenomeCard({ genome }: { genome: GenomeEntry }) {
  const emotions = Object.entries(genome.emotionalProfile)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{genome.experienceName}</span>
            {genome.dominantEmotion && <Badge variant="outline" className="text-[8px] h-3.5">{genome.dominantEmotion}</Badge>}
          </div>
          <div className="flex items-center gap-1.5">
            <ScoreChip label="Novelty" value={genome.noveltyScore} color="text-cyan-500" />
            <ScoreChip label="Quality" value={genome.qualityScore} color="text-emerald-500" />
            <ScoreChip label="Maturity" value={genome.maturityScore} color="text-amber-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
          {/* Mechanics */}
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> Mechanics ({genome.compositionDepth})</div>
            <div className="flex flex-wrap gap-0.5">
              {genome.mechanics.map((m) => (
                <Badge key={m} variant="secondary" className="text-[7px] h-3 px-1 font-mono">{m.replace('pl.', '')}</Badge>
              ))}
            </div>
            <div className="flex gap-1 mt-1">
              {genome.hasEconomy && <Badge className="text-[7px] h-3 bg-emerald-500 text-white">Economy</Badge>}
              {genome.hasCompetition && <Badge className="text-[7px] h-3 bg-amber-500 text-white">Competitive</Badge>}
              {genome.hasAI && <Badge className="text-[7px] h-3 bg-violet-500 text-white">AI</Badge>}
            </div>
          </div>

          {/* Emotional profile */}
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1"><Brain className="w-2.5 h-2.5" /> Emotional Profile</div>
            {emotions.length > 0 ? emotions.slice(0, 3).map(([emo, val]) => (
              <div key={emo} className="flex items-center gap-1.5 mb-0.5">
                <span className="w-16 text-muted-foreground capitalize">{emo}</span>
                <Progress value={val * 100} className="h-1 flex-1" />
                <span className="w-6 text-right">{Math.round(val * 100)}</span>
              </div>
            )) : <span className="text-muted-foreground/60">No data</span>}
          </div>

          {/* Audience + Economy */}
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Audience & Economy</div>
            <div className="space-y-0.5 text-muted-foreground">
              <div>Segment: <span className="font-medium text-foreground">{genome.audienceProfile.segment}</span> · {genome.audienceProfile.socialBehavior}</div>
              <div>Avg skill: <span className="font-medium text-foreground">{genome.audienceProfile.avgSkill}/100</span> · {genome.audienceProfile.size} players</div>
              <div>Monetization: <span className="font-medium text-foreground">{genome.economyProfile.monetization}</span></div>
              <div>Token velocity: <span className="font-medium text-foreground">{genome.economyProfile.tokenVelocity.toFixed(1)}/session</span></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Discovery section ─────────────────────────────────────────────────────

function DiscoverySection({ edges }: { edges: CoPlayEdgeEntry[] }) {
  if (edges.length === 0) {
    return <EmptyState icon={Network} title="No co-play edges yet" hint="Players need to play multiple experiences before the discovery graph forms. Click 'Recompute All'." />;
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Network className="w-4 h-4 text-cyan-500" /> Discovery Graph</CardTitle>
        <CardDescription className="text-xs">"Players who played X also played Y" — collaborative filtering from session co-occurrence</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {edges.map((e, i) => (
            <div key={i} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">{e.experienceA.slice(-6)}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium">{e.experienceBName}</span>
                <Badge variant="outline" className="text-[8px] h-3.5 ml-auto">{e.sharedPlayers} shared</Badge>
                <Badge className="text-[8px] h-3.5 bg-cyan-500 text-white">{Math.round(e.coPlayScore * 100)}% match</Badge>
              </div>
              {e.sharedExtensions.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  <span className="text-[9px] text-muted-foreground">Shared:</span>
                  {e.sharedExtensions.map((ext) => (
                    <Badge key={ext} variant="secondary" className="text-[7px] h-3 px-1 font-mono">{ext.replace('pl.', '')}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Creators section ──────────────────────────────────────────────────────

function CreatorsSection({ creators }: { creators: CreatorEntry[] }) {
  if (creators.length === 0) {
    return <EmptyState icon={Trophy} title="No creator scores yet" hint="Click 'Recompute All' to score every creator across 6 intelligence dimensions." />;
  }
  return (
    <div className="space-y-2">
      {creators.map((c, i) => <CreatorCard key={c.creatorId} creator={c} rank={i + 1} />)}
    </div>
  );
}

function CreatorCard({ creator, rank }: { creator: CreatorEntry; rank: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${rank <= 3 ? 'bg-amber-400 text-white' : 'bg-muted text-muted-foreground'}`}>{rank}</div>
            <span className="text-sm font-medium">{creator.creatorName}</span>
            <Badge className={`text-[8px] h-3.5 ${TIER_COLORS[creator.tier]}`}>{creator.tier}</Badge>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{creator.overallIntelligence}</div>
            <div className="text-[9px] text-muted-foreground">/ 100</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          <DimBar label="Retention" value={creator.retentionQuality} color="bg-emerald-500" />
          <DimBar label="Evolution" value={creator.evolutionVelocity} color="bg-violet-500" />
          <DimBar label="Extensions" value={creator.extensionAdoption} color="bg-amber-500" />
          <DimBar label="Fairness" value={creator.fairness} color="bg-cyan-500" />
          <DimBar label="Community" value={creator.communityHealth} color="bg-pink-500" />
          <DimBar label="Economy" value={creator.economicSustainability} color="bg-blue-500" />
        </div>

        {creator.signals.length > 0 && (
          <div className="pt-2 border-t border-border space-y-0.5">
            {creator.signals.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-1 text-[10px]">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{s}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Patterns section ──────────────────────────────────────────────────────

function PatternsSection({ patterns }: { patterns: PatternEntry[] }) {
  if (patterns.length === 0) {
    return <EmptyState icon={Zap} title="No composition patterns yet" hint="Click 'Recompute All' to mine successful extension combinations across the network." />;
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Extension Composition Patterns</CardTitle>
        <CardDescription className="text-xs">Mined patterns: "experiences with {`{X, Y, Z}`} have N% avg completion"</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {patterns.map((p) => (
            <div key={p.patternSignature} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                {p.extensionNames.map((name, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{name}</span>
                ))}
                {i_renderSeparator(p.extensionNames.length)}
              </div>
              <div className="flex items-center gap-3 text-[10px] mb-1">
                <Badge variant="outline" className="text-[8px] h-3.5">{p.occurrenceCount} uses</Badge>
                <Badge variant="outline" className="text-[8px] h-3.5">{Math.round(p.avgCompletion * 100)}% completion</Badge>
                <Badge variant="outline" className="text-[8px] h-3.5">{Math.round(p.avgReputation)}/100 rep</Badge>
                {p.context !== 'any' && <Badge className="text-[8px] h-3.5 bg-amber-500 text-white">{p.context}</Badge>}
              </div>
              {p.recommendation && (
                <div className="flex items-start gap-1 text-[10px] mt-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground italic">{p.recommendation}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function i_renderSeparator(_n: number) {
  return null;
}

// ─── Agents section ────────────────────────────────────────────────────────

function AgentsSection() {
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<{ insights: AgentInsight[] }>('/api/intelligence/agents/creator_demo?limit=30');
        if (!cancelled) {
          setInsights(d.insights ?? []);
          // If no insights, try the real creator with published experiences
          if ((d.insights ?? []).length === 0) {
            const fallback = await fetchJSON<{ insights: AgentInsight[] }>('/api/intelligence/agents/cmsbbvple0000u847xdhj91wa?limit=30');
            if (!cancelled) setInsights(fallback.insights ?? []);
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadToken]);

  const runAgents = async () => {
    setRunning(true);
    try {
      // Run for creator_demo, and if that has no experiences, run for the real creator
      await postJSON('/api/intelligence/agents/creator_demo/run');
      await postJSON('/api/intelligence/agents/cmsbbvple0000u847xdhj91wa/run').catch(() => {});
      reload();
    } finally {
      setRunning(false);
    }
  };

  const setInsightStatus = async (id: string, status: 'SEEN' | 'ACTED' | 'DISMISSED') => {
    await postJSON(`/api/intelligence/agents/insight/${id}`, { status });
    reload();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-violet-500" /> Autonomous Creator Agents</CardTitle>
            <CardDescription className="text-xs">Proactive insights from 4 AI agents monitoring your experiences</CardDescription>
          </div>
          <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={runAgents} disabled={running}>
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {running ? 'Running…' : 'Run Agents'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : insights.length === 0 ? (
          <EmptyState icon={Bot} title="No agent insights yet" hint="Click 'Run Agents' to have the Design, Economy, Growth & Community agents diagnose your experiences." />
        ) : (
          <ScrollArea className="max-h-[32rem]">
            <div className="space-y-2 pr-2">
              {insights.map((insight) => (
                <AgentInsightCard key={insight.id} insight={insight} onStatus={setInsightStatus} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function AgentInsightCard({ insight, onStatus }: { insight: AgentInsight; onStatus: (id: string, status: 'SEEN' | 'ACTED' | 'DISMISSED') => void }) {
  const meta = AGENT_META[insight.agentType] ?? AGENT_META.design;
  return (
    <div className={`rounded-lg border p-2.5 ${SEVERITY_COLORS[insight.severity] ?? 'border-border'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{meta.icon}</span>
        <span className={`text-[9px] font-medium ${meta.color}`}>{meta.name}</span>
        <Badge variant="outline" className="text-[7px] h-3">{insight.insightType}</Badge>
        <Badge variant="outline" className="text-[7px] h-3 ml-auto">{Math.round(insight.confidence * 100)}% confidence</Badge>
      </div>
      <div className="text-xs font-medium mb-0.5">{insight.title}</div>
      <p className="text-[10px] text-muted-foreground">{insight.body}</p>
      {insight.experienceName && <div className="text-[9px] text-muted-foreground/70 mt-0.5">on "{insight.experienceName}"</div>}
      {insight.actionSuggestion && (
        <div className="flex items-start gap-1 mt-1">
          <ChevronRight className="w-2.5 h-2.5 text-amber-500 mt-0.5 shrink-0" />
          <span className="text-[10px] text-amber-700 dark:text-amber-400">{insight.actionSuggestion}</span>
        </div>
      )}
      {insight.expectedImpact && (
        <div className="flex items-center gap-1 mt-0.5">
          <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{insight.expectedImpact}</span>
        </div>
      )}
      <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/50">
        <Button size="sm" variant="outline" className="h-5 text-[9px] gap-1" onClick={() => onStatus(insight.id, 'ACTED')}>
          <CheckCircle2 className="w-2.5 h-2.5" /> Act
        </Button>
        <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-1 text-muted-foreground" onClick={() => onStatus(insight.id, 'DISMISSED')}>
          Dismiss
        </Button>
        <span className="text-[8px] text-muted-foreground/60 ml-auto">{new Date(insight.surfacedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// ─── shared ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ScoreChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-bold ${color}`}>{Math.round(value)}</span>
    </div>
  );
}

function DimBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground">{label}</span>
        <span className="text-[9px] font-medium">{Math.round(value)}</span>
      </div>
      <Progress value={value} className={`h-1 ${color}`} />
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <Icon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}
