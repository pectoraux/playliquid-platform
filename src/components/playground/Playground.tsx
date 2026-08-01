'use client';

/**
 * Kernel Developer Playground (from v0.1)
 * ----------------------------------------
 * The developer-facing UI for the kernel. Accessible from Studio via the
 * "Kernel" button. This is the original v0.1 playground, now a view within
 * the Studio app.
 */

import { usePlaygroundStore } from '@/stores/playground-store';
import { useExtensions, useCompile, useStartSession, useSettle, useTick, useAction } from '@/hooks/use-kernel';
import { DEMOS } from '@/components/playground/demos';
import { GraphEditor } from '@/components/playground/GraphEditor';
import { RuntimeInspector } from '@/components/playground/RuntimeInspector';
import { LedgerView } from '@/components/playground/LedgerView';
import { TokenView } from '@/components/playground/TokenView';
import { TelemetryView } from '@/components/playground/TelemetryView';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Play, Loader2, CheckCircle2, XCircle, Zap, Terminal, Coins, BookOpen, Activity, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { useStudioStore } from '@/stores/studio-store';

export function Playground() {
  const {
    bundle, sessionId, sessionStatus, compileResult, activeTab,
    isAutoTicking, setBundle, setSessionId, setSessionStatus,
    setCompileResult, setActiveTab, setAutoTicking,
  } = usePlaygroundStore();

  const { setView } = useStudioStore();
  const extensions = useExtensions();
  const compile = useCompile();
  const startSession = useStartSession();
  const settle = useSettle();
  const tick = useTick();
  const action = useAction();

  const autoTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isAutoTicking && sessionId && sessionStatus === 'active') {
      autoTickRef.current = setInterval(() => {
        tick.mutate({ sessionId, ticks: 1 });
      }, 250);
    } else if (autoTickRef.current) {
      clearInterval(autoTickRef.current);
      autoTickRef.current = null;
    }
    return () => { if (autoTickRef.current) clearInterval(autoTickRef.current); };
  }, [isAutoTicking, sessionId, sessionStatus, tick]);

  const handleCompile = async () => {
    try {
      const result = await compile.mutateAsync(bundle);
      setCompileResult(result);
      if (result.valid) {
        toast.success('Graph compiled', {
          description: `Execution order: ${result.executionOrder.join(' → ')} · deterministic: ${result.deterministic ? 'yes' : 'no'}`,
        });
      } else {
        toast.error('Compilation failed', {
          description: result.errors.map((e: any) => `[${e.code}] ${e.message}`).join('\n'),
        });
      }
    } catch (e) {
      toast.error('Compile error', { description: (e as Error).message });
    }
  };

  const handleStart = async () => {
    if (!compileResult?.valid) { toast.error('Compile the graph first'); return; }
    setSessionStatus('starting');
    try {
      const result = await startSession.mutateAsync({
        experienceId: bundle.name ?? 'experience',
        bundle,
        mode: 'PREVIEW',
        userId: 'demo-user',
      });
      if (result.valid && result.sessionId) {
        setSessionId(result.sessionId);
        setSessionStatus('active');
        setActiveTab('inspector');
        toast.success('Session started', { description: result.sessionId });
      } else {
        setSessionStatus('idle');
        toast.error('Session start failed', { description: result.errors?.map((e: any) => e.message).join('\n') });
      }
    } catch (e) {
      setSessionStatus('idle');
      toast.error('Session error', { description: (e as Error).message });
    }
  };

  const handleSettle = async () => {
    if (!sessionId) return;
    setAutoTicking(false);
    try {
      await settle.mutateAsync(sessionId);
      setSessionStatus('ended');
      toast.success('Session settled');
      setActiveTab('ledger');
    } catch (e) {
      toast.error('Settle error', { description: (e as Error).message });
    }
  };

  const handleAction = async (act: string) => {
    if (!sessionId) return;
    await action.mutateAsync({ sessionId, instanceId: 'physics', action: act });
  };

  const loadDemo = (demo: typeof DEMOS[number]) => {
    setBundle(JSON.parse(JSON.stringify(demo.bundle)));
    setSessionId(null);
    setSessionStatus('idle');
    setCompileResult(null);
    setActiveTab('graph');
    toast.info(`Loaded ${demo.title}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setView('home')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Studio
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-white font-bold text-xs">
              ⚙
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Kernel Developer Playground</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">v0.1 — direct kernel access</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap ml-4">
            <span className="text-xs text-muted-foreground mr-1">Demos:</span>
            {DEMOS.map((d) => (
              <Button key={d.id} size="sm" variant="outline" onClick={() => loadDemo(d)} className="h-7 text-xs">
                {d.title.split('—')[0].trim()}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCompile} disabled={compile.isPending} className="h-8">
              {compile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
              Compile
            </Button>
            <Button size="sm" onClick={handleStart} disabled={!compileResult?.valid || sessionStatus === 'active'} className="h-8 bg-amber-500 hover:bg-amber-600 text-white">
              <Play className="w-3.5 h-3.5" /> Start Session
            </Button>
            {sessionStatus === 'active' && (
              <Button size="sm" variant="destructive" onClick={handleSettle} className="h-8">Settle & End</Button>
            )}
          </div>
        </div>
        {compileResult && (
          <div className="border-t border-border bg-muted/30">
            <div className="max-w-[1600px] mx-auto px-4 py-1.5 flex items-center gap-3 text-xs">
              {compileResult.valid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-mono">valid</span>
                  <Badge variant="secondary" className="text-[10px] h-4">{compileResult.executionOrder.join(' → ')}</Badge>
                  <Badge variant={compileResult.deterministic ? 'default' : 'outline'} className="text-[10px] h-4">
                    {compileResult.deterministic ? 'deterministic' : 'non-deterministic'}
                  </Badge>
                  {compileResult.contentHash && <span className="text-muted-foreground font-mono">hash: {compileResult.contentHash}</span>}
                  {compileResult.declaredTokens.length > 0 && (
                    <span className="text-muted-foreground">tokens: {compileResult.declaredTokens.map((t: any) => t.symbol).join(', ')}</span>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="font-mono text-red-500">{compileResult.errors.length} error{compileResult.errors.length !== 1 ? 's' : ''}</span>
                  <span className="text-muted-foreground truncate">{compileResult.errors[0]?.message}</span>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-5 max-w-md">
            <TabsTrigger value="graph" className="text-xs gap-1.5"><Zap className="w-3.5 h-3.5" /> Graph</TabsTrigger>
            <TabsTrigger value="inspector" className="text-xs gap-1.5"><Activity className="w-3.5 h-3.5" /> Runtime</TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Ledger</TabsTrigger>
            <TabsTrigger value="tokens" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Tokens</TabsTrigger>
            <TabsTrigger value="telemetry" className="text-xs gap-1.5"><Terminal className="w-3.5 h-3.5" /> Telemetry</TabsTrigger>
          </TabsList>
          <TabsContent value="graph" className="mt-4"><GraphEditor /></TabsContent>
          <TabsContent value="inspector" className="mt-4">
            <RuntimeInspector
              sessionId={sessionId}
              status={sessionStatus}
              onTick={(n) => tick.mutate({ sessionId: sessionId!, ticks: n })}
              onAction={handleAction}
              onSettle={handleSettle}
              onAutoTickToggle={() => setAutoTicking(!isAutoTicking)}
              isAutoTicking={isAutoTicking}
              isTicking={tick.isPending}
            />
          </TabsContent>
          <TabsContent value="ledger" className="mt-4"><LedgerView /></TabsContent>
          <TabsContent value="tokens" className="mt-4"><TokenView sessionId={sessionId} /></TabsContent>
          <TabsContent value="telemetry" className="mt-4"><TelemetryView /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Bundle: <span className="font-mono">{bundle.name}</span> · {bundle.type}</span>
          <span>·</span>
          <span>{bundle.instances.length} instance(s) · {bundle.wires.length} wire(s)</span>
          {sessionId && (
            <>
              <span>·</span>
              <span className="font-mono">{sessionId.slice(0, 20)}…</span>
              <Badge variant="outline" className="text-[10px] h-4">{sessionStatus}</Badge>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
