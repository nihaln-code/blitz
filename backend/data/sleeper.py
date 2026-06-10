"""
data/sleeper.py - Sleeper fantasy football API integration.

Sleeper provides a free, no-auth REST API. The main challenge is that Sleeper
identifies players by numeric IDs (e.g. "4046") rather than names. We solve this
by fetching the full NFL player database once and caching it in memory for 24 hours
to avoid re-downloading ~3MB on every request.

Flow:
  1. get_league_rosters(league_id) fetches rosters + users from Sleeper
  2. Each roster contains a list of player IDs
  3. We look each ID up in the cached player DB to get name, position, team
  4. We return a structured dict the API endpoint and agent tool both consume
"""
import requests
import time
from loguru import logger

SLEEPER_BASE = "https://api.sleeper.app/v1"

# In-memory cache for the player DB. Keyed so we can check staleness.
# We use a dict rather than lru_cache so we can manually expire after 24h.
_player_cache: dict = {"data": None, "fetched_at": 0.0}
_PLAYER_TTL = 86400  # 24 hours - the player DB rarely changes mid-season

# Display order for sorting players within a team card (starters first, then by position)
_POS_ORDER = {"QB": 0, "RB": 1, "WR": 2, "TE": 3, "K": 4, "DEF": 5}


def get_all_players() -> dict:
    """
    Fetch (or return cached) the complete Sleeper NFL player database.

    Returns a dict mapping player_id (str) -> player info dict, e.g.:
      {
        "4046": {"full_name": "Josh Allen", "position": "QB", "team": "BUF", ...},
        ...
      }

    The response is ~3MB so we cache it for 24 hours. Call this before any
    roster lookup that needs to translate IDs to names.
    """
    now = time.time()

    # Return the cached version if it's still fresh
    if _player_cache["data"] and (now - _player_cache["fetched_at"]) < _PLAYER_TTL:
        return _player_cache["data"]

    logger.info("Fetching Sleeper player database (~3MB, will be cached for 24h)...")
    resp = requests.get(f"{SLEEPER_BASE}/players/nfl", timeout=30)
    resp.raise_for_status()

    _player_cache["data"] = resp.json()
    _player_cache["fetched_at"] = now
    logger.info(f"Sleeper player DB cached: {len(_player_cache['data'])} players.")
    return _player_cache["data"]


def get_league_rosters(league_id: str) -> dict:
    """
    Fetch all rosters for a Sleeper league and return them with human-readable player info.

    Makes 3 API calls:
      - /league/{id}/rosters   → player IDs per team + starter slot info
      - /league/{id}/users     → display names and custom team names per owner
      - /league/{id}           → league name and season year

    Then cross-references player IDs against the cached player DB to resolve names.

    Args:
        league_id: The Sleeper league ID (long numeric string from the app URL).

    Returns:
        {
          "league_name": str,
          "season": str,
          "teams": [
            {
              "roster_id": int,
              "team_name": str,       # user's custom team name or their username
              "display_name": str,    # Sleeper @username
              "players": [
                {
                  "player_id": str,
                  "name": str,
                  "position": str,
                  "team": str,        # NFL team abbreviation, or "FA" if free agent
                  "is_starter": bool, # true if slotted in the active lineup this week
                }
              ]
            }
          ]
        }

    Raises:
        requests.HTTPError: if any Sleeper API call fails (e.g. bad league ID returns 404).
    """
    # ── 1. Fetch the three Sleeper endpoints ──────────────────────────────────
    rosters_resp = requests.get(f"{SLEEPER_BASE}/league/{league_id}/rosters", timeout=10)
    rosters_resp.raise_for_status()
    rosters: list = rosters_resp.json()

    users_resp = requests.get(f"{SLEEPER_BASE}/league/{league_id}/users", timeout=10)
    users_resp.raise_for_status()
    # Build O(1) lookup: user_id → user object
    users: dict = {u["user_id"]: u for u in users_resp.json()}

    league_resp = requests.get(f"{SLEEPER_BASE}/league/{league_id}", timeout=10)
    league_resp.raise_for_status()
    league_info: dict = league_resp.json()

    # ── 2. Load the player ID → name mapping ─────────────────────────────────
    all_players = get_all_players()

    # ── 3. Build the team list ────────────────────────────────────────────────
    teams = []
    for roster in rosters:
        owner_id = roster.get("owner_id")
        user = users.get(owner_id or "", {})

        # Prefer the user's custom team name; fall back to their @username
        team_name = (
            (user.get("metadata") or {}).get("team_name")
            or user.get("display_name")
            or f"Team {roster['roster_id']}"
        )

        player_ids: list = roster.get("players") or []

        # "starters" is the list of IDs currently in active slots this week.
        # Sleeper uses "0" as a placeholder for empty slots - we skip those.
        starter_ids: set = {
            pid for pid in (roster.get("starters") or []) if pid != "0"
        }

        players = []
        for pid in player_ids:
            p = all_players.get(str(pid), {})
            if not p:
                # Unknown or retired player - Sleeper sometimes keeps old IDs on rosters
                continue

            # Sleeper stores full_name directly, but also has first_name/last_name
            # as fallbacks in case full_name is missing (rare for older records)
            full_name = (
                p.get("full_name")
                or f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
                or str(pid)
            )

            players.append({
                "player_id": str(pid),
                "name": full_name,
                "position": p.get("position", "?"),
                "team": p.get("team") or "FA",   # "FA" = free agent / no NFL team
                "is_starter": str(pid) in starter_ids,
            })

        # Sort: starters first, then bench. Within each group: by position slot order,
        # then alphabetically. This makes the roster card easy to scan.
        players.sort(key=lambda pl: (
            0 if pl["is_starter"] else 1,
            _POS_ORDER.get(pl["position"], 99),
            pl["name"],
        ))

        teams.append({
            "roster_id": roster["roster_id"],
            "owner_id": owner_id,
            "team_name": team_name,
            "display_name": user.get("display_name", ""),
            "players": players,
        })

    # Sort teams by roster_id for a consistent, predictable order
    teams.sort(key=lambda t: t["roster_id"])

    return {
        "league_name": league_info.get("name", "Sleeper League"),
        "season": league_info.get("season", ""),
        "teams": teams,
    }
