"""
agents/fantasy_agent.py - Main AI orchestrator (LangChain 1.2.x / LangGraph compatible)
"""
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from loguru import logger
from utils.config import get_settings

settings = get_settings()


# ─────────────────────────────────────────────
# Tools
# Each function decorated with @tool becomes something the LLM can call by name.
# The docstring is literally what the LLM reads to decide when to use the tool.
# ─────────────────────────────────────────────

@tool
def get_player_projection(player_name: str, week: int) -> str:
    """Get a fantasy point projection for a player based on real NFL stats."""
    from data.stats import get_player_stats
    stats = get_player_stats(player_name)

    if not stats["found"]:
        return f"Could not find stats for {player_name}. Check the spelling."

    games = "\n".join(
        f"  Week {g['week']}: {round(g['fp'], 1)} pts"
        for g in stats["recent_games"]
    )

    return f"""
📊 {player_name} - Week {week} Projection ({stats['position']})
Projected Points: {stats['projected_points']} (4-week avg)
Floor: {stats['floor']}  |  Ceiling: {stats['ceiling']}

Recent Games:
{games}
"""
@tool
def research_player_news(player_name: str) -> str:
    """Research recent news and press conference quotes about a player."""
    import requests
    from utils.config import get_settings
    settings = get_settings()

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": f"{player_name} NFL fantasy football",
        "apiKey": settings.newsapi_key,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 5,
    }
    resp = requests.get(url, params=params)
    articles = resp.json().get("articles", [])

    if not articles:
        return f"No recent news found for {player_name}."

    lines = [f"📰 {player_name} - Recent News\n"]
    for a in articles:
        lines.append(f"• [{a['source']['name']}] {a['title']}")

    return "\n".join(lines)

@tool
def analyze_trade(giving_players: str, receiving_players: str) -> str:
    """
    Analyze a trade offer using real ML projections for every player involved.
    Pass giving_players and receiving_players as comma-separated name strings.
    """
    from data.stats import get_player_stats

    def summarize(name: str) -> tuple[str, float, str]:
        """Returns (formatted line, projected_pts, position)."""
        stats = get_player_stats(name)
        if not stats["found"]:
            return f"  {name}: not found", 0.0, "?"
        line = (
            f"  {stats['player']} ({stats['position']}, {stats['team']}) - "
            f"{stats['projected_points']} pts/wk | "
            f"Floor {stats['floor']} / Ceiling {stats['ceiling']} | "
            f"Confidence: {stats['confidence']}"
        )
        return line, stats["projected_points"], stats["position"]

    giving_names = [p.strip() for p in giving_players.split(",")]
    receiving_names = [p.strip() for p in receiving_players.split(",")]

    giving_results   = [summarize(p) for p in giving_names]
    receiving_results = [summarize(p) for p in receiving_names]

    giving_pts   = sum(r[1] for r in giving_results)
    receiving_pts = sum(r[1] for r in receiving_results)
    giving_pos   = [r[2] for r in giving_results]
    receiving_pos = [r[2] for r in receiving_results]
    diff = receiving_pts - giving_pts

    value_line = (
        f"Net projected value: {'+' if diff >= 0 else ''}{diff:.1f} pts/wk "
        f"({'receiving side wins' if diff >= 0 else 'giving side wins on raw points'})"
    )

    return f"""🔄 Trade Data

Trading Away:
{chr(10).join(r[0] for r in giving_results)}

Receiving:
{chr(10).join(r[0] for r in receiving_results)}

{value_line}
Positions leaving roster: {', '.join(giving_pos)}
Positions arriving:       {', '.join(receiving_pos)}
"""

@tool
def get_sleeper_rosters(league_id: str) -> str:
    """
    Fetch all team rosters from a Sleeper fantasy football league.
    Use this when the user provides a Sleeper league ID, asks who owns a specific player,
    wants trade targets from their actual league, or needs to know what players are available.
    The league_id is the long numeric string visible in the Sleeper app URL.
    """
    from data.sleeper import get_league_rosters

    try:
        data = get_league_rosters(league_id)
    except Exception as e:
        return f"Could not fetch Sleeper league {league_id}: {e}. Make sure the ID is correct."

    lines = [f"📋 {data['league_name']} ({data['season']}) - {len(data['teams'])} Teams\n"]

    for team in data["teams"]:
        # Show the team name and @username on the same header line
        header = team["team_name"]
        if team["display_name"] and team["display_name"] != team["team_name"]:
            header += f" (@{team['display_name']})"
        lines.append(f"\n🏈 {header}")

        for p in team["players"]:
            # ★ marks starters so the AI knows who's in the active lineup this week
            marker = "★" if p["is_starter"] else " "
            lines.append(f"  {marker} {p['position']:<4} {p['name']} ({p['team']})")

    lines.append("\n(★ = currently in active Sleeper lineup)")
    return "\n".join(lines)


