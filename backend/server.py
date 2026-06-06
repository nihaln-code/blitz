"""
server.py - FastAPI server exposing the fantasy agent as a REST API
Local dev: uvicorn server:app --reload --port 8000
HuggingFace: uvicorn server:app --host 0.0.0.0 --port 7860
"""
from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from agents.fantasy_agent import build_fantasy_agent, run_agent
from langchain_core.messages import HumanMessage, AIMessage
from data.stats import get_player_stats, search_players
import requests as http_requests
import os

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
@limiter.limit("10/minute")
async def chat(request: Request, req: ChatRequest):
    history = []
    for msg in req.history:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        else:
            history.append(AIMessage(content=msg["content"]))
    response = run_agent(agent, req.message, history)
    return ChatResponse(response=response)


@api_router.get("/search")
@limiter.limit("60/minute")
async def search(request: Request, q: str):
    if not q or len(q) < 2:
        return []
    return search_players(q)


@api_router.get("/player/{name}")
@limiter.limit("30/minute")
async def player(request: Request, name: str):
    return get_player_stats(name)


@api_router.get("/news/{player_name}")
@limiter.limit("20/minute")
async def get_news(request: Request, player_name: str):
    from utils.config import get_settings
    settings = get_settings()

    if not settings.newsapi_key:
        return []

    import re as _re

    BUY_KEYWORDS = [
        r"\bstarter\b", r"\bhealthy\b", r"\bfull practice\b", r"\bmore involved\b",
        r"\bcleared\b", r"\bexplosive\b", r"\bcontract extension\b", r"\breturns to lineup\b",
        r"\bback in lineup\b", r"\bno injury\b", r"\bfull participant\b",
    ]
    SELL_KEYWORDS = [
        r"\bquestionable\b", r"\bdoubtful\b", r"\bruled out\b", r"\binjured reserve\b",
        r"\bday-to-day\b", r"\bbenched\b", r"\blimited practice\b", r"\bdid not practice\b",
        r"\bscratch\b", r"\bout for season\b", r"\bmissed practice\b",
    ]

    try:
        # Expand abbreviated names (e.g. "K.Fairbairn" → "Ka'Imi Fairbairn" not available,
        # so fall back to last name only for better search coverage)
        search_name = player_name
        if _re.match(r"^[A-Za-z]\.[A-Za-z]", player_name):
            search_name = player_name.split(".", 1)[-1].strip()

        resp = http_requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": f'"{search_name}" NFL',
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
            buy_hits  = sum(1 for kw in BUY_KEYWORDS  if _re.search(kw, text))
            sell_hits = sum(1 for kw in SELL_KEYWORDS if _re.search(kw, text))
            if sell_hits > buy_hits:
                signal = "sell"
            elif buy_hits > 0:
                signal = "buy"
            else:
                signal = "hold"
            results.append({
                "source": a.get("source", {}).get("name", "Unknown"),
                "title": title,
                "url": a.get("url", ""),
                "publishedAt": a.get("publishedAt", ""),
                "signal": signal,
            })

        # ── AI overall signal ──────────────────────────────────────────────────
        overall_signal = "hold"
        signal_reason  = ""
        if settings.openai_api_key and results:
            try:
                from openai import OpenAI as _OAI
                import json as _json
                stats = get_player_stats(player_name)
                headlines = "\n".join(f"- {r['title']}" for r in results[:5])
                usage_line = ""
                if stats.get("found") and stats.get("usage_label"):
                    usage_line = (
                        f"Usage ({stats['usage_label']}): "
                        f"{stats['usage_recent']} last 4 games vs "
                        f"{stats['usage_season']} season avg "
                        f"({'+' if stats['usage_trend'] >= 0 else ''}{stats['usage_trend']})"
                    )
                depth_line = f"Depth Chart: {stats['depth_chart']}" if stats.get("depth_chart") else ""
                prompt = f"""You are a fantasy football analyst. Give a fantasy buy/sell/hold signal for {player_name}.

Position: {stats.get('position','?')} | Team: {stats.get('team','?')}
ML Projection: {stats.get('projected_points','?')} pts ({'+' if (stats.get('trend') or 0) >= 0 else ''}{stats.get('trend','?')} vs season avg) | Confidence: {stats.get('confidence','?')}
{depth_line}
{usage_line}

Recent news:
{headlines}

Reply with ONLY valid JSON: {{"signal":"buy|hold|sell","reason":"one sentence under 12 words"}}"""

                ai_resp = _OAI(api_key=settings.openai_api_key).chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=60,
                    temperature=0,
                )
                parsed = _json.loads(ai_resp.choices[0].message.content.strip())
                overall_signal = parsed.get("signal", "hold")
                signal_reason  = parsed.get("reason", "")
            except Exception:
                pass  # fall back to hold

        return {"articles": results, "overall_signal": overall_signal, "signal_reason": signal_reason}
    except Exception:
        return {"articles": [], "overall_signal": "hold", "signal_reason": ""}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api_router)


# ── Serve React frontend (must be LAST) ─────────────────────────────────────
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=f"{static_dir}/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(
            f"{static_dir}/index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )