'use client';

import { usePlaygroundStore } from '@/stores/playground-store';
import { useExtensions } from '@/hooks/use-kernel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ArrowRight, Boxes, Cable } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { WireSpec } from '@/kernel/types';

const CATEGORY_COLORS: Record<string, string> = {
  PHYSICS: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  MECHANIC: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  ECONOMY: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  AI: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  SOCIAL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  RENDER: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
};

export function GraphEditor() {
  const {
    bundle,
    addInstance,
    removeInstance,
    addWire,
    removeWire,
    setBundleName,
    setBundleType,
  } = usePlaygroundStore();

  const { data: extData } = useExtensions();
  const extensions = extData?.extensions ?? [];

  // Wire builder state
  const [fromInstance, setFromInstance] = useState('');
  const [fromChannel, setFromChannel] = useState('');
  const [toInstance, setToInstance] = useState('');
  const [toChannel, setToChannel] = useState('');

  const instanceMap = useMemo(() => {
    const m = new Map<string, (typeof extensions)[number]>();
    for (const inst of bundle.instances) {
      const ext = extensions.find((e) => e.id === inst.extensionId);
      if (ext) m.set(inst.id, ext);
    }
    return m;
  }, [bundle.instances, extensions]);

  const handleAdd = (extensionId: string) => {
    const ext = extensions.find((e) => e.id === extensionId);
    if (!ext) return;
    // Generate a unique instance id: <slug>-<n>
    const base = ext.slug;
    let n = 1;
    while (bundle.instances.some((i) => i.id === `${base}-${n}`)) n++;
    addInstance({
      id: `${base}-${n}`,
      extensionId,
      role: ext.category.toLowerCase() as any,
    });
  };

  const handleAddWire = () => {
    if (!fromInstance || !fromChannel || !toInstance || !toChannel) return;
    if (fromInstance === toInstance) return;
    addWire({
      from: { instance: fromInstance, channel: fromChannel },
      to: { instance: toInstance, channel: toChannel },
    });
    setFromChannel('');
    setToChannel('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
      {/* ── Extension Palette ──────────────────────────────────────────── */}
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Boxes className="w-4 h-4" /> Extension Palette
          </CardTitle>
          <CardDescription className="text-xs">
            Click to add an instance to the bundle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {extensions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            extensions.map((ext) => (
              <button
                key={ext.id}
                onClick={() => handleAdd(ext.id)}
                className="w-full text-left p-2 rounded-md border border-border hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{ext.name}</span>
                  <Badge className={`text-[9px] h-4 ${CATEGORY_COLORS[ext.category] ?? ''}`}>
                    {ext.category}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{ext.description}</p>
                <div className="flex gap-1 mt-1">
                  {ext.outputs.length > 0 && (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400">
                      {ext.outputs.length} out
                    </span>
                  )}
                  {ext.inputs.length > 0 && (
                    <span className="text-[9px] text-blue-600 dark:text-blue-400">
                      {ext.inputs.length} in
                    </span>
                  )}
                  {ext.tokenDefinitions?.length > 0 && (
                    <span className="text-[9px] text-amber-600 dark:text-amber-400">
                      {ext.tokenDefinitions.map((t: any) => t.symbol).join(', ')}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Bundle Canvas ─────────────────────────────────────────────── */}
      <Card className="min-h-[500px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <Input
                value={bundle.name ?? ''}
                onChange={(e) => setBundleName(e.target.value)}
                className="h-7 text-sm font-semibold border-none px-0 focus-visible:ring-0"
                placeholder="Experience name"
              />
            </div>
            <Select value={bundle.type} onValueChange={(v) => setBundleType(v as any)}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GAME">GAME</SelectItem>
                <SelectItem value="SPARK">SPARK</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {bundle.instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-2 text-muted-foreground">
              <Boxes className="w-8 h-8 opacity-40" />
              <p className="text-sm">Empty bundle</p>
              <p className="text-xs">Add extensions from the palette, or load a demo from the header.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Instances ({bundle.instances.length})
              </div>
              <div className="grid gap-2">
                {bundle.instances.map((inst) => {
                  const ext = instanceMap.get(inst.id);
                  if (!ext) return null;
                  return (
                    <div
                      key={inst.id}
                      className="rounded-lg border border-border p-3 bg-card hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{inst.id}</span>
                            <Badge className={`text-[9px] h-4 ${CATEGORY_COLORS[ext.category] ?? ''}`}>
                              {ext.category}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium mt-0.5">{ext.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{ext.id}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => removeInstance(inst.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <div className="text-[9px] uppercase text-blue-600 dark:text-blue-400 mb-1">Inputs</div>
                          {ext.inputs.length === 0 ? (
                            <span className="text-muted-foreground text-[10px]">none</span>
                          ) : (
                            ext.inputs.map((ch: any) => (
                              <div key={ch.name} className="font-mono text-[10px] flex items-center gap-1">
                                <span className={ch.required ? 'text-red-500' : 'text-muted-foreground'}>●</span>
                                <span>{ch.name}</span>
                                <span className="text-muted-foreground text-[9px]">{ch.cardinality}</span>
                              </div>
                            ))
                          )}
                        </div>
                        <div>
                          <div className="text-[9px] uppercase text-emerald-600 dark:text-emerald-400 mb-1">Outputs</div>
                          {ext.outputs.length === 0 ? (
                            <span className="text-muted-foreground text-[10px]">none</span>
                          ) : (
                            ext.outputs.map((ch: any) => (
                              <div key={ch.name} className="font-mono text-[10px]">
                                {ch.name}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {bundle.wires.length > 0 && (
                <>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wolder pt-2">
                    Wires ({bundle.wires.length})
                  </div>
                  <div className="space-y-1">
                    {bundle.wires.map((w, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono p-1.5 rounded border border-border bg-muted/30">
                        <span className="text-emerald-600 dark:text-emerald-400">{w.from.instance}.{w.from.channel}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-blue-600 dark:text-blue-400">{w.to.instance}.{w.to.channel}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 ml-auto text-muted-foreground hover:text-red-500"
                          onClick={() => removeWire(i)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Wire Builder ──────────────────────────────────────────────── */}
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cable className="w-4 h-4" /> Add Wire
          </CardTitle>
          <CardDescription className="text-xs">
            Connect an output channel to an input channel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bundle.instances.length < 2 ? (
            <p className="text-xs text-muted-foreground">
              Add at least 2 instances to wire them together.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-emerald-600 dark:text-emerald-400">From (output)</Label>
                <Select value={fromInstance} onValueChange={(v) => { setFromInstance(v); setFromChannel(''); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="instance" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundle.instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fromInstance && (
                  <Select value={fromChannel} onValueChange={setFromChannel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {instanceMap.get(fromInstance)?.outputs.map((ch: any) => (
                        <SelectItem key={ch.name} value={ch.name}>{ch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex justify-center">
                <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-blue-600 dark:text-blue-400">To (input)</Label>
                <Select value={toInstance} onValueChange={(v) => { setToInstance(v); setToChannel(''); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="instance" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundle.instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {toInstance && (
                  <Select value={toChannel} onValueChange={setToChannel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {instanceMap.get(toInstance)?.inputs.map((ch: any) => (
                        <SelectItem key={ch.name} value={ch.name}>
                          {ch.name} {ch.required ? '●' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button
                onClick={handleAddWire}
                disabled={!fromInstance || !fromChannel || !toInstance || !toChannel}
                size="sm"
                className="w-full h-8"
              >
                <Plus className="w-3.5 h-3.5" /> Add Wire
              </Button>

              <div className="pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <span className="text-red-500">●</span> = required input (must be wired or compilation fails)
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
