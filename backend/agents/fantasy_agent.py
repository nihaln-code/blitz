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
def check_injury_status(player_name: str) -> str:
    """Check a player's current injury status and practice participation."""
    from data.stats import get_injury_status
    status = get_injury_status(player_name)
    return f"🏥 {player_name} injury status: {status}"

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
        inj = stats["injury_status"]
        inj_note = f" ⚠️ {inj}" if inj not in ("Healthy", "Active", "—", "") else ""
        line = (
            f"  {stats['player']} ({stats['position']}, {stats['team']}) — "
            f"{stats['projected_points']} pts/wk | "
            f"Floor {stats['floor']} / Ceiling {stats['ceiling']} | "
            f"Confidence: {stats['confidence']}{inj_note}"
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
def optimize_lineup(roster: str, week: int) -> str:
    """
    Suggest an optimal lineup. Pass roster as a comma-separated string
    e.g. 'Josh Allen, CeeDee Lamb, Travis Kelce'.
    """
    players = [p.strip() for p in roster.split(",")]
    return f"""
🏈 Lineup Suggestion - Week {week}
Roster: {', '.join(players)}

Connect ml/performance_model.py and tools/roster_optimizer.py for real LP-optimized lineups.
"""


# ─────────────────────────────────────────────
# Build the Agent
# ─────────────────────────────────────────────

SYSTEM_PROMPT = """You are a sharp, opinionated fantasy football analyst. You give strong, \
data-backed verdicts — not hedged non-answers.

RULES:
1. Always pull real projection data before advising on any player or trade.
2. For trades: end with a clear "MAKE THIS TRADE" or "DO NOT MAKE THIS TRADE" verdict.
3. Factor in positional scarcity. Losing a starting QB when the backup is unproven is almost \
always a losing move — call it out explicitly.
4. If the numbers show a trade is lopsided, say so directly. Do not soften it.
5. Never say "consider whether..." — give a direct answer with the reasoning behind it.
6. Account for roster context the user provides (backup players, positional depth, team needs).
7. Back every verdict with specific projected points from the tools.

PLAYER NAME HANDLING:
- If a name lookup fails, retry with common variations: drop punctuation, try last name only, \
try first name only. Do not give up after one failed lookup."""


def build_fantasy_agent():
    llm = ChatOpenAI(
        model=settings.openai_model,
        temperature=0,
        api_key=settings.openai_api_key,
    )

    tools = [
        get_player_projection,
        check_injury_status,
        research_player_news,
        analyze_trade,
        optimize_lineup,
    ]

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