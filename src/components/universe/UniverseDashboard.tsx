'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  useMarketplace, useQuickPlay, useCurator, useActivityFeed,
  useSocialStats, useSeedDemo, useExperienceSummary, useRating,
} from '@/hooks/use-universe';
import { useExperiences } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles, Play, Users, Coins, GitFork, TrendingUp, Clock,
  Heart, Share2, Loader2, Globe, Home, Compass, Bell, User,
  Activity, Trophy, Zap, ArrowRight, Star,
} from 'lucide-react';
import { toast } from 'sonner';

export function UniverseDashboard() {
  const { setView } = useStudioStore();
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top Navigation (Front Door) ──────────────────────────────── */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-rose-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
              PL
            </div>
            <span className="text-base font-bold">PlayLiquid</span>
          </div>

          <nav className="flex items-center gap-1 ml-4">
            <NavButton icon={Compass} label="Play" active />
            <NavButton icon={Zap} label="Create" onClick={() => setView('wizard')} />
            <NavButton icon={Users} label="Community" onClick={() => setView('world')} />
            <NavButton icon={User} label="Identity" onClick={() => setView('identity')} />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('world')}>
              <Globe className="w-3.5 h-3.5" /> Worlds
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('civ')}>
              <Sparkles className="w-3.5 h-3.5" /> Civ
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('kernel-dev')}>
              <Zap className="w-3.5 h-3.5" /> Dev
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        <Tabs defaultValue="discover">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-lg">
            <TabsTrigger value="discover" className="text-xs gap-1.5"><Compass className="w-3.5 h-3.5" /> Discover</TabsTrigger>
            <TabsTrigger value="curator" className="text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Curator</TabsTrigger>
            <TabsTrigger value="community" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" /> Community</TabsTrigger>
            <TabsTrigger value="worlds" className="text-xs gap-1.5"><Globe className="w-3.5 h-3.5" /> Worlds</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="mt-4"><DiscoverTab onSelectExperience={setSelectedExperienceId} /></TabsContent>
          <TabsContent value="curator" className="mt-4"><CuratorTab /></TabsContent>
          <TabsContent value="community" className="mt-4"><CommunityTab /></TabsContent>
          <TabsContent value="worlds" className="mt-4"><WorldsTab /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Universe v0.4 — The Living Marketplace · <button onClick={() => {}} className="text-amber-500 hover:underline">Launch Universe Demo</button>
      </footer>

      {selectedExperienceId && (
        <ExperienceDetail experienceId={selectedExperienceId} onClose={() => setSelectedExperienceId(null)} />
      )}
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

// ─── Discover Tab ──────────────────────────────────────────────────────────

