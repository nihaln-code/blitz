"""
data/stats.py - Real player stats using nflreadpy + XGBoost projections
"""
import nflreadpy as nfl
import nfl_data_py as nfl_data
import pandas as pd
import numpy as np
import sys
import os
import re                       # strips dots/spaces for name normalization
import difflib                  # fuzzy player name matching fallback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.model import (
    train, save_models, load_models, models_exist,
    predict, _build_opp_defense_table, _calc_fp
)

print("Loading NFL data...")
# Loads one row per player per game week - every stat column (yards, TDs, targets, etc.)
_weekly = nfl.load_player_stats([2022, 2023, 2024, 2025]).to_pandas()
_weekly["player_display_name"] = _weekly["player_display_name"].str.lower()  # normalize for consistent matching
print(f"Loaded {len(_weekly)} rows of NFL stats.")

_all_player_names: list[str] = []  # populated after load, used by fuzzy resolver

def _norm(s: str) -> str:
    """Strips dots, apostrophes, and spaces so 'J.J. McCarthy' and \"Ka'imi Fairbairn\" normalize consistently."""
    return re.sub(r"[.'\s]+", "", s.lower())

def _resolve_player_name(raw: str) -> str:
    """
    Tries 3 strategies in order to find the right player name:
    1. Exact substring - fastest, handles most cases
    2. Dot-stripped normalization - handles 'J.J. McCarthy' vs 'jj mccarthy'
    3. Difflib fuzzy match - handles typos like 'Ceedee' vs 'CeeDee'
    """
    name = raw.lower().strip()

    if not _weekly[_weekly["player_display_name"].str.contains(name, na=False, regex=False)].empty:
        return name

    norm_input = _norm(name)
    for player_name in _all_player_names:
        if _norm(player_name) == norm_input:
            return player_name

    # cutoff=0.6 means at least 60% of characters must match - prevents false positives
    matches = difflib.get_close_matches(name, _all_player_names, n=1, cutoff=0.6)
    if matches:
        return matches[0]

    return name

# ── Train or load model ────────────────────────────────────────────────────────
if models_exist():
    print("Loading saved ML models...")
    _models = load_models()
    print("ML models loaded.")
else:
    print("No saved model found. Training XGBoost models (this takes ~60 seconds)...")
    _models = train(_weekly)
    save_models(_models)
    print("Training complete.")

# ── Precompute opponent defense table ─────────────────────────────────────────
print("Building opponent defense rankings...")
_opp_defense = _build_opp_defense_table(_weekly)
print("Defense table ready.")

FANTASY_POSITIONS = {"QB", "RB", "WR", "TE", "K"}

# Populate after all data is loaded so the fuzzy resolver has the full name list
# dropna() excludes NaN entries (pandas stores missing strings as float NaN)
# Restricted to fantasy-relevant positions so linemen/defenders/punters never surface.
_all_player_names = (
    _weekly[_weekly["position"].isin(FANTASY_POSITIONS)]["player_display_name"]
    .dropna().unique().tolist()
)

# ── Kicker weekly stats ───────────────────────────────────────────────────────
_KICKER_CACHE = os.path.join(os.path.dirname(__file__), "kicker_cache.pkl")

print("Loading kicker stats...")
try:
    if os.path.exists(_KICKER_CACHE):
        _kicking = pd.read_pickle(_KICKER_CACHE)
        print(f"Kicker stats loaded from cache ({len(_kicking)} player-weeks).")
    else:
        print("Building kicker cache from play-by-play data (one-time, ~2 min)...")
        _pbp = nfl_data.import_pbp_data([2022, 2023, 2024, 2025])
        _kick_plays = _pbp[
            _pbp["play_type"].isin(["field_goal", "extra_point"]) &
            _pbp["kicker_player_name"].notna()
        ][["season", "week", "play_type", "field_goal_result",
           "kick_distance", "extra_point_result",
           "kicker_player_name", "kicker_player_id"]].copy()

        def _play_fp(row):
            if row["play_type"] == "field_goal" and row["field_goal_result"] == "made":
                d = row["kick_distance"] or 0
                return 5 if d >= 50 else (4 if d >= 40 else 3)
            if row["play_type"] == "extra_point" and row["extra_point_result"] == "good":
                return 1
            return 0

        _kick_plays["fp"] = _kick_plays.apply(_play_fp, axis=1)
        _kicking = (
            _kick_plays.groupby(["kicker_player_name", "kicker_player_id", "season", "week"])["fp"]
            .sum().reset_index()
        )

        # Look up full display names via the player database (gsis_id → display_name)
        try:
            _players_db = nfl_data.import_players()
            _id_map = dict(zip(_players_db["gsis_id"], _players_db["display_name"]))
            _kicking["player_display_name"] = (
                _kicking["kicker_player_id"].map(_id_map)
                .fillna(_kicking["kicker_player_name"])
            )
        except Exception:
            _kicking["player_display_name"] = _kicking["kicker_player_name"]

        _kicking = _kicking.drop(columns=["kicker_player_name", "kicker_player_id"])
        _kicking["_name_lower"] = _kicking["player_display_name"].str.lower()
        _kicking.to_pickle(_KICKER_CACHE)
        print(f"Kicker cache built ({len(_kicking)} player-weeks).")

    _kicker_names = _kicking["_name_lower"].dropna().unique().tolist()
    _all_player_names.extend([n for n in _kicker_names if n not in _all_player_names])
