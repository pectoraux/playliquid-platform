'use client';

import { useStudioStore } from '@/stores/studio-store';
import { bundleToNodes } from '@/components/studio/GraphEditor';
import { useExtensions, useCompile, useStartSession, useSettle, useTick } from '@/hooks/use-kernel';
import { useUpdateDraft, usePublish } from '@/hooks/use-studio';
import { ExtensionLibrary } from './ExtensionLibrary';
import { GraphEditor, createExtensionNode } from './GraphEditor';
import { ConfigInspector } from './ConfigInspector';
import { RuntimePreview } from './RuntimePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Play, Save, Upload, Loader2, CheckCircle2, XCircle,
  Zap, Activity, Coins, BookOpen, User, Home, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef, useMemo } from 'react';
import type { ExtensionManifest } from '@/kernel/types';

export function StudioEditor() {
  const {
    draftId, draftTitle, draftDescription, bundle, intent,
    nodes, edges, selectedInstanceId, sessionId, sessionStatus,
    compileResult, isAutoTicking,
    setNodes, setEdges, setTitle, addInstance, updateInstanceConfig,
    setCompileResult, setSessionId, setSessionStatus, setAutoTicking,
    setView,
  } = useStudioStore();

  const extensions = useExtensions();
  const compile = useCompile();
  const startSession = useStartSession();
  const settle = useSettle();
  const tick = useTick();
  const updateDraft = useUpdateDraft();
  const publish = usePublish();

  // Manifest lookup map
  const manifestMap = useMemo(() => {
    const m = new Map<string, ExtensionManifest>();
    for (const ext of extensions.data?.extensions ?? []) {
      m.set(ext.id, ext as any);
    }
    return m;
  }, [extensions.data]);

  // Auto-tick loop
  const autoTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isAutoTicking && sessionId && sessionStatus === 'active') {
      autoTickRef.current = setInterval(() => {
        tick.mutate({ sessionId, ticks: 1 });
      }, 300);
    } else if (autoTickRef.current) {
      clearInterval(autoTickRef.current);
      autoTickRef.current = null;
    }
    return () => { if (autoTickRef.current) clearInterval(autoTickRef.current); };
  }, [isAutoTicking, sessionId, sessionStatus, tick]);

  const handleAddExtension = (manifest: ExtensionManifest) => {
    const node = createExtensionNode(manifest);
    addInstance(node as any);
    toast.info(`Added ${manifest.name}`, { description: node.id });
  };

  const handleCompile = async () => {
    // Sync bundle with current node positions + configs
    const syncedBundle = {
      ...bundle,
      name: draftTitle,
      instances: nodes.map((n) => {
        const data = n.data as any;
        return {
          id: n.id,
          extensionId: data.extensionId,
          config: data.config,
          role: data.role,
        };
      }),
    };
    try {
      const result = await compile.mutateAsync(syncedBundle);
      setCompileResult(result);
      if (result.valid) {
        toast.success('Graph compiled', {
          description: `${result.executionOrder.join(' → ')} · ${result.deterministic ? 'deterministic' : 'non-det'}`,
        });
      } else {
        toast.error('Compilation failed', {
          description: result.errors[0]?.message ?? 'Unknown error',
        });
      }
    } catch (e) {
      toast.error('Compile error', { description: (e as Error).message });
    }
  };

  const handleSave = async () => {
    if (!draftId) return;
    const syncedBundle = {
      ...bundle,
      name: draftTitle,
      instances: nodes.map((n) => {
        const data = n.data as any;
        return { id: n.id, extensionId: data.extensionId, config: data.config, role: data.role };
      }),
    };
    try {
      await updateDraft.mutateAsync({
        id: draftId,
        updates: { title: draftTitle, description: draftDescription, bundle: syncedBundle, intent },
      });
      toast.success('Draft saved');
    } catch (e) {
      toast.error('Save failed', { description: (e as Error).message });
    }
  };

  const handleStart = async () => {
    if (!compileResult?.valid) {
      toast.error('Compile the graph first');
      return;
    }
    setSessionStatus('starting');
    const syncedBundle = {
      ...bundle,
      name: draftTitle,
      instances: nodes.map((n) => {
        const data = n.data as any;
        return { id: n.id, extensionId: data.extensionId, config: data.config, role: data.role };
      }),
    };
    try {
      const result = await startSession.mutateAsync({
        experienceId: draftTitle.toLowerCase().replace(/\s+/g, '-'),
        bundle: syncedBundle,
        mode: 'PREVIEW',
        userId: 'demo-user',
      });
      if (result.valid && result.sessionId) {
        setSessionId(result.sessionId);
        setSessionStatus('active');
        toast.success('Session started');
      } else {
        setSessionStatus('idle');
        toast.error('Start failed', { description: result.errors?.[0] });
      }
    } catch (e) {
      setSessionStatus('idle');
      toast.error('Session error', { description: (e as Error).message });
    }
  };

  const handlePublish = async () => {
    if (!draftId) return;
    // Save first
    await handleSave();
    // Then publish
    try {
      const result = await publish.mutateAsync(draftId);
      if (result.experience) {
        toast.success('Experience published!', {
          description: `"${result.experience.title}" is now live`,
        });
        setView('experiences');
      }
    } catch (e) {
      toast.error('Publish failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="px-3 py-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView('home-v3')} className="h-8 px-2">
            <Home className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Input
            value={draftTitle}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 w-48 text-sm font-medium border-none focus-visible:ring-1"
            placeholder="Experience title"
          />
          <Badge variant="outline" className="text-[10px] h-5">{intent.kind}</Badge>
          {intent.emotions.slice(0, 2).map((e) => (
            <Badge key={e} variant="outline" className="text-[9px] h-5">{e}</Badge>
          ))}

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={!draftId || updateDraft.isPending} className="h-8">
              <Save className="w-3.5 h-3.5" /> Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleCompile} disabled={compile.isPending} className="h-8">
              {compile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Compile
            </Button>
            <Button size="sm" onClick={handleStart} disabled={!compileResult?.valid || sessionStatus === 'active'} className="h-8 bg-amber-500 hover:bg-amber-600 text-white">
              <Play className="w-3.5 h-3.5" /> Play Test
            </Button>
            <Button size="sm" variant="default" onClick={handlePublish} disabled={!draftId || publish.isPending} className="h-8">
              <Upload className="w-3.5 h-3.5" /> Publish
            </Button>
          </div>
        </div>

        {/* Compile status */}
        {compileResult && (
          <div className="px-3 py-1 border-t border-border bg-muted/30 flex items-center gap-2 text-xs">
            {compileResult.valid ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="font-mono">valid</span>
                <Badge variant="secondary" className="text-[9px] h-4">{compileResult.executionOrder.join(' → ')}</Badge>
                <Badge variant={compileResult.deterministic ? 'default' : 'outline'} className="text-[9px] h-4">
                  {compileResult.deterministic ? 'deterministic' : 'non-det'}
                </Badge>
                {compileResult.declaredTokens.length > 0 && (
                  <span className="text-muted-foreground">
                    tokens: {compileResult.declaredTokens.map((t: any) => t.symbol).join(', ')}
                  </span>
                )}
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-red-500" />
                <span className="font-mono text-red-500">{compileResult.errors.length} error(s)</span>
                <span className="text-muted-foreground truncate">{compileResult.errors[0]?.message}</span>
              </>
            )}
          </div>
        )}
      </header>

      {/* ── 3-Panel Layout ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Extension Library */}
        <div className="w-64 border-r border-border bg-card shrink-0">
          <ExtensionLibrary onAddExtension={handleAddExtension} />
        </div>

        {/* Center: Graph Canvas */}
        <div className="flex-1 relative">
          <GraphEditor onAddExtension={handleAddExtension} />
        </div>

        {/* Right: Inspector + Preview (split) */}
        <div className="w-72 border-l border-border bg-card shrink-0 flex flex-col">
          {/* Inspector (top half) */}
          <div className="flex-1 border-b border-border overflow-hidden">
            <ConfigInspector />
          </div>
          {/* Runtime Preview (bottom half) */}
          <div className="h-72 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border bg-muted/30">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Runtime Preview
              </span>
            </div>
            <div className="h-[calc(100%-2rem)]">
              <RuntimePreview
                sessionId={sessionId}
                sessionStatus={sessionStatus}
                onSetSessionId={setSessionId}
                onSetStatus={setSessionStatus}
                onSetAutoTick={setAutoTicking}
                isAutoTicking={isAutoTicking}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card/50 px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-2">
          <span>{nodes.length} extension{nodes.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{edges.length} wire{edges.length !== 1 ? 's' : ''}</span>
          {sessionId && (
            <>
              <span>·</span>
              <span className="font-mono">{sessionId.slice(0, 20)}…</span>
              <Badge variant="outline" className="text-[9px] h-4">{sessionStatus}</Badge>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setView('experiences')} className="hover:text-foreground flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Browse
          </button>
          <button onClick={() => setView('creator')} className="hover:text-foreground flex items-center gap-1">
            <User className="w-3 h-3" /> Profile
          </button>
        </div>
      </footer>
    </div>
  );
}
