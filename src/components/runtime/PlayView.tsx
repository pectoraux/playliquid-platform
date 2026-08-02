'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { ContainmentFrame } from '@/components/consumer-v2/ContainmentFrame';
import { GameCanvas } from '@/components/runtime/GameCanvas';
import { Html5GamePlayer } from '@/components/runtime/Html5GamePlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Globe, AlertCircle, Cpu, Zap, Play } from 'lucide-react';
import { GAMES } from '@/engine/games';
import { SPARKS } from '@/engine/sparks';

interface ExperienceRuntime {
  experienceId: string;
  title: string;
  description: string;
  creatorId: string;
  runtimeType: 'native' | 'html5' | 'external' | 'spark';
  engineGameId?: string;
  bundle: any;
  containment: {
    aspectRatio: string | null;
    orientation: string;
    html5BundleUrl: string | null;
    externalUrl: string | null;
  };
}

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
 * Phase 21 — Play View
 * ---------------------
 * The unified play surface. Routes to the correct runtime:
 *   spark → GameCanvas (9:16 vertical, PlayEngine spark game)
 *   native → GameCanvas (16:9, PlayEngine game)
 *   html5 → Html5GamePlayer (iframe + postMessage)
 */
export function PlayView({ experienceId }: { experienceId: string }) {
  const { setView } = useStudioStore();
  const [runtime, setRuntime] = useState<ExperienceRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await fetchJSON<{ runtime: ExperienceRuntime }>(`/api/runtime/bundle/${experienceId}`);
        if (cancelled) return;
        if (d.runtime) {
          setRuntime(d.runtime);
        } else {
          setError('Experience not found');
        }
      } catch {
        if (!cancelled) setError('Failed to load experience runtime');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading experience…</p>
        </div>
      </div>
    );
  }

  if (error || !runtime) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">{error ?? 'Experience not found'}</p>
        <Button variant="outline" size="sm" onClick={() => setView('home-v2')}>Back to Home</Button>
      </div>
    );
  }

  // Resolve the engine game (spark or native)
  // Fall back to title-based matching for experiences seeded before Phase 21
  const engineGameId = runtime.engineGameId
    ?? ((): string | undefined => {
      const title = runtime.title.toLowerCase();
      if (title.includes('neon runner') || title.includes('runner')) return 'neon-runner';
      if (title.includes('sky defender') || title.includes('defend') || title.includes('shoot')) return 'sky-defender';
      if (title.includes('coin rush') || title.includes('collect')) return 'coin-rush';
      if (title.includes('catch the stars') || title.includes('star')) return 'catch-stars';
      if (title.includes('reaction')) return 'reaction-challenge';
      if (title.includes('pet') || title.includes('cuddle')) return 'tap-pet';
      return undefined;
    })();
  const sparkGame = engineGameId ? SPARKS[engineGameId] : undefined;
  const nativeGame = engineGameId ? GAMES[engineGameId] : undefined;
  const isSpark = runtime.runtimeType === 'spark' || runtime.title.toLowerCase().includes('pet') || runtime.title.toLowerCase().includes('reaction') || runtime.title.toLowerCase().includes('catch') || !!sparkGame;
  const aspectRatio = isSpark ? '9:16' : (runtime.containment.aspectRatio ?? '16:9');
  const orientation = isSpark ? 'portrait' : (runtime.containment.orientation as 'portrait' | 'landscape' | 'any');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('home-v2')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{runtime.title}</h1>
            <p className="text-[10px] text-muted-foreground truncate">{runtime.description}</p>
          </div>
          <RuntimeBadge type={runtime.runtimeType} isSpark={isSpark} />
          {finalScore !== null && (
            <Badge className="bg-amber-500 text-white text-[10px]">Score: {finalScore}</Badge>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 flex items-center justify-center">
        {isSpark ? (
          /* Spark: vertical 9:16, centered, max height */
          <div className="h-[calc(100vh-140px)] flex items-center justify-center">
            <ContainmentFrame aspectRatio="9:16" orientation="portrait" fullscreenEnabled={false}>
              {sparkGame ? (
                <GameCanvas
                  key={sparkGame.id}
                  game={sparkGame}
                  onScore={setFinalScore}
                  onEnd={(score) => setFinalScore(score)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <p className="text-sm text-muted-foreground">Spark game not found: {engineGameId}</p>
                </div>
              )}
            </ContainmentFrame>
          </div>
        ) : (
          /* Game: 16:9 landscape */
          <div className="w-full" style={{ height: 'min(70vh, 480px)' }}>
            <ContainmentFrame aspectRatio={aspectRatio} orientation={orientation}>
              {runtime.runtimeType === 'html5' && runtime.containment.html5BundleUrl ? (
                <Html5GamePlayer
                  experienceId={runtime.experienceId}
                  gameUrl={runtime.containment.html5BundleUrl}
                  aspectRatio={aspectRatio}
                />
              ) : nativeGame ? (
                <GameCanvas
                  key={nativeGame.id}
                  game={nativeGame}
                  onScore={setFinalScore}
                  onEnd={(score) => setFinalScore(score)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <p className="text-sm text-muted-foreground">Game not found: {engineGameId}</p>
                </div>
              )}
            </ContainmentFrame>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid {isSpark ? 'Spark' : 'Game'} Runtime · {runtime.runtimeType} · telemetry feeds the Evolution System
      </footer>
    </div>
  );
}

function RuntimeBadge({ type, isSpark }: { type: string; isSpark: boolean }) {
  if (isSpark) {
    return (
      <Badge className="bg-rose-500 text-white text-[9px] gap-1">
        <Zap className="w-2.5 h-2.5" /> Spark
      </Badge>
    );
  }
  if (type === 'html5') {
    return (
      <Badge className="bg-emerald-500 text-white text-[9px] gap-1">
        <Globe className="w-2.5 h-2.5" /> HTML5
      </Badge>
    );
  }
  if (type === 'native') {
    return (
      <Badge className="bg-violet-500 text-white text-[9px] gap-1">
        <Cpu className="w-2.5 h-2.5" /> Native
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[9px]">{type}</Badge>;
}
