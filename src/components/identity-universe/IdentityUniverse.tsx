'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { usePlayerIdentity } from '@/hooks/use-identity';
import {
  useCoaching, useAchievementContext, useCommunity, useLifecycle,
  useJoinCommunity, useCreatePost, useEvolvedFeed,
} from '@/hooks/use-identity-universe';
import { useExperiences } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, User, Bot, Trophy, Globe, Star, Sparkles, Users,
  Play, GitFork, Heart, Coins, Loader2, Award, Zap, TrendingUp,
  MessageCircle, Pin, ChevronRight, Activity, Target, Rocket,
} from 'lucide-react';
import { toast } from 'sonner';

const RARITY_COLORS: Record<string, string> = {
  common: 'border-slate-300 bg-slate-50 dark:bg-slate-900',
  rare: 'border-blue-300 bg-blue-50 dark:bg-blue-950/30',
  epic: 'border-purple-300 bg-purple-50 dark:bg-purple-950/30',
  legendary: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
};

export function IdentityUniverse() {
  const { setView } = useStudioStore();
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);

  if (selectedExperienceId) {
    return <CommunityView experienceId={selectedExperienceId} onBack={() => setSelectedExperienceId(null)} />;
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
              <User className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Identity Universe</h1>
              <p className="text-[10px] text-muted-foreground">Your persistent self in PlayLiquid</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        <EnhancedProfile />

        <Tabs defaultValue="coaching" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="coaching" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> Coaching</TabsTrigger>
            <TabsTrigger value="achievements" className="text-xs gap-1.5"><Trophy className="w-3.5 h-3.5" /> Achievements</TabsTrigger>
            <TabsTrigger value="communities" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" /> Communities</TabsTrigger>
            <TabsTrigger value="lifecycle" className="text-xs gap-1.5"><Rocket className="w-3.5 h-3.5" /> Lifecycle</TabsTrigger>
            <TabsTrigger value="feed" className="text-xs gap-1.5"><Activity className="w-3.5 h-3.5" /> Feed</TabsTrigger>
          </TabsList>

          <TabsContent value="coaching" className="mt-4"><CoachingTab /></TabsContent>
          <TabsContent value="achievements" className="mt-4"><DynamicAchievementsTab /></TabsContent>
          <TabsContent value="communities" className="mt-4"><CommunitiesTab onOpenCommunity={setSelectedExperienceId} /></TabsContent>
          <TabsContent value="lifecycle" className="mt-4"><LifecycleTab onOpenCommunity={(id) => setSelectedExperienceId(id)} /></TabsContent>
          <TabsContent value="feed" className="mt-4"><EvolvedFeedTab /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Identity Universe v0.47 — You are a citizen, not an account
      </footer>
    </div>
  );
}

