'use client';

import { useRef, useEffect, useState } from 'react';
import { PlayEngine, type GameConfig } from '@/engine/PlayEngine';
import type { GameDefinition } from '@/engine/games';
import type { SparkDefinition } from '@/engine/sparks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, RotateCcw, Play } from 'lucide-react';

interface GameCanvasProps {
  game: GameDefinition | SparkDefinition;
  seed?: string;
  onScore?: (score: number) => void;
  onEnd?: (score: number, status: string) => void;
}

/**
 * GameCanvas — mounts a PlayEngine game on a canvas and handles lifecycle.
 * Shows loading state, game over screen, and restart.
 */
export function GameCanvas({ game, seed = 'spark-seed', onScore, onEnd }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PlayEngine | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<{ score: number; status: string; time: number } | null>(null);
  const [ended, setEnded] = useState(false);

  const startGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clean up previous engine
    engineRef.current?.stop();

    const engine = new PlayEngine(canvas, game.config, {
      onUpdate: (state, dt, input, eng) => game.update(state, dt, input, eng),
      onRender: (ctx, state) => game.render(ctx, state),
      onScore: (score) => {
        setGameState({ score, status: 'playing', time: engine.currentState.time });
        onScore?.(score);
      },
      onEnd: (state) => {
        setGameState({ score: state.score, status: state.status, time: state.time });
        setEnded(true);
        onEnd?.(state.score, state.status);
      },
      onEvent: (event) => {
        // Could forward to telemetry API
      },
    });

    engineRef.current = engine;
    game.init(engine, seed);
    setEnded(false);
    setGameState({ score: 0, status: 'playing', time: 0 });
    setLoading(false);

    // Start the game loop
    engine.start();
  };

  useEffect(() => {
    // Small delay to show loading state
    const timer = setTimeout(startGame, 300);
    return () => {
      clearTimeout(timer);
      engineRef.current?.stop();
    };
  }, [game.id]);

  // Periodic state sync (for timer display)
  useEffect(() => {
    if (!engineRef.current) return;
    const interval = setInterval(() => {
      const s = engineRef.current?.currentState;
      if (s) setGameState({ score: s.score, status: s.status, time: s.time });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const isSpark = game.format === 'spark';
  const canvasW = isSpark ? 360 : game.config.width;
  const canvasH = isSpark ? 640 : game.config.height;

  return (
    <div className="w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden relative">
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="max-w-full max-h-full touch-none"
        style={{ aspectRatio: `${canvasW} / ${canvasH}` }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
            <p className="text-xs text-white/60">Loading {game.name}…</p>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {ended && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">
              {gameState?.status === 'won' ? 'You Win!' : 'Game Over'}
            </p>
            <p className="text-sm text-white/70 mb-3">Score: {gameState?.score ?? 0}</p>
            <Button size="sm" onClick={startGame} className="gap-1.5">
              <Play className="w-3 h-3" /> Play Again
            </Button>
          </div>
        </div>
      )}

      {/* Score badge (top-left) */}
      {!loading && !ended && gameState && (
        <div className="absolute top-2 left-2 pointer-events-none">
          <Badge className="bg-black/60 text-white text-[10px] gap-1">
            <Trophy className="w-2.5 h-2.5" /> {gameState.score}
          </Badge>
        </div>
      )}

      {/* Restart button (top-right) */}
      {!loading && !ended && (
        <button
          onClick={() => { engineRef.current?.end(); setEnded(true); }}
          className="absolute top-2 right-2 w-6 h-6 rounded bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
          aria-label="End game"
        >
          ✕
        </button>
      )}
    </div>
  );
}
