# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Blitz** is an AI-powered fantasy football optimizer that provides:
- Weekly player point projections (XGBoost models)
- AI chat agent (OpenAI GPT-4o-mini via LangChain/LangGraph)
- Real NFL stats and injury data (nfl_data_py, ESPN API)
- Player news with buy/sell signals (NewsAPI)

Architecture: React frontend + FastAPI backend, deployed on HuggingFace Spaces (port 7860) and GitHub (origin).

## Repo Structure

```
blitz/
├── frontend/              # React 19 + Vite
│   ├── src/
│   │   ├── App.jsx       # Main app (chat, search, player stats, news)
│   │   └── firebase.js   # Firebase auth & roster persistence
│   ├── vite.config.js
│   └── package.json
├── backend/               # FastAPI + Python 3.11
│   ├── server.py         # FastAPI app, API routes
│   ├── main.py           # Interactive CLI for testing
│   ├── agents/fantasy_agent.py      # LangChain agent, tools
│   ├── data/stats.py     # get_player_stats(), search_players()
│   ├── ml/model.py       # XGBoost models (train, predict, SHAP)
│   ├── utils/config.py   # Settings from .env
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env              # [user must create]
├── Dockerfile            # Root multi-stage (frontend + backend)
├── docker-compose.yml    # Services: backend, frontend, nginx
└── README.md
```

## Build & Run Commands

### Backend

**Setup:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
source venv/bin/activate  # Unix
pip install -r requirements.txt
```

**Dev server (hot reload):**
```bash
uvicorn server:app --reload --port 8000
```

**Interactive CLI (test agent):**
```bash
python main.py
```

### Frontend

**Setup:**
```bash
cd frontend
npm install
```

**Dev server:**
```bash
npm run dev
# http://localhost:5173
```

**Build:**
```bash
npm run build
# Output: dist/
```

**Lint:**
```bash
npm run lint
```

### Docker

**Local (docker-compose):**
```bash
docker-compose up --build
```

**HuggingFace (single container, port 7860):**
```bash
docker build -t blitz:latest .
docker run -p 7860:7860 -e OPENAI_API_KEY=... -e NEWSAPI_KEY=... blitz:latest
```

## Architecture & Data Flow

### API Endpoints

All under `/api/` prefix:

- `POST /api/chat` → `{message, history}` → `{response}`
- `GET /api/search?q=<name>` → player array
- `GET /api/player/<name>` → player stats with ML projection
- `GET /api/news/<name>` → news array with buy/sell/hold signals
- `GET /api/health` → health check

### Frontend URL Detection

`App.jsx` auto-detects API URL:
1. Local dev (port 5173): `http://localhost:8000`
2. HuggingFace iframe: `https://nihalnimmagadda-blitz.hf.space/api`
3. Self-hosted: `<protocol>://<host>/api`

### Data Pipeline: NFL Stats → ML → API → UI

1. **Load** (`data/stats.py`): nflreadpy loads 2022–2025 weekly stats into `_weekly` DataFrame
2. **Train** (`ml/model.py`):
   - 4 XGBoost models (QB, RB, WR, TE)
   - Features: rolling averages (2wk, 4wk), std, TD rate, opponent defense rank, season baseline, position-specific volume stats
   - Split: training on all seasons except most recent, validation on most recent complete season
   - Three models per position: main (regression), floor (quantile 10th), ceiling (quantile 90th)
   - Saves to `backend/ml/model.pkl`
3. **Opponent Defense Ranking**:
   - For each (season, week, team, position): avg FP allowed to that position in prior 4 weeks
   - Used as a feature in predictions
4. **Predict** (`data/stats.py` → `get_player_stats`):
   - XGBoost outputs: projected points, floor, ceiling
   - SHAP explains top 5 feature contributions
   - Confidence: HIGH (CV < 0.25), MEDIUM (CV < 0.5), LOW (CV >= 0.5)
5. **Injury Status** (`get_injury_status`):
   - Queries nfl_data_py injury report (2025 season)
   - Returns report_status or practice_status
6. **Chat** (`agents/fantasy_agent.py` → `run_agent`):
   - LangGraph ReAct agent with tools
   - Tools: get_player_projection, check_injury_status, research_player_news, analyze_trade, optimize_lineup
   - OpenAI GPT-4o-mini synthesizes response
7. **UI** (`App.jsx`):
   - Chat interface, player search cards, recent games, news feed
   - Firebase anonymous auth + Firestore roster sync

### Configuration

**Backend .env (required):**
```
OPENAI_API_KEY=sk-...                  # Required
OPENAI_MODEL=gpt-4o                    # Optional
NEWSAPI_KEY=...                        # Optional
ESPN_LEAGUE_ID=...                     # Optional
REDIS_URL=redis://localhost:6379       # Optional
CACHE_TTL_SECONDS=3600                 # Optional
```

**Frontend:**
- Firebase config in `firebase.js` (implicit)
- Custom domains in `vite.config.js`

## Key Implementation Details

### ML Model

**Training** (`ml/model.py` → `train`):
- Minimum 5 games per player, minimum 4 training rows per position
- Feature engineering uses PRIOR weeks only (no data leakage)
- Hyperparams: n_estimators=300, max_depth=4, learning_rate=0.05
- Three models: main (regression), floor (quantile 0.10), ceiling (quantile 0.90)

**Prediction** (`ml/model.py` → `predict`):
- SHAP TreeExplainer for feature attribution
- Top 5 factors by absolute impact
- Confidence from CV (coefficient of variation)

### Agent Tools

All tools are LangChain `@tool` decorated:
- `get_player_projection`: Returns formatted projection with floor/ceiling
- `check_injury_status`: Placeholder (use official NFL API)
- `research_player_news`: Calls NewsAPI, returns top 5 articles
- `analyze_trade`: Placeholder (compare player values)
- `optimize_lineup`: Placeholder (PuLP installed but not used)

### Frontend

- **Auth**: Firebase anonymous auth
- **Storage**: Firestore for roster persistence
- **Responsive**: Mobile detection, layout adjusts at width < 768px
- **Data**: Always fetches fresh (localStorage removed, see commit de7d035)

### Deployment

**HuggingFace Spaces:**
- Single Dockerfile, multi-stage build
- Frontend dist → `backend/static/`
- FastAPI serves React assets + API
- CORS enabled (allow_origins=["*"])
- Port 7860 mandatory

**Version Control:**
- `origin`: GitHub
- `hf`: HuggingFace Spaces

## Development Workflow

### Add Agent Tool

1. Define `@tool` function in `backend/agents/fantasy_agent.py`
2. Docstring becomes LLM tool description
3. Add to `tools` list in `build_fantasy_agent()`
4. Test: `python backend/main.py`

### Retrain ML Model

1. Modify `ml/model.py` (features, hyperparams)
2. Delete `backend/ml/model.pkl`
3. Start backend; auto-trains on startup (check stdout)

### Add API Endpoint

1. Define handler in `backend/server.py`
2. Call from frontend via `fetch(API + "/endpoint")`

### Local Test

```bash
# Terminal 1
cd backend && uvicorn server:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev

# Terminal 3
curl http://localhost:8000/api/health
curl "http://localhost:8000/api/search?q=josh%20allen"
```

## Known Limitations

- Trade analysis: placeholder (not connected to ML)
- Lineup optimizer: placeholder (PuLP installed but unused)
- ESPN integration: config present but unused
- Injury check: placeholder (NewsAPI keywords, not official API)
- Redis caching: config present but not integrated
