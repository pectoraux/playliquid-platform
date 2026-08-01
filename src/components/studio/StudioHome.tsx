'use client';

import { useStudioStore } from '@/stores/studio-store';
import { useExperiences } from '@/hooks/use-studio';
import { useExtensions } from '@/hooks/use-kernel';
import { FARM_KINGDOM_BUNDLE, FARM_KINGDOM_INTENT, FARM_KINGDOM_DESCRIPTION } from './farm-kingdom-demo';
import { useCreateDraft } from '@/hooks/use-studio';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Gamepad2, BookOpen, User, Terminal, ArrowRight, Zap, Globe, Compass } from 'lucide-react';
import { toast } from 'sonner';

export function StudioHome() {
  const { setView, setDraft, resetWizard } = useStudioStore();
  const { data: expData } = useExperiences();
  const { data: extData } = useExtensions();
  const createDraft = useCreateDraft();

  const handleLoadFarmKingdom = async () => {
    try {
      const result = await createDraft.mutateAsync({
        title: 'Farm Kingdom',
        description: FARM_KINGDOM_DESCRIPTION,
        bundle: JSON.parse(JSON.stringify(FARM_KINGDOM_BUNDLE)),
        intent: FARM_KINGDOM_INTENT,
      });
      setDraft({
        id: result.draft.id,
        title: result.draft.title,
        description: result.draft.description,
        bundle: result.draft.bundle,
        intent: result.draft.intent,
      });
      toast.success('Farm Kingdom loaded', { description: 'A complete farming economy experience' });
    } catch (e) {
      toast.error('Failed to load demo', { description: (e as Error).message });
    }
  };

  const handleNewExperience = () => {
    resetWizard();
    setView('wizard');
  };

  const experienceCount = expData?.experiences.length ?? 0;
  const extensionCount = extData?.extensions.length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
              PL
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">PlayLiquid Studio</h1>
              <p className="text-xs text-muted-foreground leading-tight">Compose experiences, not code</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => setView('universe')} className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white">
              <Compass className="w-3.5 h-3.5" /> Play
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('civ')} className="h-8 text-xs">
              <Globe className="w-3.5 h-3.5" /> Civilization
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('world')} className="h-8 text-xs">
              <Globe className="w-3.5 h-3.5" /> World
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('experiences')} className="h-8 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> Browse ({experienceCount})
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('creator')} className="h-8 text-xs">
              <User className="w-3.5 h-3.5" /> Profile
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('kernel-dev')} className="h-8 text-xs">
              <Terminal className="w-3.5 h-3.5" /> Kernel
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Studio v0.1 — Extension Operating System
          </div>
          <h2 className="text-3xl font-bold mb-3">Create interactive experiences<br/>by composing extensions</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            No coding required. Describe your idea, let AI suggest a graph, connect extensions visually,
            and publish to the Liquid economy.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button onClick={handleNewExperience} size="lg" className="bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="w-4 h-4" /> Create New Experience
            </Button>
            <Button onClick={handleLoadFarmKingdom} variant="outline" size="lg">
              <Gamepad2 className="w-4 h-4" /> Load Farm Kingdom Demo
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{extensionCount}</div>
              <div className="text-xs text-muted-foreground">Extensions available</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-violet-500">{experienceCount}</div>
              <div className="text-xs text-muted-foreground">Published experiences</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-500">∞</div>
              <div className="text-xs text-muted-foreground">Possible compositions</div>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">How it works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { icon: '📝', title: '1. Describe', desc: 'Tell the AI what you want to create' },
              { icon: '🤖', title: '2. AI Suggests', desc: 'Get an extension graph instantly' },
              { icon: '🎨', title: '3. Compose', desc: 'Adjust visually in the graph editor' },
              { icon: '🚀', title: '4. Publish', desc: 'Go live with Liquid economy' },
            ].map((step) => (
              <Card key={step.title}>
                <CardContent className="p-4">
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent experiences */}
        {experienceCount > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent experiences</h3>
              <Button variant="ghost" size="sm" onClick={() => setView('experiences')} className="h-7 text-xs">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {expData?.experiences.slice(0, 4).map((exp: any) => (
                <Card key={exp.id} className="hover:shadow-sm transition-shadow cursor-pointer" >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{exp.title}</span>
                      <Badge variant="outline" className="text-[9px] h-4 shrink-0">{exp.intent.kind}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{exp.description.slice(0, 100)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Experiences are compositions of Extensions.</span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" /> Powered by the PlayLiquid Kernel
          </span>
        </div>
      </footer>
    </div>
  );
}
