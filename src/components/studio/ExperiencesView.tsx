'use client';

import { useExperiences, useFork } from '@/hooks/use-studio';
import { useStudioStore } from '@/stores/studio-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitFork, Play, Clock, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import type { PublishedExperience } from '@/kernel/types';

export function ExperiencesView() {
  const { data, isLoading } = useExperiences();
  const fork = useFork();
  const { setView, setDraft } = useStudioStore();

  const handleFork = async (exp: PublishedExperience) => {
    try {
      const result = await fork.mutateAsync(exp.id);
      if (result.draft) {
        setDraft({
          id: result.draft.id,
          title: result.draft.title,
          description: result.draft.description,
          bundle: result.draft.bundle,
          intent: result.draft.intent,
          parentExperienceId: result.draft.parentExperienceId,
        });
        toast.success(`Forked "${exp.title}"`, { description: 'New draft created — edit and publish your version' });
      }
    } catch (e) {
      toast.error('Fork failed', { description: (e as Error).message });
    }
  };

  const experiences = data?.experiences ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Discover Experiences</h1>
          <p className="text-sm text-muted-foreground">Browse and fork experiences created with PlayLiquid Studio</p>
        </div>
        <Button onClick={() => setView('home-v3')} variant="outline" size="sm">
          ← Studio Home
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : experiences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">No published experiences yet.</p>
            <Button onClick={() => setView('wizard')} className="bg-amber-500 hover:bg-amber-600 text-white">
              Create the first one
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {experiences.map((exp: PublishedExperience) => (
            <Card key={exp.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{exp.title}</h3>
                    <p className="text-xs text-muted-foreground">by {exp.creatorName}</p>
                  </div>
                  {exp.parentExperienceId && (
                    <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                      <GitFork className="w-2.5 h-2.5 mr-0.5" /> fork
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{exp.description.slice(0, 120)}</p>

                {/* Genome summary */}
                {exp.genome && (
                  <div className="flex gap-1 flex-wrap mb-3">
                    <Badge variant="outline" className="text-[9px] h-4">{exp.intent.kind}</Badge>
                    {exp.intent.emotions.slice(0, 2).map((e) => (
                      <Badge key={e} variant="outline" className="text-[9px] h-4">{e}</Badge>
                    ))}
                    {exp.genome.hasEconomy && <Badge className="text-[9px] h-4 bg-amber-500 text-white">econ</Badge>}
                    <Badge variant="outline" className="text-[9px] h-4">depth {exp.genome.compositionDepth}</Badge>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Play className="w-2.5 h-2.5" /> {exp.playCount}</span>
                  <span className="flex items-center gap-1"><GitFork className="w-2.5 h-2.5" /> {exp.forkCount}</span>
                  <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> {exp.likeCount}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => handleFork(exp)}>
                    <GitFork className="w-3 h-3" /> Fork
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
