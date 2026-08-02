'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { ContainmentFrame } from '@/components/consumer-v2/ContainmentFrame';
import { GameCanvas } from '@/components/runtime/GameCanvas';
import { Html5GamePlayer } from '@/components/runtime/Html5GamePlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, Heart, Share2, Zap, Trophy, Users, MessageCircle,
  Gamepad2, Globe, Cpu, Maximize2, Send, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { GAMES } from '@/engine/games';

interface ExperienceRuntime {
  experienceId: string;
  title: string;
  description: string;
  creatorId: string;
  runtimeType: 'native' | 'html5' | 'external' | 'spark';
  engineGameId?: string;
  bundle: any;
  containment: {
    aspectRatio: string | null;
    orientation: string;
    html5BundleUrl: string | null;
    externalUrl: string | null;
  };
}

interface RecommendedVideo {
  experienceId: string;
  title: string;
  creatorName: string;
  playCount: number;
  format: string;
  competitiveEligible: boolean;
}

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
 * Phase 24 — YouTube-style Game Player
 * -------------------------------------
 * Layout matches YouTube watch page:
 *   ┌─────────────────────────┬──────────┐
 *   │                         │ Recomm.  │
 *   │      16:9 GAME          │ videos   │
 *   │                         │ sidebar  │
 *   ├─────────────────────────┤          │
 *   │ Actions (like/share)    │          │
 *   │ Creator + Follow        │          │
 *   │ Description             │          │
 *   │ Leaderboard             │          │
 *   │ Comments                │          │
 *   └─────────────────────────┴──────────┘
 *
 * - Fullscreen / expand frame toggle
 * - Recommended games on the right
 * - Below: actions, description, leaderboard, comments
 */
