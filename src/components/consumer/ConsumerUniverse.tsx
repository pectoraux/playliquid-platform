'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  useDiscoverFeed, useGamePage, useSaveSpark, useUnsaveSpark,
  useGlobalLeaderboard, useCreatorStudio, useRecordInteraction,
  useSavedSparks,
} from '@/hooks/use-consumer';
import { useQuickPlay } from '@/hooks/use-universe';
import { useFollowingFeed, useReplays, usePlayerWallet } from '@/hooks/use-social';
import { useExperiences } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Play, Users, Coins, GitFork, TrendingUp, Clock,
  Heart, Share2, Loader2, Globe, Home, Compass, Bell, User,
  Trophy, Zap, Bookmark, Eye, Bot, Star, Sparkles, Radio,
  ChevronRight, Award, AlertCircle, CheckCircle2, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

export function ConsumerUniverse() {
  const { setView } = useStudioStore();
  const [gamePageId, setGamePageId] = useState<string | null>(null);
  const [studioCreatorId, setStudioCreatorId] = useState<string | null>(null);

  // Game Page view
  if (gamePageId) {
    return <GamePageView experienceId={gamePageId} onBack={() => setGamePageId(null)} />;
  }

  // Creator Studio view
  if (studioCreatorId) {
    return <CreatorStudioView creatorId={studioCreatorId} onBack={() => setStudioCreatorId(null)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top Navigation ────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-rose-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
              PL
            </div>
            <span className="text-base font-bold">PlayLiquid</span>
          </div>

          <nav className="flex items-center gap-1 ml-4">
            <NavButton icon={Compass} label="Discover" active />
            <NavButton icon={Zap} label="Create" onClick={() => setView('wizard')} />
            <NavButton icon={Trophy} label="Compete" onClick={() => setView('world')} />
            <NavButton icon={User} label="Identity" onClick={() => setView('identity')} />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStudioCreatorId('creator_demo')}>
              <BarChart className="w-3.5 h-3.5" /> Studio
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('civ')}>
              <Globe className="w-3.5 h-3.5" /> Worlds
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('kernel-dev')}>
              <Zap className="w-3.5 h-3.5" /> Dev
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        <Tabs defaultValue="discover">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 max-w-2xl">
            <TabsTrigger value="discover" className="text-xs gap-1.5"><Compass className="w-3.5 h-3.5" /> Discover</TabsTrigger>
            <TabsTrigger value="following" className="text-xs gap-1.5"><Heart className="w-3.5 h-3.5" /> Following</TabsTrigger>
            <TabsTrigger value="saved" className="text-xs gap-1.5"><Bookmark className="w-3.5 h-3.5" /> Library</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs gap-1.5"><Trophy className="w-3.5 h-3.5" /> Rankings</TabsTrigger>
            <TabsTrigger value="replays" className="text-xs gap-1.5"><Play className="w-3.5 h-3.5" /> Replays</TabsTrigger>
            <TabsTrigger value="wallet" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Wallet</TabsTrigger>
            <TabsTrigger value="studio" className="text-xs gap-1.5"><BarChart className="w-3.5 h-3.5" /> Studio</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="mt-4">
            <DiscoverFeed onOpenGame={setGamePageId} />
          </TabsContent>
          <TabsContent value="following" className="mt-4">
            <FollowingFeedView onOpenGame={setGamePageId} />
          </TabsContent>
          <TabsContent value="saved" className="mt-4">
            <SavedLibrary onOpenGame={setGamePageId} />
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-4">
            <LeaderboardView onOpenGame={setGamePageId} />
          </TabsContent>
          <TabsContent value="replays" className="mt-4">
            <ReplaysView onOpenGame={setGamePageId} />
          </TabsContent>
          <TabsContent value="wallet" className="mt-4">
            <WalletView />
          </TabsContent>
          <TabsContent value="studio" className="mt-4">
            <StudioTab onOpenStudio={() => setStudioCreatorId('creator_demo')} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid — Discover · Play · Watch · Create · Compete
      </footer>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ─── Discover Feed (YouTube Home) ──────────────────────────────────────────

