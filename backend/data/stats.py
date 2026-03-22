"""
data/stats.py - Real player stats using nflreadpy + XGBoost projections
Install: pip install nflreadpy pyarrow polars xgboost shap scikit-learn
"""
import nflreadpy as nfl
import pandas as pd
import numpy as np
import sys
import os

# Add backend root to path so ml.model can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.model import (
    train, save_models, load_models, models_exist,
    predict, _build_opp_defense_table, _calc_fp
)

print("Loading NFL data...")
_weekly = nfl.load_player_stats([2024, 2025]).to_pandas()
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


def get_player_stats(player_name: str) -> dict:
    """Returns ML-powered projection with SHAP factors for a player."""
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
        # Fallback to rolling average if position not in model (K, DST, etc.)
        fp_vals    = recent["fp"].values
        proj       = round(float(np.mean(fp_vals)), 1)
        floor      = round(float(np.min(fp_vals)), 1)
        ceiling    = round(float(np.max(fp_vals)), 1)
        std        = float(np.std(fp_vals)) if len(fp_vals) > 1 else 0.0
        cv         = std / proj if proj > 0 else 1.0
        confidence = "HIGH" if cv < 0.25 else "MEDIUM" if cv < 0.5 else "LOW"
        conf_color = "#22c55e" if confidence == "HIGH" else "#fbbf24" if confidence == "MEDIUM" else "#ef4444"
        factors    = []

    # ── Trend: ML projection vs season average ────────────────────────────────
    season_avg = float(season_games["fp"].mean()) if len(season_games) >= 4 else proj
    trend      = round(proj - season_avg, 1)

    # ── Recent games with opponent info ───────────────────────────────────────
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