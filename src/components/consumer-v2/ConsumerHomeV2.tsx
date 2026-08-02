'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ContainmentFrame } from './ContainmentFrame';
import {
  ArrowLeft, Play, Users, Radio, Sparkles, ChevronRight,
  Zap, Eye, Share2, GitFork, Heart, Loader2, Trophy, Coins,
  Package, Crown, BarChart, Network,
} from 'lucide-react';

const MICRO = 1_000_000;

export function ConsumerHomeV2() {
  const { setView } = useStudioStore();
  const [home, setHome] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sparkIndex, setSparkIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/consumer-v2/home?userId=demo-user');
      const data = await res.json();
      setHome(data.home);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  const sparks = home?.sparks ?? [];
  const experiences = home?.experiences ?? [];
  const live = home?.live ?? [];
  const highlights = home?.highlights ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-rose-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">PL</div>
            <span className="text-base font-bold">PlayLiquid</span>
          </div>
          <nav className="flex items-center gap-1 ml-4">
            <NavButton icon={Sparkles} label="Sparks" onClick={() => document.getElementById('sparks')?.scrollIntoView({ behavior: 'smooth' })} />
            <NavButton icon={Play} label="Experiences" onClick={() => document.getElementById('experiences')?.scrollIntoView({ behavior: 'smooth' })} />
            <NavButton icon={Radio} label="Live" onClick={() => document.getElementById('live')?.scrollIntoView({ behavior: 'smooth' })} />
            <NavButton icon={Eye} label="Highlights" onClick={() => document.getElementById('highlights')?.scrollIntoView({ behavior: 'smooth' })} />
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('extensions')}><Package className="w-3.5 h-3.5" /> Extensions</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('creator-studio')}><BarChart className="w-3.5 h-3.5" /> Studio</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('network-intelligence')}><Network className="w-3.5 h-3.5" /> Intelligence</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('competitive')}><Trophy className="w-3.5 h-3.5" /> Compete</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('adr-economy')}><Coins className="w-3.5 h-3.5" /> Wallet</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('identity-u')}><Users className="w-3.5 h-3.5" /> Identity</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 space-y-8">
        {/* ── Sparks (YouTube Shorts equivalent) ─────────────────────────── */}
        <section id="sparks">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-rose-500" /> Sparks</h2>
              <p className="text-xs text-muted-foreground">Vertical, instant, swipe to discover</p>
            </div>
          </div>

          {/* Spark Feed — horizontal scroll of vertical cards */}
          <div className="flex gap-3 overflow-x-auto pb-3">
            {sparks.map((spark: any, i: number) => (
              <SparkCard key={spark.experienceId} spark={spark} onClick={() => setSparkIndex(i)} />
            ))}
            {sparks.length === 0 && <p className="text-sm text-muted-foreground">No Sparks yet</p>}
          </div>
        </section>

        {/* ── Experiences (YouTube long-form) ────────────────────────────── */}
        <section id="experiences">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><Play className="w-5 h-5 text-amber-500" /> Experiences</h2>
              <p className="text-xs text-muted-foreground">Full interactive sessions</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {experiences.map((exp: any) => <ExperienceCard key={exp.experienceId} exp={exp} />)}
          </div>
        </section>

        {/* ── Live (YouTube Live) ────────────────────────────────────────── */}
        <section id="live">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><Radio className="w-5 h-5 text-red-500" /> Live Now</h2>
              <p className="text-xs text-muted-foreground">Watch players compete in real-time</p>
            </div>
          </div>
          {live.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {live.map((stream: any) => <LiveCard key={stream.id} stream={stream} />)}
            </div>
          ) : (
            <Card><CardContent className="py-6 text-center">
              <Radio className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No live sessions right now</p>
            </CardContent></Card>
          )}
        </section>

        {/* ── Highlights (AI-generated clips) ────────────────────────────── */}
        <section id="highlights">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><Eye className="w-5 h-5 text-purple-500" /> Best Moments</h2>
              <p className="text-xs text-muted-foreground">AI-generated highlights from exceptional gameplay</p>
            </div>
          </div>
          {highlights.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {highlights.map((h: any) => <HighlightCard key={h.id} highlight={h} />)}
            </div>
          ) : (
            <Card><CardContent className="py-6 text-center">
              <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No highlights yet. Play competitively to generate them!</p>
            </CardContent></Card>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid — Discover · Play · Watch · Compete · Remix · Evolve
      </footer>
    </div>
  );
}

function NavButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

// ─── Spark Card (Vertical, Shorts-style) ───────────────────────────────────

