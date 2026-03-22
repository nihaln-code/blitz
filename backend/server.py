"""
server.py - FastAPI server exposing the fantasy agent as a REST API
Run with: uvicorn server:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents.fantasy_agent import build_fantasy_agent, run_agent
from langchain_core.messages import HumanMessage, AIMessage
from data.stats import get_player_stats, search_players
import requests as http_requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://192.168.1.186:5173", "http://blitz.nimmagadda.com:5173","http://blitzfantasy.duckdns.org"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Building fantasy agent...")
agent = build_fantasy_agent()
print("Agent ready.")


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    response: str


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    history = []
    for msg in req.history:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        else:
            history.append(AIMessage(content=msg["content"]))
    response = run_agent(agent, req.message, history)
    return ChatResponse(response=response)


@app.get("/search")
async def search(q: str):
    if not q or len(q) < 2:
        return []
    return search_players(q)


@app.get("/player/{name}")
async def player(name: str):
    return get_player_stats(name)


@app.get("/news/{player_name}")
async def get_news(player_name: str):
    from utils.config import get_settings
    settings = get_settings()

    if not settings.newsapi_key:
        return []

    BUY_KEYWORDS = ["starter", "healthy", "full practice", "more involved", "featured",
                    "cleared", "active", "explosive", "extension", "return"]
    SELL_KEYWORDS = ["limited", "questionable", "doubtful", "out", "ir", "injured",
                     "day-to-day", "reduced", "benched", "cut", "scratch"]

    try:
        resp = http_requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": f'"{player_name}" NFL',
                "apiKey": settings.newsapi_key,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 6,
            },
            timeout=5,
        )
        results = []
        for a in resp.json().get("articles", []):
            title = a.get("title", "") or ""
            text = (title + " " + (a.get("description", "") or "")).lower()
            signal = "hold"
            for kw in BUY_KEYWORDS:
                if kw in text:
                    signal = "buy"
                    break
            for kw in SELL_KEYWORDS:
                if kw in text:
                    signal = "sell"
                    break
            results.append({
                "source": a.get("source", {}).get("name", "Unknown"),
                "title": title,
                "url": a.get("url", ""),
                "publishedAt": a.get("publishedAt", ""),
                "signal": signal,
            })
        return results
    except Exception:
        return []


@app.get("/health")
async def health():
    return {"status": "ok"}