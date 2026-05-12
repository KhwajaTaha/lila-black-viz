'use client';
// src/app/page.tsx

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { useMatchIndex, useMatchData, useHeatmapData } from '@/hooks/useMatchData';
import MatchSidebar from '@/components/MatchSidebar';
import PlayerLegend from '@/components/PlayerLegend';
import EventTimeline from '@/components/EventTimeline';
import { MatchData, HeatmapLayer, ViewMode } from '@/lib/types';
import type { MapCanvasHandle } from '@/components/MapCanvas';

const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });

const HEATMAP_LAYERS: { key: HeatmapLayer; label: string; color: string }[] = [
  { key: 'kill',    label: 'Kills',   color: 'text-red-400 border-red-500 bg-red-950/40' },
  { key: 'death',   label: 'Deaths',  color: 'text-purple-400 border-purple-500 bg-purple-950/40' },
  { key: 'loot',    label: 'Loot',    color: 'text-yellow-400 border-yellow-500 bg-yellow-950/40' },
  { key: 'traffic', label: 'Traffic', color: 'text-blue-400 border-blue-500 bg-blue-950/40' },
];

// ── UI refresh rate for timeline scrubber (ms between state updates)
const UI_THROTTLE_MS = 66; // ~15fps for React UI — canvas always runs at 60fps

