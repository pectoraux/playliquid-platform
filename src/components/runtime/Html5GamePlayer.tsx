'use client';

import { useRef, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Trophy, Radio } from 'lucide-react';

interface Html5GamePlayerProps {
  experienceId: string;
  gameUrl: string;        // e.g. /imported-games/orb-collector/
  aspectRatio?: string;
  onTelemetry?: (event: { name: string; value: unknown }) => void;
}

/**
 * Phase 20.5 — HTML5 Game Player
 * -------------------------------
 * Runs an imported HTML5 game inside an iframe. Provides the PlayLiquid
 * input/telemetry bridges:
 *
 *   Input:     parent → iframe  (pl:input, forwarded keyboard/touch)
 *   Telemetry: iframe  → parent (pl:telemetry, game events)
 *
 * The game is sandboxed; communication is via postMessage only.
 */
export function Html5GamePlayer({ experienceId, gameUrl, aspectRatio = '16:9', onTelemetry }: Html5GamePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [telemetryCount, setTelemetryCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{ name: string; value: unknown; ts: number }>>([]);
  const telemetryRef = useRef<Array<{ name: string; value: unknown; ts: number }>>([]);

  // Full URL (append index.html if not present)
  const fullUrl = gameUrl.endsWith('/') ? `${gameUrl}index.html` : gameUrl;

  // ── Listen for telemetry from the iframe ────────────────────────────────
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'pl:telemetry') return;
      const evt = data.event;
      if (!evt || !evt.name) return;

      const entry = { name: evt.name, value: evt.value, ts: evt.ts ?? Date.now() };
      telemetryRef.current = [...telemetryRef.current.slice(-49), entry];
      setEvents(telemetryRef.current);
      setTelemetryCount((c) => c + 1);
      setLastEvent(evt.name);
      onTelemetry?.(evt);

      // Persist telemetry to the server (fire-and-forget)
      fetch('/api/telemetry/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId,
          kind: evt.name,
          data: evt.value,
        }),
      }).catch(() => {});
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [experienceId, onTelemetry]);

  // ── Forward keyboard input to the iframe ────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const keyMap: Record<string, string> = {
      arrowleft: 'move-left', a: 'move-left',
      arrowright: 'move-right', d: 'move-right',
      arrowup: 'move-up', w: 'move-up',
      arrowdown: 'move-down', s: 'move-down',
    };
    const sendInput = (action: string, pressed: boolean) => {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'pl:input',
        payload: { action, pressed },
      }, '*');
    };
    const onDown = (e: KeyboardEvent) => {
      const action = keyMap[e.key.toLowerCase()];
      if (action) { e.preventDefault(); sendInput(action, true); }
      if (e.key === ' ') { e.preventDefault(); sendInput('start', true); }
    };
    const onUp = (e: KeyboardEvent) => {
      const action = keyMap[e.key.toLowerCase()];
      if (action) { e.preventDefault(); sendInput(action, false); }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [loaded]);

  const aspectStyle = (() => {
    if (aspectRatio === 'fluid') return { width: '100%', height: '100%' };
    const [w, h] = aspectRatio.split(':').map(Number);
    return { aspectRatio: `${w} / ${h}`, width: '100%', maxHeight: '100%' };
  })();

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0e1a] rounded-xl overflow-hidden">
      {/* Game iframe */}
      <div className="flex-1 flex items-center justify-center relative" style={aspectStyle}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={fullUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => setLoaded(true)}
          title="PlayLiquid HTML5 Game"
        />
      </div>

      {/* Telemetry HUD */}
      <div className="border-t border-white/10 bg-black/40 px-2 py-1.5 flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[8px] h-3.5 bg-white/5 text-white/70 border-white/20 gap-1">
          <Radio className="w-2.5 h-2.5 text-emerald-400" /> HTML5 Runtime
        </Badge>
        <Badge variant="outline" className="text-[8px] h-3.5 bg-white/5 text-white/70 border-white/20">
          {telemetryCount} events
        </Badge>
        {lastEvent && (
          <Badge variant="outline" className="text-[8px] h-3.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
            last: {lastEvent}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1 max-w-[40%] overflow-hidden">
          {events.slice(-3).map((e, i) => (
            <span key={i} className="text-[8px] text-white/40 font-mono truncate">
              {e.name}={typeof e.value === 'object' ? '…' : String(e.value).slice(0, 20)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
