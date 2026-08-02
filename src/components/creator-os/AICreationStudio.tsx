'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Sparkles,
  Wand2,
  Play,
  RefreshCw,
  Rocket,
  Cpu,
  Zap,
  CheckCircle2,
  AlertCircle,
  Brain,
  Tag,
  Trophy,
  RotateCcw,
} from 'lucide-react';
import { useStudioStore } from '@/stores/studio-store';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AIGameProposal {
  title: string;
  description: string;
  format: 'game' | 'spark';
  engineGameId: string;
  gameName: string;
  tags: string[];
  competitiveEligible: boolean;
  balanceParams: Record<string, number | string | boolean>;
  reasoning: string;
  source: 'ai' | 'rule';
}

interface ExamplePrompt {
  label: string;
  prompt: string;
}

interface CatalogResponse {
  templates: { games: TemplateEntry[]; sparks: TemplateEntry[] };
  examples: ExamplePrompt[];
}

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  format: 'game' | 'spark';
  tags: string[];
  configKeys: string[];
}

// ─── fetchJSON / postJSON with retry for dev cold-start ────────────────────

async function fetchJSON<T = unknown>(url: string, retries = 2): Promise<T> {
  try {
    const res = await fetch(url);
    return (await res.json()) as T;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return fetchJSON<T>(url, retries - 1);
    }
    throw err;
  }
}

async function postJSON<T = unknown>(url: string, body?: unknown, retries = 2): Promise<T> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await res.json()) as T;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return postJSON<T>(url, body, retries - 1);
    }
    throw err;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

interface AICreationStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AICreationStudio({ open, onOpenChange }: AICreationStudioProps) {
  const { playExperience } = useStudioStore();

