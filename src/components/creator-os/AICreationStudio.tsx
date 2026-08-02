'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Sparkles, Gamepad2, Zap, Copy, Check, Wand2,
  ArrowRight, ArrowLeft, RefreshCw, Play, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useStudioStore } from '@/stores/studio-store';

// ─── fetch helpers ─────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────────

interface GameSpec {
  title: string;
  description: string;
  format: 'spark' | 'game';
  genre: string;
  coreFantasy: string;
  playerActions: string[];
  gameLoop: string;
  sessionLength: string;
  orientation: 'portrait' | 'landscape';
  controls: string[];
  camera: string;
  difficulty: string;
  extensions: string[];
  telemetry: string[];
  engineTemplateId?: string;
  engineTemplateReason?: string;
  competitiveEligible: boolean;
  reasoning: string;
}

interface Compatibility {
  runtime: string;
  container: string;
  input: string[];
  telemetry: boolean;
  extensions: string[];
  evolutionReady: boolean;
  missing: string[];
  warnings: string[];
  passed: boolean;
}

type Step = 'describe' | 'architect' | 'compatibility' | 'generate';
type FormatChoice = 'spark' | 'game' | null;

// ─── Component ─────────────────────────────────────────────────────────────

export function AICreationStudio({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { playExperience } = useStudioStore();
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [formatChoice, setFormatChoice] = useState<FormatChoice>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [spec, setSpec] = useState<GameSpec | null>(null);
  const [compatibility, setCompatibility] = useState<Compatibility | null>(null);
  const [compiledPrompt, setCompiledPrompt] = useState<string | null>(null);
  const [generatedExperienceId, setGeneratedExperienceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState('');

  const reset = () => {
    setStep('describe');
    setDescription('');
    setFormatChoice(null);
    setLoading(false);
    setError(null);
    setSessionId(null);
    setSpec(null);
    setCompatibility(null);
    setCompiledPrompt(null);
    setGeneratedExperienceId(null);
    setCopied(false);
    setFeedback('');
  };

  // ── Step 1: Design ──────────────────────────────────────────────────────
  const handleDesign = useCallback(async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await postJSON<{ sessionId: string; spec: GameSpec; error?: string }>(
        '/api/game-creation',
        { action: 'design', description, formatHint: formatChoice ?? undefined },
      );
      if (result.error) throw new Error(result.error);
      setSessionId(result.sessionId);
      setSpec(result.spec);
      setStep('architect');
    } catch (err) {
      setError(`Design failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [description, formatChoice]);

  // ── Refine (real-time collaboration) ────────────────────────────────────
  const handleRefine = useCallback(async () => {
    if (!sessionId || !feedback.trim()) return;
    setLoading(true);
    try {
      const result = await postJSON<{ spec: GameSpec; error?: string }>(
        '/api/game-creation',
        { action: 'refine', sessionId, feedback },
      );
      if (result.error) throw new Error(result.error);
      setSpec(result.spec);
      setFeedback('');
    } catch (err) {
      setError(`Refine failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, feedback]);

  // ── Step 2: Compile (validate + generate prompt) ────────────────────────
  const handleCompile = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await postJSON<{ sessionId: string; spec: GameSpec; compatibility: Compatibility; compiledPrompt: string }>(
        '/api/game-creation',
        { action: 'compile', sessionId },
      );
      setCompatibility(result.compatibility);
      setCompiledPrompt(result.compiledPrompt);
      setStep('compatibility');
    } catch (err) {
      setError(`Compile failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // ── Step 3: Generate ────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await postJSON<{ sessionId: string; experienceId: string; spec: GameSpec }>(
        '/api/game-creation',
        { action: 'generate', sessionId },
      );
      setGeneratedExperienceId(result.experienceId);
      setStep('generate');
    } catch (err) {
      setError(`Generate failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const copyPrompt = () => {
    if (compiledPrompt) {
      navigator.clipboard.writeText(compiledPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-amber-500" /> AI Game Creation Studio
          </DialogTitle>
          <DialogDescription>
            {step === 'describe' && 'Step 1: Describe your game idea'}
            {step === 'architect' && 'Step 2: AI Game Architect — review the design'}
            {step === 'compatibility' && 'Step 3: Compatibility check + generation prompt'}
            {step === 'generate' && 'Step 4: Experience generated!'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Describe ── */}
        {step === 'describe' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">What are you creating?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFormatChoice('spark')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${formatChoice === 'spark' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'border-border hover:border-rose-300'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-rose-500" />
                    <span className="text-sm font-medium">⚡ Spark</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Short mobile-first experience · 30-90s · touch · portrait</p>
                </button>
                <button
                  onClick={() => setFormatChoice('game')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${formatChoice === 'game' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-border hover:border-violet-300'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Gamepad2 className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium">🎮 Game</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Longer desktop experience · 5-10min · keyboard · landscape</p>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Describe your game idea</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Make a game about a ninja fighting robots in a cyberpunk city. Players jump, attack, and collect energy cells."
                className="min-h-[100px] text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleDesign(); }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">⌘+Enter to design</p>
            </div>

            {/* Example prompts */}
            <div className="flex flex-wrap gap-1.5">
              {['Endless runner', 'Tower defense', 'Reaction game', 'Virtual pet', 'Space shooter', 'Coin collector'].map((ex) => (
                <Button
                  key={ex}
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => setDescription(ex.toLowerCase())}
                >
                  {ex}
                </Button>
              ))}
            </div>

            {error && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
              <Button size="sm" onClick={handleDesign} disabled={!description.trim() || loading} className="gap-1.5">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Design Game
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Architect ── */}
        {step === 'architect' && spec && (
          <div className="space-y-4">
            <ArchitectPanel spec={spec} />

            {/* Refine section */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium">Refine the design</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(); }}
                    placeholder="e.g. make it harder, add multiplayer, change to spark..."
                    className="flex-1 h-8 px-2 text-xs rounded border border-border bg-background"
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleRefine} disabled={!feedback.trim() || loading}>
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refine'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {['Make it harder', 'Add multiplayer', 'Make it a spark', 'Add combat'].map((s) => (
                    <Button key={s} size="sm" variant="ghost" className="h-5 text-[9px]" onClick={() => setFeedback(s.toLowerCase())}>
                      {s}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {error && <div className="text-xs text-red-500">{error}</div>}

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('describe')} className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
              <Button size="sm" onClick={handleCompile} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Compile & Validate
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Compatibility + Prompt ── */}
        {step === 'compatibility' && compatibility && compiledPrompt && spec && (
          <div className="space-y-4">
            <CompatibilityCheckView compatibility={compatibility} />

            {/* Compiled prompt */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">LLM-ready Generation Prompt</span>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={copyPrompt}>
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <pre className="text-[9px] font-mono whitespace-pre-wrap bg-muted p-2 rounded max-h-40 overflow-y-auto text-muted-foreground">
                  {compiledPrompt.slice(0, 800)}...
                </pre>
              </CardContent>
            </Card>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-2.5">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                You can copy this prompt to an external LLM to generate HTML5 code, OR generate directly with PlayLiquid AI using the engine template.
              </p>
            </div>

            {error && <div className="text-xs text-red-500">{error}</div>}

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('architect')} className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
              <Button size="sm" onClick={handleGenerate} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Generate with PlayLiquid AI
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Generated ── */}
        {step === 'generate' && spec && generatedExperienceId && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div>
              <p className="text-sm font-medium">"{spec.title}" is live!</p>
              <p className="text-xs text-muted-foreground mt-1">Your AI-designed experience is now playable on PlayLiquid.</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="text-[9px]">{spec.format === 'spark' ? '⚡ Spark' : '🎮 Game'}</Badge>
              <Badge variant="outline" className="text-[9px]">{spec.engineTemplateId}</Badge>
              {spec.competitiveEligible && <Badge className="text-[9px] bg-emerald-500 text-white">🏆 Competitive</Badge>}
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={close}>Close</Button>
              <Button size="sm" onClick={() => { close(); playExperience(generatedExperienceId); }} className="gap-1.5">
                <Play className="w-3.5 h-3.5" /> Play Now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ArchitectPanel({ spec }: { spec: GameSpec }) {
  return (
    <Card className="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 border-violet-300">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Badge className={spec.format === 'spark' ? 'bg-rose-500 text-white text-[9px]' : 'bg-violet-500 text-white text-[9px]'}>
            {spec.format === 'spark' ? '⚡ SPARK' : '🎮 GAME'}
          </Badge>
          <span className="text-sm font-bold">{spec.title}</span>
        </div>

        <p className="text-[10px] text-muted-foreground italic">{spec.description}</p>

        <Separator />

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-muted-foreground">Genre:</span> <span className="font-medium">{spec.genre}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Session:</span> <span className="font-medium">{spec.sessionLength}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Camera:</span> <span className="font-medium">{spec.camera}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Difficulty:</span> <span className="font-medium">{spec.difficulty}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Core Fantasy:</span>
          <p className="text-[11px] mt-0.5">{spec.coreFantasy}</p>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Game Loop:</span>
          <p className="text-[11px] mt-0.5 font-mono">{spec.gameLoop}</p>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Player Actions:</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {spec.playerActions.map((a) => (
              <Badge key={a} variant="secondary" className="text-[8px] h-3.5">✓ {a}</Badge>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Required Extensions:</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {spec.extensions.map((e) => (
              <Badge key={e} variant="outline" className="text-[8px] h-3.5">{e}</Badge>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Telemetry Events:</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {spec.telemetry.map((t) => (
              <Badge key={t} variant="outline" className="text-[8px] h-3.5 text-cyan-600">{t}</Badge>
            ))}
          </div>
        </div>

        {spec.engineTemplateId && (
          <div className="pt-1 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground">Engine Template:</span>
            <span className="text-[10px] font-mono ml-1">{spec.engineTemplateId}</span>
            {spec.engineTemplateReason && (
              <p className="text-[9px] text-muted-foreground mt-0.5">{spec.engineTemplateReason}</p>
            )}
          </div>
        )}

        {spec.reasoning && (
          <div className="pt-1 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground">AI Reasoning:</span>
            <p className="text-[9px] text-muted-foreground italic mt-0.5">{spec.reasoning}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompatibilityCheckView({ compatibility }: { compatibility: Compatibility }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">PlayLiquid Compatibility Check</span>
          {compatibility.passed ? (
            <Badge className="text-[8px] h-3.5 bg-emerald-500 text-white"><CheckCircle2 className="w-2.5 h-2.5" /> Passed</Badge>
          ) : (
            <Badge className="text-[8px] h-3.5 bg-amber-500 text-white"><AlertCircle className="w-2.5 h-2.5" /> Issues</Badge>
          )}
        </div>

        <div className="space-y-1 text-[10px]">
          <Row label="Runtime" value={compatibility.runtime} ok />
          <Row label="Container" value={compatibility.container} ok />
          <Row label="Input" value={compatibility.input.join(', ')} ok={compatibility.input.length > 0} />
          <Row label="Telemetry" value={compatibility.telemetry ? 'enabled' : 'disabled'} ok={compatibility.telemetry} />
          <Row label="Extensions" value={compatibility.extensions.join(', ')} ok={compatibility.extensions.length > 0} />
          <Row label="Evolution Ready" value={compatibility.evolutionReady ? 'yes' : 'no'} ok={compatibility.evolutionReady} />
        </div>

        {compatibility.warnings.length > 0 && (
          <div className="pt-1.5 border-t border-border">
            {compatibility.warnings.map((w, i) => (
              <div key={i} className="text-[9px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" /> {w}
              </div>
            ))}
          </div>
        )}

        {compatibility.missing.length > 0 && (
          <div className="pt-1.5 border-t border-border">
            {compatibility.missing.map((m, i) => (
              <div key={i} className="text-[9px] text-red-600 dark:text-red-400 flex items-start gap-1">
                <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" /> {m}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="flex items-center gap-1">
        {ok ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> : <AlertCircle className="w-2.5 h-2.5 text-amber-500" />}
        <span className="font-medium">{value}</span>
      </span>
    </div>
  );
}
