'use client';

import { useRef, useEffect, useState } from 'react';
import { NativeRuntimeAdapter, extractGameState, type NativeGameState } from '@/runtime/native/NativeRuntimeAdapter';
import type { ExperienceBundle } from '@/kernel/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Coins, Clock, Play, RotateCcw } from 'lucide-react';

interface NativeGamePlayerProps {
  experienceId: string;
  bundle: ExperienceBundle;
  userId?: string;
  onScore?: (score: number) => void;
  onEnd?: (score: number, tick: number) => void;
}

/**
 * Phase 20.5 — Native Game Player
 * --------------------------------
 * Renders a kernel session on a canvas. The kernel runs server-side;
 * this component drives it via the NativeRuntimeAdapter and renders
 * the resulting state (player, coins, score) every tick.
 *
 * Input: keyboard (arrows / WASD) + touch (on-screen dpad).
 * Telemetry: captured by the kernel on settle.
 */
export function NativeGamePlayer({ experienceId, bundle, userId, onScore, onEnd }: NativeGamePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const adapterRef = useRef<NativeRuntimeAdapter | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputQueueRef = useRef<Array<{ instance: string; action: string }>>([]);

  const [status, setStatus] = useState<'loading' | 'playing' | 'ended' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<NativeGameState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Find the physics instance id (for sending movement actions)
  const physicsInstance = bundle.instances.find((i) => i.extensionId === 'pl.physics');

  // ── Initialize session ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const adapter = new NativeRuntimeAdapter({ experienceId, bundle, userId, mode: 'PREVIEW' });
      adapterRef.current = adapter;
      const result = await adapter.initialize();
      if (cancelled) return;
      if (!result.valid) {
        setError(result.error ?? 'Failed to start session');
        setStatus('error');
        return;
      }
      setSessionId(result.sessionId);
      setStatus('playing');

      // Game loop: tick + render every 120ms (~8 fps — smooth enough for the kernel world)
      loopRef.current = setInterval(async () => {
        const snap = await adapter.tick(1);
        if (!snap || cancelled) return;
        const gs = extractGameState(snap);
        setGameState(gs);
        onScore?.(gs.score);
        if (gs.status === 'ENDED') {
          setStatus('ended');
          onEnd?.(gs.score, gs.tick);
          if (loopRef.current) clearInterval(loopRef.current);
        }
      }, 120);
    })();

    return () => {
      cancelled = true;
      if (loopRef.current) clearInterval(loopRef.current);
      adapterRef.current?.destroy('manual');
    };
  }, [experienceId]);

  // ── Flush queued inputs each frame ──────────────────────────────────────
  useEffect(() => {
    if (status !== 'playing') return;
    const flush = setInterval(() => {
      const queue = inputQueueRef.current;
      if (queue.length === 0 || !adapterRef.current || !physicsInstance) return;
      const batch = queue.splice(0, queue.length);
      for (const input of batch) {
        adapterRef.current.sendInput(physicsInstance.id, input.action);
      }
    }, 80);
    return () => clearInterval(flush);
  }, [status, physicsInstance]);

  // ── Keyboard input ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      let action: string | null = null;
      if (key === 'arrowup' || key === 'w') action = 'move-up';
      else if (key === 'arrowdown' || key === 's') action = 'move-down';
      else if (key === 'arrowleft' || key === 'a') action = 'move-left';
      else if (key === 'arrowright' || key === 'd') action = 'move-right';
      if (action) {
        e.preventDefault();
        inputQueueRef.current.push({ instance: physicsInstance?.id ?? 'physics', action });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, physicsInstance]);

  // ── Render canvas ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const scale = Math.min(W, H) / 100; // world is 0-100

    // Background
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 100; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i * scale, 0);
      ctx.lineTo(i * scale, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * scale);
      ctx.lineTo(W, i * scale);
      ctx.stroke();
    }

    // Coins
    for (const coin of gameState.coins) {
      const cx = coin.x * scale;
      const cy = coin.y * scale;
      if (coin.collected) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Glow
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
        grad.addColorStop(0, 'rgba(250, 204, 21, 0.6)');
        grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        // Coin
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Player
    if (gameState.player) {
      const px = gameState.player.x * scale;
      const py = gameState.player.y * scale;
      // Trail
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Velocity indicator
      const vx = gameState.player.vx;
      const vy = gameState.player.vy;
      if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + vx * scale * 0.5, py + vy * scale * 0.5);
        ctx.stroke();
      }
    }

    // Score overlay (top-left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${gameState.score}`, 8, 20);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`Tick: ${gameState.tick}`, 8, 36);

    // Token balance overlay (top-right)
    const tokenEntries = Object.entries(gameState.tokenBalances);
    if (tokenEntries.length > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
      ctx.font = 'bold 13px monospace';
      tokenEntries.forEach(([sym, amt], i) => {
        ctx.fillText(`${sym}: ${amt}`, W - 8, 20 + i * 16);
      });
    }
  }, [gameState]);

  // ── Touch dpad handler ──────────────────────────────────────────────────
  const sendMove = (action: string) => {
    if (status !== 'playing' || !physicsInstance) return;
    inputQueueRef.current.push({ instance: physicsInstance.id, action });
  };

  // ── Restart ─────────────────────────────────────────────────────────────
  const restart = async () => {
    if (adapterRef.current) {
      await adapterRef.current.destroy('manual');
    }
    setStatus('loading');
    setGameState(null);
    const adapter = new NativeRuntimeAdapter({ experienceId, bundle, userId, mode: 'PREVIEW' });
    adapterRef.current = adapter;
    const result = await adapter.initialize();
    if (!result.valid) {
      setError(result.error ?? 'Failed to restart');
      setStatus('error');
      return;
    }
    setSessionId(result.sessionId);
    setStatus('playing');
    loopRef.current = setInterval(async () => {
      const snap = await adapter.tick(1);
      if (!snap) return;
      const gs = extractGameState(snap);
      setGameState(gs);
      onScore?.(gs.score);
      if (gs.status === 'ENDED') {
        setStatus('ended');
        onEnd?.(gs.score, gs.tick);
        if (loopRef.current) clearInterval(loopRef.current);
      }
    }, 120);
  };

  if (status === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0e1a] rounded-xl">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-xs text-white/60">Initializing native runtime…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-950/40 rounded-xl">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-2">Runtime error</p>
          <p className="text-xs text-white/60 mb-3">{error}</p>
          <Button size="sm" variant="outline" onClick={restart}><RotateCcw className="w-3 h-3" /> Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#0a0e1a] rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="w-full h-full block touch-none"
        tabIndex={0}
      />

      {/* HUD overlay */}
      <div className="absolute top-2 left-2 flex items-center gap-2">
        {gameState && (
          <>
            <Badge className="bg-amber-500/90 text-white text-[10px] gap-1">
              <Trophy className="w-2.5 h-2.5" /> {gameState.score}
            </Badge>
            {Object.entries(gameState.tokenBalances).map(([sym, amt]) => (
              <Badge key={sym} className="bg-yellow-500/90 text-white text-[10px] gap-1">
                <Coins className="w-2.5 h-2.5" /> {amt} {sym}
              </Badge>
            ))}
          </>
        )}
      </div>

      <div className="absolute top-2 right-2">
        <Badge variant="outline" className="bg-black/60 text-white/70 text-[9px] gap-1 border-white/20">
          <Clock className="w-2.5 h-2.5" /> {gameState?.tick ?? 0}
        </Badge>
      </div>

      {/* Touch dpad (mobile) */}
      <div className="absolute bottom-2 right-2 grid grid-cols-3 gap-1 sm:hidden">
        <div />
        <DpadButton onPress={() => sendMove('move-up')}>↑</DpadButton>
        <div />
        <DpadButton onPress={() => sendMove('move-left')}>←</DpadButton>
        <div />
        <DpadButton onPress={() => sendMove('move-right')}>→</DpadButton>
        <div />
        <DpadButton onPress={() => sendMove('move-down')}>↓</DpadButton>
        <div />
      </div>

      {/* Ended overlay */}
      {status === 'ended' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">Session Complete</p>
            <p className="text-sm text-white/70 mb-3">Final score: {gameState?.score ?? 0}</p>
            <Button size="sm" onClick={restart} className="gap-1.5">
              <Play className="w-3 h-3" /> Play Again
            </Button>
          </div>
        </div>
      )}

      {/* Keyboard hint (desktop) */}
      <div className="absolute bottom-2 left-2 hidden sm:block">
        <span className="text-[9px] text-white/40 font-mono">WASD / Arrows to move</span>
      </div>
    </div>
  );
}

function DpadButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className="w-9 h-9 rounded-lg bg-white/10 text-white text-sm flex items-center justify-center active:bg-white/30 touch-none"
    >
      {children}
    </button>
  );
}
