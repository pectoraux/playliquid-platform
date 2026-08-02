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
import {
  ArrowLeft, Heart, Share2, Zap, Trophy, Users, MessageCircle,
  Gamepad2, Globe, Cpu, ChevronRight,
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
 * Long-form experience player (like a YouTube watch page).
 * 16:9 game window + creator info + description + sidebar.
 *
 * No "earn" vocabulary. Competitive mode is optional ("Challenge").
 */
export function GamePlayer({ experienceId }: { experienceId: string }) {
  const { setView } = useStudioStore();
  const [runtime, setRuntime] = useState<ExperienceRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchJSON<{ runtime: ExperienceRuntime }>(`/api/runtime/bundle/${experienceId}`);
        if (!cancelled) setRuntime(d.runtime);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

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
      {/* Minimal header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column: game + info */}
          <div className="lg:col-span-2 space-y-3">
            {/* 16:9 game window */}
            <div className="w-full" style={{ aspectRatio: '16 / 9' }}>
              <ContainmentFrame aspectRatio="16:9" orientation="landscape">
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
            </div>

            {/* Title + actions */}
            <div>
              <h1 className="text-lg font-bold">{runtime.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8"><AvatarFallback className="text-[10px] bg-amber-500 text-white">SD</AvatarFallback></Avatar>
                  <div>
                    <div className="text-xs font-medium">Studio Demo Creator</div>
                    <div className="text-[10px] text-muted-foreground">PlayLiquid</div>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs">Follow</Button>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setLiked(!liked)}>
                    <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} /> {liked ? '1' : '0'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Gamepad2 className="w-3 h-3" /> 0 plays</span>
                  <span>·</span>
                  <span>{runtime.runtimeType} runtime</span>
                </div>
                <p className={`text-xs text-muted-foreground ${!showFullDesc && 'line-clamp-2'}`}>
                  {runtime.description}
                </p>
                {runtime.description.length > 100 && (
                  <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-[10px] text-amber-500 mt-1">
                    {showFullDesc ? 'Show less' : 'Show more'}
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Extensions */}
            <Card>
              <CardContent className="p-3">
                <div className="text-xs font-medium mb-2">Extensions</div>
                <div className="flex flex-wrap gap-1.5">
                  {runtime.bundle?.instances?.map((inst: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[9px] h-4 gap-0.5">
                      <Zap className="w-2.5 h-2.5" /> {inst.extensionId.replace('pl.', '')}
                    </Badge>
                  )) ?? <span className="text-[10px] text-muted-foreground">No extensions</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: challenge + leaderboard */}
          <div className="space-y-3">
            {/* Challenge mode card */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Challenge Mode</div>
                    <div className="text-[9px] text-muted-foreground">Compete for prizes</div>
                  </div>
                </div>
                <div className="space-y-1 text-[10px] text-muted-foreground mb-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Players</span>
                    <span className="font-medium text-foreground">500</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Trophy className="w-2.5 h-2.5" /> Prize pool</span>
                    <span className="font-medium text-foreground">200 L</span>
                  </div>
                </div>
                <Button size="sm" className="w-full h-7 text-xs gap-1 bg-gradient-to-r from-amber-500 to-orange-600">
                  Enter Challenge <ChevronRight className="w-3 h-3" />
                </Button>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium">Leaderboard</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { rank: 1, name: 'Alex', score: 1250 },
                    { rank: 2, name: 'Maya', score: 980 },
                    { rank: 3, name: 'Diego', score: 720 },
                  ].map((entry) => (
                    <div key={entry.rank} className="flex items-center gap-2 text-[10px]">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${entry.rank === 1 ? 'bg-amber-400 text-white' : entry.rank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-orange-400 text-white'}`}>
                        {entry.rank}
                      </span>
                      <span className="flex-1 font-medium">{entry.name}</span>
                      <span className="font-mono text-muted-foreground">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Comments preview */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Comments</span>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-muted-foreground">"This game is amazing!" — player_42</div>
                  <div className="text-[10px] text-muted-foreground">"How do I beat level 3?" — maya</div>
                </div>
              </CardContent>
            </Card>
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
