

export interface MatchSummary {
  match_id: string;
  map_id: string;
  date: string;
  human_count: number;
  bot_count: number;
  duration_ms: number;
  kill_count: number;
  loot_count: number;
}

export interface EventPoint {
  t: number;   // ms from match start
  px: number;  // pixel x on 1024x1024 minimap
  py: number;  // pixel y on 1024x1024 minimap
  e: string;   // event type
}

export interface PlayerTrack {
  uid: string;
  human: boolean;
  hue: number;          // -1 for bots
  events: EventPoint[]; // all events, sorted by t
  posEvents: EventPoint[];    // Position / BotPosition only
  nonPosEvents: EventPoint[]; // everything else (kills, loot, deaths)
}

export interface MatchData {
  match_id: string;
  map_id: string;
  duration_ms: number;
  players: PlayerTrack[];
}

export interface HeatPoint {
  px: number;
  py: number;
}

export interface HeatmapData {
  kill: HeatPoint[];
  death: HeatPoint[];
  loot: HeatPoint[];
  traffic: HeatPoint[];
}

export type HeatmapLayer = keyof HeatmapData;

export type ViewMode = 'journey' | 'heatmap';
