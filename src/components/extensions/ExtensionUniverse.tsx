'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Package, Star, Download, Loader2, Sparkles,
  TrendingUp, Zap, ChevronRight, Coins, Users,
} from 'lucide-react';
import { toast } from 'sonner';

const MICRO = 1_000_000;

const CATEGORY_COLORS: Record<string, string> = {
  PHYSICS: 'border-sky-300',
  MECHANIC: 'border-violet-300',
  ECONOMY: 'border-amber-300',
  SOCIAL: 'border-emerald-300',
  AI: 'border-rose-300',
  RENDER: 'border-slate-300',
};

export function ExtensionUniverse() {
  const { setView } = useStudioStore();
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExt, setSelectedExt] = useState<string | null>(null);
  const [extDetail, setExtDetail] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/extensions/feed');
      const data = await res.json();
      setFeed(data.feed);
      setLoading(false);
    })();
  }, []);

  const loadDetail = async (id: string) => {
    setSelectedExt(id);
    const res = await fetch(`/api/extensions/${id}`);
    const data = await res.json();
    setExtDetail(data);
  };

  if (selectedExt && extDetail) {
    return <ExtensionDetail ext={extDetail.extension} usedTogether={extDetail.usedTogether} onBack={() => { setSelectedExt(null); setExtDetail(null); }} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('universe')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Extension Universe</h1>
              <p className="text-[10px] text-muted-foreground">The primitive is the Extension</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {feed?.trending?.length > 0 && (
              <Section title="🔥 Trending Extensions" subtitle="Growing fastest" extensions={feed.trending} onSelect={loadDetail} />
            )}
            {feed?.mostInstalled?.length > 0 && (
              <Section title="📦 Most Installed" subtitle="Widely adopted" extensions={feed.mostInstalled} onSelect={loadDetail} />
            )}
            {feed?.topRated?.length > 0 && (
              <Section title="⭐ Top Rated" subtitle="Community favorites" extensions={feed.topRated} onSelect={loadDetail} />
            )}
            {feed?.newest?.length > 0 && (
              <Section title="🆕 Latest" subtitle="Recently published" extensions={feed.newest} onSelect={loadDetail} />
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Extension Universe — Experiences are compositions of extensions
      </footer>
    </div>
  );
}

function Section({ title, subtitle, extensions, onSelect }: { title: string; subtitle: string; extensions: any[]; onSelect: (id: string) => void }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {extensions.map((ext) => <ExtensionCard key={ext.id} ext={ext} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

function ExtensionCard({ ext, onSelect }: { ext: any; onSelect: (id: string) => void }) {
  return (
    <div
      className={`rounded-xl border-2 ${CATEGORY_COLORS[ext.category] ?? 'border-border'} overflow-hidden hover:shadow-md transition-all cursor-pointer group`}
      onClick={() => onSelect(ext.id)}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{ext.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-sm font-medium truncate">{ext.name}</span>
              <Badge variant="outline" className="text-[8px] h-3.5 shrink-0">{ext.category}</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{ext.description}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><Download className="w-2.5 h-2.5" /> {ext.installCount}</span>
              <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> {ext.rating.toFixed(1)}</span>
              {ext.royaltyBps > 0 && <span className="text-amber-600 dark:text-amber-400">{ext.royaltyBps / 100}% royalty</span>}
            </div>
          </div>
        </div>
        {/* Reputation bars */}
        <div className="grid grid-cols-4 gap-1 mt-2">
          <MiniScore label="Q" value={ext.qualityScore} />
          <MiniScore label="P" value={ext.performanceScore} />
          <MiniScore label="A" value={ext.adoptionScore} />
          <MiniScore label="I" value={ext.innovationScore} />
        </div>
      </div>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[8px] text-muted-foreground">{label}</span>
      <Progress value={value} className="h-1 flex-1" />
    </div>
  );
}

function ExtensionDetail({ ext, usedTogether, onBack }: { ext: any; usedTogether: any[]; onBack: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8"><ArrowLeft className="w-4 h-4" /> Back</Button>
          <span className="text-sm font-semibold truncate">{ext.name}</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <span className="text-4xl">{ext.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold">{ext.name}</h1>
                  <Badge variant="outline">v{ext.version}</Badge>
                  <Badge variant="outline">{ext.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{ext.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>by {ext.creatorName}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Download className="w-2.5 h-2.5" /> {ext.installCount} installs</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> {ext.rating.toFixed(1)}</span>
                  {ext.royaltyBps > 0 && <><span>·</span><span className="text-amber-600 dark:text-amber-400">{ext.royaltyBps / 100}% royalty</span></>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reputation */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Extension Reputation</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              <RepBar label="Quality" value={ext.qualityScore} />
              <RepBar label="Performance" value={ext.performanceScore} />
              <RepBar label="Adoption" value={ext.adoptionScore} />
              <RepBar label="Fairness" value={ext.fairnessScore} />
              <RepBar label="Innovation" value={ext.innovationScore} />
            </div>
          </CardContent>
        </Card>

        {/* Used by */}
        {ext.usedBy?.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Used By ({ext.usedBy.length} experiences)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {ext.usedBy.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                    <span className="flex-1 truncate">{u.experienceName}</span>
                    <span className="text-[9px] text-muted-foreground">{new Date(u.installedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Used Together */}
        {usedTogether?.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">🤝 Used Together</CardTitle>
            <CardDescription className="text-xs">Extensions commonly used alongside this one</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {usedTogether.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                    <span className="text-lg">{u.icon}</span>
                    <span className="flex-1 truncate">{u.name}</span>
                    <Badge variant="outline" className="text-[8px] h-3.5">{u.category}</Badge>
                    <span className="text-[9px] text-muted-foreground">{u.coOccurrencePercent}% co-occurrence</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function RepBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-1">
        <Progress value={value} className="h-1.5 flex-1" />
        <span className="text-[10px] font-mono">{value}</span>
      </div>
    </div>
  );
}
