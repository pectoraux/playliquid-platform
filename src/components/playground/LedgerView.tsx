'use client';

import { useLedgerAccounts, useLedgerTransactions, useSeedLedger } from '@/hooks/use-kernel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function LedgerView() {
  const accounts = useLedgerAccounts();
  const transactions = useLedgerTransactions();
  const seed = useSeedLedger();

  const handleSeed = async () => {
    try {
      await seed.mutateAsync(1000);
      toast.success('Reward pool seeded with 1,000 Liquid');
    } catch (e) {
      toast.error('Seed failed', { description: (e as Error).message });
    }
  };

  const totalBalance = (accounts.data?.accounts ?? []).reduce((s, a) => s + a.balanceMicro, 0);

  return (
    <div className="space-y-4">
      {/* ── Summary ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Liquid Ledger — Double-Entry</CardTitle>
              <CardDescription className="text-xs">
                {accounts.data?.accounts.length ?? 0} accounts · Σ balances = {totalBalance.toLocaleString()} micro-Liquid (must be 0 in a closed system)
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleSeed} disabled={seed.isPending} className="h-8">
              <Plus className="w-3.5 h-3.5" /> Seed 1,000 Liquid
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {totalBalance !== 0 && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-amber-700 dark:text-amber-300">
                System imbalance: {totalBalance.toLocaleString()} micro-Liquid. (Seed funding creates positive supply; in production this is offset by platform:clearing.)
              </span>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs">Kind</TableHead>
                <TableHead className="text-xs text-right">Balance (Liquid)</TableHead>
                <TableHead className="text-xs text-right">Balance (micro)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts.data?.accounts ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-6">
                    No accounts yet. Seed the reward pool to begin.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.data?.accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs font-mono">{a.id}</TableCell>
                    <TableCell className="text-xs">{a.kind}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{a.balanceLiquid.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-muted-foreground">{a.balanceMicro.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── Transactions ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Transactions</CardTitle>
          <CardDescription className="text-xs">
            Every transaction must balance: Σ debit = Σ credit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 rounded border border-border">
            <div className="p-2 space-y-2">
              {(transactions.data?.transactions ?? []).length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-8">
                  No transactions yet. Run a session with tokens and settle it.
                </p>
              ) : (
                transactions.data?.transactions.map((tx) => (
                  <div key={tx.id} className="rounded border border-border p-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono">{tx.id}</span>
                      <div className="flex items-center gap-1.5">
                        {tx.balanced ? (
                          <Badge variant="outline" className="text-[9px] h-4 text-emerald-600 border-emerald-300">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> balanced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] h-4 text-red-600 border-red-300">
                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> imbalanced
                          </Badge>
                        )}
                      </div>
                    </div>
                    {tx.memo && <p className="text-[10px] text-muted-foreground mb-1">{tx.memo}</p>}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] h-6">Account</TableHead>
                          <TableHead className="text-[10px] h-6 text-right">Debit</TableHead>
                          <TableHead className="text-[10px] h-6 text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tx.entries.map((e: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-[10px] font-mono py-1">{e.account}</TableCell>
                            <TableCell className="text-[10px] font-mono py-1 text-right text-emerald-600 dark:text-emerald-400">
                              {e.debitLiquid > 0 ? e.debitLiquid.toLocaleString() : ''}
                            </TableCell>
                            <TableCell className="text-[10px] font-mono py-1 text-right text-amber-600 dark:text-amber-400">
                              {e.creditLiquid > 0 ? e.creditLiquid.toLocaleString() : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell className="text-[10px] font-semibold py-1">Σ</TableCell>
                          <TableCell className="text-[10px] font-mono py-1 text-right font-semibold">
                            {(tx.sumDebit / 1_000_000).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-[10px] font-mono py-1 text-right font-semibold">
                            {(tx.sumCredit / 1_000_000).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
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
