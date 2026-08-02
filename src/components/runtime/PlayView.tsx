'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { ContainmentFrame } from '@/components/consumer-v2/ContainmentFrame';
import { NativeGamePlayer } from '@/components/runtime/NativeGamePlayer';
import { Html5GamePlayer } from '@/components/runtime/Html5GamePlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Zap, Globe, AlertCircle, Cpu } from 'lucide-react';

interface ExperienceRuntime {
  experienceId: string;
  title: string;
  description: string;
  creatorId: string;
  runtimeType: 'native' | 'html5' | 'external';
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
 * Phase 20.5 — Play View
 * -----------------------
 * The unified play surface for both native and HTML5 experiences.
 * Loads the runtime info, then renders the appropriate player inside
 * the ContainmentFrame.
 *
 *   runtimeType = native → NativeGamePlayer (kernel session + canvas)
 *   runtimeType = html5  → Html5GamePlayer (iframe + postMessage bridges)
 *
 * Both produce telemetry that feeds back into the Evolution System.
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
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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

  const aspectRatio = runtime.containment.aspectRatio ?? '16:9';

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
          <RuntimeBadge type={runtime.runtimeType} />
          {finalScore !== null && (
            <Badge className="bg-amber-500 text-white text-[10px]">Score: {finalScore}</Badge>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4">
        <div className="w-full" style={{ height: 'min(70vh, 480px)' }}>
          <ContainmentFrame
            aspectRatio={aspectRatio}
            orientation={runtime.containment.orientation as 'portrait' | 'landscape' | 'any'}
            onPerformanceMetric={(fps) => { /* could emit telemetry */ }}
          >
            {runtime.runtimeType === 'native' && runtime.bundle ? (
              <NativeGamePlayer
                experienceId={runtime.experienceId}
                bundle={runtime.bundle}
                onScore={(s) => setFinalScore(s)}
              />
            ) : runtime.runtimeType === 'html5' && runtime.containment.html5BundleUrl ? (
              <Html5GamePlayer
                experienceId={runtime.experienceId}
                gameUrl={runtime.containment.html5BundleUrl}
                aspectRatio={aspectRatio}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <p className="text-sm text-muted-foreground">Unsupported runtime: {runtime.runtimeType}</p>
              </div>
            )}
          </ContainmentFrame>
        </div>

        {/* Runtime info */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-medium">Runtime</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {runtime.runtimeType === 'native'
                ? 'Native PlayLiquid kernel — tick-based extension graph executed server-side.'
                : runtime.runtimeType === 'html5'
                ? 'Imported HTML5 game — Canvas API + JavaScript in a sandboxed iframe.'
                : 'External runtime.'}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium">Extensions</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {runtime.bundle?.instances?.length ?? 0} instances
              {runtime.bundle?.instances?.length > 0 && (
                <span className="ml-1 text-muted-foreground/70">
                  ({runtime.bundle.instances.map((i: any) => i.extensionId.replace('pl.', '')).join(', ')})
                </span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium">Containment</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              ADR-005 compliant — running inside PlayLiquid Frame.
              Aspect {aspectRatio}, {runtime.containment.orientation}.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid ContainmentFrame — {runtime.runtimeType} runtime · telemetry feeds the Evolution System
      </footer>
    </div>
  );
}

function RuntimeBadge({ type }: { type: string }) {
  if (type === 'native') {
    return (
      <Badge className="bg-violet-500 text-white text-[9px] gap-1">
        <Cpu className="w-2.5 h-2.5" /> Native
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
  return <Badge variant="outline" className="text-[9px]">{type}</Badge>;
}
