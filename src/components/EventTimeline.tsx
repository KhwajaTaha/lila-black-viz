'use client';
// Event marks drawn on a canvas (once per match) — not N DOM divs updated at 15fps

import { useEffect, useRef, useCallback, memo } from 'react';
import { MatchData } from '@/lib/types';

interface Props {
  match: MatchData;
  currentTime: number;
  playing: boolean;
  speed: number;
  onTimeChange: (t: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (s: number) => void;
}

const SPEEDS = [0.5, 1, 2, 5, 10, 20];

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const EventTimeline = memo(function EventTimeline({
  match, currentTime, playing, speed,
  onTimeChange, onPlayPause, onSpeedChange,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<HTMLCanvasElement>(null);
  const duration = match.duration_ms || 1;
  const progress = Math.min(currentTime / duration, 1);

  // Draw event marks onto canvas ONCE when the match changes
  useEffect(() => {
    const canvas = marksRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    for (const player of match.players) {
      for (const ev of player.nonPosEvents) {
        const x = Math.round((ev.t / duration) * W);
        ctx.fillStyle =
          ev.e.includes('Kill') ? '#f87171' :
            ev.e.includes('Killed') || ev.e === 'KilledByStorm' ? '#9ca3af' :
              '#fbbf24';
        ctx.fillRect(x, 0, 2, H);
      }
    }
  }, [match, duration]);

  const handleBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    onTimeChange(Math.floor(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration));
  }, [duration, onTimeChange]);

  return (
    <div className="bg-gray-950 border-t border-gray-800 px-4 py-3 flex flex-col gap-2 flex-shrink-0">
      {/* Timeline bar */}
      <div ref={barRef} onClick={handleBarClick}
        className="relative h-6 bg-gray-800 rounded cursor-pointer overflow-hidden">

        {/* Progress fill */}
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-700 to-blue-500 opacity-80 rounded"
          style={{ width: `${progress * 100}%` }} />

        {/* Event marks — single canvas, drawn once per match */}
        <canvas ref={marksRef} width={800} height={24}
          className="absolute inset-0 w-full h-full opacity-70 pointer-events-none" />

        {/* Playhead */}
        <div className="absolute top-0 w-0.5 h-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          style={{ left: `${progress * 100}%` }} />

        {/* Time labels */}
        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
          <span className="text-[10px] text-gray-500 font-mono">0:00</span>
          <span className="text-[10px] text-gray-300 font-mono font-semibold">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-gray-500 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button onClick={onPlayPause}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 transition-colors text-white">
          {playing ? (
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
              <path d="M4 2.5l10 5.5-10 5.5z" />
            </svg>
          )}
        </button>

        <div className="flex gap-1">
          {SPEEDS.map(s => (
            <button key={s} onClick={() => onSpeedChange(s)}
              className={`text-xs px-2 py-0.5 rounded border transition-all font-mono ${speed === s
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>{s}×</button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Kill</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Death</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Loot</span>
        </div>
      </div>
    </div>
  );
});

export default EventTimeline;
