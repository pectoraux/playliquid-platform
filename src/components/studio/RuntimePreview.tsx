'use client';

import { useInspector, useTick, useAction, useSettle, useTokenBalances } from '@/hooks/use-kernel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Pause, SkipForward, FastForward, Flag, Loader2, Activity, Coins, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  sessionId: string | null;
  sessionStatus: 'idle' | 'starting' | 'active' | 'ended';
  onSetSessionId: (id: string | null) => void;
  onSetStatus: (s: 'idle' | 'starting' | 'active' | 'ended') => void;
  onSetAutoTick: (v: boolean) => void;
  isAutoTicking: boolean;
  onSetActiveTab?: (tab: string) => void;
}

export function RuntimePreview({
  sessionId,
  sessionStatus,
  onSetStatus,
  isAutoTicking,
  onSetAutoTick,
}: Props) {
  const { data } = useInspector(sessionId);
  const tick = useTick();
  const action = useAction();
  const settle = useSettle();
  const { data: tokenData } = useTokenBalances(sessionId);

  const snapshot = data?.snapshot;

  if (sessionStatus === 'idle' && !sessionId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Play className="w-8 h-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">Compile and start a session to preview</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEconomy = snapshot.instances.some((i: any) => i.category === 'ECONOMY');
  const tokens = tokenData?.balances ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="p-2 border-b border-border flex items-center gap-1 flex-wrap">
        <Badge variant="outline" className="text-[9px] h-4">{snapshot.status}</Badge>
        <Badge variant="secondary" className="text-[9px] h-4">tick {snapshot.tick}</Badge>
        {snapshot.score > 0 && (
          <Badge className="text-[9px] h-4 bg-amber-500 text-white">score {snapshot.score}</Badge>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={snapshot.status !== 'ACTIVE'} onClick={() => tick.mutate({ sessionId: sessionId!, ticks: 1 })}>
            <SkipForward className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={snapshot.status !== 'ACTIVE'} onClick={() => tick.mutate({ sessionId: sessionId!, ticks: 10 })}>
            <FastForward className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant={isAutoTicking ? 'default' : 'ghost'}
            className="h-7 w-7 p-0"
            disabled={snapshot.status !== 'ACTIVE'}
            onClick={() => onSetAutoTick(!isAutoTicking)}
          >
            {isAutoTicking ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" disabled={snapshot.status !== 'ACTIVE'} onClick={async () => { await settle.mutateAsync(sessionId!); onSetStatus('ended'); }}>
            <Flag className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Extension status grid */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {snapshot.instances.map((inst: any) => {
            const state = inst.state as Record<string, any> | null;
            const isActive = state !== null;
            const hasTokens = isEconomy && (state?.totalProduced > 0 || state?.mealsCooked > 0 || state?.totalTrades > 0 || state?.score > 0);
            return (
              <div key={inst.id} className="rounded-lg border border-border p-2">
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium truncate">{inst.name}</span>
                  <Badge variant="outline" className="text-[8px] h-3 px-1 ml-auto">{inst.category}</Badge>
                </div>
                {state && Object.keys(state).length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(state).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="text-[10px] font-mono flex justify-between">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-semibold">{typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? '✓' : '✗') : typeof v === 'string' && v.length > 20 ? v.slice(0, 20) + '…' : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Token balances */}
          {tokens.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Tokens</div>
              <div className="flex gap-1 flex-wrap">
                {tokens.map((t: any) => (
                  <div key={t.symbol} className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300">{t.symbol}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">{t.balance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Recent events */}
      <div className="border-t border-border p-2 max-h-32">
        <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
          <Activity className="w-3 h-3" /> Events
        </div>
        <ScrollArea className="h-20">
          <div className="space-y-0.5 font-mono text-[9px]">
            {snapshot.recentEvents.slice(0, 15).map((e: any, i: number) => (
              <div key={i} className="text-muted-foreground truncate">
                <span className="text-amber-500">[{e.tick ?? '-'}]</span>{' '}
                {e.kind === 'token-emit' ? `+${e.amount} ${e.symbol}` :
                 e.kind === 'token-consume' ? `-${e.amount} ${e.symbol}` :
                 e.kind === 'log' ? e.message :
                 e.kind === 'channel' ? `${e.message.instance}.${e.message.channel}` :
                 e.kind}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
