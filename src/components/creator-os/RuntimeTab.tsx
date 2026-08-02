'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cpu, Globe, Loader2, CheckCircle2, Play, Zap, ArrowRight,
  AlertCircle, Sparkles, Gamepad2,
} from 'lucide-react';
import { GAMES } from '@/engine/games';
import { SPARKS } from '@/engine/sparks';

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

/**
 * Phase 21 — Runtime Tab
 * -----------------------
 * Shows the engine game catalog + sparks. Seeds all games + sparks.
 */
export function RuntimeTab() {
  const { playExperience } = useStudioStore();
  const [importedGames, setImportedGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [engineExps, setEngineExps] = useState<Record<string, string>>({});
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Fetch imported HTML5 games
        const d = await fetchJSON<{ games: any[] }>('/api/runtime/import-html5');
        if (!cancelled) setImportedGames(d.games ?? []);
        // Fetch all published experiences to map game names → experienceIds
        const home = await fetchJSON<any>('/api/consumer-v2/home?userId=demo-user');
        if (!cancelled) {
          const map: Record<string, string> = {};
          for (const exp of [...(home.home?.experiences ?? []), ...(home.home?.sparks ?? [])]) {
            map[exp.title] = exp.experienceId;
          }
          setEngineExps(map);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadToken]);

  const seedAll = async () => {
    setBusy('seed');
    setMessage(null);
    try {
      const d = await postJSON<{ created: string[] }>('/api/runtime/import-html5', { mode: 'seed-engine' });
      setMessage(`Seeded ${d.created.length} games + sparks`);
      reload();
    } catch {
      setMessage('Failed to seed games');
    } finally {
      setBusy(null);
    }
  };

  const importHtml5 = async () => {
    setBusy('html5');
    setMessage(null);
    try {
      const d = await postJSON<{ experienceId: string; created: boolean; message?: string }>('/api/runtime/import-html5', { mode: 'seed-html5' });
      setMessage(d.message ?? 'HTML5 game imported');
      reload();
    } catch {
      setMessage('Failed to import HTML5 game');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={seedAll} disabled={busy === 'seed'}>
          {busy === 'seed' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          Seed All Games + Sparks
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={importHtml5} disabled={busy === 'html5'}>
          {busy === 'html5' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
          Import Orb Collector (HTML5)
        </Button>
      </div>

      {message && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-emerald-700 dark:text-emerald-400">{message}</span>
        </div>
      )}

      {/* Sparks section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-500" /> Sparks
            <Badge variant="outline" className="text-[8px] h-3.5">9:16 · Touch · Instant</Badge>
          </CardTitle>
          <CardDescription className="text-xs">Vertical, touch-native mini-experiences — the YouTube Shorts of PlayLiquid</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.values(SPARKS).map((spark) => {
              const expId = engineExps[spark.name];
              return (
                <div key={spark.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-rose-500 text-white text-[7px] h-3">SPARK</Badge>
                    <span className="text-xs font-medium truncate">{spark.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">{spark.description}</p>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {spark.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[7px] h-3 px-1">{t}</Badge>
                    ))}
                  </div>
                  {expId ? (
                    <Button size="sm" variant="default" className="w-full h-6 text-[10px] gap-1" onClick={() => playExperience(expId)}>
                      <Play className="w-3 h-3" /> Play
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[8px] h-5 w-full justify-center">Not seeded</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Games section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-violet-500" /> Native Games
            <Badge variant="outline" className="text-[8px] h-3.5">16:9 · PlayEngine</Badge>
          </CardTitle>
          <CardDescription className="text-xs">Long-form interactive games powered by the PlayLiquid Game Engine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.values(GAMES).map((game) => {
              const expId = engineExps[game.name];
              return (
                <div key={game.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-violet-500 text-white text-[7px] h-3">GAME</Badge>
                    <span className="text-xs font-medium truncate">{game.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">{game.description}</p>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {game.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[7px] h-3 px-1">{t}</Badge>
                    ))}
                    {game.tags.includes('competitive') && (
                      <Badge className="text-[7px] h-3 bg-emerald-500 text-white">🏆</Badge>
                    )}
                  </div>
                  {expId ? (
                    <Button size="sm" variant="default" className="w-full h-6 text-[10px] gap-1" onClick={() => playExperience(expId)}>
                      <Play className="w-3 h-3" /> Play
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[8px] h-5 w-full justify-center">Not seeded</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Imported HTML5 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" /> Imported HTML5 Games
          </CardTitle>
          <CardDescription className="text-xs">Standalone games running inside the ContainmentFrame via iframe</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : importedGames.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No imported games yet. Click "Import Orb Collector" above.</p>
          ) : (
            <div className="space-y-2">
              {importedGames.map((g) => (
                <div key={g.experienceId} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{g.experienceName}</div>
                    <div className="text-[9px] text-muted-foreground font-mono truncate">{g.storageUrl}</div>
                  </div>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => playExperience(g.experienceId)}>
                    <Play className="w-3 h-3" /> Play
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
