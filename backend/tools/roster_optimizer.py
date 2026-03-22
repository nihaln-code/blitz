"""
tools/roster_optimizer.py - Linear Programming lineup optimizer

Solves for the optimal lineup given:
- Projected points per player
- Injury risk multipliers
- Position slot requirements
- Optional: salary cap (for DFS mode)
"""
import pulp
import pandas as pd
from dataclasses import dataclass


@dataclass
class PlayerProjection:
    name: str
    position: str
    projected_points: float
    injury_risk: float = 1.0
    salary: int = 0  # For DFS mode


LINEUP_SLOTS = {
    "standard": {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 1, "K": 1, "DST": 1},
    "superflex": {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 1, "SFLEX": 1, "K": 1, "DST": 1},
}

FLEX_ELIGIBLE = {"RB", "WR", "TE"}
SFLEX_ELIGIBLE = {"QB", "RB", "WR", "TE"}


class LineupOptimizer:
    """Uses PuLP linear programming to find optimal lineup."""

    def optimize(
        self,
        players: list[dict],
        scoring_format: str = "half_ppr",
        lineup_format: str = "standard",
        salary_cap: int = None,
    ) -> dict:
        """
        Find the optimal starting lineup.
        
        players: list of dicts with keys: name, position, projected_points, injury_risk, salary
        """
        df = pd.DataFrame(players)
        df["adj_points"] = df["projected_points"] * df.get("injury_risk", 1.0)

        # Filter out likely inactive players
        df = df[df.get("injury_risk", 1.0) > 0.3]

        slots = LINEUP_SLOTS.get(lineup_format, LINEUP_SLOTS["standard"])

        # Create LP problem
        prob = pulp.LpProblem("Fantasy_Lineup", pulp.LpMaximize)

        # Binary decision variable: is player in lineup?
        player_vars = {
            row["name"]: pulp.LpVariable(f"player_{i}", cat="Binary")
            for i, row in df.iterrows()
        }

        # Objective: maximize total projected points
        prob += pulp.lpSum(
            player_vars[row["name"]] * row["adj_points"]
            for _, row in df.iterrows()
        )

        # Position constraints
        for pos, count in slots.items():
            if pos == "FLEX":
                flex_players = df[df["position"].isin(FLEX_ELIGIBLE)]
                # FLEX is at least the required count beyond the positional minimums
                # Handled implicitly by total constraint below
                continue
            if pos in ("FLEX", "SFLEX"):
                continue
            pos_players = df[df["position"] == pos]
            prob += (
                pulp.lpSum(player_vars[row["name"]] for _, row in pos_players.iterrows())
                == count
            ), f"{pos}_count"

        # Total roster size constraint
        total_starters = sum(slots.values())
        prob += (
            pulp.lpSum(player_vars[name] for name in player_vars) == total_starters
        ), "total_starters"

        # Salary cap constraint (DFS mode)
        if salary_cap and "salary" in df.columns:
            prob += (
                pulp.lpSum(
                    player_vars[row["name"]] * row["salary"]
                    for _, row in df.iterrows()
                ) <= salary_cap
            ), "salary_cap"

        # Solve
        prob.solve(pulp.PULP_CBC_CMD(msg=0))

        # Extract results
        starters = [
            name for name, var in player_vars.items()
            if pulp.value(var) == 1
        ]

        return {
            "starters": df[df["name"].isin(starters)].to_dict("records"),
            "bench": df[~df["name"].isin(starters)].to_dict("records"),
            "total_projected": round(df[df["name"].isin(starters)]["adj_points"].sum(), 1),
            "status": pulp.LpStatus[prob.status],
        }

    def format_lineup_output(self, result: dict) -> str:
        """Format lineup as readable string."""
        if result["status"] != "Optimal":
            return f"⚠️ Could not find optimal lineup: {result['status']}"

        lines = ["🏈 **Optimal Lineup**\n"]
        for player in sorted(result["starters"], key=lambda x: x.get("position", "")):
            risk_indicator = "" if player.get("injury_risk", 1.0) >= 0.9 else " ⚠️"
            lines.append(
                f"{player['position']:3s}  {player['name']:<25s}  "
                f"{player['adj_points']:.1f} pts{risk_indicator}"
            )

        lines.append(f"\n📊 Total Projected: **{result['total_projected']} pts**")
        lines.append("\n**Bench:**")
        for player in result["bench"][:5]:
            lines.append(f"  • {player['name']} ({player['position']}) - {player['adj_points']:.1f} pts")

        return "\n".join(lines)
