'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ContainmentFrame } from '@/components/consumer-v2/ContainmentFrame';
import {
  Home, Zap, Gamepad2, Radio, Trophy, Library, Heart, Clock,
  Plus, Search, BarChart, Coins, Users, Settings, Menu, X,
  Play, Eye, Sparkles, ChevronRight,
} from 'lucide-react';

async function fetchJSON<T = any>(url: string, retries = 2): Promise<T> {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return fetchJSON<T>(url, retries - 1);
    }
    throw err;
  }
}

/**
 * Consumer V3 — YouTube-style Home
 * ---------------------------------
 * Left sidebar navigation + content feed.
 * "What can I watch/play next?" — not "What feature do I access?"
 */
export function ConsumerHomeV3() {
  const { setView, playExperience, playSparkQueue } = useStudioStore();
  const [home, setHome] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('home');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchJSON<any>('/api/consumer-v2/home?userId=demo-user');
        if (!cancelled) setHome(d.home);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const sparks = home?.sparks ?? [];
  const experiences = home?.experiences ?? [];
  const live = home?.live ?? [];
  const highlights = home?.highlights ?? [];

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left Sidebar (YouTube style) ── */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} shrink-0 border-r border-border bg-card/30 transition-all duration-200 flex flex-col`}>
        {/* Logo */}
        <div className="p-3 flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-muted">
            {sidebarOpen ? <Menu className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {sidebarOpen && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold">PL</div>
              <span className="text-sm font-bold">PlayLiquid</span>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <nav className="px-2 space-y-0.5 pb-4">
            <NavItem icon={Home} label="Home" active={activeNav === 'home'} expanded={sidebarOpen} onClick={() => setActiveNav('home')} />
            <NavItem icon={Zap} label="Sparks" active={activeNav === 'sparks'} expanded={sidebarOpen} onClick={() => { setActiveNav('sparks'); if (sparks.length > 0) playSparkQueue(sparks, 0); }} />
            <NavItem icon={Gamepad2} label="Experiences" active={activeNav === 'experiences'} expanded={sidebarOpen} onClick={() => setActiveNav('experiences')} />
            <NavItem icon={Radio} label="Live" active={activeNav === 'live'} expanded={sidebarOpen} onClick={() => setActiveNav('live')} />
            <NavItem icon={Trophy} label="Competitions" active={activeNav === 'compete'} expanded={sidebarOpen} onClick={() => setView('competitive')} />

            {sidebarOpen && <div className="my-2 border-t border-border" />}

            <NavItem icon={Library} label="Library" active={activeNav === 'library'} expanded={sidebarOpen} onClick={() => setActiveNav('library')} />
            <NavItem icon={Heart} label="Liked" active={activeNav === 'liked'} expanded={sidebarOpen} onClick={() => setActiveNav('liked')} />
            <NavItem icon={Clock} label="History" active={activeNav === 'history'} expanded={sidebarOpen} onClick={() => setActiveNav('history')} />

            {sidebarOpen && <div className="my-2 border-t border-border" />}

            <NavItem icon={BarChart} label="Creator Studio" expanded={sidebarOpen} onClick={() => setView('creator-studio')} />
            <NavItem icon={Users} label="Extensions" expanded={sidebarOpen} onClick={() => setView('extensions')} />
            <NavItem icon={Coins} label="Wallet" expanded={sidebarOpen} onClick={() => setView('adr-economy')} />
            <NavItem icon={Settings} label="Profile" expanded={sidebarOpen} onClick={() => setView('identity-u')} />
          </nav>
        </ScrollArea>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar with search */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1 max-w-xl flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search experiences, creators, extensions..."
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <Button size="sm" variant="default" className="gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => setView('creator-studio')}>
            <Plus className="w-4 h-4" /> Create
          </Button>
        </header>

        {/* Content feed */}
        <main className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
            </div>
          ) : (
            <>
              {/* Recommended Sparks (Shorts row) */}
              {sparks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-rose-500" />
                    <h2 className="text-base font-bold">Sparks</h2>
                    <span className="text-xs text-muted-foreground">Quick interactive moments</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {sparks.map((spark: any, i: number) => (
                      <SparkCard key={spark.experienceId} spark={spark} onClick={() => playSparkQueue(sparks, i)} />
                    ))}
                  </div>
                </section>
              )}

              {/* Recommended Experiences */}
              {experiences.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Gamepad2 className="w-5 h-5 text-violet-500" />
                    <h2 className="text-base font-bold">Recommended Experiences</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {experiences.map((exp: any) => (
                      <ExperienceCard key={exp.experienceId} exp={exp} onPlay={() => playExperience(exp.experienceId)} />
                    ))}
                  </div>
                </section>
              )}

              {/* Live Now */}
              {live.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="w-5 h-5 text-red-500" />
                    <h2 className="text-base font-bold">Live Now</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {live.map((stream: any) => (
                      <LiveCard key={stream.id} stream={stream} />
                    ))}
                  </div>
                </section>
              )}

              {/* Trending / Because you played */}
              {experiences.length > 2 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h2 className="text-base font-bold">Trending</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {experiences.slice(2).map((exp: any) => (
                      <ExperienceCard key={`trending-${exp.experienceId}`} exp={exp} onPlay={() => playExperience(exp.experienceId)} />
                    ))}
                  </div>
                </section>
              )}

              {sparks.length === 0 && experiences.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No content yet. Click "Create" to publish your first experience.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Nav Item ──────────────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, active, expanded, onClick }: {
  icon: any; label: string; active?: boolean; expanded: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      } ${!expanded && 'justify-center'}`}
      title={label}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && <span className="truncate">{label}</span>}
    </button>
  );
}