export function GamePlayer({ experienceId }: { experienceId: string }) {
  const { setView, playExperience } = useStudioStore();
  const [runtime, setRuntime] = useState<ExperienceRuntime | null>(null);
  const [recommended, setRecommended] = useState<RecommendedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; user: string; avatar: string; text: string; time: string; likes: number }>>([
    { id: '1', user: 'Alex Rivers', avatar: 'AR', text: 'This game is incredible! The difficulty curve is perfect.', time: '2 hours ago', likes: 12 },
    { id: '2', user: 'Maya Chen', avatar: 'MC', text: 'How do you beat level 3? I keep dying at the boss.', time: '5 hours ago', likes: 4 },
    { id: '3', user: 'Diego Torres', avatar: 'DT', text: 'Just got 1st place on the leaderboard! 🏆', time: '1 day ago', likes: 23 },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [runtimeRes, homeRes] = await Promise.all([
          fetchJSON<{ runtime: ExperienceRuntime }>(`/api/runtime/bundle/${experienceId}`),
          fetchJSON<any>('/api/consumer-v2/home?userId=demo-user'),
        ]);
        if (!cancelled) {
          setRuntime(runtimeRes.runtime);
          // Use experiences from home as recommended (exclude current)
          const exps = homeRes.home?.experiences ?? [];
          setRecommended(exps.filter((e: any) => e.experienceId !== experienceId).slice(0, 8));
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

  // Fullscreen handling
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    const el = document.getElementById('game-frame-container');
    if (!document.fullscreenElement && el) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const postComment = () => {
    if (!comment.trim()) return;
    setComments([{
      id: Date.now().toString(),
      user: 'You',
      avatar: 'YO',
      text: comment.trim(),
      time: 'just now',
      likes: 0,
    }, ...comments]);
    setComment('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!runtime) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <p className="text-sm text-muted-foreground">Experience not found</p>
        <Button variant="outline" size="sm" onClick={() => setView('home-v2')}>Back to Home</Button>
      </div>
    );
  }

  const engineGameId = runtime.engineGameId ?? matchGameByTitle(runtime.title);
  const nativeGame = engineGameId ? GAMES[engineGameId] : undefined;
  const isHtml5 = runtime.runtimeType === 'html5' && runtime.containment.html5BundleUrl;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('home-v2')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex-1" />
          {runtime.runtimeType === 'html5' ? (
            <Badge className="bg-emerald-500 text-white text-[9px] gap-1"><Globe className="w-2.5 h-2.5" /> HTML5</Badge>
          ) : (
            <Badge className="bg-violet-500 text-white text-[9px] gap-1"><Cpu className="w-2.5 h-2.5" /> Native</Badge>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          {/* ── Left column: game + below-video content ── */}
          <div className="space-y-3 min-w-0">
            {/* 16:9 game window with fullscreen toggle */}
            <div id="game-frame-container" className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
              <ContainmentFrame aspectRatio="16:9" orientation="landscape" fullscreenEnabled={false}>
                {nativeGame ? (
                  <GameCanvas key={nativeGame.id} game={nativeGame} />
                ) : isHtml5 ? (
                  <Html5GamePlayer
                    experienceId={runtime.experienceId}
                    gameUrl={runtime.containment.html5BundleUrl!}
                    aspectRatio="16:9"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <p className="text-sm text-muted-foreground">Game not available</p>
                  </div>
                )}
              </ContainmentFrame>
              {/* Fullscreen button overlay */}
              <button
                onClick={toggleFullscreen}
                className="absolute bottom-2 right-10 z-40 w-7 h-7 rounded bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title */}
            <h1 className="text-lg font-bold leading-tight">{runtime.title}</h1>

            {/* Action bar (like YouTube: like, dislike, share, challenge) */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 mr-auto">
                <Avatar className="w-9 h-9"><AvatarFallback className="text-[10px] bg-gradient-to-br from-amber-400 to-orange-600 text-white">SD</AvatarFallback></Avatar>
                <div>
                  <div className="text-sm font-medium">Studio Demo Creator</div>
                  <div className="text-[10px] text-muted-foreground">1.2K followers</div>
                </div>
                <Button size="sm" className="h-7 text-xs ml-2">Subscribe</Button>
              </div>

              {/* Like / Dislike */}
              <div className="flex items-center bg-muted rounded-full overflow-hidden">
                <button
                  onClick={() => { setLiked(!liked); setDisliked(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted-foreground/10 transition-colors"
                >
                  <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-foreground' : ''}`} />
                  <span className="text-xs font-medium">{liked ? '1' : '0'}</span>
                </button>
                <Separator orientation="vertical" className="h-5" />
                <button
                  onClick={() => { setDisliked(!disliked); setLiked(false); }}
                  className="px-3 py-1.5 hover:bg-muted-foreground/10 transition-colors"
                >
                  <ThumbsDown className={`w-4 h-4 ${disliked ? 'fill-foreground' : ''}`} />
                </button>
              </div>

              {/* Share */}
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-full">
                <Share2 className="w-3.5 h-3.5" /> Share
              </Button>

              {/* Challenge */}
              <Button size="sm" className="h-8 text-xs gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600">
                <Zap className="w-3.5 h-3.5" /> Challenge
              </Button>
            </div>

            {/* Description box */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-3 mb-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Gamepad2 className="w-3 h-3" /> {runtime.runtimeType}</span>
                  <span>·</span>
                  <span>0 plays</span>
                  <span>·</span>
                  <span>0 likes</span>
                </div>
                <p className={`text-xs ${!showFullDesc ? 'line-clamp-2' : ''}`}>
                  {runtime.description || 'No description provided.'}
                </p>
                {runtime.description && runtime.description.length > 80 && (
                  <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-[11px] text-muted-foreground font-medium mt-1 hover:text-foreground">
                    {showFullDesc ? 'Show less' : '...Show more'}
                  </button>
                )}
                {runtime.bundle?.instances && (
                  <div className="flex gap-1 flex-wrap mt-2 pt-2 border-t border-border">
                    {runtime.bundle.instances.map((inst: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[8px] h-3.5 gap-0.5">
                        <Zap className="w-2 h-2" /> {inst.extensionId.replace('pl.', '')}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Leaderboard</span>
                  <Badge variant="outline" className="text-[8px] h-3.5 ml-auto">
                    <Users className="w-2.5 h-2.5 mr-0.5" /> 500 players
                  </Badge>
                </div>
                <div className="space-y-2">
                  {[
                    { rank: 1, name: 'Diego Torres', avatar: 'DT', score: 1250, color: 'bg-amber-400' },
                    { rank: 2, name: 'Alex Rivers', avatar: 'AR', score: 980, color: 'bg-gray-300' },
                    { rank: 3, name: 'Maya Chen', avatar: 'MC', score: 720, color: 'bg-orange-400' },
                    { rank: 4, name: 'Kenji Sato', avatar: 'KS', score: 540, color: 'bg-muted' },
                    { rank: 5, name: 'Priya Patel', avatar: 'PP', score: 410, color: 'bg-muted' },
                  ].map((entry) => (
                    <div key={entry.rank} className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${entry.color}`}>
                        {entry.rank}
                      </span>
                      <Avatar className="w-6 h-6"><AvatarFallback className="text-[8px]">{entry.avatar}</AvatarFallback></Avatar>
                      <span className="flex-1 text-xs font-medium">{entry.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{entry.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Comments section */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{comments.length} Comments</span>
                </div>

                {/* Comment input */}
                <div className="flex gap-2 mb-4">
                  <Avatar className="w-8 h-8 shrink-0"><AvatarFallback className="text-[9px]">YO</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') postComment(); }}
                      placeholder="Add a comment..."
                      className="w-full h-8 px-2 text-xs border-b border-border bg-transparent focus:border-amber-500 focus:outline-none pb-1"
                    />
                    <div className="flex justify-end gap-1.5 mt-1">
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setComment('')}>Cancel</Button>
                      <Button size="sm" className="h-6 text-[10px] gap-1" onClick={postComment} disabled={!comment.trim()}>
                        <Send className="w-3 h-3" /> Comment
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Comments list */}
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar className="w-8 h-8 shrink-0"><AvatarFallback className="text-[9px]">{c.avatar}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{c.user}</span>
                          <span className="text-[10px] text-muted-foreground">{c.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground">
                            <ThumbsUp className="w-3 h-3" /> {c.likes}
                          </button>
                          <button className="text-[10px] text-muted-foreground hover:text-foreground">Reply</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right column: recommended videos ── */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">Up Next</div>
            {recommended.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recommendations yet</p>
            ) : (
              recommended.map((rec) => (
                <button
                  key={rec.experienceId}
                  onClick={() => playExperience(rec.experienceId)}
                  className="flex gap-2 w-full text-left hover:bg-muted/50 rounded-lg p-1 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative w-40 h-[90px] shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-violet-200 to-fuchsia-200 dark:from-violet-900 dark:to-fuchsia-900 flex items-center justify-center">
                    <Gamepad2 className="w-6 h-6 text-white/60" />
                    {rec.competitiveEligible && (
                      <Badge className="absolute top-1 right-1 text-[7px] h-3 px-1 bg-emerald-500 text-white">🏆</Badge>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="text-xs font-medium line-clamp-2 leading-tight">{rec.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{rec.creatorName}</div>
                    <div className="text-[10px] text-muted-foreground">{rec.playCount} plays</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid · Free to play · Challenge mode is optional
      </footer>
    </div>
  );
}

function matchGameByTitle(title: string): string | undefined {
  const t = title.toLowerCase();
  if (t.includes('neon') || t.includes('runner')) return 'neon-runner';
  if (t.includes('sky') || t.includes('defend') || t.includes('shoot')) return 'sky-defender';
  if (t.includes('coin') || t.includes('collect')) return 'coin-rush';
  return undefined;
}
