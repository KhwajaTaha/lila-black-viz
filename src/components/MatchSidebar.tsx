'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { MatchSummary } from '@/lib/types';

const ITEM_H = 72;  // px — must match card height in JSX
const OVERSCAN = 4;  // extra items above/below the visible window

const DAYS = ['February_10', 'February_11', 'February_12', 'February_13', 'February_14'];
const DAY_LABELS: Record<string, string> = {
  February_10: 'Feb 10', February_11: 'Feb 11', February_12: 'Feb 12',
  February_13: 'Feb 13', February_14: 'Feb 14',
};
const MAP_BADGE: Record<string, string> = {
  AmbroseValley: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
  GrandRift: 'bg-amber-900/60 text-amber-300 border-amber-700/50',
  Lockdown: 'bg-violet-900/60 text-violet-300 border-violet-700/50',
};

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  index: MatchSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string, mapId: string) => void;
}

export default function MatchSidebar({ index, loading, selectedId, onSelect }: Props) {
  const [activeDay, setActiveDay] = useState('all');
  const [activeMap, setActiveMap] = useState('All');
  const [onlyKills, setOnlyKills] = useState(false);

  // Virtual scroll
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [listH, setListH] = useState(500);

  const filtered = useMemo(() =>
    index.filter(m => {
      if (activeDay !== 'all' && m.date !== activeDay) return false;
      if (activeMap !== 'All' && m.map_id !== activeMap) return false;
      if (onlyKills && m.kill_count === 0) return false;
      return true;
    }),
    [index, activeDay, activeMap, onlyKills]
  );

  // Measure container height once on mount
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    if (node) setListH(node.clientHeight || 500);
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible slice
  const visStart = Math.max(0, Math.floor(scrollTop / ITEM_H) - OVERSCAN);
  const visEnd = Math.min(filtered.length, visStart + Math.ceil(listH / ITEM_H) + OVERSCAN * 2);
  const visItems = filtered.slice(visStart, visEnd);

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col bg-gray-950 border-r border-gray-800 h-full overflow-hidden">

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Matches</h2>
          <span className="ml-auto text-xs text-gray-600 font-mono">{filtered.length}</span>
        </div>

        {/* Map filter */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {['All', 'AmbroseValley', 'GrandRift', 'Lockdown'].map(m => (
            <button key={m} onClick={() => setActiveMap(m)}
              className={`text-xs px-2 py-1 rounded border transition-all ${activeMap === m
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>
              {m === 'All' ? 'All Maps' : m === 'AmbroseValley' ? 'Ambrose' : m}
            </button>
          ))}
        </div>

        {/* Kills toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div onClick={() => setOnlyKills(v => !v)}
            className={`w-8 h-4 rounded-full transition-colors relative ${onlyKills ? 'bg-red-600' : 'bg-gray-700'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${onlyKills ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-gray-400">Has kills only</span>
        </label>
      </div>

      {/* Day tabs */}
      <div className="flex border-b border-gray-800 overflow-x-auto flex-shrink-0">
        <button onClick={() => setActiveDay('all')}
          className={`text-xs px-3 py-2 whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${activeDay === 'all' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>All</button>
        {DAYS.map(d => (
          <button key={d} onClick={() => setActiveDay(d)}
            className={`text-xs px-3 py-2 whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${activeDay === d ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>{DAY_LABELS[d]}</button>
        ))}
      </div>

      {/* Virtualised list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={onScroll}>
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-16">No matches</div>
        )}
        {!loading && filtered.length > 0 && (
          <div style={{ height: filtered.length * ITEM_H, position: 'relative' }}>
            {visItems.map((match, idx) => {
              const top = (visStart + idx) * ITEM_H;
              return (
                <button
                  key={`${match.match_id}-${match.date}`}
                  onClick={() => onSelect(match.match_id, match.map_id)}
                  style={{ position: 'absolute', top, left: 0, right: 0, height: ITEM_H }}
                  className={`text-left px-4 py-3 border-b border-gray-800/50 transition-all ${selectedId === match.match_id
                      ? 'bg-blue-950/60 border-l-2 border-l-blue-500'
                      : 'hover:bg-gray-900/50'
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${MAP_BADGE[match.map_id] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {match.map_id === 'AmbroseValley' ? 'AMBROSE' : match.map_id === 'GrandRift' ? 'RIFT' : 'LOCK'}
                    </span>
                    <span className="font-mono text-[10px] text-gray-500 truncate">{match.match_id.slice(0, 18)}…</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-gray-400">
                      <span className="text-blue-400 font-semibold">{match.human_count}</span>
                      <span className="text-gray-600"> + {match.bot_count}B</span>
                    </span>
                    {match.kill_count > 0 && <span className="text-red-400">⚔ {match.kill_count}</span>}
                    {match.loot_count > 0 && <span className="text-yellow-500">◆ {match.loot_count}</span>}
                    <span className="ml-auto text-gray-600 font-mono text-[10px]">{fmt(match.duration_ms)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
