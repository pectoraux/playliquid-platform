'use client';

import { useStudioStore } from '@/stores/studio-store';
import { useExtensions } from '@/hooks/use-kernel';
import { useAICompose, useCreateDraft } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, ArrowLeft, ArrowRight, Check, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExperienceKind, ExperienceEmotion } from '@/kernel/types';
import { suggestionToBundle } from '@/lib/suggestion-utils';

const KINDS: Array<{ id: ExperienceKind; icon: string; label: string; desc: string }> = [
  { id: 'GAME', icon: '🎮', label: 'Game', desc: 'A full interactive experience' },
  { id: 'SPARK', icon: '⚡', label: 'Spark', desc: 'Vertical, mobile-first, immediate' },
  { id: 'SIMULATION', icon: '🌎', label: 'Simulation', desc: 'A living world to explore' },
  { id: 'CHALLENGE', icon: '🏆', label: 'Challenge', desc: 'Competitive, score-driven' },
  { id: 'LEARNING', icon: '📚', label: 'Learning', desc: 'Educational, skill-building' },
];

const EMOTIONS: Array<{ id: ExperienceEmotion; icon: string; label: string }> = [
  { id: 'competition', icon: '⚔️', label: 'Competition' },
  { id: 'discovery', icon: '🔍', label: 'Discovery' },
  { id: 'creativity', icon: '🎨', label: 'Creativity' },
  { id: 'mastery', icon: '🎓', label: 'Mastery' },
  { id: 'relaxation', icon: '🌿', label: 'Relaxation' },
  { id: 'social', icon: '👥', label: 'Social' },
  { id: 'strategy', icon: '♟️', label: 'Strategy' },
];