function EnhancedProfile() {
  const { data, isLoading } = usePlayerIdentity();
  const identity = data?.identity;

  if (isLoading || !identity) {
    return <Card><CardContent className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  const skillIcons: Record<string, string> = { farming: '🌾', trading: '💰', strategy: '♟️', building: '🔨', exploration: '🧭', combat: '⚔️', cooking: '🍳' };

  return (
    <Card className="bg-gradient-to-r from-indigo-50 via-purple-50 to-rose-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-rose-950/30 border-indigo-300">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16 ring-2 ring-indigo-400">
            <AvatarFallback className="bg-indigo-500 text-white text-xl font-bold">{identity.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{identity.displayName}</h2>
              <Badge className="bg-indigo-500 text-white">Level {identity.level}</Badge>
              {identity.reputation.trust > 80 && <Badge className="bg-emerald-500 text-white">✓ Verified</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {identity.totalSessions} sessions · {identity.achievements.length} achievements · {(identity.liquidBalance / 1_000_000).toFixed(1)}L
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(identity.skills)
                .filter(([, v]) => (v as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 6)
                .map(([skill, value]) => (
                  <div key={skill} className="flex items-center gap-2">
                    <span className="text-sm">{skillIcons[skill] ?? '🎯'}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[9px] mb-0.5">
                        <span className="capitalize text-muted-foreground">{skill}</span>
                        <span className="font-mono font-semibold">{value as number}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500" style={{ width: `${value as number}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoachingTab() {
  const { data, isLoading } = useCoaching();
  const insights = data?.insights ?? [];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const TYPE_ICONS: Record<string, any> = { coaching: Bot, discovery: Globe, progress: TrendingUp, social: Users, creation: Zap };
  const SEVERITY_COLORS: Record<string, string> = {
    info: 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30',
    suggestion: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
    alert: 'border-red-300 bg-red-50 dark:bg-red-950/30',
  };

  return (
    <div className="space-y-2">
      {insights.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">Play more to unlock coaching insights!</p></CardContent></Card>
      ) : (
        insights.map((insight: any, i: number) => {
          const Icon = TYPE_ICONS[insight.type] ?? Bot;
          return (
            <Card key={i} className={SEVERITY_COLORS[insight.severity] ?? ''}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Icon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{insight.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.body}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <ChevronRight className="w-3 h-3 text-indigo-400" />
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400">{insight.actionSuggestion}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function DynamicAchievementsTab() {
  const { data } = useAchievementContext();
  const achievements = data?.achievements ?? [];

  return (
    <div className="space-y-2">
      {achievements.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">No achievements yet. Play Sparks to earn them!</p></CardContent></Card>
      ) : (
        achievements.map((a: any) => (
          <Card key={a.achievementId} className={RARITY_COLORS[a.rarity] ?? RARITY_COLORS.common}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <Badge variant="outline" className="text-[8px] h-3.5 capitalize">{a.rarity}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic mt-0.5">{a.unlockStory}</p>
                  {a.progressToNext && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Target className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">{a.progressToNext}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function CommunitiesTab({ onOpenCommunity }: { onOpenCommunity: (id: string) => void }) {
  const { data: expData } = useExperiences();
  const experiences = expData?.experiences ?? [];

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Game Communities</CardTitle>
          <CardDescription className="text-xs">Join communities to discuss strategies, share builds, and connect</CardDescription>
        </CardHeader>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {experiences.map((exp: any) => (
          <Card key={exp.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpenCommunity(exp.id)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{exp.title}</div>
                  <div className="text-[10px] text-muted-foreground">by {exp.creatorName}</div>
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LifecycleTab({ onOpenCommunity }: { onOpenCommunity: (id: string) => void }) {
  const { data: expData } = useExperiences();
  const experiences = expData?.experiences ?? [];
  const [selectedExp, setSelectedExp] = useState<string | null>(experiences[0]?.id ?? null);
  const { data: lifecycleData } = useLifecycle(selectedExp);
  const timeline = lifecycleData?.timeline ?? [];

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Rocket className="w-4 h-4 text-amber-500" /> Game Lifecycle</CardTitle>
          <CardDescription className="text-xs">Track how Sparks grow from creation to legendary</CardDescription>
        </CardHeader>
      </Card>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {experiences.map((exp: any) => (
          <button key={exp.id} onClick={() => setSelectedExp(exp.id)} className={`px-3 py-1.5 rounded-lg border-2 text-xs shrink-0 ${selectedExp === exp.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}>
            {exp.title}
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="p-3">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No lifecycle events yet</p>
          ) : (
            <div className="space-y-2">
              {timeline.map((event: any, i: number) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white text-sm flex items-center justify-center">{event.icon}</div>
                    {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="text-sm font-medium">{event.title}</div>
                    <p className="text-[10px] text-muted-foreground">{event.description}</p>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{new Date(event.achievedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EvolvedFeedTab() {
  const { data, isLoading } = useEvolvedFeed();
  const feed = data?.feed;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!feed) return null;

  return (
    <div className="space-y-4">
      {feed.games?.length > 0 && (
        <FeedSection title="🎮 Recommended Games" items={feed.games.map((g: any) => ({ id: g.experienceId, title: g.title, subtitle: g.creatorName, meta: `${g.playCount} plays`, badge: g.matchReason }))} />
      )}
      {feed.replays?.length > 0 && (
        <FeedSection title="🎬 Trending Replays" items={feed.replays.map((r: any) => ({ id: r.id, title: r.experienceName, subtitle: r.displayName, meta: `Score: ${r.score}`, badge: r.highlightLabel }))} />
      )}
      {feed.creatorPosts?.length > 0 && (
        <FeedSection title="📢 Creator Updates" items={feed.creatorPosts.map((p: any) => ({ id: p.id, title: p.title, subtitle: p.creatorName, meta: p.postType, badge: undefined }))} />
      )}
      {feed.communityMoments?.length > 0 && (
        <FeedSection title="💬 Community Moments" items={feed.communityMoments.map((c: any) => ({ id: c.id, title: c.title, subtitle: c.author, meta: `↑ ${c.upvotes}`, badge: c.communityName }))} />
      )}
      {(!feed.games?.length && !feed.replays?.length && !feed.creatorPosts?.length && !feed.communityMoments?.length) && (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">No feed content yet. Play and create to fill the feed!</p></CardContent></Card>
      )}
    </div>
  );
}

function FeedSection({ title, items }: { title: string; items: any[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{item.title}</div>
              <div className="text-[10px] text-muted-foreground">{item.subtitle} · {item.meta}</div>
            </div>
            {item.badge && <Badge variant="outline" className="text-[9px] h-4 shrink-0">{item.badge}</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunityView({ experienceId, onBack }: { experienceId: string; onBack: () => void }) {
  const { data } = useCommunity(experienceId);
  const join = useJoinCommunity();
  const createPost = useCreatePost();
  const [showPostForm, setShowPostForm] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const community = data?.community;

  const handleJoin = async () => {
    try { await join.mutateAsync({ experienceId, userId: 'demo-user' }); toast.success('Joined community!'); } catch { toast.error('Join failed'); }
  };

  const handlePost = async () => {
    if (!postTitle.trim()) return;
    try {
      await createPost.mutateAsync({ communityId: community?.id, userId: 'demo-user', displayName: 'Demo Player', type: 'discussion', title: postTitle, body: postBody });
      setPostTitle(''); setPostBody(''); setShowPostForm(false); toast.success('Posted!');
    } catch { toast.error('Post failed'); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8"><ArrowLeft className="w-4 h-4" /> Back</Button>
          <span className="text-sm font-semibold truncate">{community?.experienceName ?? 'Community'}</span>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4">
        {community && (
          <>
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-lg font-bold">{community.experienceName} Community</h2><p className="text-xs text-muted-foreground">{community.memberCount} members</p></div>
                  <Button onClick={handleJoin} disabled={join.isPending} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white"><Users className="w-3.5 h-3.5" /> Join</Button>
                </div>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">📋 {community.rules}</p>
              </CardContent>
            </Card>
            <div className="mb-3">
              {showPostForm ? (
                <Card><CardContent className="p-3 space-y-2">
                  <Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="Post title..." className="h-8 text-sm" />
                  <Textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} placeholder="Share your thoughts..." className="min-h-20 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handlePost} disabled={createPost.isPending || !postTitle.trim()} className="bg-amber-500 hover:bg-amber-600 text-white">Post</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowPostForm(false)}>Cancel</Button>
                  </div>
                </CardContent></Card>
              ) : (
                <Button onClick={() => setShowPostForm(true)} variant="outline" size="sm" className="w-full h-8"><MessageCircle className="w-3.5 h-3.5" /> Start a Discussion</Button>
              )}
            </div>
            <div className="space-y-2">
              {community.posts.length === 0 ? (
                <Card><CardContent className="py-6 text-center"><p className="text-sm text-muted-foreground">No posts yet. Be the first!</p></CardContent></Card>
              ) : (
                community.posts.map((post: any) => (
                  <Card key={post.id}><CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Avatar className="w-7 h-7 shrink-0"><AvatarFallback className="text-[9px]">{post.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><span className="text-xs font-medium">{post.displayName}</span><Badge variant="outline" className="text-[8px] h-3.5">{post.type}</Badge>{post.pinned && <Pin className="w-2.5 h-2.5 text-amber-500" />}</div>
                        <div className="text-sm font-medium mt-0.5">{post.title}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{post.body}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground"><span>↑ {post.upvotes}</span><span>💬 {post.commentCount}</span><span>{new Date(post.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                  </CardContent></Card>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
