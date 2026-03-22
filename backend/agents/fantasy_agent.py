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
    return f"""
🏥 {player_name} Injury Report
Status: Active (placeholder)
Practice: Full Participation
Note: Add your NEWSAPI_KEY to .env and connect InjuryTracker for real data.
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
    Analyze a trade offer. Pass giving_players and receiving_players as
    comma-separated strings e.g. 'CeeDee Lamb, Davante Adams'.
    """
    giving = [p.strip() for p in giving_players.split(",")]
    receiving = [p.strip() for p in receiving_players.split(",")]
    return f"""
🔄 Trade Analysis
Trading Away: {', '.join(giving)}
Receiving: {', '.join(receiving)}

Placeholder analysis - connect the ML model for real projected values.
General advice: Consider remaining schedule, injury history, and positional need.
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

SYSTEM_PROMPT = """You are an expert fantasy football AI analyst. You help managers make 
the best decisions for their team using data, projections, and news analysis.

You have tools to:
- Project player fantasy point output
- Check injury status and practice participation
- Research news and press conference quotes
- Analyze trade offers
- Optimize lineups

Always check injury status before recommending a player to start.
Be direct with recommendations and cite specific reasons."""


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