@tool
def optimize_lineup(roster: str, week: int) -> str:
    """
    Suggest an optimal lineup. Pass roster as a comma-separated string
    e.g. 'Josh Allen, CeeDee Lamb, Travis Kelce'.
    """
    # Placeholder - real optimization (using PuLP integer programming) not implemented yet
    players = [p.strip() for p in roster.split(",")]
    return f"""
🏈 Lineup Suggestion - Week {week}
Roster: {', '.join(players)}

Connect ml/performance_model.py and tools/roster_optimizer.py for real LP-optimized lineups.
"""


# ─────────────────────────────────────────────
# Build the Agent
# ─────────────────────────────────────────────

# This is what the LLM reads at the start of every conversation.
# It defines the AI's personality, rules, and how to handle edge cases.
SYSTEM_PROMPT = """You are a sharp, opinionated fantasy football analyst. You give strong, \
data-backed verdicts - not hedged non-answers.

CURRENT SEASON: 2025 NFL season. Do NOT refer to any player as a "rookie" or characterize \
their experience level, injury history, or current role from your training data - that \
information is stale. All player assessments must come exclusively from what the tools return.

RULES:
1. Always call get_player_projection before advising on any player or trade. Never describe \
a player's situation from memory - use the numbers the tool returns.
2. For trades: end with a clear "MAKE THIS TRADE" or "DO NOT MAKE THIS TRADE" verdict.
3. Factor in positional scarcity. Losing a starting QB when the backup is unproven is almost \
always a losing move - call it out explicitly.
4. If the numbers show a trade is lopsided, say so directly. Do not soften it.
5. Never say "consider whether..." - give a direct answer with the reasoning behind it.
6. Account for roster context the user provides (backup players, positional depth, team needs).
7. Back every verdict with specific projected points from the tools.
8. If the tools show a player projecting well, do not contradict that with stale training \
data (e.g. calling them injury-prone or inexperienced). Trust the numbers.

SLEEPER LEAGUE INTEGRATION:
- If the user's message includes a Sleeper league ID, call get_sleeper_rosters with it first.
- Use the roster data to identify trade targets, waiver wire pickups, or lineup decisions.
- When analyzing trades, reference who owns the players involved and their roster context.

PLAYER NAME HANDLING:
- If a name lookup fails, retry with common variations: drop punctuation, try last name only, \
try first name only. Do not give up after one failed lookup."""


def build_fantasy_agent():
    llm = ChatOpenAI(
        model=settings.openai_model,
        temperature=0,          # 0 = deterministic; no creativity, just facts
        api_key=settings.openai_api_key,
    )

    tools = [
        get_player_projection,
        research_player_news,
        analyze_trade,
        optimize_lineup,
        get_sleeper_rosters,   # fetch real league rosters by Sleeper league ID
    ]

    # create_react_agent implements the ReAct loop: Reason → call a Tool → Observe result → repeat
    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=SYSTEM_PROMPT,
    )
    return agent


def run_agent(agent, user_input: str, chat_history: list = None) -> str:
    """Run the agent and return the final text response."""
    messages = []
    if chat_history:
        messages.extend(chat_history)
    messages.append(HumanMessage(content=user_input))

    try:
        # .invoke() runs the full ReAct loop until the LLM stops calling tools
        result = agent.invoke({"messages": messages})
        return result["messages"][-1].content
    except Exception as e:
        logger.error(f"Agent error: {e}")
        return f"Error: {e}"
    

r"""
frontend:
cd C:\Users\nihal\fantasy-optimizer\frontend
npm run dev

backend:
cd C:\Users\nihal\fantasy-optimizer\backend
venv\Scripts\activate
uvicorn server:app --reload --port 8000
"""