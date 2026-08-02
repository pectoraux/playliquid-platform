'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Home, Zap, Gamepad2, Radio, Sparkles, Library, Heart, Clock,
  Plus, Search, Trophy, Coins, Package, BarChart, Settings, Menu, X,
  Play, Eye, ListVideo, History, Bookmark, Flame, Users, Loader2,
  Bell, Download, ChevronDown, User, Mail, Upload,
} from 'lucide-react';

// ─── fetchJSON helper (retry for dev cold-start) ──────────────────────────

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

// ─── Nav types ────────────────────────────────────────────────────────────

type NavId =
  | 'home' | 'sparks' | 'games' | 'live' | 'highlights' | 'tournaments'
  | 'subscriptions' | 'library' | 'history' | 'liked' | 'watch-later'
  | 'downloads' | 'search';

interface Experience {
  experienceId: string;
  title: string;
  experienceName?: string;
  description?: string;
  creatorName: string;
  creatorId?: string;
  playCount: number;
  publishedAgo?: string;
  thumbnailUrl?: string | null;
  competitiveEligible?: boolean;
  format?: string;
  extensions?: Array<{ icon: string; name: string; category?: string }>;
}

interface LiveStream {
  id: string;
  experienceId?: string;
  experienceName?: string;
  playerName?: string;
  viewerCount: number;
  startedAt?: number;
}

interface Highlight {
  id: string;
  experienceId?: string;
  experienceName?: string;
  displayName?: string;
  triggerType?: string;
  title?: string;
  description?: string;
  scoreAtHighlight?: number;
  viewCount?: number;
  createdAt?: number;
}

interface HomeData {
  sparks: Experience[];
  experiences: Experience[];
  live: LiveStream[];
  highlights: Highlight[];
}

/**
 * ConsumerHomeV3 — Complete YouTube-style consumer shell.
 * ----------------------------------------------------
 * - Desktop: collapsible left sidebar (rail when collapsed)
 * - Mobile: bottom navigation (5 items, prominent Create button)
 * - Content area renders different pages based on activeNav
 * - Top bar with search + Create button
 */