function DiscoverFeed({ onOpenGame }: { onOpenGame: (id: string) => void }) {
  const { data, isLoading } = useDiscoverFeed();
  const feed = data?.feed;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!feed) return <p className="text-sm text-muted-foreground text-center py-8">No content yet</p>;

  return (
    <div className="space-y-6">
      {feed.forYou?.sparks.length > 0 && (
        <FeedSection title="✨ For You" subtitle={feed.forYou.subtitle} sparks={feed.forYou.sparks} onOpenGame={onOpenGame} />
      )}
      {feed.trending?.sparks.length > 0 && (
        <FeedSection title="🔥 Trending" subtitle={feed.trending.subtitle} sparks={feed.trending.sparks} onOpenGame={onOpenGame} />
      )}
      {feed.live?.sessions.length > 0 && (
        <LiveFeedSection sessions={feed.live.sessions} onOpenGame={onOpenGame} />
      )}
      {feed.following?.sparks.length > 0 && (
        <FeedSection title="👥 Following" subtitle={feed.following.subtitle} sparks={feed.following.sparks} onOpenGame={onOpenGame} />
      )}
      {feed.friends?.sparks.length > 0 && (
        <FeedSection title="🎮 Friends Are Playing" subtitle={feed.friends.subtitle} sparks={feed.friends.sparks} onOpenGame={onOpenGame} />
      )}
      {feed.challenges?.challenges.length > 0 && (
        <ChallengesFeedSection challenges={feed.challenges.challenges} onOpenGame={onOpenGame} />
      )}
    </div>
  );
}

function FeedSection({ title, subtitle, sparks, onOpenGame }: { title: string; subtitle: string; sparks: any[]; onOpenGame: (id: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sparks.map((spark) => (
          <FeedCard key={spark.experienceId} spark={spark} onOpenGame={onOpenGame} />
        ))}
      </div>
    </div>
  );
}

