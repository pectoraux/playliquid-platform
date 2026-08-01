'use client';

import { useTelemetryEvents, useTelemetryGenomes } from '@/hooks/use-kernel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dna, Activity } from 'lucide-react';

export function TelemetryView() {
  const events = useTelemetryEvents();
  const genomes = useTelemetryGenomes();

  return (
    <div className="space-y-4">
      {/* ── Genomes ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Dna className="w-4 h-4" /> Experience Genomes
          </CardTitle>
          <CardDescription className="text-xs">
            Derived from compiled bundles. Becomes the substrate for the future AI Evolution Engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">Experience</TableHead>
                  <TableHead className="text-xs">Extensions</TableHead>
                  <TableHead className="text-xs text-right">Depth</TableHead>
                  <TableHead className="text-xs">Categories</TableHead>
                  <TableHead className="text-xs text-right">Tokens</TableHead>
                  <TableHead className="text-xs">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(genomes.data?.genomes ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">
                      No genomes yet. Compile and start a session to compute one.
                    </TableCell>
                  </TableRow>
                ) : (
                  genomes.data?.genomes.map((g: any) => (
                    <TableRow key={g.bundleHash ?? g.experienceId}>
                      <TableCell className="text-xs font-mono">{g.experienceId}</TableCell>
                      <TableCell className="text-[10px] font-mono max-w-48 truncate">
                        {Array.isArray(g.extensions) ? g.extensions.join(', ') : ''}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">{g.compositionDepth}</TableCell>
                      <TableCell className="text-[10px]">
                        {g.categories && typeof g.categories === 'object'
                          ? Object.entries(g.categories)
                              .filter(([, v]) => (v as number) > 0)
                              .map(([k, v]) => `${k}:${v as number}`)
                              .join(' ')
                          : ''}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">{g.tokenCount}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {g.hasEconomy && <Badge className="text-[9px] h-4 bg-amber-500 text-white">econ</Badge>}
                          {g.hasAI && <Badge className="text-[9px] h-4 bg-rose-500 text-white">AI</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Session Events ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" /> Session Telemetry
          </CardTitle>
          <CardDescription className="text-xs">
            One row per ended session. Foundation for the evolution correlation model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 rounded border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-xs">Experience</TableHead>
                  <TableHead className="text-xs text-right">Ticks</TableHead>
                  <TableHead className="text-xs text-right">Duration</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                  <TableHead className="text-xs text-right">Score</TableHead>
                  <TableHead className="text-xs">Tokens</TableHead>
                  <TableHead className="text-xs">Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(events.data?.events ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-6">
                      No telemetry yet. Settle a session to record an event.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.data?.events.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-mono">{e.experienceId}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{e.tickCount}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{(e.sessionDurationMs / 1000).toFixed(1)}s</TableCell>
                      <TableCell className="text-xs text-right font-mono">{e.actions}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-semibold">{e.score ?? 0}</TableCell>
                      <TableCell className="text-[10px] font-mono">
                        {e.tokensEmitted && typeof e.tokensEmitted === 'object'
                          ? Object.entries(e.tokensEmitted).map(([k, v]) => `${k}:${v as number}`).join(' ')
                          : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.completion ? 'default' : 'outline'} className="text-[9px] h-4">
                          {e.completion ? '✓' : '—'}
                        </Badge>
                      </TableCell>
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