except Exception as _e:
    print(f"Kicker stats load skipped: {_e}")
    _kicking = pd.DataFrame()


# ── Active roster filter ───────────────────────────────────────────────────────
print("Loading active rosters...")
try:
    _roster_raw = nfl_data.import_weekly_rosters([2025])
    print(f"Roster columns: {list(_roster_raw.columns)}")
    # Find player name column
    _roster_name_col = next(
        (c for c in ["player_name", "full_name", "display_name"] if c in _roster_raw.columns), None
    )
    if _roster_name_col:
        # Keep only players with an active status (or no status column - just being on a 2025 roster is enough)
        if "status" in _roster_raw.columns:
            _active = _roster_raw[_roster_raw["status"].isin(["Active", "ACT", "active"])]
        else:
            _active = _roster_raw
        _active_names: set[str] = set(_active[_roster_name_col].dropna().str.lower().str.strip())
        print(f"Active roster: {len(_active_names)} players.")
    else:
        _active_names = set()
        print("Active roster load skipped: name column not found.")
except Exception as _e:
    print(f"Active roster load skipped: {_e}")
    _active_names = set()


def _is_active(player_name: str) -> bool:
    """Return True if the player appears on a 2025 NFL roster (or if roster data unavailable)."""
    if not _active_names:
        return True  # no filter if data unavailable
    name = player_name.lower().strip()
    return name in _active_names or any(name in n or n in name for n in _active_names if abs(len(n) - len(name)) < 4)


def _get_kicker_stats(player_name: str) -> dict:
    """Rolling-average projection for kickers (no ML - variance too high)."""
    if _kicking.empty:
        return {"found": False, "player": player_name}
    name = player_name.lower().strip()
    exact = _kicking[_kicking["_name_lower"] == name]
    games = exact if not exact.empty else _kicking[_kicking["_name_lower"].str.contains(name, na=False, regex=False)]
    # Abbreviated name fallback: "k.fairbairn" → search by last name "fairbairn"
    if games.empty and "." in name:
        last = name.split(".")[-1].strip()
        if len(last) > 3:
            games = _kicking[_kicking["_name_lower"].str.contains(last, na=False, regex=False)]
    if games.empty:
        return {"found": False, "player": player_name}

    games = games.sort_values(["season", "week"])

    full_name = str(games["player_display_name"].iloc[-1]).title()
    team_col  = next((c for c in ["team", "recent_team"] if c in games.columns), None)
    team      = str(games[team_col].iloc[-1]) if team_col else "?"
    fp_all    = games["fp"].values.astype(float)
    fp_recent = fp_all[-4:] if len(fp_all) >= 4 else fp_all

    proj    = round(float(np.mean(fp_recent)), 1)
    floor   = round(float(np.percentile(fp_all, 10)), 1) if len(fp_all) >= 5 else round(max(0.0, proj - 3), 1)
    ceiling = round(float(np.percentile(fp_all, 90)), 1) if len(fp_all) >= 5 else round(proj + 4.0, 1)
    trend   = round(proj - float(np.mean(fp_all)), 1)
    n_recent = len(fp_recent)

    tail4 = games.tail(4)
    recent_games = [
        {"week": int(r["week"]), "fp": round(float(r["fp"]), 1)}
        for _, r in tail4.iterrows()
    ]
    sample_desc = " · ".join(
        f"Wk{int(r['week'])}: {round(float(r['fp']), 1)}"
        for _, r in tail4.iterrows()
    )

    depth = _get_depth_info(full_name)
    return {
        "found":            True,
        "player":           full_name,
        "position":         "K",
        "team":             team,
        "projected_points": proj,
        "floor":            floor,
        "ceiling":          ceiling,
        "trend":            trend,
        "confidence":       "MEDIUM",
        "confidence_color": "#fbbf24",
        "factors":          [],
        "recent_games":     recent_games,
        "games_sampled":    n_recent,
        "sample_weeks":     sample_desc,
        "usage_label":      "",
        "usage_recent":     0.0,
        "usage_season":     0.0,
        "usage_trend":      0.0,
        "depth_chart":      depth.get("depth_label", ""),
        "depth_order":      depth.get("depth_order"),
    }


