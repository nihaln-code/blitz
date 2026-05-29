"""
ml/model.py - XGBoost fantasy football projection model

Training data:  all loaded seasons except the most recent complete one
Validation:     most recent complete season
Target:         Full PPR fantasy points for a given week
Features:       Rolling averages, usage trends, opponent defense rank, consistency

Install deps:   pip install xgboost shap scikit-learn
"""

import os
import pickle
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error
import shap

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

# Positions we build models for
POSITIONS = ["QB", "RB", "WR", "TE"]

# Feature names per position
BASE_FEATURES = [
    "roll2_fp",          # 2-week rolling avg fantasy points
    "roll4_fp",          # 4-week rolling avg fantasy points
    "roll4_std",         # 4-week std dev (consistency)
    "roll4_td_rate",     # TDs per game last 4 weeks
    "opp_fp_allowed",    # opponent avg fp allowed to this position (last 4 wks)
    "week",              # season week number (schedule difficulty varies)
    "season_avg_fp",     # full season avg fp (baseline)
]

POSITION_EXTRA = {
    "QB": ["roll4_attempts", "roll4_pass_yards", "roll4_rush_yards"],
    "RB": ["roll4_carries",  "roll4_rush_yards", "roll4_receptions"],
    "WR": ["roll4_targets",  "roll4_rec_yards",  "roll4_receptions"],
    "TE": ["roll4_targets",  "roll4_rec_yards",  "roll4_receptions"],
}