function SparkCard({ spark, onClick }: { spark: any; onClick?: () => void }) {
  return (
    <div className="relative shrink-0 w-40 h-72 rounded-xl overflow-hidden cursor-pointer group" onClick={onClick}>
      {/* Vertical aspect ratio — portrait-first */}
      <ContainmentFrame aspectRatio="9:16" orientation="portrait" fullscreenEnabled={false}>
        <div className="w-full h-full bg-gradient-to-b from-amber-200 via-rose-200 to-purple-200 dark:from-amber-900 dark:via-rose-900 dark:to-purple-900 flex flex-col items-center justify-center p-2">
          <div className="text-3xl mb-2">{spark.extensions[0]?.icon ?? '🎮'}</div>
          <div className="text-xs font-bold text-center text-white drop-shadow">{spark.title}</div>
          <div className="text-[9px] text-white/80 mt-1">{spark.creatorName}</div>
          <Button size="sm" className="mt-3 h-7 bg-white/90 text-amber-600 hover:bg-white text-[10px]">
            <Play className="w-3 h-3" /> Play
          </Button>
        </div>
      </ContainmentFrame>
      {/* Spark badges */}
      <div className="absolute top-1.5 left-1.5">
        <Badge className="text-[8px] h-4 bg-rose-500 text-white">⚡ SPARK</Badge>
      </div>
      {/* Extension pills */}
      <div className="absolute bottom-8 left-1.5 right-1.5 flex gap-1 flex-wrap">
        {spark.extensions.map((ext: any, i: number) => (
          <span key={i} className="text-[7px] px-1 py-0.5 rounded bg-black/50 text-white">{ext.icon}</span>
        ))}
      </div>
      {/* Stats */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-[8px] text-white/80">
        <span className="flex items-center gap-0.5"><Play className="w-2 h-2" /> {spark.playCount}</span>
        <div className="flex gap-1">
          <Heart className="w-2.5 h-2.5" />
          <Share2 className="w-2.5 h-2.5" />
          <GitFork className="w-2.5 h-2.5" />
        </div>
      </div>
    </div>
  );
}

// ─── Experience Card (YouTube long-form) ───────────────────────────────────

function ExperienceCard({ exp }: { exp: any }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer group">
      {/* Thumbnail (16:9) */}
      <div className="relative aspect-video bg-gradient-to-br from-amber-200 via-rose-200 to-purple-200 dark:from-amber-900 dark:via-rose-900 dark:to-purple-900 flex items-center justify-center">
        <Play className="w-8 h-8 text-white/80 group-hover:scale-110 transition-transform" />
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">{exp.playCount} plays</div>
        {exp.competitiveEligible && <Badge className="absolute top-1.5 right-1.5 text-[8px] h-4 bg-emerald-500 text-white">🏆 Competitive</Badge>}
      </div>
      {/* Info */}
      <div className="p-2">
        <div className="flex items-start gap-2">
          <Avatar className="w-7 h-7 shrink-0"><AvatarFallback className="text-[9px] bg-amber-500 text-white">{exp.creatorName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-medium line-clamp-2 leading-tight">{exp.title}</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">{exp.creatorName}</p>
            {/* Extension pills */}
            <div className="flex gap-0.5 mt-1 flex-wrap">
              {exp.extensions.map((ext: any, i: number) => (
                <span key={i} className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground" title={ext.name}>{ext.icon}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Live Card ─────────────────────────────────────────────────────────────

function LiveCard({ stream }: { stream: any }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer">
      <div className="relative aspect-video bg-gradient-to-br from-red-200 to-rose-300 dark:from-red-900 dark:to-rose-900 flex items-center justify-center">
        <Eye className="w-6 h-6 text-white/80" />
        <Badge className="absolute top-1.5 left-1.5 text-[8px] h-4 bg-red-500 text-white flex items-center gap-0.5">
          <Radio className="w-2 h-2" /> LIVE
        </Badge>
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono flex items-center gap-0.5">
          <Eye className="w-2 h-2" /> {stream.viewerCount}
        </div>
      </div>
      <div className="p-2">
        <div className="text-xs font-medium truncate">{stream.experienceName}</div>
        <div className="text-[10px] text-muted-foreground">{stream.playerName}</div>
      </div>
    </div>
  );
}

// ─── Highlight Card ────────────────────────────────────────────────────────

function HighlightCard({ highlight }: { highlight: any }) {
  const TRIGGER_ICONS: Record<string, string> = {
    leaderboard_first: '🏆', podium: '🥉', world_record: '🌍', comeback: '🔄', exceptional: '✨', high_score: '📈',
  };
  return (
    <div className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer">
      <div className="relative aspect-video bg-gradient-to-br from-purple-200 to-indigo-200 dark:from-purple-900 dark:to-indigo-900 flex items-center justify-center">
        <span className="text-3xl">{TRIGGER_ICONS[highlight.triggerType] ?? '🎬'}</span>
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">{highlight.viewCount} views</div>
      </div>
      <div className="p-2">
        <div className="text-xs font-medium truncate">{highlight.title}</div>
        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{highlight.description}</p>
        <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
          <span>{highlight.displayName}</span>
          <span>·</span>
          <span>Score: {highlight.scoreAtHighlight}</span>
        </div>
      </div>
    </div>
  );
}
