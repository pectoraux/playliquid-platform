'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { useExperiences } from '@/hooks/use-studio';
import {
  useRecommendations, useTrending, usePlayerIdentity, useAllMetrics,
  useEconomySummary, useGenomes, useRunSimulation, useAnalyze,
  useProposals, useApproveProposal, useRecomputeMetrics, useSimulationRuns,
} from '@/hooks/use-world';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Sparkles, TrendingUp, Users, Coins, Dna, FlaskConical,
  Play, Loader2, CheckCircle2, ChevronRight, Activity, Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { FARM_KINGDOM_BUNDLE, FARM_KINGDOM_INTENT, FARM_KINGDOM_DESCRIPTION } from '@/components/studio/farm-kingdom-demo';
import { useCreateDraft, usePublish } from '@/hooks/use-studio';

export function WorldDashboard() {
  const { setView } = useStudioStore();
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('home')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Studio
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white">
              🌍
            </div>
            <div>
              <h1 className="text-sm font-semibold">World Engine</h1>
              <p className="text-[10px] text-muted-foreground">Discovery · Economy · Evolution</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        <Tabs defaultValue="discover">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="discover" className="text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Discover</TabsTrigger>
            <TabsTrigger value="economy" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Economy</TabsTrigger>
            <TabsTrigger value="genomes" className="text-xs gap-1.5"><Dna className="w-3.5 h-3.5" /> Genomes</TabsTrigger>
            <TabsTrigger value="evolution" className="text-xs gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Evolution</TabsTrigger>
            <TabsTrigger value="lab" className="text-xs gap-1.5"><Activity className="w-3.5 h-3.5" /> Lab</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="mt-4"><DiscoverTab /></TabsContent>
          <TabsContent value="economy" className="mt-4"><EconomyTab /></TabsContent>
          <TabsContent value="genomes" className="mt-4"><GenomesTab /></TabsContent>
          <TabsContent value="evolution" className="mt-4"><EvolutionTab selectedId={selectedExperienceId} setSelectedId={setSelectedExperienceId} /></TabsContent>
          <TabsContent value="lab" className="mt-4"><LabTab selectedId={selectedExperienceId} setSelectedId={setSelectedExperienceId} /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid World Engine v0.2 — A self-improving experience economy
      </footer>
    </div>
  );
}

// ─── Discover Tab ──────────────────────────────────────────────────────────