def _calc_fp(df: pd.DataFrame) -> pd.Series:
    """Full PPR fantasy points."""
    def col(name):
        return df[name].fillna(0) if name in df.columns else pd.Series(0, index=df.index)
    return (
        col("passing_yards")    * 0.04 +
        col("passing_tds")      * 4    +
        col("rushing_yards")    * 0.1  +
        col("rushing_tds")      * 6    +
        col("receptions")       * 1.0  +
        col("receiving_yards")  * 0.1  +
        col("receiving_tds")    * 6    -
        col("interceptions")    * 2    -
        col("sack_fumbles_lost")* 2
    )


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Given a full dataset, build training rows.
    For each player-week, compute rolling features from PRIOR weeks only
    (no data leakage).
    """
    df = df.copy().sort_values(["player_display_name", "season", "week"])
    df["fp"] = _calc_fp(df)

    rows = []

    for player, pdf in df.groupby("player_display_name"):
        pdf = pdf.sort_values(["season", "week"]).reset_index(drop=True)
        if len(pdf) < 5:
            continue

        pos = str(pdf["position"].iloc[-1]) if "position" in pdf.columns else "UNK"
        if pos not in POSITIONS:
            continue

        for i in range(4, len(pdf)):
            hist = pdf.iloc[:i]           # everything BEFORE this week
            curr = pdf.iloc[i]            # the week we're predicting

            all_fp = hist["fp"].values
            if len(all_fp) < 2:
                continue

            # Match the same healthy-game filter used in predict()
            MIN_HEALTHY_FP = {"QB": 8.0, "RB": 2.0, "WR": 2.0, "TE": 2.0}.get(pos, 2.0)
            healthy = all_fp[all_fp >= MIN_HEALTHY_FP]
            if len(healthy) < 2:
                healthy = all_fp
            recent = healthy[-6:]

            roll4_fp  = float(np.mean(healthy[-4:])) if len(healthy) >= 4 else float(np.mean(healthy))
            roll2_fp  = float(np.mean(healthy[-2:]))
            roll4_std = float(np.std(recent)) if len(recent) >= 2 else 0.0

            # TD rate
            td_cols = ["passing_tds", "rushing_tds", "receiving_tds"]
            recent_hist = hist.tail(4)
            td_rate = sum(
                float(recent_hist[c].fillna(0).sum()) for c in td_cols if c in recent_hist.columns
            ) / max(len(recent_hist), 1)

            season_avg = float(hist[hist["season"] == int(curr["season"])]["fp"].mean()) if len(hist) > 0 else roll4_fp

            row = {
                "player":       player,
                "position":     pos,
                "season":       int(curr["season"]),
                "week":         int(curr["week"]),
                "roll2_fp":     roll2_fp,
                "roll4_fp":     roll4_fp,
                "roll4_std":    roll4_std,
                "roll4_td_rate":td_rate,
                "season_avg_fp":season_avg,
                "opp_fp_allowed": 0.0,   # filled in after
                "target_fp":    float(curr["fp"]),
            }

            # Position-specific usage features
            def roll(col_name):
                if col_name in hist.columns:
                    return float(hist.tail(4)[col_name].fillna(0).mean())
                return 0.0

            if pos == "QB":
                row["roll4_attempts"]   = roll("attempts")
                row["roll4_pass_yards"] = roll("passing_yards")
                row["roll4_rush_yards"] = roll("rushing_yards")
            elif pos == "RB":
                row["roll4_carries"]    = roll("carries")
                row["roll4_rush_yards"] = roll("rushing_yards")
                row["roll4_receptions"] = roll("receptions")
            elif pos in ["WR", "TE"]:
                row["roll4_targets"]    = roll("targets")
                row["roll4_rec_yards"]  = roll("receiving_yards")
                row["roll4_receptions"] = roll("receptions")

            rows.append(row)

    result = pd.DataFrame(rows)

    # Fill opponent defensive ranking
    # For each (season, week, opponent_team, position), compute avg fp allowed
    # by that defense to that position in the 4 weeks prior
    if "opponent_team" in df.columns:
        opp_lookup = _build_opp_defense_table(df)
        def lookup_opp(r):
            key = (r["season"], r["week"], r.get("opp_team", ""), r["position"])
            return opp_lookup.get(key, roll4_fp)

        # We need opp_team in result — add it from df
        df_opp = df[["player_display_name", "season", "week", "opponent_team"]].copy()
        df_opp.columns = ["player", "season", "week", "opp_team"]
        result = result.merge(df_opp, on=["player", "season", "week"], how="left")
        result["opp_fp_allowed"] = result.apply(
            lambda r: opp_lookup.get((r["season"], r["week"], r.get("opp_team", ""), r["position"]), r["roll4_fp"]),
            axis=1
        )
        result = result.drop(columns=["opp_team"], errors="ignore")

    return result


def _build_opp_defense_table(df: pd.DataFrame) -> dict:
    """
    For each (season, week, team, position): avg fp allowed by that team
    to that position in the 4 prior weeks.
    Returns a dict keyed by (season, week, defending_team, position).
    """
    df = df.copy()
    df["fp"] = _calc_fp(df)
    if "opponent_team" not in df.columns:
        return {}

    lookup = {}
    for (season, pos), group in df.groupby(["season", "position"]):
        if pos not in POSITIONS:
            continue
        group = group.sort_values("week")
        weeks = sorted(group["week"].unique())
        for w in weeks:
            prior = group[group["week"] < w].copy()
            if prior.empty:
                continue
            # For each defending team, avg fp allowed in last 4 weeks
            for team in group["opponent_team"].dropna().unique():
                team_games = prior[prior["opponent_team"] == team].tail(4)
                if team_games.empty:
                    continue
                avg_allowed = float(team_games["fp"].mean())
                lookup[(season, w, team, pos)] = avg_allowed
    return lookup


def _get_feature_cols(pos: str) -> list:
    return BASE_FEATURES + POSITION_EXTRA.get(pos, [])


def train(df: pd.DataFrame) -> dict:
    """
    Train one XGBoost model per position. Trains on all seasons except the
    most recent complete one, which is used for validation.
    Returns dict of {position: model}.
    """
    print("Building feature set...")
    features_df = _build_features(df)

    all_seasons = sorted(features_df["season"].unique())
    val_season  = all_seasons[-1] if len(all_seasons) >= 2 else None
    train_df    = features_df[features_df["season"] != val_season] if val_season else features_df
    val_df      = features_df[features_df["season"] == val_season] if val_season else pd.DataFrame()

    models = {}
    print(f"\n{'Position':<8} {'Train rows':<12} {'Val rows':<10} {'Val MAE':<10} {'Baseline MAE'}")
    print("-" * 55)

    for pos in POSITIONS:
        tr = train_df[train_df["position"] == pos].copy()
        vl = val_df[val_df["position"] == pos].copy()

        if len(tr) < 50:
            print(f"{pos:<8} {'insufficient data'}")
            continue

        feat_cols = _get_feature_cols(pos)
        # Keep only columns that exist
        feat_cols = [c for c in feat_cols if c in tr.columns]

        X_train = tr[feat_cols].fillna(0)
        y_train = tr["target_fp"]
        X_val   = vl[feat_cols].fillna(0) if len(vl) > 0 else X_train.head(0)
        y_val   = vl["target_fp"] if len(vl) > 0 else y_train.head(0)

        base_params = dict(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
            verbosity=0,
        )

        model = XGBRegressor(**base_params)
        model.fit(X_train, y_train,
                  eval_set=[(X_val, y_val)] if len(X_val) > 0 else None,
                  verbose=False)

        floor_model = XGBRegressor(objective="reg:quantileerror", quantile_alpha=0.10, **base_params)
        floor_model.fit(X_train, y_train, verbose=False)

        ceiling_model = XGBRegressor(objective="reg:quantileerror", quantile_alpha=0.90, **base_params)
        ceiling_model.fit(X_train, y_train, verbose=False)

        models[pos] = {"model": model, "floor_model": floor_model, "ceiling_model": ceiling_model, "features": feat_cols}

        if len(X_val) > 0:
            preds    = model.predict(X_val)
            mae      = mean_absolute_error(y_val, preds)
            baseline = mean_absolute_error(y_val, [y_train.mean()] * len(y_val))
            print(f"{pos:<8} {len(tr):<12} {len(vl):<10} {mae:<10.2f} {baseline:.2f}")
        else:
            print(f"{pos:<8} {len(tr):<12} {'no val data':<10}")

    return models


def save_models(models: dict):
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(models, f)
    print(f"\nModels saved to {MODEL_PATH}")


def load_models() -> dict:
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def models_exist() -> bool:
    return os.path.exists(MODEL_PATH)


def predict(models: dict, player_df: pd.DataFrame, position: str, opp_defense_avg: float = 0.0) -> dict:
    """
    Given a player's recent game history (sorted oldest->newest),
    predict their next fantasy point total and return SHAP-based factors.

    player_df: DataFrame of recent games for one player (all columns from _weekly)
    position:  "QB", "RB", "WR", "TE"
    opp_defense_avg: avg fp that opponent allowed to this position recently
    """
    if position not in models:
        return None

    m     = models[position]["model"]
    feats = models[position]["features"]

    player_df = player_df.copy().sort_values(["season", "week"])
    player_df["fp"] = _calc_fp(player_df)

    hist = player_df  # all games as history
    fp_vals = hist["fp"].values

    if len(fp_vals) < 2:
        return None

    # Filter out near-DNP games (injury/early exit) before computing rolling stats.
    # A QB scoring <8 or a skill player scoring <2 almost certainly didn't play a full game.
    MIN_HEALTHY_FP = {"QB": 8.0, "RB": 2.0, "WR": 2.0, "TE": 2.0}.get(position, 2.0)
    healthy_vals = fp_vals[fp_vals >= MIN_HEALTHY_FP]
    if len(healthy_vals) < 2:
        healthy_vals = fp_vals
    recent_vals = healthy_vals[-6:]  # last 6 healthy games for std

    roll4_fp  = float(np.mean(healthy_vals[-4:])) if len(healthy_vals) >= 4 else float(np.mean(healthy_vals))
    roll2_fp  = float(np.mean(healthy_vals[-2:]))
    roll4_std = float(np.std(recent_vals)) if len(recent_vals) >= 2 else 0.0

    td_cols = ["passing_tds", "rushing_tds", "receiving_tds"]
    recent4 = hist.tail(4)
    td_rate = sum(
        float(recent4[c].fillna(0).sum()) for c in td_cols if c in recent4.columns
    ) / max(len(recent4), 1)

    latest_season = int(hist["season"].max())
    season_avg = float(hist[hist["season"] == latest_season]["fp"].mean())
    latest_week = int(hist["week"].max())

    def roll(col_name):
        if col_name in hist.columns:
            return float(hist.tail(4)[col_name].fillna(0).mean())
        return 0.0

    row = {
        "roll2_fp":      roll2_fp,
        "roll4_fp":      roll4_fp,
        "roll4_std":     roll4_std,
        "roll4_td_rate": td_rate,
        "opp_fp_allowed":opp_defense_avg if opp_defense_avg > 0 else roll4_fp,
        "week":          min(latest_week + 1, 18),
        "season_avg_fp": season_avg,
        "roll4_attempts":  roll("attempts"),
        "roll4_pass_yards":roll("passing_yards"),
        "roll4_rush_yards":roll("rushing_yards"),
        "roll4_carries":   roll("carries"),
        "roll4_receptions":roll("receptions"),
        "roll4_targets":   roll("targets"),
        "roll4_rec_yards": roll("receiving_yards"),
    }

    X = pd.DataFrame([row])[feats].fillna(0)
    prediction = float(m.predict(X)[0])
    prediction = max(0.0, round(prediction, 1))

    # ── SHAP explanation ────────────────────────────────────────────────────────
    explainer  = shap.TreeExplainer(m)
    shap_vals  = explainer.shap_values(X)[0]

    FACTOR_LABELS = {
        "roll4_fp":       "4-Week Rolling Avg",
        "roll2_fp":       "Last 2 Games Form",
        "roll4_std":      "Consistency",
        "roll4_td_rate":  "TD Rate",
        "opp_fp_allowed": "Opponent Defense",
        "season_avg_fp":  "Season Baseline",
        "week":           "Schedule Position",
        "roll4_attempts": "Pass Volume",
        "roll4_pass_yards":"Passing Yards Trend",
        "roll4_rush_yards":"Rushing Yards Trend",
        "roll4_carries":  "Carry Volume",
        "roll4_receptions":"Reception Trend",
        "roll4_targets":  "Target Volume",
        "roll4_rec_yards":"Receiving Yards Trend",
    }

    factors = []
    for feat, sv in zip(feats, shap_vals):
        label = FACTOR_LABELS.get(feat, feat)
        impact = round(float(sv), 1)
        if abs(impact) >= 0.1:
            factors.append({"factor": label, "impact": impact})

    # Sort by absolute impact, keep top 5
    factors.sort(key=lambda x: abs(x["impact"]), reverse=True)
    factors = factors[:5]

    # Floor/ceiling from quantile regression models (10th and 90th percentile)
    floor_m   = models[position].get("floor_model")
    ceiling_m = models[position].get("ceiling_model")
    if floor_m and ceiling_m:
        floor   = round(max(0.0, float(floor_m.predict(X)[0])), 1)
        ceiling = round(float(ceiling_m.predict(X)[0]), 1)
    else:
        floor   = round(max(0.0, prediction - 1.5 * roll4_std), 1)
        ceiling = round(prediction + 1.5 * roll4_std, 1)

    # Confidence from cv
    cv = roll4_std / roll4_fp if roll4_fp > 0 else 1.0
    if cv < 0.25:
        confidence, confidence_color = "HIGH",   "#22c55e"
    elif cv < 0.5:
        confidence, confidence_color = "MEDIUM", "#fbbf24"
    else:
        confidence, confidence_color = "LOW",    "#ef4444"

    return {
        "projected_points": prediction,
        "floor":            floor,
        "ceiling":          ceiling,
        "confidence":       confidence,
        "confidence_color": confidence_color,
        "factors":          factors,
    }