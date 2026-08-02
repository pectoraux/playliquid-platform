'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, Sparkles, Activity, FlaskConical, GitBranch, TrendingUp,
  AlertCircle, CheckCircle2, XCircle, Brain, Zap, Trophy, Clock,
  ChevronRight, Beaker, Wand2, MessageSquare,
} from 'lucide-react';

interface ExperienceListItem {
  experienceId: string;
  title: string;
  format: string;
  playCount: number;
  completionRate: number;
  mutationCount: number;
  proposalCount: number;
  feedbackCount: number;
  publishedAt: number;
}

interface Health {
  experienceId: string;
  experienceName: string;
  overall: number;
  retention: { score: number; label: string };
  competition: { score: number; label: string };
  economy: { score: number; label: string };
  community: { score: number; label: string };
  evolution: { score: number; label: string };
  signals: string[];
}

interface Proposal {
  id: string;
  experienceId: string;
  experienceName: string;
  problem: string;
  evidence: string;
  affectedExtensions: string[];
  graphChanges: Array<{
    mutationType: string;
    instance?: string;
    extensionId?: string;
    config?: Record<string, unknown>;
    reason: string;
  }>;
  expectedImpact: string;
  confidenceScore: number;
  predictedLift: number;
  status: string;
  mutationId?: string;
  createdAt: number;
  analysis: {
    patterns: string[];
    bottlenecks: string[];
    strengths: string[];
    diagnosis: string;
    hypothesis: string;
  };
}

interface ExperimentRun {
  id: string;
  variantA: string;
  variantB: string;
  winner: 'A' | 'B' | 'TIE' | null;
  status: string;
  metrics: {
    A: Record<string, number>;
    B: Record<string, number>;
    delta: Record<string, number>;
  };
  createdAt: number;
  mutationId?: string;
}

interface TimelineEntry {
  version: string;
  versionNumber: number;
  changeSummary: string;
  changeType: 'CREATED' | 'EVOLUTION' | 'EXPERIMENT_WIN' | 'MANUAL_FORK' | 'ROLLBACK';
  impact?: string;
  createdAt: number;
}

interface MutationItem {
  id: string;
  mutationType: string;
  status: string;
  creatorApproved: boolean;
  createdAt: number;
  diff: {
    addedInstances: string[];
    removedInstances: string[];
    configChanges: Array<{ instance: string; key: string; before: unknown; after: unknown }>;
    wireChanges: { added: unknown[]; removed: unknown[] };
    mutationTypes: string[];
  };
}

const STATUS_COLORS: Record<string, string> = {
  DISCOVERED: 'border-blue-300 bg-blue-50 dark:bg-blue-950/30',
  PROPOSED: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
  CREATOR_REVIEW: 'border-violet-300 bg-violet-50 dark:bg-violet-950/30',
  EXPERIMENTING: 'border-cyan-300 bg-cyan-50 dark:bg-cyan-950/30',
  APPROVED: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30',
  REJECTED: 'border-red-300 bg-red-50 dark:bg-red-950/30',
  ROLLED_BACK: 'border-orange-300 bg-orange-50 dark:bg-orange-950/30',
  PENDING: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
  APPLIED: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30',
};

const CHANGE_TYPE_ICON: Record<string, typeof Activity> = {
  CREATED: Sparkles,
  EVOLUTION: GitBranch,
  EXPERIMENT_WIN: Trophy,
  MANUAL_FORK: GitBranch,
  ROLLBACK: XCircle,
};

/**
 * Fetch JSON with a retry — API routes in dev compile on first hit, which
 * can cause the initial fetch to fail with "TypeError: Failed to fetch".
 * A short retry paper over the cold-start window.
 */
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

/**
 * POST JSON with a retry — same cold-start rationale as fetchJSON.
 */
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

