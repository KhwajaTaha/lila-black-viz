'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { MatchData, HeatmapData, HeatmapLayer, EventPoint } from '@/lib/types';
import { playerColor, botColor, eventColor } from '@/lib/colorHash';

const MINIMAP_SIZE = 1024;
const TRAIL_LENGTH = 40;


export interface MapCanvasHandle {
  setTime: (t: number) => void;
}

interface JourneyProps {
  mode: 'journey';
  match: MatchData;
  showBots: boolean;
  highlightedUid: string | null;
}

interface HeatmapProps {
  mode: 'heatmap';
  mapId: string;
  heatmap: HeatmapData;
  layer: HeatmapLayer;
}

type Props = (JourneyProps | HeatmapProps) & { canvasSize: number };

function getMinimapSrc(mapId: string): string {
  if (mapId === 'Lockdown') return '/minimaps/Lockdown_Minimap.jpg';
  if (mapId === 'GrandRift') return '/minimaps/GrandRift_Minimap.png';
  return '/minimaps/AmbroseValley_Minimap.png';
}

const HEAT_COLORS: Record<HeatmapLayer, [number, number, number]> = {
  kill: [255, 60, 60],
  death: [160, 80, 255],
  loot: [255, 200, 0],
  traffic: [0, 160, 255],
};


function bisectRight(events: EventPoint[], time: number): number {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].t <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

// ── Heatmap offscreen cache (module-level, shared across renders) ─────────────
const heatmapCache = { canvas: null as HTMLCanvasElement | null, key: '' };

// ── Component ─────────────────────────────────────────────────────────────────
const MapCanvasInner = forwardRef<MapCanvasHandle, Props>(function MapCanvas(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const bgCacheRef = useRef<HTMLCanvasElement | null>(null);
  const bgLoadedRef = useRef(false);
  const timeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // ── draw & scheduleDraw as stable useCallback refs so closures never go stale
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const p = propsRef.current;
    const size = p.canvasSize;
    const scale = size / MINIMAP_SIZE;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(0, 0, size, size);

    if (bgLoadedRef.current) {
      const alpha = p.mode === 'heatmap' ? 0.35 : 0.55;
      ctx.globalAlpha = alpha;
      if (bgCacheRef.current) {
        ctx.drawImage(bgCacheRef.current, 0, 0);
      } else if (bgImgRef.current) {
        ctx.drawImage(bgImgRef.current, 0, 0, size, size);
      }
      ctx.globalAlpha = 1;
    }

    if (p.mode === 'heatmap') {
      drawHeatmap(ctx, p.heatmap, p.layer, size, scale);
    } else {
      drawJourney(ctx, p.match, timeRef.current, p.showBots, p.highlightedUid, size, scale);
    }
  }, []); // stable — reads everything via refs

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return; // already queued
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // Expose setTime() to parent — zero React state updates during playback
  useImperativeHandle(ref, () => ({
    setTime: (t: number) => {
      timeRef.current = t;
      scheduleDraw();
    },
  }), [scheduleDraw]);

  const mapId = props.mode === 'journey' ? props.match.map_id : props.mapId;

  // Load minimap image once per map
  useEffect(() => {
    bgLoadedRef.current = false;
    bgImgRef.current = null;
    bgCacheRef.current = null;

    const img = new Image();
    img.src = getMinimapSrc(mapId);

    img.onload = () => {
      bgImgRef.current = img;
      bgLoadedRef.current = true;

      // Bake into offscreen canvas at current size for fast blitting
      const size = propsRef.current.canvasSize;
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const octx = off.getContext('2d')!;
      octx.drawImage(img, 0, 0, size, size);
      bgCacheRef.current = off;

      scheduleDraw();
    };

    img.onerror = () => {
      // Still draw (dark background + data) even if minimap image fails
      bgLoadedRef.current = false;
      scheduleDraw();
    };
  }, [mapId, scheduleDraw]);

  // Redraw when meaningful props change
  const propKey = props.mode === 'journey'
    ? `${(props as JourneyProps).match?.match_id}-${(props as JourneyProps).showBots}-${(props as JourneyProps).highlightedUid}`
    : `${(props as HeatmapProps).mapId}-${(props as HeatmapProps).layer}`;

  useEffect(() => {
    scheduleDraw();
  }, [propKey, scheduleDraw]);

  // Draw once after canvas mounts (handles initial render where propKey effect
  // fires before canvasRef is attached)
  useEffect(() => {
    scheduleDraw();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scheduleDraw]);

  return (
    <canvas
      ref={canvasRef}
      width={props.canvasSize}
      height={props.canvasSize}
      className="rounded-lg block"
    />
  );
});