function DiscoverTab({ onSelectExperience }: { onSelectExperience: (id: string) => void }) {
  const { data, isLoading } = useMarketplace();
  const seedDemo = useSeedDemo();
  const home = data?.home;

  const handleSeed = async () => {
    try {
      const result = await seedDemo.mutateAsync();
      toast.success('Universe seeded!', {
        description: `${result.creators} creators, ${result.sparks} sparks, ${result.players} players`,
      });
    } catch (e) {
      toast.error('Seed failed', { description: (e as Error).message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!home || (home.trending.length === 0 && home.newReleases.length === 0)) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Compass className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">The marketplace is empty.</p>
          <Button onClick={handleSeed} disabled={seedDemo.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
            {seedDemo.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Seeding...</> : <><Sparkles className="w-4 h-4" /> Launch Universe Demo</>}
          </Button>
          <p className="text-xs text-muted-foreground">Creates 5 creators, 20 sparks, 100 simulated players</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trending */}
      {home.trending.length > 0 && (
        <Section title="🔥 Trending Sparks" icon={TrendingUp}>
          <SparkCardGrid sparks={home.trending} onSelect={onSelectExperience} />
        </Section>
      )}

      {/* Recommended */}
      {home.recommended.length > 0 && (
        <Section title="✨ Recommended For You" icon={Sparkles}>
          <SparkCardGrid sparks={home.recommended} onSelect={onSelectExperience} />
        </Section>
      )}

      {/* New Releases */}
      {home.newReleases.length > 0 && (
        <Section title="🆕 New Releases" icon={Clock}>
          <SparkCardGrid sparks={home.newReleases} onSelect={onSelectExperience} />
        </Section>
      )}

      {/* Friends Playing */}
      {home.friendsPlaying.length > 0 && (
        <Section title="👥 Friends Are Playing" icon={Users}>
          <SparkCardGrid sparks={home.friendsPlaying} onSelect={onSelectExperience} />
        </Section>
      )}

      {/* Worlds */}
      {home.worldsPopular.length > 0 && (
        <Section title="🌍 Worlds Becoming Popular" icon={Globe}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {home.worldsPopular.map((w: any) => (
              <Card key={w.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🌍</span>
                    <span className="font-medium text-sm truncate">{w.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{w.description}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> {w.population}</span>
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {w.tickCount} ticks</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-amber-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Spark Card ────────────────────────────────────────────────────────────

function SparkCardGrid({ sparks, onSelect }: { sparks: any[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sparks.map((spark) => (
        <SparkCard key={spark.experienceId} spark={spark} onSelect={onSelect} />
      ))}
    </div>
  );
}

function SparkCard({ spark, onSelect }: { spark: any; onSelect: (id: string) => void }) {
  const play = useQuickPlay();

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await play.mutateAsync({ experienceId: spark.experienceId, userId: 'demo-user', ticks: 25 });
      toast.success(`Played ${spark.title}`, {
        description: `Score: ${result.result.score} · ${(result.result.durationMs / 1000).toFixed(1)}s · ${result.result.rewardLiquid / 1_000_000}L earned`,
      });
    } catch (e) {
      toast.error('Play failed', { description: (e as Error).message });
    }
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
      onClick={() => onSelect(spark.experienceId)}
    >
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm truncate">{spark.title}</span>
              {spark.isFork && (
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0">
                  <GitFork className="w-2 h-2 mr-0.5" />fork
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">by {spark.creatorName}</p>
          </div>
          <ReputationBadge score={spark.reputationScore} />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{spark.description.slice(0, 100)}</p>

        {/* Genome badges */}
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <Badge variant="outline" className="text-[8px] h-3.5 px-1">{spark.intent?.kind ?? 'GAME'}</Badge>
          {spark.intent?.emotions?.slice(0, 2).map((e: string) => (
            <Badge key={e} variant="outline" className="text-[8px] h-3.5 px-1">{e}</Badge>
          ))}
          {spark.genome?.hasEconomy && <Badge className="text-[8px] h-3.5 px-1 bg-amber-500 text-white">econ</Badge>}
          {spark.genome?.retentionPrediction > 60 && (
            <Badge className="text-[8px] h-3.5 px-1 bg-emerald-500 text-white">retention {spark.genome.retentionPrediction}%</Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><Play className="w-2.5 h-2.5" /> {spark.playCount}</span>
          <span className="flex items-center gap-1"><GitFork className="w-2.5 h-2.5" /> {spark.forkCount}</span>
          <span className="flex items-center gap-1"><Heart className="w-2.5 h-2.5" /> {spark.likeCount}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="h-7 flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handlePlay}
            disabled={play.isPending}
          >
            {play.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Play
          </Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); toast.info('Forked!'); }}>
            <GitFork className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); toast.info('Shared!'); }}>
            <Share2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReputationBadge({ score }: { score: number }) {
  const color = score > 70 ? 'bg-emerald-500' : score > 50 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted shrink-0">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[10px] font-mono font-semibold">{score}</span>
    </div>
  );
}

// ─── Curator Tab ───────────────────────────────────────────────────────────

function CuratorTab() {
  const { data, isLoading } = useCurator();
  const recs = data?.recommendations ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/30 border-amber-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Your Personal AI Curator
          </CardTitle>
          <CardDescription className="text-xs">Personalized recommendations based on your play history, preferences, and social graph</CardDescription>
        </CardHeader>
      </Card>

      {recs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Play some Sparks first — the curator will learn your preferences!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recs.map((rec: any) => (
            <Card key={rec.experienceId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{rec.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-[10px] h-5 bg-amber-500 text-white">{rec.score}% match</Badge>
                      <span className="text-xs text-muted-foreground">enjoyment: {rec.predictedEnjoyment}%</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic mb-2">"{rec.reasoning}"</p>
                <div className="flex flex-wrap gap-1">
                  {rec.matchFactors.map((f: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Community Tab ─────────────────────────────────────────────────────────

function CommunityTab() {
  const { data } = useActivityFeed();
  const { data: stats } = useSocialStats();
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
    <div className="space-y-4">
      {/* Social stats */}
      {stats && (
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold">{stats.stats.followers}</div>
                <div className="text-[10px] text-muted-foreground">Followers</div>
              </div>
              <div>
                <div className="text-lg font-bold">{stats.stats.following}</div>
                <div className="text-[10px] text-muted-foreground">Following</div>
              </div>
              <div>
                <div className="text-lg font-bold">{stats.stats.friends}</div>
                <div className="text-[10px] text-muted-foreground">Friends</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {feed.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet. Play or follow to see activity here.</p>
              ) : (
                feed.map((item: any) => {
                  const Icon = ACTIVITY_ICONS[item.type] ?? Activity;
                  return (
                    <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg border border-border">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-amber-500 text-white">
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
    </div>
  );
}

// ─── Worlds Tab ────────────────────────────────────────────────────────────

function WorldsTab() {
  const { setView } = useStudioStore();
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-3">
        <Globe className="w-10 h-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Explore living worlds in the Civilization Engine</p>
        <Button onClick={() => setView('civ')} className="bg-amber-500 hover:bg-amber-600 text-white">
          Open Civilization Engine <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Experience Detail Modal ───────────────────────────────────────────────

function ExperienceDetail({ experienceId, onClose }: { experienceId: string; onClose: () => void }) {
  const { data: summary } = useExperienceSummary(experienceId);
  const { data: rating } = useRating(experienceId);
  const play = useQuickPlay();

  const handlePlay = async () => {
    try {
      const result = await play.mutateAsync({ experienceId, userId: 'demo-user', ticks: 30 });
      toast.success(`Played! Score: ${result.result.score}`, {
        description: `${(result.result.durationMs / 1000).toFixed(1)}s · ${result.result.rewardLiquid / 1_000_000}L earned`,
      });
      onClose();
    } catch (e) {
      toast.error('Play failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">Experience Details</h3>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>✕</Button>
          </div>

          {/* AI Summary */}
          {summary?.summary && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase mb-1">AI Curator Says</div>
              <p className="text-sm">{summary.summary}</p>
            </div>
          )}

          {/* Reputation Score */}
          {rating?.reputation && (
            <div>
              <div className="text-xs font-medium mb-2">Reputation Score</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <ScoreBar label="Overall" value={rating.reputation.overallScore} />
                <ScoreBar label="Completion" value={rating.reputation.completionScore} />
                <ScoreBar label="Return" value={rating.reputation.returnScore} />
                <ScoreBar label="Social" value={rating.reputation.socialScore} />
                <ScoreBar label="Emotion" value={rating.reputation.emotionScore} />
                <ScoreBar label="Economy" value={rating.reputation.economyScore} />
              </div>
            </div>
          )}

          <Button onClick={handlePlay} disabled={play.isPending} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            {play.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Playing...</> : <><Play className="w-4 h-4" /> Play Now</>}
          </Button>
        </CardContent>
      </Card>
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
