'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * ADR-005: Game Containment Frame
 * --------------------------------
 * Every experience must run inside the PlayLiquid frame.
 * This component provides:
 *   - Fixed PlayLiquid viewport
 *   - Aspect ratio enforcement
 *   - Input normalization layer (touch → standard events)
 *   - Fullscreen handling
 *   - Performance telemetry hooks
 *
 * No experience may render outside this boundary.
 */

interface ContainmentFrameProps {
  aspectRatio?: string; // "16:9" | "9:16" | "1:1" | "fluid"
  orientation?: 'portrait' | 'landscape' | 'any';
  fullscreenEnabled?: boolean;
  onPerformanceMetric?: (fps: number, latency: number) => void;
  children: React.ReactNode;
}

export function ContainmentFrame({
  aspectRatio = 'fluid',
  orientation = 'any',
  fullscreenEnabled = true,
  onPerformanceMetric,
  children,
}: ContainmentFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fps, setFps] = useState(60);

  // Aspect ratio calculation
  const aspectStyle = (() => {
    if (aspectRatio === 'fluid') return { width: '100%', height: '100%' };
    const [w, h] = aspectRatio.split(':').map(Number);
    return { aspectRatio: `${w} / ${h}`, width: '100%', maxHeight: '100%' };
  })();

  // Fullscreen handling
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Performance monitoring (simulated FPS counter)
  useEffect(() => {
    if (!onPerformanceMetric) return;
    let frame = 0;
    let lastTime = performance.now();
    let raf: number;

    const loop = (time: number) => {
      frame++;
      if (time - lastTime >= 1000) {
        const measuredFps = Math.round((frame * 1000) / (time - lastTime));
        setFps(measuredFps);
        onPerformanceMetric(measuredFps, time - lastTime);
        frame = 0;
        lastTime = time;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onPerformanceMetric]);

  // Input normalization: touch → standard pointer events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const normalizeTouch = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      // Dispatch normalized event
      el.dispatchEvent(new CustomEvent('pl:normalized-input', {
        detail: { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), type: e.type },
      }));
    };

    el.addEventListener('touchstart', normalizeTouch, { passive: true });
    el.addEventListener('touchmove', normalizeTouch, { passive: true });
    el.addEventListener('touchend', normalizeTouch, { passive: true });

    return () => {
      el.removeEventListener('touchstart', normalizeTouch);
      el.removeEventListener('touchmove', normalizeTouch);
      el.removeEventListener('touchend', normalizeTouch);
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden">
      {/* PlayLiquid Frame Boundary */}
      <div
        ref={containerRef}
        className="relative bg-background overflow-hidden"
        style={aspectStyle}
        data-orientation={orientation}
        data-pl-frame="true"
      >
        {/* Experience Runtime renders here */}
        {children}

        {/* Frame overlay: performance indicator */}
        {onPerformanceMetric && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono pointer-events-none">
            {fps}fps
          </div>
        )}

        {/* Frame overlay: fullscreen button */}
        {fullscreenEnabled && (
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-1 right-1 w-6 h-6 rounded bg-black/60 text-white text-[10px] flex items-center justify-center hover:bg-black/80 transition-colors"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? '⤓' : '⤢'}
          </button>
        )}

        {/* Frame overlay: PlayLiquid badge */}
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/40 text-white/60 text-[8px] font-mono pointer-events-none">
          PlayLiquid
        </div>
      </div>
    </div>
  );
}