export function EvolutionTab() {
  const [experiences, setExperiences] = useState<ExperienceListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dashboardKey, setDashboardKey] = useState(0);
  const reloadDashboard = () => setDashboardKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await fetchJSON<{ experiences: ExperienceListItem[] }>('/api/evolution/creator/experiences?creatorId=creator_demo');
        if (cancelled) return;
        setExperiences(d.experiences ?? []);
        if ((d.experiences ?? []).length > 0) {
          setSelectedId(d.experiences[0].experienceId);
        }
        setLoadingList(false);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) {
          setLoadError('Could not load experiences. Please retry.');
          setLoadingList(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loadingList) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  if (experiences.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <GitBranch className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No published experiences yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Publish an experience from the Studio to start evolving it with AI.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Experience picker + seed */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="flex items-center gap-2 shrink-0">
              <GitBranch className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium">Experience:</span>
            </div>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {experiences.map((exp) => (
                  <SelectItem key={exp.experienceId} value={exp.experienceId} className="text-xs">
                    {exp.title} · {exp.playCount} plays · {exp.completionRate}% completion
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SeedButton experienceId={selectedId} onDone={reloadDashboard} />
          </div>
        </CardContent>
      </Card>

      {selectedId && (
        <EvolutionDashboard experienceId={selectedId} key={`${selectedId}-${dashboardKey}`} />
      )}
    </div>
  );
}

function SeedButton({ experienceId, onDone }: { experienceId: string; onDone: () => void }) {
  const [seeding, setSeeding] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-xs shrink-0"
      disabled={!experienceId || seeding}
      onClick={async () => {
        setSeeding(true);
        try {
          await postJSON(`/api/evolution/${experienceId}/seed`);
          onDone();
        } finally {
          setSeeding(false);
        }
      }}
    >
      {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
      Seed demo data
    </Button>
  );
}

function EvolutionDashboard({ experienceId }: { experienceId: string }) {
  return (
    <div className="space-y-4">
      <HealthSection experienceId={experienceId} />
      <OpportunitiesSection experienceId={experienceId} />
      <ExperimentsSection experienceId={experienceId} />
      <TimelineSection experienceId={experienceId} />
      <MutationsSection experienceId={experienceId} />
    </div>
  );
}

// ─── Current Health ────────────────────────────────────────────────────────

function HealthSection({ experienceId }: { experienceId: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<Health>(`/api/evolution/${experienceId}/health`);
        if (!cancelled) setHealth(d);
      } catch { /* leave health null */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

  if (loading) return <SectionSkeleton />;
  if (!health) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" /> Current Health
        </CardTitle>
        <CardDescription className="text-xs">Live snapshot across retention, competition, economy, community</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold">{health.overall}</div>
          <div className="text-[10px] text-muted-foreground">/ 100 overall</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <HealthBar label="Retention" data={health.retention} color="bg-emerald-500" />
          <HealthBar label="Competition" data={health.competition} color="bg-amber-500" />
          <HealthBar label="Economy" data={health.economy} color="bg-violet-500" />
          <HealthBar label="Community" data={health.community} color="bg-pink-500" />
          <HealthBar label="Evolution" data={health.evolution} color="bg-cyan-500" />
        </div>
        {health.signals.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-border">
            {health.signals.map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px]">
                <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{s}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthBar({ label, data, color }: { label: string; data: { score: number; label: string }; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-medium">{data.score}</span>
      </div>
      <Progress value={data.score} className={`h-1.5 ${color}`} />
      <div className="text-[9px] text-muted-foreground mt-0.5">{data.label}</div>
    </div>
  );
}

// ─── AI Opportunities ──────────────────────────────────────────────────────

function OpportunitiesSection({ experienceId }: { experienceId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<{ proposals: Proposal[] }>(`/api/evolution/${experienceId}/proposals`);
        if (!cancelled) setProposals(d.proposals ?? []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId, reloadToken]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await postJSON(`/api/evolution/${experienceId}/analyze`);
      reload();
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-500" /> AI Opportunities
            </CardTitle>
            <CardDescription className="text-xs">AI-diagnosed problems with graph mutations you can approve</CardDescription>
          </div>
          <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SectionSkeleton />
        ) : proposals.length === 0 ? (
          <div className="py-4 text-center">
            <Brain className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No AI opportunities yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Run AI Analysis" to diagnose the experience.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[28rem]">
            <div className="space-y-2 pr-2">
              {proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} onChanged={reload} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ProposalCard({ proposal, onChanged }: { proposal: Proposal; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [experimenting, setExperimenting] = useState(false);

  const act = async (action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await postJSON(`/api/evolution/proposals/${proposal.id}/${action}`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const runExperiment = async () => {
    if (!proposal.mutationId) return;
    setExperimenting(true);
    try {
      await postJSON(`/api/evolution/${proposal.experienceId}/sandbox`, {
        mutationId: proposal.mutationId,
        mode: 'experiment',
        playerCount: 8,
      });
      onChanged();
    } finally {
      setExperimenting(false);
    }
  };

  const confidencePct = Math.round(proposal.confidenceScore * 100);

  return (
    <div className={`rounded-lg border p-3 ${STATUS_COLORS[proposal.status] ?? 'border-border'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[8px] h-3.5">{proposal.status}</Badge>
            <Badge variant="outline" className="text-[8px] h-3.5">{confidencePct}% confidence</Badge>
            {proposal.predictedLift > 0 && (
              <Badge className="text-[8px] h-3.5 bg-emerald-500 text-white">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                +{Math.round(proposal.predictedLift * 100)}% predicted
              </Badge>
            )}
          </div>
          <div className="text-xs font-medium mt-1">{proposal.problem}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{proposal.evidence}</p>
          {proposal.expectedImpact && (
            <div className="flex items-center gap-1 mt-1">
              <ChevronRight className="w-2.5 h-2.5 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{proposal.expectedImpact}</span>
            </div>
          )}

          {/* Graph changes */}
          <div className="mt-2 space-y-1">
            {proposal.graphChanges.map((c, i) => (
              <div key={i} className="text-[10px] flex items-start gap-1.5">
                <Badge variant="secondary" className="text-[7px] h-3 px-1 shrink-0">{c.mutationType.replace(/_/g, ' ')}</Badge>
                <span className="text-muted-foreground break-words">
                  {c.instance ? `@${c.instance}` : c.extensionId ? `+${c.extensionId}` : ''}
                  {c.config ? ` → ${JSON.stringify(c.config)}` : ''}
                  {' — '}
                  <span className="italic">{c.reason}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Affected extensions */}
          {proposal.affectedExtensions.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              <span className="text-[9px] text-muted-foreground">Affected:</span>
              {proposal.affectedExtensions.map((ext) => (
                <Badge key={ext} variant="outline" className="text-[8px] h-3.5 font-mono">{ext}</Badge>
              ))}
            </div>
          )}

          {/* Expandable AI reasoning */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 hover:underline flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'Show'} AI reasoning
            <ChevronRight className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          {expanded && (
            <div className="mt-2 p-2 rounded bg-background/60 text-[10px] space-y-1.5 border border-border/50">
              {proposal.analysis.diagnosis && (
                <div><span className="font-medium text-amber-600 dark:text-amber-400">Diagnosis:</span> <span className="text-muted-foreground">{proposal.analysis.diagnosis}</span></div>
              )}
              {proposal.analysis.hypothesis && (
                <div><span className="font-medium text-amber-600 dark:text-amber-400">Hypothesis:</span> <span className="text-muted-foreground">{proposal.analysis.hypothesis}</span></div>
              )}
              {proposal.analysis.patterns.length > 0 && (
                <div><span className="font-medium">Patterns:</span> <span className="text-muted-foreground">{proposal.analysis.patterns.join(' · ')}</span></div>
              )}
              {proposal.analysis.bottlenecks.length > 0 && (
                <div><span className="font-medium">Bottlenecks:</span> <span className="text-muted-foreground">{proposal.analysis.bottlenecks.join(' · ')}</span></div>
              )}
              {proposal.analysis.strengths.length > 0 && (
                <div><span className="font-medium text-emerald-600 dark:text-emerald-400">Strengths:</span> <span className="text-muted-foreground">{proposal.analysis.strengths.join(' · ')}</span></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {(proposal.status === 'PROPOSED' || proposal.status === 'DISCOVERED' || proposal.status === 'PENDING' || proposal.status === 'CREATOR_REVIEW' || proposal.status === 'EXPERIMENTING') && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
          <Button size="sm" variant="default" className="h-6 text-[10px] gap-1" onClick={() => act('approve')} disabled={busy}>
            <CheckCircle2 className="w-3 h-3" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={runExperiment} disabled={experimenting || !proposal.mutationId}>
            {experimenting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Beaker className="w-3 h-3" />}
            Run Experiment
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-red-500" onClick={() => act('reject')} disabled={busy}>
            <XCircle className="w-3 h-3" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Experiments ───────────────────────────────────────────────────────────

function ExperimentsSection({ experienceId }: { experienceId: string }) {
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<{ runs: ExperimentRun[] }>(`/api/evolution/${experienceId}/experiments`);
        if (!cancelled) setRuns(d.runs ?? []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-cyan-500" /> Experiments
        </CardTitle>
        <CardDescription className="text-xs">A/B sandbox runs comparing the current graph against mutated variants</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SectionSkeleton />
        ) : runs.length === 0 ? (
          <div className="py-4 text-center">
            <FlaskConical className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No experiments yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Approve an AI proposal and click "Run Experiment".</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <ExperimentRow key={r.id} run={r} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExperimentRow({ run }: { run: ExperimentRun }) {
  const winnerColor = run.winner === 'B' ? 'bg-emerald-500' : run.winner === 'A' ? 'bg-amber-500' : 'bg-muted';
  const compDelta = run.metrics.delta?.completionRate ?? 0;
  const scoreDelta = run.metrics.delta?.averageScore ?? 0;

  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">A vs B</span>
          <Badge className={`text-[8px] h-3.5 text-white ${winnerColor}`}>
            Winner: {run.winner ?? '—'}
          </Badge>
        </div>
        <span className="text-[9px] text-muted-foreground">{new Date(run.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-1.5">
          <div className="font-medium text-amber-700 dark:text-amber-400">A (Current)</div>
          <div className="text-muted-foreground">completion: {pct(run.metrics.A.completionRate)}</div>
          <div className="text-muted-foreground">avg score: {Math.round(run.metrics.A.averageScore ?? 0)}</div>
        </div>
        <div className="rounded bg-emerald-50 dark:bg-emerald-950/30 p-1.5">
          <div className="font-medium text-emerald-700 dark:text-emerald-400">B (Mutated)</div>
          <div className="text-muted-foreground">completion: {pct(run.metrics.B.completionRate)}</div>
          <div className="text-muted-foreground">avg score: {Math.round(run.metrics.B.averageScore ?? 0)}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px]">
        <span className={compDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
          completion Δ {compDelta > 0 ? '+' : ''}{(compDelta * 100).toFixed(1)}%
        </span>
        <span className={scoreDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
          score Δ {scoreDelta > 0 ? '+' : ''}{Math.round(scoreDelta)}
        </span>
      </div>
    </div>
  );
}

function pct(n: number | undefined): string {
  if (n === undefined) return '—';
  return `${Math.round(n * 100)}%`;
}

// ─── Evolution Timeline ────────────────────────────────────────────────────

function TimelineSection({ experienceId }: { experienceId: string }) {
  const [data, setData] = useState<{ timeline: TimelineEntry[]; currentVersion: number; appliedMutations: number; experimentWins: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<{ timeline: TimelineEntry[]; currentVersion: number; appliedMutations: number; experimentWins: number }>(`/api/evolution/${experienceId}/timeline`);
        if (!cancelled) setData(d);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-500" /> Evolution Timeline
        </CardTitle>
        <CardDescription className="text-xs">Version history with measured impact</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SectionSkeleton />
        ) : !data || data.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No evolution history yet.</p>
        ) : (
          <div className="space-y-0">
            {data.timeline.map((entry, i) => {
              const Icon = CHANGE_TYPE_ICON[entry.changeType] ?? GitBranch;
              const isLast = i === data.timeline.length - 1;
              return (
                <div key={i} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] ${
                      entry.changeType === 'CREATED' ? 'bg-emerald-500' :
                      entry.changeType === 'EXPERIMENT_WIN' ? 'bg-amber-500' :
                      entry.changeType === 'EVOLUTION' ? 'bg-violet-500' :
                      entry.changeType === 'ROLLBACK' ? 'bg-red-500' :
                      'bg-muted-foreground'
                    }`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border my-0.5" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{entry.version}</span>
                      <Badge variant="outline" className="text-[7px] h-3">{entry.changeType.replace(/_/g, ' ')}</Badge>
                      {entry.impact && (
                        <Badge className="text-[7px] h-3 bg-emerald-500 text-white">{entry.impact}</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{entry.changeSummary}</p>
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-3 pt-2 mt-1 border-t border-border text-[10px] text-muted-foreground">
              <span>Current: v{data.currentVersion}</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{data.appliedMutations} applied mutations</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{data.experimentWins} experiment wins</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Mutations (pending + applied) ─────────────────────────────────────────

function MutationsSection({ experienceId }: { experienceId: string }) {
  const [mutations, setMutations] = useState<MutationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<{ mutations: MutationItem[] }>(`/api/evolution/${experienceId}/mutations`);
        if (!cancelled) setMutations(d.mutations ?? []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId, reloadToken]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> Graph Mutations
        </CardTitle>
        <CardDescription className="text-xs">All proposed graph changes — the AI never edits production directly</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SectionSkeleton />
        ) : mutations.length === 0 ? (
          <div className="py-4 text-center">
            <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No mutations recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mutations.map((m) => (
              <MutationRow key={m.id} mutation={m} onChanged={reload} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MutationRow({ mutation, onChanged }: { mutation: MutationItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const approved = mutation.status === 'APPROVED' || mutation.status === 'APPLIED';

  const apply = async (mode: 'replace' | 'publish-new' | 'discard') => {
    setBusy(true);
    try {
      await postJSON(`/api/evolution/mutations/${mutation.id}/apply`, { mode });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const diff = mutation.diff;
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[8px] h-3.5">{mutation.mutationType.replace(/_/g, ' ')}</Badge>
          <Badge variant={approved ? 'default' : 'secondary'} className="text-[8px] h-3.5">{mutation.status}</Badge>
          {mutation.creatorApproved && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
        </div>
        <span className="text-[9px] text-muted-foreground">{new Date(mutation.createdAt).toLocaleDateString()}</span>
      </div>

      {diff.addedInstances.length > 0 && (
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">+ {diff.addedInstances.join(', ')}</div>
      )}
      {diff.removedInstances.length > 0 && (
        <div className="text-[10px] text-red-600 dark:text-red-400">− {diff.removedInstances.join(', ')}</div>
      )}
      {diff.configChanges.map((c, i) => (
        <div key={i} className="text-[10px] text-muted-foreground font-mono">
          {c.instance}.{c.key}: <span className="text-red-500 line-through">{String(c.before)}</span> → <span className="text-emerald-500">{String(c.after)}</span>
        </div>
      ))}

      {approved && mutation.status !== 'APPLIED' && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
          <Button size="sm" variant="default" className="h-6 text-[10px] gap-1" onClick={() => apply('replace')} disabled={busy}>
            <GitBranch className="w-3 h-3" /> Replace current
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => apply('publish-new')} disabled={busy}>
            <Sparkles className="w-3 h-3" /> Publish as new
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-red-500" onClick={() => apply('discard')} disabled={busy}>
            <XCircle className="w-3 h-3" /> Discard
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── shared skeleton ───────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
      <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
      <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
    </div>
  );
}