  const [prompt, setPrompt] = useState('');
  const [examples, setExamples] = useState<ExamplePrompt[]>([]);
  const [catalog, setCatalog] = useState<{ games: TemplateEntry[]; sparks: TemplateEntry[] } | null>(null);
  const [proposal, setProposal] = useState<AIGameProposal | null>(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedExperienceId, setPublishedExperienceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load examples + catalog on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchJSON<CatalogResponse>('/api/ai-create');
        if (cancelled) return;
        setExamples(d.examples ?? []);
        setCatalog(d.templates ?? { games: [], sparks: [] });
      } catch {
        // Non-fatal — examples fall back to defaults below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset state when dialog is reopened
  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('Please describe the game you want to create.');
      return;
    }
    setGenerating(true);
    setError(null);
    setProposal(null);
    setPublishedExperienceId(null);
    try {
      const d = await postJSON<{ proposal: AIGameProposal; error?: string }>('/api/ai-create', { prompt: trimmed });
      if (d.error) {
        setError(d.error);
      } else if (d.proposal) {
        setProposal(d.proposal);
        toast.success('AI proposal generated', {
          description: `${d.proposal.title} · ${d.proposal.format} · ${d.proposal.gameName}`,
        });
      } else {
        setError('AI returned an empty proposal.');
      }
    } catch (err) {
      setError(`Generation failed: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }, [prompt]);

  const handlePublish = useCallback(async () => {
    if (!proposal) return;
    setPublishing(true);
    setError(null);
    try {
      const d = await postJSON<{ experienceId: string; published: boolean; error?: string }>(
        '/api/ai-create?mode=publish',
        { proposal },
      );
      if (d.error) {
        setError(d.error);
      } else if (d.experienceId) {
        setPublishedExperienceId(d.experienceId);
        toast.success('Experience published', {
          description: `${proposal.title} is now live and playable.`,
        });
      }
    } catch (err) {
      setError(`Publish failed: ${(err as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }, [proposal]);

  const handlePlay = useCallback(() => {
    if (!publishedExperienceId) return;
    onOpenChange(false);
    playExperience(publishedExperienceId);
  }, [publishedExperienceId, onOpenChange, playExperience]);

  const handleReset = useCallback(() => {
    setProposal(null);
    setPublishedExperienceId(null);
    setError(null);
    setPrompt('');
  }, []);

  const handleExampleClick = useCallback((ex: ExamplePrompt) => {
    setPrompt(ex.prompt);
    setProposal(null);
    setPublishedExperienceId(null);
    setError(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-4 p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            AI Creation Studio
          </DialogTitle>
          <DialogDescription className="text-xs">
            Describe a game in natural language. The AI matches your idea to the best engine template and produces a polished, publishable experience.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 max-h-[60vh]">
          <div className="space-y-4 pb-2">
            {/* Prompt input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Your prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Create a fast-paced cyberpunk endless runner for mobile and desktop. Players jump obstacles and collect coins while the speed ramps up."
                className="min-h-[100px] resize-none text-sm"
                disabled={generating}
              />
              <div className="flex flex-wrap gap-1.5">
                {examples.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => handleExampleClick(ex)}
                    disabled={generating}
                    className="text-[10px] px-2 py-1 rounded-full border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p>
              </div>
            )}

            {/* Generating skeleton */}
            {generating && !proposal && (
              <Card className="border-dashed">
                <CardContent className="p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Asking the AI…</p>
                    <p className="text-[10px] text-muted-foreground">Analyzing your prompt and matching it to the engine catalog.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Proposal result */}
            {proposal && (
              <ProposalCard
                proposal={proposal}
                publishing={publishing}
                publishedExperienceId={publishedExperienceId}
                onPublish={handlePublish}
                onPlay={handlePlay}
                onRegenerate={handleGenerate}
                onReset={handleReset}
              />
            )}

            {/* Catalog preview (collapsible hint) */}
            {catalog && !proposal && !generating && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Available engine templates ({catalog.games.length} games · {catalog.sparks.length} sparks)
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[...catalog.games, ...catalog.sparks].map((t) => (
                    <div key={t.id} className="p-2 rounded border border-border bg-card/50">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">{t.name}</span>
                        <Badge variant="outline" className="text-[8px] h-3.5">{t.format}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-4 pt-2 border-t border-border gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={generating || publishing}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" /> Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Proposal Card ─────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: AIGameProposal;
  publishing: boolean;
  publishedExperienceId: string | null;
  onPublish: () => void;
  onPlay: () => void;
  onRegenerate: () => void;
  onReset: () => void;
}

function ProposalCard({
  proposal,
  publishing,
  publishedExperienceId,
  onPublish,
  onPlay,
  onRegenerate,
  onReset,
}: ProposalCardProps) {
  const isSpark = proposal.format === 'spark';
  const published = !!publishedExperienceId;
  const balanceEntries = Object.entries(proposal.balanceParams);

  return (
    <Card className="border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {proposal.title}
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
                {isSpark ? <Zap className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                {proposal.format}
              </Badge>
              {proposal.source === 'ai' ? (
                <Badge className="text-[9px] h-4 bg-amber-500 text-white gap-0.5">
                  <Brain className="w-2.5 h-2.5" /> AI
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[9px] h-4">rule-based</Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{proposal.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Engine template */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Engine template:</span>
          <Badge variant="outline" className="text-[10px] font-mono">{proposal.engineGameId}</Badge>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium">{proposal.gameName}</span>
        </div>

        {/* Tags */}
        <div className="flex items-start gap-2">
          <Tag className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
          <div className="flex flex-wrap gap-1">
            {proposal.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] h-4">{t}</Badge>
            ))}
          </div>
        </div>

        {/* Competitive eligibility */}
        <div className="flex items-center gap-2 text-xs">
          <Trophy className={`w-3.5 h-3.5 ${proposal.competitiveEligible ? 'text-emerald-500' : 'text-muted-foreground/50'}`} />
          <span className={proposal.competitiveEligible ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}>
            {proposal.competitiveEligible ? 'Competitive-eligible (leaderboard-ready)' : 'Casual (not competitive)'}
          </span>
        </div>

        {/* Balance overrides */}
        {balanceEntries.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Balance overrides</div>
            <div className="flex flex-wrap gap-1.5">
              {balanceEntries.map(([k, v]) => (
                <div key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border font-mono">
                  {k}=<span className="text-amber-600 dark:text-amber-400">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* AI reasoning */}
        <div className="flex items-start gap-2">
          <Brain className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mb-0.5">AI Reasoning</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{proposal.reasoning}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {!published ? (
            <Button
              size="sm"
              onClick={onPublish}
              disabled={publishing}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              Publish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onPlay}
              className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Play className="w-3.5 h-3.5" /> Play Now
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerate}
            disabled={publishing}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            disabled={publishing}
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>

          {published && (
            <Badge className="ml-auto text-[9px] h-5 bg-emerald-500 text-white gap-0.5 self-center">
              <CheckCircle2 className="w-3 h-3" /> Published
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