function FeedCard({ spark, onOpenGame }: { spark: any; onOpenGame: (id: string) => void }) {
  const play = useQuickPlay();
  const save = useSaveSpark();
  const recordInteraction = useRecordInteraction();

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await play.mutateAsync({ experienceId: spark.experienceId, userId: 'demo-user', ticks: 25 });
      toast.success(`Played ${spark.title}`, {
        description: `Score: ${result.result.score} · ${result.result.rewardLiquid / 1_000_000}L earned`,
      });
    } catch (e) {
      toast.error('Play failed', { description: (e as Error).message });
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await save.mutateAsync({ experienceId: spark.experienceId, userId: 'demo-user' });
      await recordInteraction.mutateAsync({ userId: 'demo-user', experienceId: spark.experienceId, interaction: 'saved' });
      toast.success('Saved to library');
    } catch (e) {
      toast.error('Save failed');
    }
  };

  return (
    <div
      className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onOpenGame(spark.experienceId)}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-gradient-to-br from-amber-200 via-rose-200 to-purple-200 dark:from-amber-900 dark:via-rose-900 dark:to-purple-900 flex items-center justify-center">
        <Play className="w-8 h-8 text-white/80 group-hover:scale-110 transition-transform" />
        {spark.isNew && (
          <Badge className="absolute top-1.5 right-1.5 text-[8px] h-4 bg-rose-500 text-white">NEW</Badge>
        )}
        {spark.isLive && (
          <Badge className="absolute top-1.5 right-1.5 text-[8px] h-4 bg-red-500 text-white flex items-center gap-0.5">
            <Radio className="w-2 h-2" /> LIVE
          </Badge>
        )}
        <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">
          {spark.playCount} plays
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="flex items-start gap-2">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="text-[9px] bg-amber-500 text-white">
              {spark.creatorName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-medium line-clamp-2 leading-tight">{spark.title}</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">{spark.creatorName}</p>
            <div className="flex items-center gap-2 mt-1">
              <ReputationBadge score={spark.reputationScore} />
              {spark.matchReason && (
                <span className="text-[9px] text-amber-600 dark:text-amber-400 truncate">{spark.matchReason}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          <Button size="sm" className="h-6 flex-1 text-[10px] bg-amber-500 hover:bg-amber-600 text-white" onClick={handlePlay} disabled={play.isPending}>
            {play.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />} Play
          </Button>
          <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={handleSave} disabled={save.isPending}>
            <Bookmark className="w-2.5 h-2.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReputationBadge({ score }: { score: number }) {
  const color = score > 70 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-slate-400';
  return (
    <div className="flex items-center gap-0.5">
      <Star className={`w-2.5 h-2.5 ${color}`} />
      <span className={`text-[9px] font-mono font-semibold ${color}`}>{score}</span>
    </div>
  );
}

// ─── Live Feed Section ─────────────────────────────────────────────────────

function LiveFeedSection({ sessions, onOpenGame }: { sessions: any[]; onOpenGame: (id: string) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Radio className="w-4 h-4 text-red-500" /> Live Now</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {sessions.map((s) => (
          <div key={s.id} className="min-w-48 shrink-0 rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => onOpenGame(s.experienceId)}>
            <div className="aspect-video bg-gradient-to-br from-red-200 to-rose-300 dark:from-red-900 dark:to-rose-900 flex items-center justify-center relative">
              <Eye className="w-6 h-6 text-white/80" />
              <Badge className="absolute top-1.5 left-1.5 text-[8px] h-4 bg-red-500 text-white flex items-center gap-0.5">
                <Radio className="w-2 h-2" /> LIVE
              </Badge>
              <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono flex items-center gap-0.5">
                <Eye className="w-2 h-2" /> {s.viewerCount}
              </div>
            </div>
            <div className="p-2">
              <div className="text-xs font-medium truncate">{s.experienceName}</div>
              <div className="text-[10px] text-muted-foreground">{s.streamerName}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Challenges Feed Section ───────────────────────────────────────────────

function ChallengesFeedSection({ challenges, onOpenGame }: { challenges: any[]; onOpenGame: (id: string) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Active Challenges</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {challenges.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onOpenGame(c.experienceId)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{c.title}</span>
                {c.rewardLiquid > 0 && <Badge className="text-[9px] h-4 bg-amber-500 text-white">{c.rewardLiquid / 1_000_000}L</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-2">{c.description}</p>
              <div className="text-[10px] text-muted-foreground mt-1">{c.participants} participants</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Game Page (YouTube Watch Page) ────────────────────────────────────────

function GamePageView({ experienceId, onBack }: { experienceId: string; onBack: () => void }) {
  const { data, isLoading } = useGamePage(experienceId);
  const play = useQuickPlay();
  const save = useSaveSpark();
  const unsave = useUnsaveSpark();
  const recordInteraction = useRecordInteraction();
  const page = data?.page;

  const handlePlay = async () => {
    try {
      const result = await play.mutateAsync({ experienceId, userId: 'demo-user', ticks: 30 });
      toast.success(`Played! Score: ${result.result.score}`, {
        description: `${(result.result.durationMs / 1000).toFixed(1)}s · ${result.result.rewardLiquid / 1_000_000}L earned`,
      });
    } catch (e) {
      toast.error('Play failed', { description: (e as Error).message });
    }
  };

  const handleSave = async () => {
    if (page?.isSaved) {
      await unsave.mutateAsync({ experienceId, userId: 'demo-user' });
      toast.success('Removed from library');
    } else {
      await save.mutateAsync({ experienceId, userId: 'demo-user' });
      await recordInteraction.mutateAsync({ userId: 'demo-user', experienceId, interaction: 'saved' });
      toast.success('Saved to library');
    }
  };

  if (isLoading || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <span className="text-sm font-semibold truncate">{page.experience.title}</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Main content */}
          <div className="space-y-4">
            {/* Game runtime area */}
            <div className="aspect-video rounded-xl bg-gradient-to-br from-amber-200 via-rose-200 to-purple-200 dark:from-amber-900 dark:via-rose-900 dark:to-purple-900 flex items-center justify-center relative overflow-hidden">
              <button onClick={handlePlay} disabled={play.isPending} className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all hover:scale-110 shadow-lg">
                {play.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-7 h-7 text-amber-600 ml-1" />}
              </button>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <Badge className="bg-black/60 text-white text-[10px]">{page.experience.intent?.kind ?? 'GAME'}</Badge>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px]">
                  <Eye className="w-2.5 h-2.5" /> {page.stats.playCount}
                </div>
              </div>
            </div>

            {/* Title + actions */}
            <div>
              <h1 className="text-lg font-bold">{page.experience.title}</h1>
              <p className="text-xs text-muted-foreground mt-1">{page.experience.description.slice(0, 200)}</p>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button onClick={handlePlay} disabled={play.isPending} className="bg-amber-500 hover:bg-amber-600 text-white h-8">
                  {play.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Play
                </Button>
                <Button variant="outline" className="h-8" onClick={handleSave}>
                  <Bookmark className={`w-3.5 h-3.5 ${page.isSaved ? 'fill-current' : ''}`} />
                  {page.isSaved ? 'Saved' : 'Save'}
                </Button>
                <Button variant="outline" className="h-8" onClick={() => toast.info('Shared!')}>
                  <Share2 className="w-3.5 h-3.5" /> Share
                </Button>
                <Button variant="outline" className="h-8" onClick={() => toast.info('Forked!')}>
                  <GitFork className="w-3.5 h-3.5" /> Fork
                </Button>
              </div>
            </div>

            {/* Reputation scores */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reputation Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <ScoreBar label="Overall" value={page.stats.reputationBreakdown.overallScore} />
                  <ScoreBar label="Complete" value={page.stats.reputationBreakdown.completionScore} />
                  <ScoreBar label="Return" value={page.stats.reputationBreakdown.returnScore} />
                  <ScoreBar label="Social" value={page.stats.reputationBreakdown.socialScore} />
                  <ScoreBar label="Emotion" value={page.stats.reputationBreakdown.emotionScore} />
                  <ScoreBar label="Economy" value={page.stats.reputationBreakdown.economyScore} />
                </div>
              </CardContent>
            </Card>

            {/* Creator info */}
            <Card>
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-amber-500 text-white text-sm">{page.experience.creatorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{page.experience.creatorName}</div>
                  <div className="text-[10px] text-muted-foreground">@{page.experience.creatorHandle} · Level {page.experience.creatorLevel}</div>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info('Followed!')}>
                  <Heart className="w-3 h-3" /> Follow
                </Button>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            {page.leaderboard.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {page.leaderboard.slice(0, 5).map((entry: any) => (
                      <div key={entry.rank} className="flex items-center gap-3 p-1.5 rounded border border-border">
                        <span className={`text-xs font-bold w-5 ${entry.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{entry.rank}</span>
                        <Avatar className="w-6 h-6"><AvatarFallback className="text-[8px]">{entry.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <span className="text-xs flex-1 truncate">{entry.displayName}</span>
                        <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            {page.comments.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comments ({page.comments.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {page.comments.slice(0, 5).map((c: any) => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="w-6 h-6 shrink-0"><AvatarFallback className="text-[8px]">{c.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div>
                          <div className="text-[10px] text-muted-foreground">{c.displayName} · {new Date(c.createdAt).toLocaleDateString()}</div>
                          <p className="text-xs">{c.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Remixes */}
            {page.remixes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><GitFork className="w-4 h-4" /> Remixes ({page.remixes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {page.remixes.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 p-1.5 rounded border border-border text-xs">
                        <GitFork className="w-3 h-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{r.title}</span>
                        <span className="text-[10px] text-muted-foreground">{r.creatorName}</span>
                        <span className="text-[10px] text-muted-foreground">{r.playCount} plays</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: related */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Related</h3>
            {page.related.map((r: any) => (
              <div key={r.experienceId} className="flex gap-2 p-2 rounded-lg border border-border hover:shadow-sm cursor-pointer" onClick={onBack}>
                <div className="w-20 aspect-video rounded bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 shrink-0 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium line-clamp-2">{r.title}</div>
                  <div className="text-[9px] text-muted-foreground">{r.creatorName}</div>
                  <div className="text-[9px] text-muted-foreground">{r.playCount} plays · ⭐{r.reputationScore}</div>
                </div>
              </div>
            ))}
            {page.related.length === 0 && <p className="text-xs text-muted-foreground">No related sparks yet</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
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

// ─── Saved Library ─────────────────────────────────────────────────────────

function SavedLibrary({ onOpenGame }: { onOpenGame: (id: string) => void }) {
  const { data } = useSavedSparks();
  const saved = data?.saved ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Bookmark className="w-4 h-4" /> Your Library</CardTitle>
        <CardDescription className="text-xs">Saved Sparks you can play anytime</CardDescription>
      </CardHeader>
      <CardContent>
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No saved Sparks yet. Bookmark Sparks from the Discover feed!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {saved.map((s: any) => (
              <div key={s.experienceId} className="p-2 rounded-lg border border-border cursor-pointer hover:shadow-sm" onClick={() => onOpenGame(s.experienceId)}>
                <div className="text-xs font-medium truncate">{s.title}</div>
                <div className="text-[10px] text-muted-foreground">{s.creatorName} · {s.playCount} plays</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Leaderboard View ──────────────────────────────────────────────────────

function LeaderboardView({ onOpenGame }: { onOpenGame: (id: string) => void }) {
  const { data } = useGlobalLeaderboard();
  const leaderboard = data?.leaderboard ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Global Leaderboard</CardTitle>
        <CardDescription className="text-xs">Top players across all Sparks</CardDescription>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No scores yet. Play a Spark to get on the board!</p>
        ) : (
          <div className="space-y-1">
            {leaderboard.map((entry: any, i: number) => (
              <div key={entry.id ?? i} className="flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer hover:shadow-sm" onClick={() => onOpenGame(entry.experienceId)}>
                <span className={`text-sm font-bold w-6 ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <Avatar className="w-8 h-8"><AvatarFallback className="text-[10px] bg-amber-500 text-white">{entry.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{entry.displayName}</div>
                  <div className="text-[10px] text-muted-foreground">{entry.experienceName}</div>
                </div>
                <Badge className="bg-amber-500 text-white">{entry.score}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Live View ─────────────────────────────────────────────────────────────

function LiveView({ onOpenGame }: { onOpenGame: (id: string) => void }) {
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-3">
        <Radio className="w-10 h-10 mx-auto text-red-500/40" />
        <p className="text-sm text-muted-foreground">No live sessions right now.</p>
        <p className="text-xs text-muted-foreground">When creators go live, you'll see them here.</p>
      </CardContent>
    </Card>
  );
}

// ─── Studio Tab ────────────────────────────────────────────────────────────

function StudioTab({ onOpenStudio }: { onOpenStudio: () => void }) {
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-3">
        <BarChart className="w-10 h-10 mx-auto text-amber-500/40" />
        <p className="text-sm font-medium">Creator Studio</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">Analytics, AI suggestions, audience insights, and revenue tracking for your Sparks.</p>
        <Button onClick={onOpenStudio} className="bg-amber-500 hover:bg-amber-600 text-white">
          Open Studio <ChevronRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Creator Studio View ──────────────────────────────────────────────────

function CreatorStudioView({ creatorId, onBack }: { creatorId: string; onBack: () => void }) {
  const { data, isLoading } = useCreatorStudio(creatorId);
  const studio = data?.studio;

  if (isLoading || !studio) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <span className="text-sm font-semibold">Creator Studio</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Sparks" value={studio.overview.totalSparks} icon={Zap} color="text-violet-500" />
          <StatCard label="Players" value={studio.overview.totalPlayers} icon={Users} color="text-blue-500" />
          <StatCard label="Liquid" value={`${(studio.overview.totalLiquid / 1_000_000).toFixed(1)}`} icon={Coins} color="text-amber-500" />
          <StatCard label="Forks" value={studio.overview.totalForks} icon={GitFork} color="text-emerald-500" />
        </div>

        {/* AI Suggestions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {studio.aiSuggestions.map((s: any, i: number) => (
                <div key={i} className={`p-2 rounded-lg border ${
                  s.severity === 'critical' ? 'border-red-300 bg-red-50 dark:bg-red-950/30' :
                  s.severity === 'warning' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' :
                  'border-border bg-muted/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {s.severity === 'critical' ? <AlertCircle className="w-3.5 h-3.5 text-red-500" /> :
                     s.severity === 'warning' ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> :
                     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    <span className="text-xs font-medium">{s.insight}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground ml-5">{s.suggestion}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Sparks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Your Sparks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {studio.topSparks.map((s: any) => (
                <div key={s.experienceId} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{s.playCount} plays</span>
                      <span>·</span>
                      <span>{s.completionRate}% complete</span>
                      <span>·</span>
                      <span>⭐{s.reputationScore}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4">{s.forkCount} forks</Badge>
                </div>
              ))}
              {studio.topSparks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No published Sparks yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Audience */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Audience</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase mb-1">By Genre</div>
                {Object.entries(studio.audience.byGenre).map(([genre, count]) => (
                  <div key={genre} className="text-xs flex justify-between">
                    <span>{genre}</span>
                    <span className="font-mono">{count as number}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Retention Curve</div>
                {studio.audience.retentionCurve.map((r: any) => (
                  <div key={r.tick} className="text-xs">
                    <div className="flex justify-between">
                      <span>{r.tick}</span>
                      <span className="font-mono">{r.percentage}%</span>
                    </div>
                    <Progress value={r.percentage} className="h-1 mb-1" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function BarChart({ className }: { className?: string }) {
  return <span className={className}>📊</span>;
}

// ─── Following Feed View ───────────────────────────────────────────────────

function FollowingFeedView({ onOpenGame }: { onOpenGame: (id: string) => void }) {
  const { data } = useFollowingFeed();
  const feed = data?.feed ?? [];

  const ACTIVITY_ICONS: Record<string, any> = {
    played: Play,
    forked: GitFork,
    published: Zap,
    followed: Heart,
    earned: Coins,
    evolved: Sparkles,
    rated: Star,
    joined: Users,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Heart className="w-4 h-4 text-rose-500" /> Following</CardTitle>
        <CardDescription className="text-xs">Activity from creators and players you follow</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activity yet. Follow creators to see their updates here!
              </p>
            ) : (
              feed.map((item: any) => {
                const Icon = ACTIVITY_ICONS[item.type] ?? Activity;
                return (
                  <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30" onClick={() => item.targetId && onOpenGame(item.targetId)}>
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className="text-xs bg-rose-500 text-white">
                        {item.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">
                        <span className="font-medium">{item.displayName}</span>
                        <span className="text-muted-foreground"> {item.type} </span>
                        {item.targetName && <span className="font-medium">{item.targetName}</span>}
                        {item.detail && <span className="text-muted-foreground"> {item.detail}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Replays View ──────────────────────────────────────────────────────────

function ReplaysView({ onOpenGame }: { onOpenGame: (id: string) => void }) {
  const { data } = useReplays();
  const replays = data?.replays ?? [];

  const HIGHLIGHT_ICONS: Record<string, string> = {
    'world-record': '🌍',
    'clutch': '🎯',
    'speedrun': '⚡',
    'comeback': '🔄',
    'upset': '😱',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Play className="w-4 h-4 text-amber-500" /> Replays</CardTitle>
        <CardDescription className="text-xs">Watch gameplay highlights from the community</CardDescription>
      </CardHeader>
      <CardContent>
        {replays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No replays yet. Play a Spark to generate one!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {replays.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer hover:shadow-sm" onClick={() => onOpenGame(r.experienceId)}>
                <div className="w-16 aspect-video rounded bg-gradient-to-br from-amber-200 to-rose-200 dark:from-amber-900 dark:to-rose-900 shrink-0 flex items-center justify-center">
                  <span className="text-lg">{HIGHLIGHT_ICONS[r.highlightType] ?? '🎬'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{r.experienceName}</div>
                  <div className="text-[10px] text-muted-foreground">{r.displayName}</div>
                  {r.highlightLabel && (
                    <Badge className="text-[8px] h-3.5 mt-0.5 bg-amber-500 text-white">{r.highlightLabel}</Badge>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                    <span>Score: {r.score}</span>
                    <span>·</span>
                    <span><Eye className="w-2 h-2 inline" /> {r.viewCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Wallet View ───────────────────────────────────────────────────────────

function WalletView() {
  const { data } = usePlayerWallet();
  const wallet = data?.wallet;

  if (!wallet) return <p className="text-sm text-muted-foreground">Loading wallet...</p>;

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Liquid Balance</div>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {wallet.balance / 1_000_000}<span className="text-lg ml-1">L</span>
              </div>
            </div>
            <Coins className="w-8 h-8 text-amber-500/40" />
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-muted-foreground">Earned Today</div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                +{wallet.earnedToday / 1_000_000} L
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Withdrawable</div>
              <div className="text-sm font-semibold">
                {wallet.withdrawable / 1_000_000} L
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent earnings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {wallet.earnedSources.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No earnings yet. Play Sparks to earn Liquid!</p>
            ) : (
              wallet.earnedSources.map((src: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded border border-border text-xs">
                  <span className="text-muted-foreground truncate flex-1">{src.source}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">+{src.amount / 1_000_000} L</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
