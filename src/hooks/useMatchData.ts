
import { useState, useEffect } from 'react';
import { MatchSummary, MatchData, HeatmapData } from '@/lib/types';

export function useMatchIndex() {
  const [index, setIndex] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/match_index.json')
      .then(r => r.json())
      .then((data: MatchSummary[]) => { setIndex(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return { index, loading, error };
}

const POSITION_EVENTS = new Set(['Position', 'BotPosition']);

function enrichMatchData(d: MatchData): MatchData {
  return {
    ...d,
    players: d.players.map(p => ({
      ...p,
      posEvents: p.events.filter(e => POSITION_EVENTS.has(e.e)),
      nonPosEvents: p.events.filter(e => !POSITION_EVENTS.has(e.e)),
    })),
  };
}

export function useMatchData(matchId: string | null) {
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    setData(null);
    fetch(`/data/matches/${matchId}.json`)
      .then(r => r.json())
      .then((d: MatchData) => { setData(enrichMatchData(d)); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [matchId]);

  return { data, loading, error };
}

export function useHeatmapData(mapId: string | null) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapId) return;
    setLoading(true);
    setData(null);
    fetch(`/data/heatmaps/${mapId}.json`)
      .then(r => r.json())
      .then((d: HeatmapData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mapId]);

  return { data, loading };
}
