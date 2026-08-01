'use client';

import { useTokenBalances, useTokenEvents } from '@/hooks/use-kernel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Coins } from 'lucide-react';

interface Props {
  sessionId: string | null;
}

const KIND_COLORS: Record<string, string> = {
  EMIT: 'text-amber-600 dark:text-amber-400',
  CONSUME: 'text-orange-600 dark:text-orange-400',
  SETTLE: 'text-emerald-600 dark:text-emerald-400',
  REJECT: 'text-red-600 dark:text-red-400',
};

export function TokenView({ sessionId }: Props) {
  const balances = useTokenBalances(sessionId);
  const events = useTokenEvents(sessionId);

  if (!sessionId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center gap-2 text-muted-foreground">
          <Coins className="w-8 h-8 opacity-40" />
          <p className="text-sm">No active session</p>
          <p className="text-xs">Start a session with token-emitting extensions to see balances and events.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Balances ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Token Balances</CardTitle>
          <CardDescription className="text-xs">
            Session-scoped tokens owned by extensions. Liquid-backed tokens settle to the player wallet on session end.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Symbol</TableHead>
                <TableHead className="text-xs">Balance</TableHead>
                <TableHead className="text-xs">Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(balances.data?.balances ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-6">
                    No tokens yet. Add an economy extension (Coin Collector, Farm, Cooking) and tick the session.
                  </TableCell>
                </TableRow>
              ) : (
                balances.data?.balances.map((b: any) => (
                  <TableRow key={b.symbol}>
                    <TableCell className="text-xs font-mono font-semibold">{b.symbol}</TableCell>
                    <TableCell className="text-xs font-mono">{b.balance}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] h-4">{b.scope}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Events ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Token Events</CardTitle>
          <CardDescription className="text-xs">
            Audit trail of emissions, consumptions, settlements, and rejections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 rounded border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">Kind</TableHead>
                  <TableHead className="text-xs">Symbol</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Instance</TableHead>
                  <TableHead className="text-xs">Reason</TableHead>
                  <TableHead className="text-xs text-right">Tick</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(events.data?.events ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">
                      No token events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.data?.events.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className={`text-[10px] font-mono font-semibold ${KIND_COLORS[e.kind] ?? ''}`}>
                        {e.kind}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{e.symbol}</TableCell>
                      <TableCell className="text-xs font-mono text-right">{e.amount}</TableCell>
                      <TableCell className="text-[10px] font-mono">{e.instance ?? '-'}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-32 truncate">{e.reason ?? '-'}</TableCell>
                      <TableCell className="text-[10px] font-mono text-right text-muted-foreground">{e.tick ?? '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