export function CreationWizard() {
  const { wizard, setWizardStep, setWizardIntent, setWizardDescription, setAIComposing, setAISuggestion, setAIError, setDraft, resetWizard, setView } = useStudioStore();
  const aiCompose = useAICompose();
  const createDraft = useCreateDraft();
  const { data: extData } = useExtensions();

  const handleToggleEmotion = (e: ExperienceEmotion) => {
    const current = wizard.intent.emotions;
    if (current.includes(e)) {
      setWizardIntent({ emotions: current.filter((x) => x !== e) });
    } else {
      setWizardIntent({ emotions: [...current, e] });
    }
  };

  const handleAICompose = async () => {
    setAIComposing(true);
    setAIError(null);
    try {
      const result = await aiCompose.mutateAsync({
        description: wizard.description,
        intent: wizard.intent,
      });
      setAISuggestion(result.suggestion);
      if (result.error) {
        toast.info('AI used fallback', { description: result.error });
      } else {
        toast.success('AI composed a graph', {
          description: `${result.suggestion.instances.length} extensions, ${result.suggestion.wires.length} wires`,
        });
      }
    } catch (e) {
      setAIError((e as Error).message);
      toast.error('AI composition failed', { description: (e as Error).message });
    } finally {
      setAIComposing(false);
    }
  };

  const handleUseSuggestion = async () => {
    if (!wizard.aiSuggestion) return;
    const bundle = suggestionToBundle(wizard.aiSuggestion, wizard.intent.kind === 'SPARK' ? 'SPARK' : 'GAME');
    bundle.name = wizard.description.slice(0, 40) || 'AI-Composed Experience';
    try {
      const result = await createDraft.mutateAsync({
        title: bundle.name ?? 'Untitled',
        description: wizard.description,
        bundle,
        intent: wizard.intent,
      });
      setDraft({
        id: result.draft.id,
        title: result.draft.title,
        description: result.draft.description,
        bundle: result.draft.bundle,
        intent: result.draft.intent,
      });
      resetWizard();
      toast.success('Experience created from AI suggestion');
    } catch (e) {
      toast.error('Failed to create draft', { description: (e as Error).message });
    }
  };

  const handleStartBlank = async () => {
    try {
      const result = await createDraft.mutateAsync({
        title: wizard.description.slice(0, 40) || 'Untitled Experience',
        description: wizard.description,
        bundle: { type: wizard.intent.kind === 'SPARK' ? 'SPARK' : 'GAME', name: wizard.description.slice(0, 40) || 'Untitled', instances: [], wires: [] },
        intent: wizard.intent,
      });
      setDraft({
        id: result.draft.id,
        title: result.draft.title,
        description: result.draft.description,
        bundle: result.draft.bundle,
        intent: result.draft.intent,
      });
      resetWizard();
    } catch (e) {
      toast.error('Failed to create draft', { description: (e as Error).message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { resetWizard(); setView('home-v3'); }} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-semibold">Create New Experience</h1>
            <p className="text-xs text-muted-foreground">Step {wizard.step} of 4</p>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-8 h-1.5 rounded-full ${wizard.step >= s ? 'bg-amber-500' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        {/* Step 1: Type */}
        {wizard.step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold">What do you want to create?</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose the type of experience</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setWizardIntent({ kind: k.id })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    wizard.intent.kind === k.id
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-border hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{k.icon}</span>
                    <div>
                      <div className="font-semibold">{k.label}</div>
                      <div className="text-xs text-muted-foreground">{k.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setWizardStep(2)} className="bg-amber-500 hover:bg-amber-600 text-white">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Emotions */}
        {wizard.step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold">What should players feel?</h2>
              <p className="text-sm text-muted-foreground mt-1">Select the emotions your experience should evoke</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {EMOTIONS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleToggleEmotion(e.id)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    wizard.intent.emotions.includes(e.id)
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-border hover:border-amber-300'
                  }`}
                >
                  <div className="text-3xl mb-1">{e.icon}</div>
                  <div className="text-sm font-medium">{e.label}</div>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Target audience (optional)</Label>
              <Input
                value={wizard.intent.audience}
                onChange={(e) => setWizardIntent({ audience: e.target.value })}
                placeholder="e.g. casual players, hardcore strategists, kids..."
                className="h-9"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setWizardStep(1)} className="h-9">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={() => setWizardStep(3)} className="bg-amber-500 hover:bg-amber-600 text-white h-9">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Describe */}
        {wizard.step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Describe your idea</h2>
              <p className="text-sm text-muted-foreground mt-1">In plain language — the AI will suggest extensions</p>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Label className="text-sm font-medium">What's the experience about?</Label>
                <Textarea
                  value={wizard.description}
                  onChange={(e) => setWizardDescription(e.target.value)}
                  placeholder="e.g. A farming game where players grow crops, cook meals, trade at a marketplace, and compete for the highest score..."
                  className="min-h-32 resize-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{wizard.intent.kind}</Badge>
                  {wizard.intent.emotions.map((e) => (
                    <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setWizardStep(2)} className="h-9">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleStartBlank} className="h-9">
                  Skip AI, start blank
                </Button>
                <Button
                  onClick={() => { setWizardStep(4); handleAICompose(); }}
                  disabled={!wizard.description.trim() || aiCompose.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-white h-9"
                >
                  <Wand2 className="w-4 h-4" /> Compose with AI
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: AI Suggestion */}
        {wizard.step === 4 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-500" /> AI Suggestion
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {wizard.aiComposing ? 'Composing your experience...' : 'Review the AI-generated graph'}
              </p>
            </div>

            {wizard.aiComposing && (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <p className="text-sm text-muted-foreground">Analyzing extension catalog and your intent...</p>
                </CardContent>
              </Card>
            )}

            {!wizard.aiComposing && wizard.aiSuggestion && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Reasoning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{wizard.aiSuggestion.reasoning}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Suggested Extensions ({wizard.aiSuggestion.instances.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {wizard.aiSuggestion.instances.map((inst: any, i: number) => {
                      const ext = extData?.extensions.find((e: any) => e.id === inst.extensionId);
                      return (
                        <div key={i} className="flex items-start gap-3 p-2 rounded-lg border border-border">
                          <span className="text-2xl">{ext?.icon ?? '📦'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{ext?.name ?? inst.extensionId}</span>
                              <Badge variant="outline" className="text-[9px] h-4">{ext?.category}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{inst.why}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Token Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <code className="text-sm font-mono text-amber-600 dark:text-amber-400">
                      {wizard.aiSuggestion.tokenFlow}
                    </code>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setWizardStep(3)} className="h-9">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleAICompose} className="h-9">
                      <Wand2 className="w-4 h-4" /> Regenerate
                    </Button>
                    <Button onClick={handleUseSuggestion} className="bg-amber-500 hover:bg-amber-600 text-white h-9">
                      <Check className="w-4 h-4" /> Use This Graph
                    </Button>
                  </div>
                </div>
              </>
            )}

            {wizard.aiError && !wizard.aiComposing && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-red-500 mb-3">{wizard.aiError}</p>
                  <Button onClick={handleAICompose} variant="outline" className="h-9">
                    <Wand2 className="w-4 h-4" /> Try Again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
