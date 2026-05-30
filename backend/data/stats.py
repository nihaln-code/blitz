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
import requests as _requests
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.model import (
    train, save_models, load_models, models_exist,
    predict, _build_opp_defense_table, _calc_fp
)

print("Loading NFL data...")
_weekly = nfl.load_player_stats([2022, 2023, 2024, 2025]).to_pandas()
_weekly["player_display_name"] = _weekly["player_display_name"].str.lower()
print(f"Loaded {len(_weekly)} rows of NFL stats.")

_all_player_names: list[str] = []  # populated after load, used by fuzzy resolver

def _norm(s: str) -> str:
    """Strip dots and collapse whitespace for name comparison (handles J.J. vs JJ)."""
    return re.sub(r"[.\s]+", "", s.lower())

def _resolve_player_name(raw: str) -> str:
    """
    Resolve a potentially misspelled or abbreviated name to the best match in the dataset.
    Strategy: 1) direct substring  2) dot-stripped normalization  3) difflib fuzzy match
    """
    name = raw.lower().strip()

    # 1. Fast path: direct substring match already works
    if not _weekly[_weekly["player_display_name"].str.contains(name, na=False, regex=False)].empty:
        return name

    # 2. Normalize: strip dots/spaces so "jj mccarthy" matches "j.j. mccarthy"
    norm_input = _norm(name)
    for player_name in _all_player_names:
        if _norm(player_name) == norm_input:
            return player_name

    # 3. Difflib: catch typos with >60% similarity
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

# Populate after all data is loaded so the fuzzy resolver has the full name list
_all_player_names = _weekly["player_display_name"].unique().tolist()

# ── ESPN injury lookup with 4-hour cache ──────────────────────────────────────
_espn_cache: dict = {}
_ESPN_TTL = timedelta(hours=4)


def get_injury_status(player_name: str) -> str:
    """
    Real-time injury status from ESPN API with 4-hour in-memory cache.
    Falls back to nfl_data_py injury report if ESPN is unreachable.
    """
    key = player_name.lower().strip()

    # Return cached result if fresh
    if key in _espn_cache:
        status, ts = _espn_cache[key]
        if datetime.now() - ts < _ESPN_TTL:
            return status

    try:
        # Step 1: find the ESPN athlete ID by searching for the player
        search = _requests.get(
            "https://site.api.espn.com/apis/search/v2",
            params={"query": player_name, "sport": "football", "league": "nfl", "limit": 5},
            timeout=3,
        ).json()

        athlete_id = None
        for bucket in search.get("results", {}).get("buckets", []):
            for r in bucket.get("results", []):
                if r.get("type") == "player":
                    athlete_id = r.get("id")
                    break
            if athlete_id:
                break
        # alternate response shape
        if not athlete_id:
            for hit in search.get("hits", []):
                if hit.get("type") == "player":
                    athlete_id = hit.get("id")
                    break

        if not athlete_id:
            raise ValueError("not found")

        # Step 2: get athlete details including injuries
        athlete_data = _requests.get(
            f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/{athlete_id}",
            timeout=3,
        ).json()

        athlete = athlete_data.get("athlete", athlete_data)

        # Active injuries take priority
        injuries = athlete.get("injuries", [])
        if injuries:
            inj_status = injuries[0].get("status") or injuries[0].get("type", {}).get("name", "")
            if inj_status:
                _espn_cache[key] = (inj_status, datetime.now())
                return inj_status

        # Fall back to roster status (Active / Questionable / Out / IR etc.)
        status_name = (athlete.get("status") or {}).get("name", "Active")
        result = "Healthy" if status_name == "Active" else status_name
        _espn_cache[key] = (result, datetime.now())
        return result

    except Exception:
        # ESPN unavailable — fall back to nfl_data_py static report
        try:
            df = nfl_data.import_injuries([2025])
            df["player_name"] = df["full_name"].str.lower() if "full_name" in df.columns else df["player_name"].str.lower()
            df = df.sort_values("week").groupby("player_name").last().reset_index()
            name_lower = player_name.lower().strip()
            match = df[df["player_name"].str.contains(name_lower, na=False)]
            if match.empty:
                last = name_lower.split()[-1]
                match = df[df["player_name"].str.contains(last, na=False)]
            if not match.empty:
                row = match.iloc[0]
                status = str(row.get("report_status", "") or "").strip()
                if status and status != "nan":
                    _espn_cache[key] = (status, datetime.now())
                    return status
        except Exception:
            pass
        _espn_cache[key] = ("—", datetime.now())
        return "—"


def get_player_stats(player_name: str) -> dict:
    """Returns ML-powered projection with SHAP factors and real injury status."""
    name = _resolve_player_name(player_name)
    all_games = _weekly[_weekly["player_display_name"].str.contains(name, na=False, regex=False)].copy()

    if all_games.empty:
        return {"found": False, "player": player_name}

    all_games = all_games.sort_values(["season", "week"])
    all_games["fp"] = _calc_fp(all_games)

    position  = str(all_games["position"].iloc[-1])  if "position"  in all_games.columns else "?"
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
        sample_desc = f"{latest_season} — {opponents}"
    else:
        sample_desc = f"Wks {int(recent['week'].min())}–{int(recent['week'].max())}, {latest_season}"

    # ── Real injury status from NFL injury report ──────────────────────────────
    injury_status = get_injury_status(full_name)

    return {
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
        "injury_status":    injury_status,
        "usage_label":      USAGE_COL,
        "usage_recent":     round(usage_recent, 1),
        "usage_season":     round(usage_season, 1),
        "usage_trend":      round(usage_trend, 1),
    }


def search_players(query: str, limit: int = 12) -> list[dict]:
    """Search for players by partial name match with fuzzy fallback."""
    q       = _resolve_player_name(query)
    matches = _weekly[_weekly["player_display_name"].str.contains(q, na=False, regex=False)]

    if matches.empty:
        return []

    latest = (
        matches.sort_values(["season", "week"])
        .groupby("player_display_name")
        .last()
        .reset_index()
    )

    results = []
    for _, row in latest.head(limit).iterrows():
        name  = str(row["player_display_name"]).title()
        stats = get_player_stats(name)
        if stats["found"]:
            results.append(stats)

    results.sort(key=lambda x: x["projected_points"], reverse=True)
    return results