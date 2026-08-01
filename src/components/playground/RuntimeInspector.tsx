'use client';

import { useInspector } from '@/hooks/use-kernel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, SkipForward, FastForward, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Flag, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Props {
  sessionId: string | null;
  status: 'idle' | 'starting' | 'active' | 'ended';
  onTick: (n: number) => void;
  onAction: (action: string) => void;
  onSettle: () => void;
  onAutoTickToggle: () => void;
  isAutoTicking: boolean;
  isTicking: boolean;
}

const EVENT_COLORS: Record<string, string> = {
  tick: 'text-muted-foreground',
  state: 'text-blue-600 dark:text-blue-400',
  channel: 'text-emerald-600 dark:text-emerald-400',
  'token-emit': 'text-amber-600 dark:text-amber-400',
  'token-consume': 'text-orange-600 dark:text-orange-400',
  log: 'text-slate-500',
  action: 'text-violet-600 dark:text-violet-400',
  'session-end': 'text-red-600 dark:text-red-400',
};

function formatEvent(e: any): string {
  switch (e.kind) {
    case 'tick': return `tick ${e.tick}`;
    case 'state': return `${e.instance}.state = ${JSON.stringify(e.state).slice(0, 80)}`;
    case 'channel': return `${e.message.instance}.${e.message.channel} → ${JSON.stringify(e.message.value).slice(0, 60)}`;
    case 'token-emit': return `${e.instance} emit ${e.amount} ${e.symbol}${e.reason ? ` (${e.reason})` : ''}`;
    case 'token-consume': return `${e.instance} consume ${e.amount} ${e.symbol}${e.reason ? ` (${e.reason})` : ''}`;
    case 'log': return `${e.instance}: ${e.message}`;
    case 'action': return `action: ${e.action}`;
    case 'session-end': return `session ended: ${e.reason}`;
    default: return JSON.stringify(e);
  }
}

export function RuntimeInspector({
  sessionId,
  status,
  onTick,
  onAction,
  onSettle,
  onAutoTickToggle,
  isAutoTicking,
  isTicking,
}: Props) {
  const { data } = useInspector(sessionId);
  const snapshot = data?.snapshot;

  if (status === 'idle' && !sessionId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center gap-2 text-muted-foreground">
          <Play className="w-8 h-8 opacity-40" />
          <p className="text-sm">No active session</p>
          <p className="text-xs">Compile a valid graph, then click "Start Session".</p>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Controls ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-sm">Runtime Controls</CardTitle>
              <CardDescription className="text-xs font-mono">{sessionId}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5">{snapshot.status}</Badge>
              <Badge variant="secondary" className="text-[10px] h-5">tick {snapshot.tick}</Badge>
              {typeof snapshot.score === 'number' && snapshot.score > 0 && (
                <Badge className="text-[10px] h-5 bg-amber-500 text-white">score {snapshot.score}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => onTick(1)} disabled={isTicking || snapshot.status !== 'ACTIVE'} className="h-8">
              <SkipForward className="w-3.5 h-3.5" /> Tick ×1
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTick(10)} disabled={isTicking || snapshot.status !== 'ACTIVE'} className="h-8">
              <FastForward className="w-3.5 h-3.5" /> ×10
            </Button>
            <Button
              size="sm"
              variant={isAutoTicking ? 'default' : 'outline'}
              onClick={onAutoTickToggle}
              disabled={snapshot.status !== 'ACTIVE'}
              className="h-8"
            >
              {isAutoTicking ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isAutoTicking ? 'Pause' : 'Auto'}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button size="sm" variant="destructive" onClick={onSettle} disabled={snapshot.status !== 'ACTIVE'} className="h-8">
              <Flag className="w-3.5 h-3.5" /> Settle & End
            </Button>
          </div>

          {snapshot.status === 'ACTIVE' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Player actions (sends to physics instance):</span>
              <div className="grid grid-cols-3 gap-1 w-fit">
                <div />
                <Button size="sm" variant="outline" onClick={() => onAction('move-up')} className="h-8 w-10 p-0">
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <div />
                <Button size="sm" variant="outline" onClick={() => onAction('move-left')} className="h-8 w-10 p-0">
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAction('move-down')} className="h-8 w-10 p-0">
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAction('move-right')} className="h-8 w-10 p-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Instance States ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {snapshot.instances.map((inst: any) => (
          <InstanceCard key={inst.id} inst={inst} />
        ))}
      </div>

      {/* ── Token Balances ───────────────────────────────────────────── */}
      {Object.keys(snapshot.tokenBalances).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Token Balances (in-session)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(snapshot.tokenBalances).map(([sym, amt]) => (
                <div key={sym} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-300">{sym}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400">{amt as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Event Log ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Event Log</CardTitle>
          <CardDescription className="text-xs">Last {snapshot.recentEvents.length} events (newest first)</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 rounded border border-border">
            <div className="p-2 space-y-0.5 font-mono text-[11px]">
              {snapshot.recentEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No events yet. Tick the session.</p>
              ) : (
                snapshot.recentEvents.map((e: any, i: number) => (
                  <div key={i} className={`px-1 py-0.5 hover:bg-muted/50 rounded ${EVENT_COLORS[e.kind] ?? ''}`}>
                    <span className="text-muted-foreground mr-2">[{e.tick ?? '-'}]</span>
                    {formatEvent(e)}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function InstanceCard({ inst }: { inst: any }) {
  const [expanded, setExpanded] = useState(true);
  const stateStr = JSON.stringify(inst.state, null, 2);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm truncate">{inst.name}</CardTitle>
            <p className="text-[10px] font-mono text-muted-foreground">{inst.id}</p>
          </div>
          <Badge variant="outline" className="text-[9px] h-4">{inst.category}</Badge>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <pre className="text-[10px] font-mono p-2 rounded bg-muted/50 overflow-x-auto max-h-40">
            {stateStr}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}
