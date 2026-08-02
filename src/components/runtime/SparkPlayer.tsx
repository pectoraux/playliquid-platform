'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { GameCanvas } from '@/components/runtime/GameCanvas';
import { Html5GamePlayer } from '@/components/runtime/Html5GamePlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Heart, MessageCircle, Share2, Zap, ChevronUp, ChevronDown,
  X, Trophy, Users,
} from 'lucide-react';
import { SPARKS } from '@/engine/sparks';

interface Spark {
  experienceId: string;
  title: string;
  creatorName: string;
  creatorId: string;
  playCount: number;
  format: string;
  extensions: any[];
  runtimeType?: string;
  engineGameId?: string;
  html5BundleUrl?: string;
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
 * Phase 24 — TikTok-style Spark Player
 * -------------------------------------
 * Fullscreen vertical 9:16. Game auto-starts instantly.
 * Side action rail: creator avatar, like, comment, share, challenge.
 * Vertical swipe to navigate between sparks (preload next/prev).
 *
 * No "Play" button. No loading screen. The game IS the content.
 */
export function SparkPlayer({ sparks, initialIndex = 0 }: { sparks: Spark[]; initialIndex?: number }) {
  const { setView } = useStudioStore();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState(false);
  const [swipeDir, setSwipeDir] = useState<'up' | 'down' | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  const current = sparks[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < sparks.length - 1) {
      setIsPaused(true); // pause current spark
      setSwipeDir('up');
      setTimeout(() => {
        setCurrentIndex((i) => Math.min(i + 1, sparks.length - 1));
        setSwipeDir(null);
        setIsPaused(false); // resume new spark
      }, 200);
    }
  }, [currentIndex, sparks.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsPaused(true); // pause current spark
      setSwipeDir('down');
      setTimeout(() => {
        setCurrentIndex((i) => Math.max(i - 1, 0));
        setSwipeDir(null);
        setIsPaused(false); // resume new spark
      }, 200);
    }
  }, [currentIndex]);

  const toggleLike = useCallback((id?: string) => {
    if (!id) return;
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); goNext(); }
      else if (e.key === 'Escape') { setView('home-v3'); }
      else if (e.key === 'l') { toggleLike(current?.experienceId); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, current, setView, toggleLike]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) > 50) {
      if (deltaY > 0) goNext();
      else goPrev();
    }
    touchStartY.current = null;
  };

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white/60 text-sm">No sparks available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={() => setView('home-v3')}
        className="absolute top-4 left-4 z-50 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Spark counter */}
      <div className="absolute top-4 right-4 z-50 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-mono">
        {currentIndex + 1} / {sparks.length}
      </div>

      {/* No arrow buttons — TikTok uses scroll/swipe only */}

      {/* Main spark content — vertical 9:16 */}
      <div
        className={`relative h-full w-full max-w-[420px] flex items-center justify-center transition-transform duration-200 ${swipeDir === 'up' ? '-translate-y-full' : swipeDir === 'down' ? 'translate-y-full' : ''}`}
      >
        <SparkContent spark={current} paused={isPaused} />
      </div>

      {/* Side action rail (right side, vertical) */}
      <div className="absolute right-3 bottom-20 z-40 flex flex-col items-center gap-4">
        {/* Creator avatar */}
        <button
          onClick={() => setView('home-v3')}
          className="relative"
        >
          <Avatar className="w-10 h-10 border-2 border-white">
            <AvatarFallback className="text-[10px] bg-gradient-to-br from-amber-400 to-rose-500 text-white">
              {current.creatorName?.slice(0, 2).toUpperCase() ?? 'PL'}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">+</div>
        </button>

        {/* Like */}
        <button
          onClick={() => toggleLike(current.experienceId)}
          className="flex flex-col items-center gap-0.5"
        >
          <Heart className={`w-7 h-7 ${liked.has(current.experienceId) ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
          <span className="text-white text-[9px] font-medium">{Math.floor(current.playCount / 10) + (liked.has(current.experienceId) ? 1 : 0)}</span>
        </button>

        {/* Comments */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-col items-center gap-0.5"
        >
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-white text-[9px] font-medium">{Math.floor(current.playCount / 20)}</span>
        </button>

        {/* Share */}
        <button className="flex flex-col items-center gap-0.5">
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-white text-[9px] font-medium">Share</span>
        </button>

        {/* Challenge mode */}
        <button className="flex flex-col items-center gap-0.5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[9px] font-medium">Challenge</span>
        </button>
      </div>

      {/* Bottom info bar (creator + title) */}
      <div className="absolute bottom-4 left-3 right-16 z-40">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white text-xs font-medium">@{current.creatorName?.toLowerCase().replace(/\s+/g, '') ?? 'creator'}</span>
          <Badge className="text-[7px] h-3 px-1 bg-rose-500 text-white">SPARK</Badge>
        </div>
        <p className="text-white text-xs line-clamp-2 mb-1">{current.title}</p>
        {current.extensions && current.extensions.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {current.extensions.slice(0, 3).map((ext: any, i: number) => (
              <span key={i} className="text-[8px] text-white/60">{ext.icon}{i < Math.min(2, current.extensions.length - 1) ? ' ·' : ''}</span>
            ))}
          </div>
        )}
      </div>

      {/* Comments panel (slide up) */}
      {showComments && (
        <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md rounded-t-2xl p-4 max-h-[40%] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-sm font-medium">Comments</span>
            <button onClick={() => setShowComments(false)}><X className="w-4 h-4 text-white/60" /></button>
          </div>
          <div className="space-y-2">
            <CommentItem avatar="JP" name="player_42" text="🔥 How did you make that jump?" time="2h" />
            <CommentItem avatar="MK" name="maya" text="This is impossible on level 3" time="4h" />
            <CommentItem avatar="RT" name="riley" text="Beat my score! 850 points" time="1d" />
          </div>
          <div className="flex gap-2 mt-3">
            <input
              placeholder="Add a comment..."
              className="flex-1 h-8 px-3 text-xs rounded-full bg-white/10 text-white placeholder:text-white/40 border border-white/20"
            />
            <Button size="sm" variant="ghost" className="h-8 text-white text-xs">Post</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({ avatar, name, text, time }: { avatar: string; name: string; text: string; time: string }) {
  return (
    <div className="flex gap-2">
      <Avatar className="w-6 h-6 shrink-0"><AvatarFallback className="text-[8px] bg-muted">{avatar}</AvatarFallback></Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white/80 text-[10px] font-medium">{name}</span>
          <span className="text-white/40 text-[9px]">{time}</span>
        </div>
        <p className="text-white/70 text-[11px]">{text}</p>
      </div>
    </div>
  );
}

// ─── Spark content (auto-starting game) ────────────────────────────────────

function SparkContent({ spark, paused = false }: { spark: Spark; paused?: boolean }) {
  const [runtime, setRuntime] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchJSON<{ runtime: any }>(`/api/runtime/bundle/${spark.experienceId}`);
        if (!cancelled) {
          setRuntime(d.runtime);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [spark.experienceId]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-violet-900 to-black">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto mb-2" />
          <p className="text-white/40 text-[10px]">Loading…</p>
        </div>
      </div>
    );
  }

  // Determine game type
  const engineGameId = runtime?.engineGameId ?? spark.engineGameId ?? matchSparkByTitle(spark.title);
  const sparkGame = engineGameId ? SPARKS[engineGameId] : undefined;
  const isHtml5 = runtime?.runtimeType === 'html5' || (runtime?.containment?.html5BundleUrl && !sparkGame);

  return (
    <div className="relative w-full h-full max-h-[100vh] flex items-center justify-center bg-black">
      {sparkGame ? (
        <GameCanvas
          key={spark.experienceId}
          game={sparkGame}
        />
      ) : isHtml5 && runtime?.containment?.html5BundleUrl ? (
        <Html5GamePlayer
          experienceId={spark.experienceId}
          gameUrl={runtime.containment.html5BundleUrl}
          aspectRatio="9:16"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-amber-900 to-black">
          <div className="text-center p-4">
            <div className="text-4xl mb-2">{spark.extensions?.[0]?.icon ?? '🎮'}</div>
            <p className="text-white text-sm font-medium">{spark.title}</p>
            <p className="text-white/40 text-[10px] mt-1">Spark runtime not available</p>
          </div>
        </div>
      )}
      {/* Paused overlay */}
      {paused && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30 pointer-events-none">
          <div className="text-white/60 text-xs">Paused</div>
        </div>
      )}
    </div>
  );
}

function matchSparkByTitle(title: string): string | undefined {
  const t = title.toLowerCase();
  if (t.includes('catch') || t.includes('star')) return 'catch-stars';
  if (t.includes('reaction') || t.includes('reflex')) return 'reaction-challenge';
  if (t.includes('pet') || t.includes('cuddle') || t.includes('critter')) return 'tap-pet';
  return undefined;
}
