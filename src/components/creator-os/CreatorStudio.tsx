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
  ArrowLeft, BarChart, Coins, Package, Sparkles, Users, Zap,
  Loader2, TrendingUp, Trophy, Bot, ChevronRight, AlertCircle,
  CheckCircle2, FlaskConical, Clock, GitBranch,
} from 'lucide-react';
import { EvolutionTab } from './EvolutionTab';

const MICRO = 1_000_000;

export function CreatorStudio() {
  const { setView } = useStudioStore();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('home-v2')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white">
              <BarChart className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Creator Studio</h1>
              <p className="text-[10px] text-muted-foreground">Operate your interactive business</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 max-w-3xl">
            <TabsTrigger value="overview" className="text-xs gap-1.5"><BarChart className="w-3.5 h-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="content" className="text-xs gap-1.5"><Package className="w-3.5 h-3.5" /> Content</TabsTrigger>
            <TabsTrigger value="economy" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Economy</TabsTrigger>
            <TabsTrigger value="extensions" className="text-xs gap-1.5"><Zap className="w-3.5 h-3.5" /> Extensions</TabsTrigger>
            <TabsTrigger value="insights" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> AI</TabsTrigger>
            <TabsTrigger value="experiments" className="text-xs gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Experiments</TabsTrigger>
            <TabsTrigger value="evolution" className="text-xs gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Evolution</TabsTrigger>
            <TabsTrigger value="community" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" /> Community</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
          <TabsContent value="content" className="mt-4"><ContentTab /></TabsContent>
          <TabsContent value="economy" className="mt-4"><EconomyTab /></TabsContent>
          <TabsContent value="extensions" className="mt-4"><ExtensionsTab /></TabsContent>
          <TabsContent value="insights" className="mt-4"><InsightsTab /></TabsContent>
          <TabsContent value="experiments" className="mt-4"><ExperimentsTab /></TabsContent>
          <TabsContent value="evolution" className="mt-4"><EvolutionTab /></TabsContent>
          <TabsContent value="community" className="mt-4"><CommunityTab /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Creator Studio — Operate interactive economies powered by PlayLiquid
      </footer>
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/creator-os/overview?creatorId=creator_demo');
      const d = await res.json();
      setData(d);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const ch = data?.channel;
  const rev = data?.revenue;

  return (
    <div className="space-y-4">
      {/* Channel Health */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Players" value={ch?.totalPlayers ?? 0} icon={Users} color="text-blue-500" />
        <StatCard label="Followers" value={ch?.followers ?? 0} icon={Trophy} color="text-amber-500" />
        <StatCard label="Revenue" value={`${(ch?.totalRevenueLiquid ?? 0).toFixed(1)}L`} icon={Coins} color="text-emerald-500" />
        <StatCard label="Experiences" value={ch?.totalExperiences ?? 0} icon={Package} color="text-violet-500" />
      </div>

      {/* AI Summary */}
      {data?.insights?.length > 0 && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Creator Copilot</span>
            </div>
            {data.insights.slice(0, 3).map((insight: any, i: number) => (
              <div key={i} className="text-xs mb-2 last:mb-0">
                <div className="font-medium">{insight.problem}</div>
                <p className="text-[10px] text-muted-foreground">{insight.evidence}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ChevronRight className="w-2.5 h-2.5 text-amber-500" />
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">{insight.recommendation}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Revenue Breakdown */}
      {rev && rev.bySource.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {rev.bySource.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.source.replace(/_/g, ' ')}</span>
                  <span className="font-mono font-semibold">{s.amountLiquid}L ({s.percent}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContentTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/creator-os/overview?creatorId=creator_demo');
      const d = await res.json();
      setData(d);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const content = data?.content ?? [];

  return (
    <div className="space-y-2">
      {content.map((exp: any) => (
        <Card key={exp.experienceId}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{exp.title}</span>
                  <Badge variant="outline" className="text-[8px] h-3.5">{exp.format}</Badge>
                  {exp.competitiveEligible && <Badge className="text-[8px] h-3.5 bg-emerald-500 text-white">🏆</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>{exp.playCount} plays</span>
                  <span>·</span>
                  <span>{exp.completionRate}% complete</span>
                  <span>·</span>
                  <span>{exp.extensions.length} extensions</span>
                </div>
                {/* Extension pills */}
                <div className="flex gap-0.5 mt-1 flex-wrap">
                  {exp.extensions.map((ext: any, i: number) => (
                    <span key={i} className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground" title={ext.name}>{ext.icon}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="outline" className="h-6 text-[10px]"><GitBranch className="w-3 h-3" /> Fork</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {content.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No published content yet</p>}
    </div>
  );
}

function EconomyTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/creator-os/revenue?creatorId=creator_demo');
      const d = await res.json();
      setData(d.economy);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Royalty Paid" value={`${(data?.totalRoyaltyPaidXof ?? 0) / MICRO}L`} icon={Coins} color="text-red-500" />
        <StatCard label="Royalty Received" value={`${(data?.totalRoyaltyReceivedXof ?? 0) / MICRO}L`} icon={Coins} color="text-emerald-500" />
        <StatCard label="Net Royalty" value={`${(data?.revenueImpact?.netRoyaltyLiquid ?? 0)}L`} icon={TrendingUp} color="text-amber-500" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Extension Dependencies</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            {(data?.extensions ?? []).map((ext: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                <span className="text-lg">{ext.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{ext.name}</div>
                  <div className="text-[9px] text-muted-foreground">by {ext.creatorName} · {ext.usedInExperiences.length} experiences</div>
                </div>
                <Badge variant="outline" className="text-[8px] h-3.5">{ext.royaltyBps / 100}% royalty</Badge>
              </div>
            ))}
            {(data?.extensions ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No extensions installed</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExtensionsTab() {
  return (
    <Card><CardContent className="py-8 text-center">
      <Zap className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">Browse and install extensions from the Extension Universe</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/'}>
        Open Extension Universe
      </Button>
    </CardContent></Card>
  );
}

function InsightsTab() {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/creator-os/insights?creatorId=creator_demo');
      const d = await res.json();
      setInsights(d.insights ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const SEVERITY_COLORS: Record<string, string> = {
    info: 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30',
    suggestion: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
    warning: 'border-orange-300 bg-orange-50 dark:bg-orange-950/30',
    critical: 'border-red-300 bg-red-50 dark:bg-red-950/30',
  };

  return (
    <div className="space-y-2">
      {insights.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><Bot className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">No AI insights yet. Run the AI Team from the Creator Intelligence dashboard.</p></CardContent></Card>
      ) : (
        insights.map((insight: any, i: number) => (
          <Card key={i} className={SEVERITY_COLORS[insight.severity] ?? ''}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{insight.problem}</span>
                    <Badge variant="outline" className="text-[8px] h-3.5">{insight.category}</Badge>
                    <Badge variant="outline" className="text-[8px] h-3.5">{insight.reportType}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{insight.evidence}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ChevronRight className="w-2.5 h-2.5 text-amber-500" />
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">{insight.recommendation}</span>
                  </div>
                  {insight.expectedImpact && <span className="text-[9px] text-emerald-600 dark:text-emerald-400">📈 {insight.expectedImpact}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ExperimentsTab() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/creator-os/experiments?creatorId=creator_demo');
      const d = await res.json();
      setExperiments(d.experiments ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-2">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="w-4 h-4 text-amber-500" /> Experiments</CardTitle><CardDescription className="text-xs">Test variants and let AI recommend the winner</CardDescription></CardHeader></Card>
      {experiments.length === 0 ? (
        <Card><CardContent className="py-6 text-center"><FlaskConical className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">No experiments yet. Create A/B tests to optimize your experiences.</p></CardContent></Card>
      ) : (
        experiments.map((exp: any) => (
          <Card key={exp.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{exp.name}</span>
                <Badge variant="outline" className="text-[8px] h-3.5">{exp.status}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{exp.hypothesis}</p>
              {exp.winner && <Badge className="text-[8px] h-3.5 mt-1 bg-emerald-500 text-white">Winner: {exp.winner}</Badge>}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function CommunityTab() {
  return (
    <Card><CardContent className="py-8 text-center">
      <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">Community management tools</p>
      <p className="text-xs text-muted-foreground mt-1">Posts, challenges, polls, and events for your audience</p>
    </CardContent></Card>
  );
}

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
