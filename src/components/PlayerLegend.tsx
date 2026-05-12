'use client';

import { PlayerTrack } from '@/lib/types';
import { playerColor, botColor } from '@/lib/colorHash';

interface Props {
  players: PlayerTrack[];
  showBots: boolean;
  highlightedUid: string | null;
  onHighlight: (uid: string | null) => void;
  onToggleBots: () => void;
}

function statCounts(p: PlayerTrack) {
  let kills = 0, deaths = 0, loot = 0, positions = 0;
  for (const e of p.events) {
    if (e.e === 'Kill' || e.e === 'BotKill') kills++;
    else if (e.e === 'Killed' || e.e === 'BotKilled' || e.e === 'KilledByStorm') deaths++;
    else if (e.e === 'Loot') loot++;
    else if (e.e === 'Position' || e.e === 'BotPosition') positions++;
  }
  return { kills, deaths, loot, positions };
}

export default function PlayerLegend({ players, showBots, highlightedUid, onHighlight, onToggleBots }: Props) {
  const humans = players.filter(p => p.human);
  const bots = players.filter(p => !p.human);

  return (
    <div className="w-56 flex-shrink-0 flex flex-col bg-gray-950 border-l border-gray-800 h-full overflow-hidden">
      <div className="px-3 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Players</h3>
          {highlightedUid && (
            <button
              onClick={() => onHighlight(null)}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Humans */}
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Humans · {humans.length}</span>
        </div>
        {humans.map(p => {
          const stats = statCounts(p);
          const isHighlighted = highlightedUid === null || highlightedUid === p.uid;
          const color = playerColor(p.hue, 1);
          return (
            <button
              key={p.uid}
              onClick={() => onHighlight(highlightedUid === p.uid ? null : p.uid)}
              className={`w-full text-left px-3 py-2 flex items-start gap-2 border-b border-gray-800/30 transition-all ${highlightedUid === p.uid ? 'bg-gray-800/60' : 'hover:bg-gray-900/40'
                } ${!isHighlighted ? 'opacity-40' : ''}`}
            >
              {/* Color swatch */}
              <div
                className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ring-1 ring-white/20"
                style={{ background: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] text-gray-300 truncate">{p.uid.slice(0, 13)}…</div>
                <div className="flex gap-2 mt-0.5 text-[10px]">
                  {stats.kills > 0 && <span className="text-red-400">⚔ {stats.kills}</span>}
                  {stats.deaths > 0 && <span className="text-gray-500">✝ {stats.deaths}</span>}
                  {stats.loot > 0 && <span className="text-yellow-500">◆ {stats.loot}</span>}
                </div>
              </div>
            </button>
          );
        })}

        {/* Bots toggle */}
        {bots.length > 0 && (
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">Bots · {bots.length}</span>
            <button
              onClick={onToggleBots}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${showBots
                  ? 'bg-gray-700 border-gray-600 text-gray-300'
                  : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
            >
              {showBots ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
        {showBots && bots.map(p => {
          const stats = statCounts(p);
          return (
            <button
              key={p.uid}
              onClick={() => onHighlight(highlightedUid === p.uid ? null : p.uid)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 border-b border-gray-800/20 transition-all hover:bg-gray-900/30 ${highlightedUid && highlightedUid !== p.uid ? 'opacity-30' : ''
                }`}
            >
              <div className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
              <div className="font-mono text-[10px] text-gray-500">Bot {p.uid}</div>
              {stats.kills > 0 && <span className="ml-auto text-[10px] text-red-400/70">⚔ {stats.kills}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