# ── Depth chart ────────────────────────────────────────────────────────────────
print("Loading depth charts...")
try:
    _depth_raw = nfl_data.import_depth_charts([2025])
    if len(_depth_raw) > 0:
        # Filter to most recent date snapshot
        latest_dt = _depth_raw["dt"].max()
        _depth = _depth_raw[_depth_raw["dt"] == latest_dt].copy()
        _depth["_name_lower"] = _depth["player_name"].str.lower()
    else:
        _depth = pd.DataFrame()
    print(f"Depth charts loaded ({len(_depth)} entries, {latest_dt if len(_depth_raw) > 0 else '?'}).")
except Exception as _e:
    print(f"Depth chart load skipped: {_e}")
    _depth = pd.DataFrame()


def _get_depth_info(player_name: str) -> dict:
    """Return depth chart position for a player as a human-readable label."""
    if _depth.empty:
        return {}
    name_lower = player_name.lower()
    exact = _depth[_depth["_name_lower"] == name_lower]
    rows = exact if not exact.empty else _depth[_depth["_name_lower"].str.contains(name_lower, na=False, regex=False)]
    if rows.empty:
        return {}
    row = rows.sort_values("pos_rank").iloc[0]
    order = int(row["pos_rank"]) if pd.notna(row["pos_rank"]) else None
    pos = str(row["pos_abb"]) if pd.notna(row["pos_abb"]) else ""
    if order is None or not pos:
        return {}
    role = "starter" if order == 1 else ("backup" if order == 2 else f"#{order}")
    return {
        "depth_order": order,
        "depth_label": f"{pos}{order} - {role}",
    }



_stats_cache: dict[str, dict] = {}

