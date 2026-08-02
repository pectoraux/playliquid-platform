'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { V3ShellWrapper } from '@/components/consumer-v2/V3ShellWrapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Play, Users, Gamepad2, Zap, Loader2 } from 'lucide-react';

async function fetchJSON<T = any>(url: string, retries = 2): Promise<T> {
  try { const res = await fetch(url); return await res.json(); }
  catch { if (retries > 0) { await new Promise(r => setTimeout(r, 800)); return fetchJSON<T>(url, retries - 1); } throw new Error('fetch failed'); }
}

interface ChannelData {
  creatorId: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  followers: number;
  isFollowing: boolean;
  experiences: Array<{
    experienceId: string;
    title: string;
    displayTitle: string | null;
    thumbnailUrl: string | null;
    playCount: number;
    format: string;
    publishedAgo: string;
  }>;
}

/**
 * Creator Channel Page — YouTube-style
 * Banner, avatar, subscribe, tabs (Games, Sparks, About)
 */
export function CreatorChannel({ creatorId }: { creatorId: string }) {
  const { playExperience, playSparkQueue } = useStudioStore();
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchJSON<{ channel: ChannelData }>(`/api/creator-channel?creatorId=${creatorId}&viewerId=demo-user`);
        if (!cancelled) {
          setChannel(d.channel);
          setSubscribed(d.channel.isFollowing);
          setFollowerCount(d.channel.followers);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [creatorId]);

  const handleSubscribe = async () => {
    const action = subscribed ? 'unfollow' : 'follow';
    const res = await fetchJSON<{ following: boolean; followers: number }>(`/api/social/follow`,);
    await fetch('/api/social/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId, action, viewerId: 'demo-user' }),
    });
    const d = await fetchJSON<{ following: boolean; followers: number }>(`/api/social/follow?creatorId=${creatorId}&viewerId=demo-user`);
    setSubscribed(d.following);
    setFollowerCount(d.followers);
  };

  if (loading) return <V3ShellWrapper title="Channel"><div className="flex justify-center py-24"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold animate-pulse">PL</div></div></V3ShellWrapper>;

  if (!channel) return <V3ShellWrapper title="Channel"><div className="text-center py-12"><p className="text-sm text-muted-foreground">Creator not found</p></div></V3ShellWrapper>;

  const games = channel.experiences.filter(e => e.format !== 'spark');
  const sparks = channel.experiences.filter(e => e.format === 'spark');

  return (
    <V3ShellWrapper title={channel.displayName}>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Banner */}
        <div className="h-32 sm:h-48 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 mb-4 overflow-hidden" />

        {/* Channel header */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-background -mt-8 sm:-mt-12 shrink-0">
            <AvatarFallback className="text-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white">
              {channel.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 pt-2">
            <h1 className="text-xl font-bold">{channel.displayName}</h1>
            <p className="text-sm text-muted-foreground">@{channel.handle}</p>
            <p className="text-xs text-muted-foreground mt-1">{followerCount.toLocaleString()} subscribers · {channel.experiences.length} experiences</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{channel.bio}</p>
          </div>
          <Button
            size="sm"
            variant={subscribed ? 'secondary' : 'default'}
            className="rounded-full h-9 px-4"
            onClick={handleSubscribe}
          >
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="games">
          <TabsList className="grid w-full grid-cols-3 max-w-xs">
            <TabsTrigger value="games" className="text-xs">Games</TabsTrigger>
            <TabsTrigger value="sparks" className="text-xs">Sparks</TabsTrigger>
            <TabsTrigger value="about" className="text-xs">About</TabsTrigger>
          </TabsList>

          {/* Games tab */}
          <TabsContent value="games" className="mt-4">
            {games.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No games published yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {games.map((exp) => (
                  <div key={exp.experienceId} className="rounded-xl overflow-hidden cursor-pointer group hover:bg-muted/30" onClick={() => playExperience(exp.experienceId)}>
                    <div className="relative aspect-video overflow-hidden">
                      {exp.thumbnailUrl ? <img src={exp.thumbnailUrl} alt={exp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full bg-gradient-to-br from-violet-300 to-fuchsia-300 dark:from-violet-800 dark:to-fuchsia-800 flex items-center justify-center"><Play className="w-8 h-8 text-white/60" /></div>}
                    </div>
                    <div className="p-2">
                      <h3 className="text-xs font-medium line-clamp-2">{exp.displayTitle ?? exp.title}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{exp.playCount} plays · {exp.publishedAgo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Sparks tab */}
          <TabsContent value="sparks" className="mt-4">
            {sparks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No sparks published yet</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {sparks.map((exp) => (
                  <div key={exp.experienceId} className="relative shrink-0 w-36 h-64 rounded-xl overflow-hidden cursor-pointer group" onClick={() => { if (sparks.length > 0) playSparkQueue(sparks.map(s => ({ experienceId: s.experienceId, title: s.displayTitle ?? s.title, creatorName: channel.displayName, creatorId: channel.creatorId, playCount: s.playCount, format: s.format, extensions: [] }))); }}>
                    <div className="w-full h-full bg-gradient-to-b from-rose-500/20 via-violet-500/20 to-amber-500/20 flex flex-col items-center justify-center p-2">
                      <div className="text-3xl mb-2">⚡</div>
                      <div className="text-xs font-bold text-center line-clamp-2">{exp.displayTitle ?? exp.title}</div>
                      <div className="text-[9px] text-muted-foreground mt-1">{exp.playCount} plays</div>
                    </div>
                    <Badge className="absolute top-1.5 left-1.5 text-[7px] h-3.5 bg-rose-500 text-white">⚡ SPARK</Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* About tab */}
          <TabsContent value="about" className="mt-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-sm font-medium">About {channel.displayName}</div>
                <p className="text-xs text-muted-foreground">{channel.bio || 'No description provided.'}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {followerCount.toLocaleString()} subscribers</span>
                  <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5" /> {games.length} games</span>
                  <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> {sparks.length} sparks</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </V3ShellWrapper>
  );
}
