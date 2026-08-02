'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cpu, Globe, Loader2, CheckCircle2, Play, Upload, Zap, ArrowRight,
  AlertCircle, FileCode,
} from 'lucide-react';

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
 * Phase 20.5 — Runtime Tab
 * -------------------------
 * Validates ADR-005 (Containment): native + HTML5 experiences both run
 * inside the PlayLiquid frame.
 *
 *   - Seed the canonical native "Neon Runner" game
 *   - Import the "Orb Collector" HTML5 game
 *   - Play either one to verify the full runtime path
 */
export function RuntimeTab() {
  const { playExperience } = useStudioStore();
  const [importedGames, setImportedGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<{ games: any[] }>('/api/runtime/import-html5');
        if (!cancelled) setImportedGames(d.games ?? []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadToken]);

  const seedNative = async () => {
    setBusy('native');
    setMessage(null);
    try {
      const d = await postJSON<{ experienceId: string; created: boolean; message?: string }>('/api/runtime/import-html5', { mode: 'seed-native' });
      setMessage(d.message ?? 'Native game ready');
      reload();
    } catch {
      setMessage('Failed to seed native game');
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
      {/* Validation header */}
      <Card className="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 border-violet-300">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium">ADR-005 Runtime Validation</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Every experience must run inside the PlayLiquid ContainmentFrame — regardless of runtime type.
            Seed a native game and import an HTML5 game, then play both to verify the full path:
            ExperienceRecord → Bundle → ContainmentFrame → Runtime → Telemetry → Evolution.
          </p>
        </CardContent>
      </Card>

      {/* Two columns: Native + HTML5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Native */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-500" /> Native Runtime
            </CardTitle>
            <CardDescription className="text-xs">PlayLiquid kernel — tick-based extension graph</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-[10px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Extensions: Physics + Movement + Score + CoinCollector + Competition</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-emerald-500" />
                <span>Rendered on canvas, driven by kernel sessions API</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={seedNative} disabled={busy === 'native'}>
                {busy === 'native' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Seed Neon Runner
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* HTML5 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" /> HTML5 Imported
            </CardTitle>
            <CardDescription className="text-xs">Standalone game in a sandboxed iframe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-[10px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3 h-3 text-blue-500" />
                <span>Pure Canvas API + JavaScript (no frameworks)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-amber-500" />
                <span>Input bridge (pl:input) + Telemetry bridge (pl:telemetry)</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={importHtml5} disabled={busy === 'html5'}>
                {busy === 'html5' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Import Orb Collector
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status message */}
      {message && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-emerald-700 dark:text-emerald-400">{message}</span>
        </div>
      )}

      {/* Imported games list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" /> Imported HTML5 Games
          </CardTitle>
          <CardDescription className="text-xs">Games running inside the ContainmentFrame via iframe + postMessage</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : importedGames.length === 0 ? (
            <div className="py-4 text-center">
              <Globe className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No imported games yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Import Orb Collector" to create one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {importedGames.map((g) => (
                <div key={g.experienceId} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{g.experienceName}</div>
                    <div className="text-[9px] text-muted-foreground font-mono truncate">{g.storageUrl}</div>
                  </div>
                  <Badge variant="outline" className="text-[8px] h-3.5">{g.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] gap-1"
                    onClick={() => playExperience(g.experienceId)}
                  >
                    <Play className="w-3 h-3" /> Play
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Architecture note */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-[10px] text-muted-foreground">
              <span className="font-medium">Architecture:</span> Native and HTML5 experiences become
              indistinguishable after entering PlayLiquid. Both produce telemetry that feeds the
              Evolution System. Both appear in the Consumer Home. Both participate in the same
              Experience Graph, Extensions, and Economy.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
