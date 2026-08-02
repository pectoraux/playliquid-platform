'use client';

import { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { ContainmentFrame } from '@/components/consumer-v2/ContainmentFrame';
import { GameCanvas } from '@/components/runtime/GameCanvas';
import { Html5GamePlayer } from '@/components/runtime/Html5GamePlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { V3ShellWrapper } from '@/components/consumer-v2/V3ShellWrapper';
import {
  ArrowLeft, Heart, Share2, Zap, Trophy, Users, MessageCircle,
  Gamepad2, Globe, Cpu, Maximize2, Minimize2, Send, ThumbsUp, ThumbsDown,
  Copy, Check, Link2,
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

interface Comment {
  id: string;
  displayName: string;
  body: string;
  likes: number;
  createdAt: number;
  replies?: Comment[];
}

async function fetchJSON<T = any>(url: string, retries = 2): Promise<T> {
  try { const res = await fetch(url); return await res.json(); }
  catch { if (retries > 0) { await new Promise(r => setTimeout(r, 800)); return fetchJSON<T>(url, retries - 1); } throw new Error('fetch failed'); }
}

async function postJSON<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return await res.json();
}

export function GamePlayer({ experienceId }: { experienceId: string }) {
  const { setView, playExperience } = useStudioStore();
  const [runtime, setRuntime] = useState<ExperienceRuntime | null>(null);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState('');
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rt, home] = await Promise.all([
          fetchJSON<{ runtime: ExperienceRuntime }>(`/api/runtime/bundle/${experienceId}`),
          fetchJSON<any>('/api/consumer-v2/home?userId=demo-user'),
        ]);
        if (cancelled) return;
        setRuntime(rt.runtime);
        setRecommended((home.home?.experiences ?? []).filter((e: any) => e.experienceId !== experienceId).slice(0, 10));
        // Load social data
        if (rt.runtime?.creatorId) {
          const [followRes, commentRes, likeRes, saveRes] = await Promise.all([
            fetchJSON<{ following: boolean; followers: number }>(`/api/social/follow?creatorId=${rt.runtime.creatorId}&viewerId=demo-user`),
            fetchJSON<{ comments: Comment[] }>(`/api/social/comments?experienceId=${experienceId}`),
            fetchJSON<{ liked: boolean }>(`/api/social/like?experienceId=${experienceId}&userId=demo-user`),
            fetchJSON<{ saved: boolean }>(`/api/social/save?experienceId=${experienceId}&listType=watch-later&userId=demo-user`),
          ]);
          if (!cancelled) {
            setSubscribed(followRes.following);
            setSubscriberCount(followRes.followers);
            setComments(commentRes.comments ?? []);
            setLiked(likeRes.liked);
            setSaved(saveRes.saved);
          }
        }
        // Record play in history
        postJSON('/api/social/history', { experienceId, experienceTitle: rt.runtime?.title ?? '' }).catch(() => {});
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

  // Fullscreen that actually resizes the frame
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && frameRef.current) {
      frameRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleSubscribe = async () => {
    if (!runtime?.creatorId) return;
    const action = subscribed ? 'unfollow' : 'follow';
    const res = await postJSON<{ following: boolean; followers: number }>('/api/social/follow', { creatorId: runtime.creatorId, action, viewerId: 'demo-user' });
    setSubscribed(res.following);
    setSubscriberCount(res.followers);
  };

  const handleLike = async () => {
    const res = await postJSON<{ liked: boolean; likeCount: number }>('/api/social/like', { experienceId, userId: 'demo-user' });
    setLiked(res.liked);
  };

  const handleSave = async () => {
    const res = await postJSON<{ saved: boolean }>('/api/social/save', { experienceId, listType: 'watch-later', userId: 'demo-user' });
    setSaved(res.saved);
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    const res = await postJSON<{ comment: Comment }>('/api/social/comments', { experienceId, body: comment.trim(), displayName: 'You' });
    setComments([res.comment, ...comments]);
    setComment('');
  };

  const likeComment = async (id: string) => {
    const res = await postJSON<{ likes: number }>(`/api/social/comments/${id}/like`);
    setComments(comments.map(c => c.id === id ? { ...c, likes: res.likes } : c));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-2 border-muted border-t-foreground animate-spin" /></div>;
  if (!runtime) return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p className="text-sm text-muted-foreground">Experience not found</p><Button variant="outline" size="sm" onClick={() => setView('home-v3')}>Back to Home</Button></div>;

  const engineGameId = runtime.engineGameId ?? matchGameByTitle(runtime.title);
  const nativeGame = engineGameId ? GAMES[engineGameId] : undefined;
  const isHtml5 = runtime.runtimeType === 'html5' && runtime.containment.html5BundleUrl;

  return (
    <V3ShellWrapper title={runtime.title} showSearch={!isFullscreen}>
      <div className={`flex flex-col bg-background ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'min-h-[calc(100vh-3.5rem)]'}`}>
        {/* Runtime badge (floating, above content) */}
        {!isFullscreen && (
          <div className="max-w-6xl mx-auto w-full px-4 pt-3">
            {runtime.runtimeType === 'html5' ? <Badge className="bg-emerald-500 text-white text-[9px] gap-1"><Globe className="w-2.5 h-2.5" /> HTML5</Badge> : <Badge className="bg-violet-500 text-white text-[9px] gap-1"><Cpu className="w-2.5 h-2.5" /> Native</Badge>}
          </div>
        )}

      <main className={`flex-1 max-w-6xl w-full mx-auto px-4 py-4 ${isFullscreen ? 'max-w-none flex items-center justify-center' : ''}`}>
        {isFullscreen ? (
          <div ref={frameRef} className="w-full h-full flex items-center justify-center bg-black">
            <div className="relative w-full h-full max-w-[1600px] max-h-[900px]" style={{ aspectRatio: '16/9' }}>
              <ContainmentFrame aspectRatio="16:9" orientation="landscape" fullscreenEnabled={false}>
                {nativeGame ? <GameCanvas key={nativeGame.id} game={nativeGame} /> : isHtml5 ? <Html5GamePlayer experienceId={runtime.experienceId} gameUrl={runtime.containment.html5BundleUrl!} aspectRatio="16:9" /> : null}
              </ContainmentFrame>
            </div>
            <button onClick={toggleFullscreen} className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center"><Minimize2 className="w-5 h-5" /></button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
            <div className="space-y-3 min-w-0">
              {/* Game frame with fullscreen */}
              <div ref={frameRef} className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <ContainmentFrame aspectRatio="16:9" orientation="landscape" fullscreenEnabled={false}>
                  {nativeGame ? <GameCanvas key={nativeGame.id} game={nativeGame} /> : isHtml5 ? <Html5GamePlayer experienceId={runtime.experienceId} gameUrl={runtime.containment.html5BundleUrl!} aspectRatio="16:9" /> : <div className="w-full h-full flex items-center justify-center bg-muted"><p className="text-sm text-muted-foreground">Game not available</p></div>}
                </ContainmentFrame>
                <button onClick={toggleFullscreen} className="absolute bottom-2 right-10 z-40 w-7 h-7 rounded bg-black/60 text-white flex items-center justify-center hover:bg-black/80"><Maximize2 className="w-3.5 h-3.5" /></button>
              </div>

              <h1 className="text-lg font-bold leading-tight">{runtime.title}</h1>

              {/* Action bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 mr-auto">
                  <Avatar className="w-9 h-9 cursor-pointer" onClick={() => setView('home-v3')}><AvatarFallback className="text-[10px] bg-gradient-to-br from-amber-400 to-orange-600 text-white">SD</AvatarFallback></Avatar>
                  <div className="cursor-pointer" onClick={() => setView('home-v3')}>
                    <div className="text-sm font-medium">Studio Demo Creator</div>
                    <div className="text-[10px] text-muted-foreground">{subscriberCount.toLocaleString()} subscribers</div>
                  </div>
                  <Button size="sm" variant={subscribed ? 'secondary' : 'default'} className="h-7 text-xs ml-2 rounded-full" onClick={handleSubscribe}>{subscribed ? 'Subscribed' : 'Subscribe'}</Button>
                </div>
                <div className="flex items-center bg-muted rounded-full overflow-hidden">
                  <button onClick={handleLike} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted-foreground/10"><ThumbsUp className={`w-4 h-4 ${liked ? 'fill-amber-500 text-amber-500' : ''}`} /><span className="text-xs font-medium">{liked ? 'Liked' : 'Like'}</span></button>
                  <Separator orientation="vertical" className="h-5" />
                  <button onClick={() => { setLiked(false); }} className="px-3 py-1.5 hover:bg-muted-foreground/10"><ThumbsDown className="w-4 h-4" /></button>
                </div>
                <Button size="sm" variant={saved ? 'secondary' : 'outline'} className="h-8 text-xs gap-1.5 rounded-full" onClick={handleSave}>{saved ? '✓ Saved' : 'Save'}</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-full" onClick={() => setShowShare(true)}><Share2 className="w-3.5 h-3.5" /> Share</Button>
                <Button size="sm" className="h-8 text-xs gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600"><Zap className="w-3.5 h-3.5" /> Challenge</Button>
              </div>

              {/* Description */}
              <Card><CardContent className="p-3">
                <div className="flex items-center gap-3 mb-2 text-[11px] text-muted-foreground"><span>{runtime.runtimeType}</span><span>·</span><span>0 plays</span></div>
                <p className="text-xs">{runtime.description || 'No description provided.'}</p>
              </CardContent></Card>

              {/* Leaderboard */}
              <Card><CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3"><Trophy className="w-4 h-4 text-amber-500" /><span className="text-sm font-medium">Leaderboard</span></div>
                <div className="space-y-2">
                  {[{ r: 1, n: 'Diego Torres', a: 'DT', s: 1250, c: 'bg-amber-400' }, { r: 2, n: 'Alex Rivers', a: 'AR', s: 980, c: 'bg-gray-300' }, { r: 3, n: 'Maya Chen', a: 'MC', s: 720, c: 'bg-orange-400' }].map(e => (
                    <div key={e.r} className="flex items-center gap-2.5"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${e.c}`}>{e.r}</span><Avatar className="w-6 h-6"><AvatarFallback className="text-[8px]">{e.a}</AvatarFallback></Avatar><span className="flex-1 text-xs font-medium">{e.n}</span><span className="text-xs font-mono text-muted-foreground">{e.s.toLocaleString()}</span></div>
                  ))}
                </div>
              </CardContent></Card>

              {/* Real Comments */}
              <Card><CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3"><MessageCircle className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{comments.length} Comments</span></div>
                <div className="flex gap-2 mb-4">
                  <Avatar className="w-8 h-8 shrink-0"><AvatarFallback className="text-[9px]">YO</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') postComment(); }} placeholder="Add a comment..." className="w-full h-8 px-2 text-xs border-b border-border bg-transparent focus:border-amber-500 focus:outline-none pb-1" />
                    <div className="flex justify-end gap-1.5 mt-1"><Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setComment('')}>Cancel</Button><Button size="sm" className="h-6 text-[10px] gap-1" onClick={postComment} disabled={!comment.trim()}><Send className="w-3 h-3" /> Comment</Button></div>
                  </div>
                </div>
                <div className="space-y-3">
                  {comments.length === 0 ? <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p> : comments.map(c => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar className="w-8 h-8 shrink-0"><AvatarFallback className="text-[9px]">{c.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className="text-xs font-medium">{c.displayName}</span><span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span></div>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.body}</p>
                        <div className="flex items-center gap-2 mt-1"><button onClick={() => likeComment(c.id)} className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"><ThumbsUp className="w-3 h-3" /> {c.likes}</button><button className="text-[10px] text-muted-foreground hover:text-foreground">Reply</button></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            </div>

            {/* Recommended sidebar */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Up Next</div>
              {recommended.map(rec => (
                <button key={rec.experienceId} onClick={() => playExperience(rec.experienceId)} className="flex gap-2 w-full text-left hover:bg-muted/50 rounded-lg p-1">
                  <div className="relative w-40 h-[90px] shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-violet-300 to-fuchsia-300 dark:from-violet-800 dark:to-fuchsia-800 flex items-center justify-center"><Gamepad2 className="w-6 h-6 text-white/60" />{rec.competitiveEligible && <Badge className="absolute top-1 right-1 text-[7px] h-3 px-1 bg-emerald-500 text-white">🏆</Badge>}</div>
                  <div className="flex-1 min-w-0 py-0.5"><div className="text-xs font-medium line-clamp-2 leading-tight">{rec.title}</div><div className="text-[10px] text-muted-foreground mt-0.5">{rec.creatorName}</div><div className="text-[10px] text-muted-foreground">{rec.playCount} plays · {rec.publishedAgo ?? 'recently'}</div></div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Share Modal */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Share2 className="w-4 h-4" /> Share</DialogTitle></DialogHeader>
          <ShareContent experienceId={experienceId} title={runtime.title} />
        </DialogContent>
      </Dialog>

      {!isFullscreen && <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">PlayLiquid · Free to play · Challenge mode is optional</footer>}
      </div>
    </V3ShellWrapper>
  );
}

function ShareContent({ experienceId, title }: { experienceId: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const link = `https://playliquid.vercel.app/?exp=${experienceId}`;
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
        <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <input readOnly value={link} className="flex-1 bg-transparent text-xs focus:outline-none" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copy}>{copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied!' : 'Copy'}</Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[{ n: 'WhatsApp', e: '🟢' }, { n: 'X', e: '𝕏' }, { n: 'Facebook', e: '📘' }, { n: 'Telegram', e: '✈️' }].map(s => (
          <button key={s.n} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(title + ' ' + link)}`, '_blank')} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted">
            <span className="text-xl">{s.e}</span><span className="text-[9px] text-muted-foreground">{s.n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return 'just now'; if (h < 1) return `${m}m ago`; if (d < 1) return `${h}h ago`; return `${d}d ago`;
}

function matchGameByTitle(title: string): string | undefined {
  const t = title.toLowerCase();
  if (t.includes('neon') || t.includes('runner')) return 'neon-runner';
  if (t.includes('sky') || t.includes('defend') || t.includes('shoot')) return 'sky-defender';
  if (t.includes('coin') || t.includes('collect')) return 'coin-rush';
  return undefined;
}