function DiscoverTab() {
  const { data: recData } = useRecommendations();
  const { data: trendData } = useTrending();
  const { data: idData } = usePlayerIdentity();

  return (
    <div className="space-y-6">
      {/* Player Identity */}
      {idData?.identity && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Player Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Sessions</div>
                <div className="font-semibold">{idData.identity.sessionCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Player Score</div>
                <div className="font-semibold">{idData.identity.playerScore}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Trust</div>
                <div className="font-semibold">{idData.identity.trustScore}/100</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Behavior</div>
                <div className="font-semibold capitalize">{idData.identity.playerGenome.socialBehavior}</div>
              </div>
            </div>
            {idData.identity.playerGenome.emotionPreferences.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">Emotions:</span>
                {idData.identity.playerGenome.emotionPreferences.map((e: string) => (
                  <Badge key={e} variant="outline" className="text-[9px] h-4">{e}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Recommended For You</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(recData?.recommendations ?? []).map((rec: any) => (
            <Card key={rec.experienceId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-medium text-sm">{rec.title}</span>
                  <Badge className="text-[10px] h-5 bg-amber-500 text-white">{rec.score}%</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Predicted enjoyment</span>
                    <span className="font-mono">{rec.predictedEnjoyment}%</span>
                  </div>
                  <Progress value={rec.predictedEnjoyment} className="h-1.5" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {rec.reasons.slice(0, 3).map((r: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!recData?.recommendations || recData.recommendations.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
              No recommendations yet. Publish experiences and run simulations to populate the discovery engine.
            </p>
          )}
        </div>
      </div>

      {/* Trending */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Trending</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(trendData?.trending ?? []).map((t: any) => (
            <Card key={t.experienceId} className="min-w-40 shrink-0">
              <CardContent className="p-2">
                <div className="text-xs font-medium truncate">{t.title}</div>
                <div className="text-[10px] text-muted-foreground">{t.reasons[0]}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Economy Tab ───────────────────────────────────────────────────────────

function EconomyTab() {
  const { data: econData } = useEconomySummary();
  const s = econData?.summary;

  if (!s) return <p className="text-sm text-muted-foreground">Loading economy...</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Liquid in Circulation</div><div className="text-xl font-bold text-amber-500">{(s.totalLiquidInCirculation / 1_000_000).toFixed(1)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Creator Earnings</div><div className="text-xl font-bold text-emerald-500">{(s.totalCreatorEarnings / 1_000_000).toFixed(1)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total Sessions</div><div className="text-xl font-bold">{s.totalSessions}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Top Creators</div><div className="text-xl font-bold">{s.topCreators.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4" /> Top Creators</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {s.topCreators.map((c: any, i: number) => (
              <div key={c.creatorId} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <span className="text-sm font-bold w-6">{i + 1}.</span>
                <span className="text-sm flex-1">{c.name}</span>
                <Badge className="bg-amber-500 text-white">{(c.earnings / 1_000_000).toFixed(2)} Liquid</Badge>
              </div>
            ))}
            {s.topCreators.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No creator earnings yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Genomes Tab ───────────────────────────────────────────────────────────

function GenomesTab() {
  const { data: genomeData } = useGenomes();
  const genomes = genomeData?.genomes ?? [];

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Dna className="w-4 h-4" /> Experience Genomes (v2)</CardTitle>
          <CardDescription className="text-xs">The DNA of every experience — complexity, novelty, economy, social, emotion, retention scores</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {genomes.map((g: any) => (
          <Card key={g.bundleHash ?? g.experienceId}>
            <CardContent className="p-3">
              <div className="font-medium text-sm mb-2 truncate">{g.experienceId}</div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <GenomeScore label="Complexity" value={g.complexityScore} color="bg-violet-500" />
                <GenomeScore label="Novelty" value={g.noveltyScore} color="bg-blue-500" />
                <GenomeScore label="Economy" value={g.economyScore} color="bg-amber-500" />
                <GenomeScore label="Social" value={g.socialScore} color="bg-emerald-500" />
                <GenomeScore label="Emotion" value={g.emotionScore} color="bg-rose-500" />
                <GenomeScore label="Retention" value={g.retentionPrediction} color="bg-teal-500" />
              </div>
              <Separator className="my-2" />
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-[9px] h-4">depth {g.compositionDepth}</Badge>
                <Badge variant="outline" className="text-[9px] h-4">{g.tokenCount} tokens</Badge>
                {g.hasEconomy && <Badge className="text-[9px] h-4 bg-amber-500 text-white">econ</Badge>}
                {g.hasAI && <Badge className="text-[9px] h-4 bg-rose-500 text-white">AI</Badge>}
                <span className="text-[9px] text-muted-foreground font-mono ml-auto">{g.extensionDNA?.length ?? 0} DNA</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {genomes.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-4">No genomes computed yet</p>}
      </div>
    </div>
  );
}

function GenomeScore({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-1">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
        <span className="font-mono">{value}</span>
      </div>
    </div>
  );
}

// ─── Evolution Tab ─────────────────────────────────────────────────────────

function EvolutionTab({ selectedId, setSelectedId }: { selectedId: string | null; setSelectedId: (id: string | null) => void }) {
  const { data: expData } = useExperiences();
  const { data: propData } = useProposals(selectedId);
  const analyze = useAnalyze();
  const approve = useApproveProposal();
  const recompute = useRecomputeMetrics();

  const handleAnalyze = async (expId: string) => {
    setSelectedId(expId);
    await recompute.mutateAsync(expId);
    try {
      const result = await analyze.mutateAsync(expId);
      if (result.proposal) {
        toast.success('AI analysis complete', { description: `Predicted lift: +${Math.round(result.proposal.predictedLift * 100)}%` });
      } else if (result.error) {
        toast.info('Analysis note', { description: result.error });
      }
    } catch (e) {
      toast.error('Analysis failed', { description: (e as Error).message });
    }
  };

  const handleApprove = async (proposalId: string) => {
    try {
      const result = await approve.mutateAsync(proposalId);
      if (result.newExperienceId) {
        toast.success('Evolution approved!', { description: 'New fork published as v2' });
      }
    } catch (e) {
      toast.error('Approval failed', { description: (e as Error).message });
    }
  };

  const experiences = expData?.experiences ?? [];
  const proposals = propData?.proposals ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="w-4 h-4 text-purple-500" /> AI Evolution Agent</CardTitle>
          <CardDescription className="text-xs">The AI analyzes metrics and proposes graph improvements. Approve to publish an evolved fork.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {experiences.map((exp: any) => (
          <Card key={exp.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-medium text-sm truncate">{exp.title}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAnalyze(exp.id)} disabled={analyze.isPending && selectedId === exp.id}>
                  {analyze.isPending && selectedId === exp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Analyze
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground">{exp.playCount} plays · {exp.forkCount} forks</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {proposals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Proposals for selected experience</h3>
          <div className="space-y-3">
            {proposals.map((p: any) => (
              <Card key={p.id} className={p.status === 'PENDING' ? 'border-amber-300' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant={p.status === 'PENDING' ? 'default' : 'outline'} className="text-[9px] h-4">{p.status}</Badge>
                    <Badge className="text-[10px] h-5 bg-emerald-500 text-white">+{Math.round(p.predictedLift * 100)}% retention</Badge>
                  </div>

                  <div className="text-xs font-medium mb-1">{p.proposedChanges.summary}</div>

                  <div className="space-y-1 mb-2">
                    {p.analysis.patterns?.map((pat: string, i: number) => (
                      <div key={i} className="text-[10px] text-muted-foreground">• {pat}</div>
                    ))}
                  </div>

                  <div className="space-y-1 mb-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Changes:</div>
                    {p.proposedChanges.changes?.map((c: any, i: number) => (
                      <div key={i} className="text-[10px] font-mono p-1.5 rounded bg-muted/50">
                        {c.instance}: {JSON.stringify(c.config)}
                        <div className="text-muted-foreground mt-0.5">{c.reason}</div>
                      </div>
                    ))}
                  </div>

                  {p.status === 'PENDING' && (
                    <Button size="sm" className="h-7 w-full bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleApprove(p.id)} disabled={approve.isPending}>
                      <CheckCircle2 className="w-3 h-3" /> Approve & Publish v2
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lab Tab ───────────────────────────────────────────────────────────────

function LabTab({ selectedId, setSelectedId }: { selectedId: string | null; setSelectedId: (id: string | null) => void }) {
  const { data: expData } = useExperiences();
  const { data: runsData } = useSimulationRuns(selectedId);
  const simulate = useRunSimulation();
  const recompute = useRecomputeMetrics();
  const createDraft = useCreateDraft();
  const publish = usePublish();
  const { setDraft, setView } = useStudioStore();

  const handleSimulate = async (expId: string, count: number) => {
    setSelectedId(expId);
    try {
      const result = await simulate.mutateAsync({ experienceId: expId, playerCount: count });
      toast.success(`Simulation complete`, { description: `${result.sessionsRun} sessions run` });
      await recompute.mutateAsync(expId);
    } catch (e) {
      toast.error('Simulation failed', { description: (e as Error).message });
    }
  };

  const handleFarmKingdomUniverse = async () => {
    // The full demo: publish Farm Kingdom → simulate 50 players → analyze → evolve
    try {
      // Create + publish Farm Kingdom
      const draft = await createDraft.mutateAsync({
        title: 'Farm Kingdom',
        description: FARM_KINGDOM_DESCRIPTION,
        bundle: JSON.parse(JSON.stringify(FARM_KINGDOM_BUNDLE)),
        intent: FARM_KINGDOM_INTENT,
      });
      const pub = await publish.mutateAsync(draft.draft.id);
      const expId = pub.experience.id;
      setSelectedId(expId);
      toast.success('Farm Kingdom published', { description: 'Starting simulation...' });

      // Simulate 50 players
      const sim = await simulate.mutateAsync({ experienceId: expId, playerCount: 50 });
      toast.success(`${sim.sessionsRun} simulated players completed`, { description: 'Analyzing metrics...' });

      // Recompute metrics
      await recompute.mutateAsync(expId);

      // Switch to evolution tab to show the analysis
      toast.info('Ready for AI Evolution', { description: 'Go to the Evolution tab and click Analyze' });
    } catch (e) {
      toast.error('Demo failed', { description: (e as Error).message });
    }
  };

  const experiences = expData?.experiences ?? [];
  const runs = runsData?.runs ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">🚀 Farm Kingdom Universe Demo</CardTitle>
          <CardDescription className="text-xs">Publishes Farm Kingdom → runs 50 simulated players → captures metrics → ready for AI evolution</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleFarmKingdomUniverse} disabled={simulate.isPending || publish.isPending || createDraft.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
            {simulate.isPending || publish.isPending || createDraft.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-4 h-4" /> Run Farm Kingdom Universe</>
            )}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">Simulate Players</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {experiences.map((exp: any) => (
            <Card key={exp.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-sm truncate">{exp.title}</span>
                  <span className="text-[10px] text-muted-foreground">{exp.playCount} plays</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleSimulate(exp.id, 10)} disabled={simulate.isPending}>
                    10 players
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleSimulate(exp.id, 50)} disabled={simulate.isPending}>
                    50 players
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleSimulate(exp.id, 100)} disabled={simulate.isPending}>
                    100
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {runs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Simulation Runs</h3>
          <div className="space-y-2">
            {runs.map((run: any) => (
              <Card key={run.id}>
                <CardContent className="p-2 flex items-center gap-3">
                  <Badge variant={run.status === 'COMPLETED' ? 'default' : 'outline'} className="text-[9px] h-4">{run.status}</Badge>
                  <span className="text-xs">{run.playerCount} players</span>
                  {run.variantLabel && <Badge variant="outline" className="text-[9px] h-4">variant {run.variantLabel}</Badge>}
                  {run.metrics?.totalSessions != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {run.metrics.totalSessions} sessions · {(run.metrics.completionRate * 100).toFixed(0)}% completion · {run.metrics.tokensEarned} tokens
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