// Memo wrapper — prevents re-render when parent updates playbackTime state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapCanvas = React.memo(MapCanvasInner) as any as typeof MapCanvasInner;

export default MapCanvas;


function drawJourney(
  ctx: CanvasRenderingContext2D,
  match: MatchData,
  playbackTime: number,
  showBots: boolean,
  highlightedUid: string | null,
  size: number,
  scale: number,
) {
  const players = match.players.filter(p => showBots || p.human);

  for (const player of players) {
    const isHighlighted = highlightedUid === null || highlightedUid === player.uid;
    const alpha = isHighlighted ? 1 : 0.2;

    const allPos = player.posEvents;
    const allNonPos = player.nonPosEvents;

    if (!allPos || !allNonPos) continue; // guard against un-enriched data

    const posEnd = bisectRight(allPos, playbackTime);
    const nonPosEnd = bisectRight(allNonPos, playbackTime);

    // Draw trail — batch into opacity buckets
    if (posEnd >= 1) {
      const trailStart = Math.max(0, posEnd - TRAIL_LENGTH + 1);
      const trailLen = posEnd - trailStart + 1;
      const BUCKETS = 4;
      const lineW = player.human ? 2 : 1;

      for (let b = 0; b < BUCKETS; b++) {
        const bStart = trailStart + Math.floor((b / BUCKETS) * trailLen);
        const bEnd = trailStart + Math.floor(((b + 1) / BUCKETS) * trailLen);
        if (bEnd <= bStart) continue;

        const fadeFactor = ((b + 0.5) / BUCKETS) * alpha * 0.85;
        ctx.beginPath();
        ctx.lineWidth = lineW;
        ctx.strokeStyle = player.human ? playerColor(player.hue, fadeFactor) : botColor(fadeFactor);

        for (let i = bStart + 1; i <= bEnd && i <= posEnd; i++) {
          ctx.moveTo(allPos[i - 1].px * scale, allPos[i - 1].py * scale);
          ctx.lineTo(allPos[i].px * scale, allPos[i].py * scale);
        }
        ctx.stroke();
      }
    }

    // Current position dot
    if (posEnd >= 0) {
      const last = allPos[posEnd];
      const x = last.px * scale;
      const y = last.py * scale;
      ctx.beginPath();
      ctx.arc(x, y, player.human ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = player.human ? playerColor(player.hue, alpha) : botColor(alpha);
      ctx.fill();
      if (player.human && isHighlighted) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Event markers — single save/restore for the whole batch
    if (nonPosEnd >= 0) {
      ctx.save();
      for (let i = 0; i <= nonPosEnd; i++) {
        drawEventMarker(ctx, allNonPos[i], scale, alpha);
      }
      ctx.restore();
    }
  }
}

function drawEventMarker(ctx: CanvasRenderingContext2D, ev: EventPoint, scale: number, alpha: number) {
  const x = ev.px * scale;
  const y = ev.py * scale;
  const color = eventColor(ev.e);

  ctx.globalAlpha = alpha;

  if (ev.e === 'Kill' || ev.e === 'BotKill') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
    ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5);
    ctx.stroke();
  } else if (ev.e === 'Killed' || ev.e === 'BotKilled' || ev.e === 'KilledByStorm') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
  } else if (ev.e === 'Loot') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 4, y);
    ctx.closePath();
    ctx.fill();
  }
}

// ── Heatmap renderer ──────────────────────────────────────────────────────────
function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  heatmap: HeatmapData,
  layer: HeatmapLayer,
  size: number,
  scale: number,
) {
  const points = heatmap[layer];
  if (!points?.length) return;

  const cacheKey = `${layer}-${size}-${points.length}`;
  if (heatmapCache.key !== cacheKey || !heatmapCache.canvas) {
    heatmapCache.key = cacheKey;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d')!;

    const [r, g, b] = HEAT_COLORS[layer];
    const radius = Math.max(18, 28 * scale);

    octx.globalCompositeOperation = 'screen';
    for (const pt of points) {
      const x = pt.px * scale;
      const y = pt.py * scale;
      const grad = octx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},0.08)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      octx.beginPath();
      octx.arc(x, y, radius, 0, Math.PI * 2);
      octx.fillStyle = grad;
      octx.fill();
    }
    octx.globalCompositeOperation = 'source-over';
    heatmapCache.canvas = off;
  }

  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(heatmapCache.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
