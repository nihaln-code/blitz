"""
data/stats.py - Real player stats using nflreadpy + XGBoost projections
"""
import nflreadpy as nfl
import nfl_data_py as nfl_data
import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.model import (
    train, save_models, load_models, models_exist,
    predict, _build_opp_defense_table, _calc_fp
)

print("Loading NFL data...")
_weekly = nfl.load_player_stats([2023, 2024, 2025]).to_pandas()
_weekly["player_display_name"] = _weekly["player_display_name"].str.lower()
print(f"Loaded {len(_weekly)} rows of NFL stats.")

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

# ── Load injury report from nfl_data_py ───────────────────────────────────────
def _load_injuries() -> pd.DataFrame:
    try:
        print("Loading injury reports...")
        current_year = 2025
        df = nfl_data.import_injuries([current_year])
        df["player_name"] = df["full_name"].str.lower() if "full_name" in df.columns else df["player_name"].str.lower()
        # Keep only the most recent week per player
        df = df.sort_values("week").groupby("player_name").last().reset_index()
        print(f"Loaded {len(df)} injury records.")
        return df
    except Exception as e:
        print(f"Could not load injuries: {e}")
        return pd.DataFrame()

_injuries = _load_injuries()


def get_injury_status(player_name: str) -> str:
    """Look up injury status from the official NFL injury report via nfl_data_py."""
    if _injuries.empty:
        return "—"
    name_lower = player_name.lower().strip()
    match = _injuries[_injuries["player_name"].str.contains(name_lower, na=False)]
    if match.empty:
        # Try partial last name match
        last_name = name_lower.split()[-1] if name_lower else ""
        match = _injuries[_injuries["player_name"].str.contains(last_name, na=False)]
    if match.empty:
        return "Healthy"
    row = match.iloc[0]
    # report_status: Questionable, Doubtful, Out, IR
    status = str(row.get("report_status", "") or "").strip()
    if not status or status == "nan":
        # Fall back to practice status
        practice = str(row.get("practice_status", "") or "").strip()
        if "did not practice" in practice.lower():
            return "Did Not Practice"
        if "limited" in practice.lower():
            return "Limited"
        return "Healthy"
    return status


def get_player_stats(player_name: str) -> dict:
    """Returns ML-powered projection with SHAP factors and real injury status."""
    name = player_name.lower().strip()
    all_games = _weekly[_weekly["player_display_name"].str.contains(name, na=False)].copy()

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
    }


def search_players(query: str, limit: int = 12) -> list[dict]:
    """Search for players by partial name match."""
    q       = query.lower().strip()
    matches = _weekly[_weekly["player_display_name"].str.contains(q, na=False)]

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