def get_player_stats(player_name: str) -> dict:
    """Returns ML-powered projection with SHAP factors and real injury status."""
    _cache_key = player_name.lower().strip()
    if _cache_key in _stats_cache:
        return _stats_cache[_cache_key]

    name = _resolve_player_name(player_name)
    all_games = _weekly[
        _weekly["player_display_name"].str.contains(name, na=False, regex=False) &
        _weekly["position"].isin(FANTASY_POSITIONS)
    ].copy()

    if all_games.empty:
        return _get_kicker_stats(player_name)

    all_games = all_games.sort_values(["season", "week"])
    all_games["fp"] = _calc_fp(all_games)

    position  = str(all_games["position"].iloc[-1])  if "position"  in all_games.columns else "?"

    # Kickers are in _weekly but have no ML model - use PBP-based projection
    if position == "K":
        return _get_kicker_stats(player_name)
    team      = str(all_games["team"].iloc[-1])       if "team"      in all_games.columns else "?"
    full_name = str(all_games["player_display_name"].iloc[-1]).title()

    latest_season = int(all_games["season"].max())
    season_games  = all_games[all_games["season"] == latest_season].copy()
    recent        = all_games.tail(4).copy()

    # ── Opponent defense lookup ────────────────────────────────────────────────
    opp_defense_avg = 0.0
    if "opponent_team" in recent.columns and not recent.empty:
        last_opp = str(recent["opponent_team"].iloc[-1])
        last_wk  = int(recent["week"].iloc[-1])
        opp_defense_avg = _opp_defense.get(
            (latest_season, last_wk, last_opp, position), 0.0
        )

    # ── ML prediction ─────────────────────────────────────────────────────────
    ml_result = predict(_models, all_games, position, opp_defense_avg)

    if ml_result:
        proj       = ml_result["projected_points"]
        floor      = ml_result["floor"]
        ceiling    = ml_result["ceiling"]
        confidence = ml_result["confidence"]
        conf_color = ml_result["confidence_color"]
        factors    = ml_result["factors"]
    else:
        fp_vals    = recent["fp"].values
        proj       = round(float(np.mean(fp_vals)), 1)
        floor      = round(float(np.min(fp_vals)), 1)
        ceiling    = round(float(np.max(fp_vals)), 1)
        std        = float(np.std(fp_vals)) if len(fp_vals) > 1 else 0.0
        cv         = std / proj if proj > 0 else 1.0
        confidence = "HIGH" if cv < 0.25 else "MEDIUM" if cv < 0.5 else "LOW"
        conf_color = "#22c55e" if confidence == "HIGH" else "#fbbf24" if confidence == "MEDIUM" else "#ef4444"
        factors    = []

    # ── Trend ─────────────────────────────────────────────────────────────────
    season_avg = float(season_games["fp"].mean()) if len(season_games) >= 4 else proj
    trend      = round(proj - season_avg, 1)

    # ── Usage trend (targets / carries / attempts vs season avg) ──────────────
    USAGE_COL = {"QB": "attempts", "RB": "carries", "WR": "targets", "TE": "targets"}.get(position, "targets")
    if USAGE_COL in all_games.columns:
        usage_season = float(season_games[USAGE_COL].fillna(0).mean()) if len(season_games) > 0 else 0.0
        usage_recent = float(recent[USAGE_COL].fillna(0).mean()) if len(recent) > 0 else 0.0
        usage_trend  = round(usage_recent - usage_season, 1)
    else:
        usage_season = usage_recent = usage_trend = 0.0

    # ── Recent games ──────────────────────────────────────────────────────────
    game_cols = ["week", "fp"]
    if "opponent_team" in recent.columns:
        game_cols.append("opponent_team")

    recent_games = []
    for r in recent[game_cols].to_dict("records"):
        game = {"week": int(r["week"]), "fp": round(float(r["fp"]), 1)}
        if "opponent_team" in r:
            game["opponent"] = str(r["opponent_team"])
        recent_games.append(game)

    if "opponent_team" in recent.columns and not recent.empty:
        opponents   = ", ".join([f"Wk{int(r['week'])} vs {r['opponent_team']}" for _, r in recent.iterrows()])
        sample_desc = f"{latest_season} - {opponents}"
    else:
        sample_desc = f"Wks {int(recent['week'].min())}–{int(recent['week'].max())}, {latest_season}"

    depth = _get_depth_info(full_name)

    result = {
        "found":            True,
        "player":           full_name,
        "position":         position,
        "team":             team,
        "projected_points": proj,
        "floor":            floor,
        "ceiling":          ceiling,
        "trend":            trend,
        "confidence":       confidence,
        "confidence_color": conf_color,
        "factors":          factors,
        "recent_games":     recent_games,
        "games_sampled":    len(recent),
        "sample_weeks":     sample_desc,
        "usage_label":      USAGE_COL,
        "usage_recent":     round(usage_recent, 1),
        "usage_season":     round(usage_season, 1),
        "usage_trend":      round(usage_trend, 1),
        "depth_chart":      depth.get("depth_label", ""),
        "depth_order":      depth.get("depth_order"),
    }
    _stats_cache[_cache_key] = result
    return result


def search_players(query: str, limit: int = 12) -> list[dict]:
    """Search for players by partial name match with fuzzy fallback."""
    q = _resolve_player_name(query)
    matches = _weekly[
        _weekly["player_display_name"].str.contains(q, na=False, regex=False) &
        _weekly["position"].isin(FANTASY_POSITIONS)
    ]

    results = []
    seen_names = set()

    if not matches.empty:
        latest = (
            matches.sort_values(["season", "week"])
            .groupby("player_display_name")
            .last()
            .reset_index()
        )
        for _, row in latest.head(limit).iterrows():
            name  = str(row["player_display_name"]).title()
            if not _is_active(name):
                continue
            stats = get_player_stats(name)
            if stats["found"]:
                results.append(stats)
                seen_names.add(stats["player"].lower())

    # Also search kickers (not in _weekly)
    if not _kicking.empty and len(results) < limit:
        k_matches = _kicking[_kicking["_name_lower"].str.contains(q, na=False, regex=False)]
        for k_name in k_matches["_name_lower"].unique():
            if k_name in seen_names:
                continue
            stats = _get_kicker_stats(k_name.title())
            if stats["found"]:
                results.append(stats)
                seen_names.add(k_name)
            if len(results) >= limit:
                break

    results.sort(key=lambda x: x["projected_points"], reverse=True)
    return results