export function ConsumerHomeV3() {
  const { setView, playExperience, playSparkQueue } = useStudioStore();
  const [home, setHome] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState<NavId>('home');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchJSON<{ home: HomeData }>('/api/consumer-v2/home?userId=demo-user');
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

  // Search filter (applies to cards rendered on home/sparks/games pages)
  const q = searchQuery.trim().toLowerCase();
  const sparksFiltered = sparks.filter((e) =>
    !q || (e.title?.toLowerCase().includes(q) ?? false) || (e.creatorName?.toLowerCase().includes(q) ?? false),
  );
  const experiencesFiltered = experiences.filter((e) =>
    !q || (e.title?.toLowerCase().includes(q) ?? false) || (e.creatorName?.toLowerCase().includes(q) ?? false),
  );

  const openSpark = (index: number) => {
    if (sparks.length > 0) playSparkQueue(sparks, index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Global Header (shared desktop + mobile, sticky) ── */}
      <GlobalHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onCreate={() => setView('creator-studio')}
        onNavigate={(v) => setView(v)}
        onOpenLibrary={() => setActiveNav('library')}
        onOpenSearch={() => setActiveNav('search')}
      />

      <div className="flex flex-1 min-h-0">
        {/* ── Desktop Left Sidebar (collapsible) ── */}
        <DesktopSidebar
          open={sidebarOpen}
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onNavigate={(v) => setView(v)}
        />

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <main className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6 space-y-6 max-w-7xl w-full mx-auto">
            {loading ? (
              <LoadingState />
            ) : (
              <ContentRouter
                activeNav={activeNav}
                sparks={sparksFiltered}
                experiences={experiencesFiltered}
                live={live}
                highlights={highlights}
                onPlaySpark={openSpark}
                onPlayExperience={playExperience}
                onPlayAllSparks={() => openSpark(0)}
              />
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <MobileBottomNav
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onCreate={() => setView('creator-studio')}
      />
    </div>
  );
}

// ─── Content router ────────────────────────────────────────────────────────

function ContentRouter({
  activeNav, sparks, experiences, live, highlights,
  onPlaySpark, onPlayExperience, onPlayAllSparks,
}: {
  activeNav: NavId;
  sparks: Experience[];
  experiences: Experience[];
  live: LiveStream[];
  highlights: Highlight[];
  onPlaySpark: (i: number) => void;
  onPlayExperience: (id: string) => void;
  onPlayAllSparks: () => void;
}) {
  switch (activeNav) {
    case 'home':
      return <HomePage sparks={sparks} experiences={experiences} live={live} onPlaySpark={onPlaySpark} onPlayExperience={onPlayExperience} onPlayAllSparks={onPlayAllSparks} />;
    case 'sparks':
      return <SparksPage sparks={sparks} onPlay={onPlaySpark} onPlayAll={onPlayAllSparks} />;
    case 'games':
      return <GamesPage experiences={experiences} onPlay={onPlayExperience} />;
    case 'live':
      return <LivePage live={live} />;
    case 'highlights':
      return <HighlightsPage highlights={highlights} />;
    case 'tournaments':
      return <TournamentsPage />;
    case 'subscriptions':
      return <SubscriptionsPage experiences={experiences} onPlay={onPlayExperience} />;
    case 'library':
      return <LibraryPage />;
    case 'history':
      return <EmptyState icon={History} title="No history yet" subtitle="Experiences you watch will appear here" />;
    case 'liked':
      return <EmptyState icon={Heart} title="No liked content yet" subtitle="Tap the heart on experiences you enjoy" />;
    case 'watch-later':
      return <EmptyState icon={Bookmark} title="Nothing saved yet" subtitle="Bookmark experiences to play them later" />;
    case 'search':
      return <SearchPage />;
    default:
      return <HomePage sparks={sparks} experiences={experiences} live={live} onPlaySpark={onPlaySpark} onPlayExperience={onPlayExperience} onPlayAllSparks={onPlayAllSparks} />;
  }
}

// ─── Pages ─────────────────────────────────────────────────────────────────

function HomePage({
  sparks, experiences, live, onPlaySpark, onPlayExperience, onPlayAllSparks,
}: {
  sparks: Experience[];
  experiences: Experience[];
  live: LiveStream[];
  onPlaySpark: (i: number) => void;
  onPlayExperience: (id: string) => void;
  onPlayAllSparks: () => void;
}) {
  const hasContent = sparks.length > 0 || experiences.length > 0 || live.length > 0;
  if (!hasContent) {
    return <EmptyState icon={Sparkles} title="No experiences yet" subtitle="Be the first to publish on PlayLiquid — tap Create to begin." />;
  }

  return (
    <>
      {/* Sparks row (horizontal scroll) */}
      {sparks.length > 0 && (
        <section>
          <SectionHeader
            icon={<Zap className="w-5 h-5 text-rose-500" />}
            title="Sparks"
            subtitle="Quick interactive moments"
            action={sparks.length > 1 ? { label: 'Play all', onClick: onPlayAllSparks } : undefined}
          />
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {sparks.map((spark, i) => (
              <SparkCard key={spark.experienceId} spark={spark} onClick={() => onPlaySpark(i)} />
            ))}
          </div>
        </section>
      )}

      {/* Recommended experiences */}
      {experiences.length > 0 && (
        <section>
          <SectionHeader
            icon={<Gamepad2 className="w-5 h-5 text-violet-500" />}
            title="Recommended"
            subtitle="Experiences picked for you"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {experiences.map((exp) => (
              <ExperienceCard key={exp.experienceId} exp={exp} onPlay={() => onPlayExperience(exp.experienceId)} />
            ))}
          </div>
        </section>
      )}

      {/* Live now */}
      {live.length > 0 && (
        <section>
          <SectionHeader
            icon={<Radio className="w-5 h-5 text-red-500" />}
            title="Live Now"
            subtitle={`${live.length} streaming`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {live.map((stream) => (
              <LiveCard key={stream.id} stream={stream} />
            ))}
          </div>
        </section>
      )}

      {/* Trending (subset of experiences) */}
      {experiences.length > 2 && (
        <section>
          <SectionHeader
            icon={<Flame className="w-5 h-5 text-amber-500" />}
            title="Trending"
            subtitle="What everyone is playing right now"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {experiences.slice(0, Math.min(8, experiences.length)).map((exp) => (
              <ExperienceCard key={`trending-${exp.experienceId}`} exp={exp} onPlay={() => onPlayExperience(exp.experienceId)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function SparksPage({ sparks, onPlay, onPlayAll }: {
  sparks: Experience[];
  onPlay: (i: number) => void;
  onPlayAll: () => void;
}) {
  if (sparks.length === 0) {
    return <EmptyState icon={Zap} title="No sparks yet" subtitle="Sparks are quick interactive moments. Create one with AI." />;
  }
  return (
    <section>
      <SectionHeader
        icon={<Zap className="w-5 h-5 text-rose-500" />}
        title="Sparks"
        subtitle={`${sparks.length} quick interactive moments`}
        action={sparks.length > 1 ? { label: 'Play all', onClick: onPlayAll } : undefined}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {sparks.map((spark, i) => (
          <SparkCard key={spark.experienceId} spark={spark} onClick={() => onPlay(i)} />
        ))}
      </div>
    </section>
  );
}

function GamesPage({ experiences, onPlay }: {
  experiences: Experience[];
  onPlay: (id: string) => void;
}) {
  if (experiences.length === 0) {
    return <EmptyState icon={Gamepad2} title="No games yet" subtitle="Published games will appear here. Tap Create to publish one." />;
  }
  return (
    <section>
      <SectionHeader
        icon={<Gamepad2 className="w-5 h-5 text-violet-500" />}
        title="Games"
        subtitle={`${experiences.length} experiences to play`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {experiences.map((exp) => (
          <ExperienceCard key={exp.experienceId} exp={exp} onPlay={() => onPlay(exp.experienceId)} />
        ))}
      </div>
    </section>
  );
}

function LivePage({ live }: { live: LiveStream[] }) {
  if (live.length === 0) {
    return <EmptyState icon={Radio} title="No live streams" subtitle="When creators go live, you'll see them here." />;
  }
  return (
    <section>
      <SectionHeader
        icon={<Radio className="w-5 h-5 text-red-500" />}
        title="Live Now"
        subtitle={`${live.length} streaming`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {live.map((stream) => (
          <LiveCard key={stream.id} stream={stream} />
        ))}
      </div>
    </section>
  );
}

function HighlightsPage({ highlights }: { highlights: Highlight[] }) {
  if (highlights.length === 0) {
    return <EmptyState icon={Sparkles} title="No highlights yet" subtitle="AI-generated highlight clips will appear here after your next great play session." />;
  }
  return (
    <section>
      <SectionHeader
        icon={<Sparkles className="w-5 h-5 text-amber-500" />}
        title="Highlights"
        subtitle="AI-generated clips from great play sessions"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {highlights.map((h) => (
          <HighlightCard key={h.id} highlight={h} />
        ))}
      </div>
    </section>
  );
}

function SubscriptionsPage({ experiences, onPlay }: {
  experiences: Experience[];
  onPlay: (id: string) => void;
}) {
  if (experiences.length === 0) {
    return <EmptyState icon={Users} title="No subscriptions yet" subtitle="Follow creators to see their latest experiences here." />;
  }
  return (
    <section>
      <SectionHeader
        icon={<Users className="w-5 h-5 text-violet-500" />}
        title="Subscriptions"
        subtitle="Latest from creators you follow"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {experiences.map((exp) => (
          <ExperienceCard key={exp.experienceId} exp={exp} onPlay={() => onPlay(exp.experienceId)} />
        ))}
      </div>
    </section>
  );
}

function LibraryPage() {
  const sections = [
    { icon: History, label: 'History', desc: 'Recently watched' },
    { icon: Heart, label: 'Liked', desc: 'Experiences you loved' },
    { icon: Bookmark, label: 'Watch Later', desc: 'Saved for later' },
    { icon: ListVideo, label: 'Playlists', desc: 'Your collections' },
  ];
  return (
    <section>
      <SectionHeader
        icon={<Library className="w-5 h-5 text-violet-500" />}
        title="Library"
        subtitle="Your collections and history"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sections.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card/40 p-4 hover:bg-muted/40 transition-colors cursor-pointer">
            <s.icon className="w-6 h-6 text-muted-foreground mb-2" />
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TournamentsPage() {
  return (
    <section>
      <SectionHeader
        icon={<Trophy className="w-5 h-5 text-amber-500" />}
        title="Tournaments"
        subtitle="Compete for prizes and glory"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { title: 'Neon Runner Championship', prize: '500L', entrants: 124, status: 'Registration Open', startsIn: '2 days' },
          { title: 'Sky Defense Showdown', prize: '1,200L', entrants: 89, status: 'Live Now', startsIn: 'Started' },
          { title: 'Coin Rush Sprint', prize: '250L', entrants: 56, status: 'Starting Soon', startsIn: '1 hour' },
        ].map((t, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/40 overflow-hidden hover:shadow-md transition-all cursor-pointer">
            <div className="relative aspect-video bg-gradient-to-br from-amber-300 to-orange-400 dark:from-amber-800 dark:to-orange-900 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-white/70" />
              <Badge className={`absolute top-2 left-2 text-[8px] h-4 ${t.status === 'Live Now' ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>{t.status}</Badge>
            </div>
            <div className="p-2.5">
              <h3 className="text-xs font-bold line-clamp-1">{t.title}</h3>
              <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                <span className="text-amber-600 dark:text-amber-400 font-medium">🏆 {t.prize}</span>
                <span>{t.entrants} entrants</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{t.startsIn}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <Button variant="outline" size="sm" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> Create Tournament</Button>
      </div>
    </section>
  );
}

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const { playExperience } = useStudioStore();

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const d = await fetchJSON<{ results: any[] }>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(d.results ?? []);
    } catch { setResults([]); }
    setSearching(false);
  };

  return (
    <section>
      <SectionHeader icon={<Search className="w-5 h-5 text-muted-foreground" />} title="Search" subtitle="Find experiences, creators, sparks" />
      <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-muted/50 mb-4">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={query} onChange={e => search(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent text-sm focus:outline-none" autoFocus />
        {searching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      {results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map(r => (
            <div key={r.experienceId} className="rounded-xl overflow-hidden cursor-pointer group hover:bg-muted/30" onClick={() => playExperience(r.experienceId)}>
              <div className="relative aspect-video bg-gradient-to-br from-violet-300 to-fuchsia-300 dark:from-violet-800 dark:to-fuchsia-800 flex items-center justify-center">
                {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt={r.title} className="w-full h-full object-cover" /> : <Gamepad2 className="w-8 h-8 text-white/50" />}
              </div>
              <div className="p-2">
                <h3 className="text-xs font-medium line-clamp-2">{r.displayTitle ?? r.title}</h3>
                <p className="text-[10px] text-muted-foreground">{r.creatorName} · {r.playCount} plays · {r.publishedAgo}</p>
              </div>
            </div>
          ))}
        </div>
      ) : query.trim() && !searching ? (
        <p className="text-sm text-muted-foreground text-center py-8">No results for "{query}"</p>
      ) : null}
    </section>
  );
}

// ─── Sidebar (desktop) ────────────────────────────────────────────────────

interface SidebarItem {
  id: NavId;
  icon: any;
  label: string;
}

interface SidebarNavAction {
  icon: any;
  label: string;
  view: string;
}

const PRIMARY_NAV: SidebarItem[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'sparks', icon: Zap, label: 'Sparks' },
  { id: 'games', icon: Gamepad2, label: 'Games' },
  { id: 'live', icon: Radio, label: 'Live' },
  { id: 'highlights', icon: Sparkles, label: 'Highlights' },
  { id: 'tournaments', icon: Trophy, label: 'Tournaments' },
  { id: 'subscriptions', icon: Users, label: 'Subscriptions' },
];

const LIBRARY_NAV: SidebarItem[] = [
  { id: 'library', icon: Library, label: 'Library' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'liked', icon: Heart, label: 'Liked' },
  { id: 'watch-later', icon: Bookmark, label: 'Watch Later' },
  { id: 'downloads', icon: Download, label: 'Downloads' },
];

const ACTIONS_NAV: SidebarNavAction[] = [
  { icon: Coins, label: 'Wallet', view: 'adr-economy' },
  { icon: Package, label: 'Extensions', view: 'extensions' },
  { icon: BarChart, label: 'Studio', view: 'creator-studio' },
];

function DesktopSidebar({
  open, activeNav, setActiveNav, onNavigate,
}: {
  open: boolean;
  activeNav: NavId;
  setActiveNav: (n: NavId) => void;
  onNavigate: (v: any) => void;
}) {
  return (
    <aside className={`hidden md:flex ${open ? 'w-60' : 'w-16'} shrink-0 border-r border-border bg-card/30 transition-all duration-200 flex-col sticky top-14 h-[calc(100vh-3.5rem)] z-10`}>
      <ScrollArea className="flex-1">
        <nav className="px-2 space-y-0.5 pt-2 pb-4">
          {PRIMARY_NAV.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeNav === item.id}
              expanded={open}
              onClick={() => setActiveNav(item.id)}
            />
          ))}

          {open && <div className="my-2 border-t border-border" />}

          {LIBRARY_NAV.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeNav === item.id}
              expanded={open}
              onClick={() => setActiveNav(item.id)}
            />
          ))}

          {open && <div className="my-2 border-t border-border" />}

          {ACTIONS_NAV.map((item) => (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              active={false}
              expanded={open}
              onClick={() => onNavigate(item.view)}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {open && (
        <div className="border-t border-border p-3 text-[10px] text-muted-foreground">
          PlayLiquid · Free to play
        </div>
      )}
    </aside>
  );
}

// ─── Global Header (YouTube-style, shared desktop + mobile) ───────────────

function GlobalHeader({
  sidebarOpen, onToggleSidebar, searchQuery, setSearchQuery, onCreate,
  onNavigate, onOpenLibrary, onOpenSearch,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onCreate: () => void;
  onNavigate: (v: any) => void;
  onOpenLibrary: () => void;
  onOpenSearch: () => void;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center gap-2 px-3 md:px-4 h-14">
        {/* Left: hamburger (desktop) + logo */}
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex w-10 h-10 items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none" onClick={onOpenSearch}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">PL</div>
          <span className="text-base font-bold tracking-tight hidden sm:inline">PlayLiquid</span>
        </div>

        {/* Center: search (desktop) */}
        <div className="hidden md:flex flex-1 max-w-2xl mx-auto px-4">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSubmit={onOpenSearch}
          />
        </div>

        {/* Spacer for mobile (push right cluster) */}
        <div className="flex-1 md:hidden" />

        {/* Right cluster */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mobile search icon */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Create button (desktop, with label) */}
          <Button
            size="sm"
            variant="default"
            className="hidden md:inline-flex gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white"
            onClick={onCreate}
          >
            <Plus className="w-4 h-4" /> Create
          </Button>

          {/* Create button (mobile, icon only) */}
          <button
            onClick={onCreate}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Create"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Notifications bell */}
          <NotificationsBell />

          {/* Profile avatar dropdown */}
          <ProfileDropdown onNavigate={onNavigate} onOpenLibrary={onOpenLibrary} />
        </div>
      </div>

      {/* Mobile search expandable */}
      {mobileSearchOpen && (
        <div className="md:hidden border-t border-border p-2">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSubmit={() => setMobileSearchOpen(false)}
            autoFocus
          />
        </div>
      )}
    </header>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────

function SearchBar({
  searchQuery, setSearchQuery, onSubmit, autoFocus,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/40 focus-within:border-amber-400 focus-within:bg-background transition-colors">
      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) onSubmit(); }}
        placeholder="Search experiences, creators, sparks..."
        className="flex-1 h-6 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        autoFocus={autoFocus}
      />
      {searchQuery && (
        <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="shrink-0">
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}

// ─── Notifications Bell dropdown ──────────────────────────────────────────

interface NotificationItem {
  icon: any;
  text: string;
  time: string;
  bg: string;
  color: string;
}

const NOTIFICATIONS: NotificationItem[] = [
  { icon: Upload, text: 'Alex Rivers uploaded a new game', time: '2h ago', bg: 'bg-violet-100 dark:bg-violet-900/40', color: 'text-violet-600 dark:text-violet-300' },
  { icon: Trophy, text: 'Tournament starts in 30 minutes', time: '30m ago', bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-300' },
  { icon: Heart, text: 'Your comment got 5 likes', time: '1d ago', bg: 'bg-rose-100 dark:bg-rose-900/40', color: 'text-rose-600 dark:text-rose-300' },
  { icon: Coins, text: 'You won 50L in the Neon Runner tournament!', time: '2d ago', bg: 'bg-emerald-100 dark:bg-emerald-900/40', color: 'text-emerald-600 dark:text-emerald-300' },
];

function NotificationsBell() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-background" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 max-h-[28rem] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border text-sm font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notifications
        </div>
        <div className="max-h-96 overflow-y-auto">
          {NOTIFICATIONS.map((n, i) => (
            <DropdownMenuItem
              key={i}
              className="flex items-start gap-3 p-3 cursor-pointer rounded-none focus:bg-muted/60"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.bg}`}>
                <n.icon className={`w-4 h-4 ${n.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight">{n.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Profile dropdown ─────────────────────────────────────────────────────

function ProfileDropdown({
  onNavigate, onOpenLibrary,
}: {
  onNavigate: (v: any) => void;
  onOpenLibrary: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 w-9 h-9 rounded-full overflow-hidden ring-2 ring-border hover:ring-amber-400 transition-all flex items-center justify-center"
          aria-label="Open profile menu"
        >
          <Avatar className="w-9 h-9">
            <AvatarFallback className="text-[11px] bg-gradient-to-br from-amber-400 to-orange-600 text-white font-semibold">SD</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0">
        {/* Header */}
        <div className="p-3 flex items-center gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-600 text-white font-semibold">SD</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">Studio Demo Creator</div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 shrink-0" /> demo@playliquid.io
            </div>
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => onNavigate('creator-studio')}>
            <User className="w-4 h-4" /> My Channel
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => onNavigate('creator-studio')}>
            <BarChart className="w-4 h-4" /> Studio
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => onNavigate('adr-economy')}>
            <Coins className="w-4 h-4" /> Wallet
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={onOpenLibrary}>
            <Library className="w-4 h-4" /> Library
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-0" />
          <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => onNavigate('identity-u')}>
            <Settings className="w-4 h-4" /> Settings
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Mobile bottom nav ─────────────────────────────────────────────────────

interface BottomNavItem {
  id: NavId;
  icon: any;
  label: string;
}

const BOTTOM_NAV: BottomNavItem[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'sparks', icon: Zap, label: 'Sparks' },
];

const BOTTOM_NAV_RIGHT: BottomNavItem[] = [
  { id: 'games', icon: Gamepad2, label: 'Games' },
  { id: 'library', icon: Library, label: 'Library' },
];

function MobileBottomNav({
  activeNav, setActiveNav, onCreate,
}: {
  activeNav: NavId;
  setActiveNav: (n: NavId) => void;
  onCreate: () => void;
}) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border grid grid-cols-5 items-center px-1 pt-1 pb-[env(safe-area-inset-bottom)]">
      {BOTTOM_NAV.map((item) => (
        <BottomNavButton
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={activeNav === item.id}
          onClick={() => setActiveNav(item.id)}
        />
      ))}
      {/* Center Create button — circular, gradient */}
      <div className="flex justify-center">
        <button
          onClick={onCreate}
          aria-label="Create"
          className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
      {BOTTOM_NAV_RIGHT.map((item) => (
        <BottomNavButton
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={activeNav === item.id}
          onClick={() => setActiveNav(item.id)}
        />
      ))}
    </nav>
  );
}

function BottomNavButton({
  icon: Icon, label, active, onClick,
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 min-h-[44px] min-w-[44px] rounded-lg transition-colors"
    >
      <Icon className={`w-5 h-5 ${active ? 'text-amber-500' : 'text-muted-foreground'}`} />
      <span className={`text-[9px] font-medium ${active ? 'text-amber-500' : 'text-muted-foreground'}`}>{label}</span>
    </button>
  );
}

// ─── Nav Item (sidebar) ────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, active, expanded, onClick }: {
  icon: any;
  label: string;
  active?: boolean;
  expanded: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors min-h-[40px] ${
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      } ${!expanded && 'justify-center'}`}
      title={label}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && <span className="truncate">{label}</span>}
    </button>
  );
}

// ─── Section header ────────────────────────────────────────────────────────

function SectionHeader({
  icon, title, subtitle, action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-base font-bold">{title}</h2>
      {subtitle && <span className="text-xs text-muted-foreground hidden sm:inline">{subtitle}</span>}
      {action && (
        <button
          onClick={action.onClick}
          className="ml-auto text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium flex items-center gap-1"
        >
          {action.label}
          <Play className="w-3 h-3 fill-current" />
        </button>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }: {
  icon: any;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="w-8 h-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground max-w-sm">{subtitle}</p>}
    </div>
  );
}

// ─── Loading state ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-6">
      {/* Sparks skeleton */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-[200px] h-[356px] rounded-xl bg-muted/50 animate-pulse shrink-0" />
        ))}
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-video rounded-xl bg-muted/50 animate-pulse" />
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 rounded bg-muted/50 animate-pulse w-3/4" />
                <div className="h-2 rounded bg-muted/50 animate-pulse w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Spark Card (phone-sized, 9:16) ────────────────────────────────────────

function SparkCard({ spark, onClick }: { spark: Experience; onClick?: () => void }) {
  const icon = spark.extensions?.[0]?.icon ?? '⚡';
  return (
    <div
      className="relative shrink-0 w-[200px] h-[356px] rounded-xl overflow-hidden cursor-pointer group bg-gradient-to-b from-rose-500/20 via-violet-500/20 to-amber-500/20"
      onClick={onClick}
    >
      {/* Background */}
      {spark.thumbnailUrl ? (
        <img
          src={spark.thumbnailUrl}
          alt={spark.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
          <div className="text-4xl mb-2">{icon}</div>
          <div className="text-xs font-bold text-center line-clamp-3">{spark.title}</div>
        </div>
      )}

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
        <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur flex items-center justify-center">
          <Play className="w-6 h-6 text-white fill-white" />
        </div>
      </div>

      {/* SPARK badge */}
      <Badge className="absolute top-2 left-2 text-[8px] h-4 bg-rose-500 text-white gap-0.5">
        <Zap className="w-2.5 h-2.5 fill-white" /> SPARK
      </Badge>

      {/* Game icon top-right */}
      {spark.extensions && spark.extensions.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-0.5">
          {spark.extensions.slice(0, 2).map((ext, i) => (
            <span key={i} className="w-5 h-5 rounded bg-black/50 backdrop-blur flex items-center justify-center text-[10px]">
              {ext.icon}
            </span>
          ))}
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="text-[11px] font-semibold text-white line-clamp-2 leading-tight mb-1">{spark.title}</div>
        <div className="flex items-center justify-between text-[9px] text-white/80">
          <span className="truncate">@{spark.creatorName?.toLowerCase().replace(/\s+/g, '') ?? 'creator'}</span>
        </div>
        <div className="text-[9px] text-white/60 mt-0.5">
          {formatCount(spark.playCount)} plays · {spark.publishedAgo ?? 'recently'}
        </div>
      </div>
    </div>
  );
}

// ─── Experience Card (YouTube-style 16:9) ──────────────────────────────────

function ExperienceCard({ exp, onPlay }: { exp: Experience; onPlay?: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer group hover:bg-muted/30 transition-colors"
      onClick={onPlay}
    >
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {exp.thumbnailUrl ? (
          <img
            src={exp.thumbnailUrl}
            alt={exp.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-300 via-fuchsia-300 to-amber-300 dark:from-violet-800 dark:via-fuchsia-800 dark:to-amber-800 flex items-center justify-center">
            <Play className="w-10 h-10 text-white/70 group-hover:scale-110 transition-transform" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
        {/* Plays badge */}
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">
          {formatCount(exp.playCount)} plays
        </div>
        {/* Ranked badge */}
        {exp.competitiveEligible && (
          <Badge className="absolute top-1.5 right-1.5 text-[8px] h-4 bg-emerald-500 text-white gap-0.5">
            <Trophy className="w-2.5 h-2.5" /> Ranked
          </Badge>
        )}
        {/* Format badge */}
        {exp.format && exp.format !== 'spark' && exp.format !== 'native' && (
          <Badge className="absolute top-1.5 left-1.5 text-[8px] h-4 bg-violet-500 text-white">
            {exp.format.toUpperCase()}
          </Badge>
        )}
      </div>
      {/* Info — YouTube style: avatar + title + creator + stats */}
      <div className="flex gap-2 p-2">
        <Avatar className="w-9 h-9 shrink-0">
          <AvatarFallback className="text-[10px] bg-gradient-to-br from-amber-400 to-orange-600 text-white">
            {exp.creatorName?.slice(0, 2).toUpperCase() ?? 'PL'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium line-clamp-2 leading-tight">{exp.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{exp.creatorName}</p>
          <p className="text-xs text-muted-foreground">
            {formatCount(exp.playCount)} plays · {exp.publishedAgo ?? 'recently'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Live Card ─────────────────────────────────────────────────────────────

function LiveCard({ stream }: { stream: LiveStream }) {
  const title = stream.experienceName ?? 'Live Session';
  const creator = stream.playerName ?? 'Unknown';
  return (
    <div className="rounded-xl overflow-hidden cursor-pointer group">
      <div className="relative aspect-video bg-gradient-to-br from-red-200 to-rose-300 dark:from-red-900 dark:to-rose-900 flex items-center justify-center overflow-hidden">
        <Eye className="w-8 h-8 text-white/70" />
        <Badge className="absolute top-1.5 left-1.5 text-[8px] h-4 bg-red-500 text-white flex items-center gap-0.5">
          <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
        </Badge>
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono flex items-center gap-0.5">
          <Eye className="w-2.5 h-2.5" /> {stream.viewerCount}
        </div>
      </div>
      <div className="p-2">
        <h3 className="text-sm font-medium line-clamp-2">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{creator}</p>
      </div>
    </div>
  );
}

// ─── Highlight Card ────────────────────────────────────────────────────────

function HighlightCard({ highlight }: { highlight: Highlight }) {
  const title = highlight.title ?? highlight.experienceName ?? 'Highlight';
  return (
    <div className="rounded-xl overflow-hidden cursor-pointer group">
      <div className="relative aspect-video bg-gradient-to-br from-amber-200 to-orange-300 dark:from-amber-900 dark:to-orange-900 flex items-center justify-center overflow-hidden">
        <Sparkles className="w-8 h-8 text-white/70" />
        <Badge className="absolute top-1.5 left-1.5 text-[8px] h-4 bg-amber-500 text-white flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5" /> HIGHLIGHT
        </Badge>
        {typeof highlight.scoreAtHighlight === 'number' && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">
            {highlight.scoreAtHighlight.toLocaleString()} pts
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </div>
      <div className="p-2">
        <h3 className="text-sm font-medium line-clamp-2">{title}</h3>
        {highlight.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{highlight.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {highlight.displayName ?? 'Anonymous'} · {formatCount(highlight.viewCount ?? 0)} views
        </p>
      </div>
    </div>
  );
}

// ─── Format count (YouTube-style: 1.2K, 3.4M) ──────────────────────────────

function formatCount(n: number): string {
  if (!n || n < 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}
