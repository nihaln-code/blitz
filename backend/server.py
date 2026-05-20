"""
server.py - FastAPI server exposing the fantasy agent as a REST API
Local dev: uvicorn server:app --reload --port 8000
HuggingFace: uvicorn server:app --host 0.0.0.0 --port 7860
"""
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from agents.fantasy_agent import build_fantasy_agent, run_agent
from langchain_core.messages import HumanMessage, AIMessage
from data.stats import get_player_stats, search_players
import requests as http_requests
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Covers HuggingFace + all local dev origins
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Building fantasy agent...")
agent = build_fantasy_agent()
print("Agent ready.")


# ── API Router with /api prefix (used by frontend on HuggingFace) ───────────
api_router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    response: str


@api_router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    history = []
    for msg in req.history:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        else:
            history.append(AIMessage(content=msg["content"]))
    response = run_agent(agent, req.message, history)
    return ChatResponse(response=response)


@api_router.get("/search")
async def search(q: str):
    if not q or len(q) < 2:
        return []
    return search_players(q)


@api_router.get("/player/{name}")
async def player(name: str):
    return get_player_stats(name)


@api_router.get("/news/{player_name}")
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


@api_router.get("/health")
async def health():
    return {"status": "ok"}


# Also keep routes without /api prefix for local dev (port 8000)
app.include_router(api_router)
app.include_router(APIRouter(routes=api_router.routes))  # mounts at root too


# ── Serve React frontend (must be LAST) ─────────────────────────────────────
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=f"{static_dir}/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(f"{static_dir}/index.html")