export default function Home() {
  const { index, loading: indexLoading } = useMatchIndex();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMapId, setSelectedMapId]     = useState<string | null>(null);
  const [viewMode, setViewMode]               = useState<ViewMode>('journey');
  const [heatmapLayer, setHeatmapLayer]       = useState<HeatmapLayer>('kill');
  const [highlightedUid, setHighlightedUid]   = useState<string | null>(null);
  const [showBots, setShowBots]               = useState(false);

  // Playback — time lives in a ref (canvas reads it); state only for UI at 15fps
  const [playing, setPlaying]           = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);   // UI only (timeline)
  const [speed, setSpeed]               = useState(10);

  const canvasRef     = useRef<MapCanvasHandle>(null);
  const playTimeRef   = useRef(0);          // source of truth, no re-renders
  const animFrameRef  = useRef<number | null>(null);
  const lastRafRef    = useRef<number | null>(null);
  const lastUiUpdate  = useRef(0);
  const durationRef   = useRef(0);
  const speedRef      = useRef(speed);
  speedRef.current    = speed;

  const { data: matchData, loading: matchLoading } = useMatchData(selectedMatchId);
  const { data: heatmapData, loading: heatmapLoading } = useHeatmapData(
    viewMode === 'heatmap' ? selectedMapId : null
  );

  // Keep durationRef in sync
  useEffect(() => { durationRef.current = matchData?.duration_ms ?? 0; }, [matchData]);

  // ── Animation loop ────────────────────────────────────────────────────────
  // Runs entirely via refs — zero React state updates at 60fps
  const startLoop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const tick = (now: number) => {
      const last  = lastRafRef.current ?? now;
      const delta = (now - last) * speedRef.current;
      lastRafRef.current = now;

      const next = Math.min(playTimeRef.current + delta, durationRef.current);
      playTimeRef.current = next;

      // Push time to canvas directly (no React re-render)
      canvasRef.current?.setTime(next);

      // Update React UI at throttled rate (for timeline scrubber)
      if (now - lastUiUpdate.current >= UI_THROTTLE_MS) {
        lastUiUpdate.current = now;
        setPlaybackTime(next);
      }

      if (next >= durationRef.current) {
        setPlaying(false);
        setPlaybackTime(next);
        return; // stop loop
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    lastRafRef.current = null;
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopLoop = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    lastRafRef.current = null;
  }, []);

  useEffect(() => {
    if (playing) startLoop();
    else stopLoop();
    return stopLoop;
  }, [playing, startLoop, stopLoop]);

  // Reset on match change
  useEffect(() => {
    stopLoop();
    setPlaying(false);
    playTimeRef.current = 0;
    setPlaybackTime(0);
    setHighlightedUid(null);
    canvasRef.current?.setTime(0);
  }, [selectedMatchId, stopLoop]);

  const handleSelectMatch = useCallback((id: string, mapId: string) => {
    setSelectedMatchId(id);
    setSelectedMapId(mapId);
    setViewMode('journey');
  }, []);

  // Manual scrub from timeline
  const handleTimeChange = useCallback((t: number) => {
    playTimeRef.current = t;
    setPlaybackTime(t);
    canvasRef.current?.setTime(t);
  }, []);

  const handlePlayPause = useCallback(() => {
    setPlaying(prev => {
      if (!prev && playTimeRef.current >= durationRef.current) {
        playTimeRef.current = 0;
        setPlaybackTime(0);
        canvasRef.current?.setTime(0);
      }
      return !prev;
    });
  }, []);

  const noMatchSelected = !selectedMatchId || !matchData;

  // Compute canvas size once on mount (and on resize) — avoid raw window access every render
  const [canvasSize, setCanvasSize] = useState(() =>
    typeof window !== 'undefined'
      ? Math.min(Math.min(window.innerWidth - 72 - 256 - 224 - 32, window.innerHeight - 160), 700)
      : 600
  );
  useEffect(() => {
    const onResize = () => setCanvasSize(
      Math.min(Math.min(window.innerWidth - 72 - 256 - 224 - 32, window.innerHeight - 160), 700)
    );
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      {/* Sidebar — memoised, never re-renders during playback */}
      <MatchSidebar
        index={index}
        loading={indexLoading}
        selectedId={selectedMatchId}
        onSelect={handleSelectMatch}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          matchData={matchData}
          matchLoading={matchLoading}
          viewMode={viewMode}
          heatmapLayer={heatmapLayer}
          onSetViewMode={mode => { setViewMode(mode); if (mode === 'heatmap') setPlaying(false); }}
          onSetHeatmapLayer={setHeatmapLayer}
        />

        {/* Canvas + Legend */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-900/30 overflow-hidden">
            {matchLoading && (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading match data…</span>
              </div>
            )}
            {!matchLoading && noMatchSelected && <EmptyState totalMatches={index.length} />}
            {!matchLoading && matchData && (
              <div className="w-full h-full flex items-center justify-center p-4">
                {viewMode === 'journey' && (
                  <MapCanvas
                    ref={canvasRef}
                    mode="journey"
                    match={matchData}
                    showBots={showBots}
                    highlightedUid={highlightedUid}
                    canvasSize={canvasSize}
                  />
                )}
                {viewMode === 'heatmap' && (
                  heatmapLoading
                    ? <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    : heatmapData
                    ? <MapCanvas
                        mode="heatmap"
                        mapId={matchData.map_id}
                        heatmap={heatmapData}
                        layer={heatmapLayer}
                        canvasSize={canvasSize}
                      />
                    : <span className="text-gray-600 text-sm">No heatmap data</span>
                )}
              </div>
            )}
          </div>

          {matchData && viewMode === 'journey' && (
            <PlayerLegend
              players={matchData.players}
              showBots={showBots}
              highlightedUid={highlightedUid}
              onHighlight={setHighlightedUid}
              onToggleBots={() => setShowBots(v => !v)}
            />
          )}
        </div>

        {/* Timeline — only re-renders at 15fps during playback */}
        {matchData && viewMode === 'journey' && (
          <EventTimeline
            match={matchData}
            currentTime={playbackTime}
            playing={playing}
            speed={speed}
            onTimeChange={handleTimeChange}
            onPlayPause={handlePlayPause}
            onSpeedChange={setSpeed}
          />
        )}
      </main>
    </div>
  );
}

// ── Memoised header — never re-renders during playback ─────────────────────────
const Header = memo(function Header({ matchData, matchLoading, viewMode, heatmapLayer, onSetViewMode, onSetHeatmapLayer }: {
  matchData: MatchData | null;
  matchLoading: boolean;
  viewMode: ViewMode;
  heatmapLayer: HeatmapLayer;
  onSetViewMode: (m: ViewMode) => void;
  onSetHeatmapLayer: (l: HeatmapLayer) => void;
}) {
  return (
    <header className="flex items-center gap-4 px-5 py-3 border-b border-gray-800 bg-gray-950 flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-black">L</div>
        <span className="text-sm font-semibold tracking-wide">LILA BLACK</span>
        <span className="text-gray-600 text-sm">· Journey Viz</span>
      </div>

      {matchData && (
        <>
          <div className="h-4 w-px bg-gray-800" />
          <div className="flex gap-1 bg-gray-900 rounded-md p-0.5">
            <button
              onClick={() => onSetViewMode('journey')}
              className={`text-xs px-3 py-1.5 rounded transition-all ${viewMode === 'journey' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >Journey</button>
            <button
              onClick={() => onSetViewMode('heatmap')}
              className={`text-xs px-3 py-1.5 rounded transition-all ${viewMode === 'heatmap' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >Heatmap</button>
          </div>

          {viewMode === 'heatmap' && (
            <div className="flex gap-1">
              {HEATMAP_LAYERS.map(l => (
                <button key={l.key} onClick={() => onSetHeatmapLayer(l.key)}
                  className={`text-xs px-2.5 py-1 rounded border transition-all ${
                    heatmapLayer === l.key ? l.color : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                  }`}>{l.label}</button>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span className="text-gray-400 font-medium">{matchData.map_id}</span>
            <span>{matchData.players.filter(p => p.human).length} humans</span>
            <span>{matchData.players.filter(p => !p.human).length} bots</span>
            <span className="font-mono text-gray-600">{matchData.match_id.slice(0, 8)}…</span>
          </div>
        </>
      )}

      {!matchData && !matchLoading && (
        <span className="ml-4 text-gray-600 text-sm">← Select a match to get started</span>
      )}
    </header>
  );
});

function EmptyState({ totalMatches }: { totalMatches: number }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-sm">
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-blue-800/30 animate-pulse" />
        <div className="absolute inset-4 rounded-lg bg-gradient-to-br from-blue-800/20 to-purple-800/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 64 64" className="w-16 h-16 text-blue-400/60">
            <circle cx="20" cy="20" r="3" fill="currentColor" opacity="0.8" />
            <circle cx="44" cy="16" r="2" fill="currentColor" opacity="0.5" />
            <circle cx="32" cy="40" r="4" fill="currentColor" opacity="0.6" />
            <circle cx="48" cy="44" r="2" fill="currentColor" opacity="0.4" />
            <path d="M20 20 Q30 28 32 40" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
            <path d="M44 16 Q40 28 32 40" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
            <path d="M32 40 Q40 42 48 44" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
          </svg>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Select a Match</h2>
        <p className="text-sm text-gray-500">
          {totalMatches > 0
            ? `${totalMatches} matches across 5 days of gameplay. Pick one from the sidebar to visualize player journeys and heatmaps.`
            : 'Loading match data…'}
        </p>
      </div>
      <div className="flex gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Humans</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-600" /> Bots</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Kills</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Loot</div>
      </div>
    </div>
  );
}