// ─── Spark Card (Shorts thumbnail — vertical) ──────────────────────────────

function SparkCard({ spark, onClick }: { spark: any; onClick?: () => void }) {
  return (
    <div
      className="relative shrink-0 w-36 h-64 rounded-xl overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      <div className="w-full h-full bg-gradient-to-b from-rose-500/20 via-violet-500/20 to-amber-500/20 flex flex-col items-center justify-center p-2">
        <div className="text-3xl mb-2">{spark.extensions?.[0]?.icon ?? '⚡'}</div>
        <div className="text-xs font-bold text-center line-clamp-2">{spark.title}</div>
        <div className="text-[9px] text-muted-foreground mt-1">{spark.creatorName}</div>
        <div className="mt-2 w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
      </div>
      <Badge className="absolute top-1.5 left-1.5 text-[7px] h-3.5 bg-rose-500 text-white">⚡ SPARK</Badge>
      <div className="absolute bottom-1.5 left-1.5 right-1.5 text-[8px] text-white/80">
        {formatCount(spark.playCount)} plays · {spark.publishedAgo ?? 'recently'}
      </div>
    </div>
  );
}

// ─── Experience Card (YouTube video thumbnail — 16:9) ──────────────────────

function ExperienceCard({ exp, onPlay }: { exp: any; onPlay?: () => void }) {
  return (
    <div className="rounded-xl overflow-hidden cursor-pointer group hover:bg-muted/30 transition-colors" onClick={onPlay}>
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video overflow-hidden">
        {exp.thumbnailUrl ? (
          <img src={exp.thumbnailUrl} alt={exp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-300 via-fuchsia-300 to-amber-300 dark:from-violet-800 dark:via-fuchsia-800 dark:to-amber-800 flex items-center justify-center">
            <Play className="w-10 h-10 text-white/70 group-hover:scale-110 transition-transform" />
          </div>
        )}
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">
          {formatCount(exp.playCount)} plays
        </div>
        {exp.competitiveEligible && (
          <Badge className="absolute top-1.5 right-1.5 text-[8px] h-4 bg-emerald-500 text-white gap-0.5">
            <Trophy className="w-2.5 h-2.5" /> Ranked
          </Badge>
        )}
      </div>
      {/* Info — YouTube style: avatar + title + creator + stats */}
      <div className="flex gap-2 p-2">
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="text-[9px] bg-amber-500 text-white">
            {exp.creatorName?.slice(0, 2).toUpperCase() ?? 'PL'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium line-clamp-2 leading-tight">{exp.title}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{exp.creatorName}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatCount(exp.playCount)} plays · {exp.publishedAgo ?? 'recently'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Live Card ─────────────────────────────────────────────────────────────

function LiveCard({ stream }: { stream: any }) {
  return (
    <div className="rounded-xl overflow-hidden cursor-pointer group">
      <div className="relative aspect-video bg-gradient-to-br from-red-200 to-rose-300 dark:from-red-900 dark:to-rose-900 flex items-center justify-center">
        <Eye className="w-8 h-8 text-white/70" />
        <Badge className="absolute top-1.5 left-1.5 text-[8px] h-4 bg-red-500 text-white flex items-center gap-0.5">
          <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
        </Badge>
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">
          {stream.viewers ?? 0} watching
        </div>
      </div>
      <div className="p-2">
        <h3 className="text-xs font-medium line-clamp-2">{stream.title ?? 'Live Session'}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{stream.creatorName ?? 'Unknown'}</p>
      </div>
    </div>
  );
}

// ─── ScrollArea import ─────────────────────────────────────────────────────
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Format count (YouTube-style: 1.2K, 3.4M) ─────────────────────────────
function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}
