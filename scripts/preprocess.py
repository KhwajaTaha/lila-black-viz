#!/usr/bin/env python3
"""
LILA BLACK — Data Preprocessing Pipeline
Run once locally to convert .nakama-0 parquet files into static JSON
that the Next.js frontend can consume.

Usage:
  python3 scripts/preprocess.py --data /Users/taha/Downloads/player_data

Output:
  public/data/match_index.json
  public/data/matches/{match_id}.json  (one per match)
  public/data/heatmaps/{MapId}.json    (one per map)
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

import pyarrow.parquet as pq
import pandas as pd

# ── Map configuration ──────────────────────────────────────────────────────────
MAP_CONFIG = {
    "AmbroseValley": {"scale": 900,  "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581,  "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE
)

DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]

# ── Coordinate helpers ─────────────────────────────────────────────────────────
def world_to_pixel(x: float, z: float, map_id: str) -> tuple[int, int]:
    cfg = MAP_CONFIG.get(map_id, MAP_CONFIG["AmbroseValley"])
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    px = int(u * 1024)
    py = int((1 - v) * 1024)
    return px, py

def is_human(uid: str) -> bool:
    return bool(UUID_RE.match(uid))

def color_hue(uid: str) -> int:
    """Deterministic HSL hue from uid string (djb2 hash)."""
    h = 5381
    for c in uid:
        h = ((h << 5) + h) + ord(c)
        h &= 0xFFFFFFFF
    return h % 360

# ── Load all parquet files ─────────────────────────────────────────────────────
def load_all_files(data_root: Path) -> pd.DataFrame:
    frames = []
    total = 0
    for day in DAYS:
        day_dir = data_root / day
        if not day_dir.exists():
            print(f"  ⚠️  Missing day folder: {day}", file=sys.stderr)
            continue
        files = list(day_dir.iterdir())
        print(f"  📂 {day}: {len(files)} files")
        for fpath in files:
            if fpath.name.startswith('.'):
                continue
            try:
                table = pq.read_table(str(fpath))
                df = table.to_pandas()
                df['_day'] = day
                frames.append(df)
                total += 1
            except Exception as e:
                print(f"    ⚠️  Could not read {fpath.name}: {e}", file=sys.stderr)

    print(f"\n✅ Loaded {total} files")
    if not frames:
        sys.exit("❌ No data loaded. Check --data path.")

    df = pd.concat(frames, ignore_index=True)
    # Decode event bytes → str
    df['event'] = df['event'].apply(lambda x: x.decode('utf-8') if isinstance(x, bytes) else str(x))
    # Strip .nakama-0 suffix from match_id for clean IDs
    df['match_id_clean'] = df['match_id'].str.replace(r'\.nakama-0$', '', regex=True)
    return df

# ── Build match index ──────────────────────────────────────────────────────────
def build_match_index(df: pd.DataFrame) -> list[dict]:
    matches = []
    for (match_id_clean, _day), group in df.groupby(['match_id_clean', '_day']):
        map_id = group['map_id'].iloc[0]
        human_uids = group[group['user_id'].apply(is_human)]['user_id'].unique()
        bot_uids   = group[~group['user_id'].apply(is_human)]['user_id'].unique()

        # Duration: max ts - min ts in ms
        ts_vals = group['ts'].astype('int64')
        duration_ms = int((ts_vals.max() - ts_vals.min()) / 1_000_000)  # ns → ms

        combat_events = {'Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm'}
        kill_count = int(group[group['event'].isin({'Kill', 'BotKill'})].shape[0])
        loot_count = int(group[group['event'] == 'Loot'].shape[0])

        matches.append({
            "match_id":    match_id_clean,
            "map_id":      map_id,
            "date":        _day,
            "human_count": int(len(human_uids)),
            "bot_count":   int(len(bot_uids)),
            "duration_ms": duration_ms,
            "kill_count":  kill_count,
            "loot_count":  loot_count,
        })

    # Sort by date desc
    day_order = {d: i for i, d in enumerate(DAYS)}
    matches.sort(key=lambda m: day_order.get(m['date'], 99))
    return matches

# ── Build per-match JSON ───────────────────────────────────────────────────────
def build_match_file(match_id_clean: str, group: pd.DataFrame) -> dict:
    map_id = group['map_id'].iloc[0]

    # Compute relative timestamps (ms from match start)
    ts_ns = group['ts'].astype('int64')
    min_ts = ts_ns.min()

    players = []
    for uid, player_group in group.groupby('user_id'):
        human = is_human(str(uid))
        hue = color_hue(str(uid)) if human else -1

        player_group = player_group.copy()
        player_group['t_rel'] = ((player_group['ts'].astype('int64') - min_ts) / 1_000_000).astype(int)
        player_group = player_group.sort_values('t_rel')

        events = []
        for _, row in player_group.iterrows():
            px, py = world_to_pixel(row['x'], row['z'], map_id)
            events.append({
                "t":  int(row['t_rel']),
                "px": px,
                "py": py,
                "e":  row['event'],  # short key to save space
            })

        players.append({
            "uid":      str(uid),
            "human":    human,
            "hue":      hue,
            "events":   events,
        })

    duration_ms = int((ts_ns.max() - min_ts) / 1_000_000)

    return {
        "match_id":    match_id_clean,
        "map_id":      map_id,
        "duration_ms": duration_ms,
        "players":     players,
    }

# ── Build heatmaps ─────────────────────────────────────────────────────────────
def build_heatmaps(df: pd.DataFrame) -> dict[str, dict]:
    """Returns {map_id: {kill: [...], death: [...], loot: [...], traffic: [...]}}"""
    heatmaps = {}

    for map_id, map_group in df.groupby('map_id'):
        kill_pts, death_pts, loot_pts, traffic_pts = [], [], [], []

        kill_events   = {'Kill', 'BotKill'}
        death_events  = {'Killed', 'BotKilled', 'KilledByStorm'}

        for _, row in map_group.iterrows():
            px, py = world_to_pixel(row['x'], row['z'], map_id)
            ev = row['event']

            if ev in kill_events:
                kill_pts.append({"px": px, "py": py})
            elif ev in death_events:
                death_pts.append({"px": px, "py": py})
            elif ev == 'Loot':
                loot_pts.append({"px": px, "py": py})
            elif ev in ('Position', 'BotPosition'):
                traffic_pts.append({"px": px, "py": py})

        # Subsample traffic to keep JSON small (max 5000 points per map)
        if len(traffic_pts) > 5000:
            step = len(traffic_pts) // 5000
            traffic_pts = traffic_pts[::step]

        heatmaps[map_id] = {
            "kill":    kill_pts,
            "death":   death_pts,
            "loot":    loot_pts,
            "traffic": traffic_pts,
        }

    return heatmaps

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="LILA BLACK data preprocessor")
    parser.add_argument(
        '--data',
        default='/Users/taha/Downloads/player_data',
        help='Path to the player_data folder'
    )
    parser.add_argument(
        '--out',
        default='public/data',
        help='Output directory (relative to CWD or absolute)'
    )
    args = parser.parse_args()

    data_root = Path(args.data)
    out_dir   = Path(args.out)

    print(f"\n🎮 LILA BLACK Preprocessor")
    print(f"   Data: {data_root}")
    print(f"   Out:  {out_dir}\n")

    # Output dirs
    (out_dir / 'matches').mkdir(parents=True, exist_ok=True)
    (out_dir / 'heatmaps').mkdir(parents=True, exist_ok=True)

    # ── 1. Load all data ───────────────────────────────────────────────────────
    print("📦 Loading parquet files...")
    df = load_all_files(data_root)
    print(f"   Total rows: {len(df):,}")
    print(f"   Unique matches: {df['match_id_clean'].nunique()}")
    print(f"   Unique users: {df['user_id'].nunique()}\n")

    # ── 2. Match index ─────────────────────────────────────────────────────────
    print("📋 Building match index...")
    match_index = build_match_index(df)
    idx_path = out_dir / 'match_index.json'
    with open(idx_path, 'w') as f:
        json.dump(match_index, f, separators=(',', ':'))
    print(f"   ✅ {len(match_index)} matches → {idx_path}")

    # ── 3. Per-match files ─────────────────────────────────────────────────────
    print("\n📁 Building per-match files...")
    matches_dir = out_dir / 'matches'
    count = 0
    for (match_id_clean, _day), group in df.groupby(['match_id_clean', '_day']):
        match_data = build_match_file(match_id_clean, group)
        safe_id = match_id_clean.replace('/', '_')
        out_path = matches_dir / f"{safe_id}.json"
        with open(out_path, 'w') as f:
            json.dump(match_data, f, separators=(',', ':'))
        count += 1
        if count % 100 == 0:
            print(f"   {count}/{len(match_index)}...")

    print(f"   ✅ {count} match files written")

    # ── 4. Heatmaps ────────────────────────────────────────────────────────────
    print("\n🔥 Building heatmaps...")
    heatmaps = build_heatmaps(df)
    for map_id, data in heatmaps.items():
        out_path = out_dir / 'heatmaps' / f"{map_id}.json"
        with open(out_path, 'w') as f:
            json.dump(data, f, separators=(',', ':'))
        print(f"   ✅ {map_id}: kill={len(data['kill'])}, death={len(data['death'])}, loot={len(data['loot'])}, traffic={len(data['traffic'])}")

    print(f"\n🎉 Done! All data written to {out_dir}/")

if __name__ == '__main__':
    main()
