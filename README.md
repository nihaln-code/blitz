#  Blitz - AI Fantasy Football Assistant

> AI-powered projections, explainable predictions, and a natural language agent to help fantasy managers make smarter decisions every week.

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![XGBoost](https://img.shields.io/badge/XGBoost-FF6600?style=for-the-badge&logo=xgboost&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace_Spaces-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)

**[ Live Demo](https://huggingface.co/spaces/NihalNimmagadda/blitz)** <!-- update this link -->

---

##  Demo

<img width="1914" height="911" alt="image" src="https://github.com/user-attachments/assets/d62bab71-dd67-4716-bc2f-1e6f846054d8" />
<img width="1919" height="914" alt="image" src="https://github.com/user-attachments/assets/15791471-9aa3-4c69-bd4c-4018f9af9318" />


---

##  What It Does

Blitz is a full-stack AI assistant for fantasy football managers. It combines position-specific machine learning models with a conversational AI agent to give you data-driven answers to the questions that actually matter - who to start, who to trade, and who to pick up.

---

##  Features

###  Weekly Player Projections
Position-specific XGBoost models (one each for QB, RB, WR, TE) trained on 2022â€“2025 NFL data output a **floor, ceiling, and confidence score** for every relevant player each week.

###  Explainable Predictions
Each projection surfaces the **top 5 SHAP factors** driving the prediction - so you can see *why* a player is projected high or low, not just the number.

###  Natural Language AI Agent
A **LangGraph ReAct agent** powered by GPT-4o answers natural language questions about trades, injuries, and lineup decisions. Ask it anything: *"Should I trade Jaylen Waddle for Amon-Ra St. Brown?"*

###  Real-Time Injury & News Signals
Live injury status via the ESPN API and player news via NewsAPI are surfaced as **buy / sell / hold signals**, updated continuously throughout the week.

###  Rate Limiting
API endpoints are rate-limited to protect against abuse and control costs on external API calls (OpenAI, NewsAPI).

---

##  Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      React 19 + Vite                    â”‚
â”‚              Firebase Auth + Roster Storage             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚ REST
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  FastAPI (Python)                       â”‚
â”‚         Serves both frontend + API (port 7860)         â”‚
â”‚                                                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚  XGBoost Models â”‚   â”‚   LangGraph ReAct Agent      â”‚ â”‚
â”‚  â”‚  QB / RB / WR   â”‚   â”‚   GPT-4o via LangChain       â”‚ â”‚
â”‚  â”‚  TE + SHAP      â”‚   â”‚                              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚           â”‚                           â”‚                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚  nfl_data_py Â· nflreadpy Â· ESPN API Â· NewsAPI      â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚
              Docker multi-stage build
                           â”‚
              HuggingFace Spaces (deployed)
```

---

##  Tech Stack

| Layer       | Technology                                              |
|-------------|----------------------------------------------------------|
| Frontend    | React 19, Vite, Firebase (auth + roster storage)        |
| Backend     | FastAPI, Python, uvicorn                                |
| ML Models   | XGBoost (QB/RB/WR/TE), SHAP for explainability          |
| AI Agent    | LangGraph ReAct agent, GPT-4o, LangChain                |
| Data        | nfl_data_py, nflreadpy, ESPN API, NewsAPI               |
| Deployment  | Docker multi-stage build, HuggingFace Spaces            |

---

##  Running Locally

### Prerequisites
- Python 3.10+
- Node.js v18+
- Docker (optional, for containerized run)
- OpenAI API key
- NewsAPI key
- Firebase project credentials

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in `/backend`:
```
OPENAI_API_KEY=your_key
NEWS_API_KEY=your_key
FIREBASE_CREDENTIALS=path/to/credentials.json
```

```bash
uvicorn main:app --reload --port 7860
```

### Frontend (dev mode)

```bash
cd frontend
npm install
npm run dev
```

### Docker (production build)

```bash
docker build -t blitz .
docker run -p 7860:7860 blitz
```

The multi-stage Dockerfile builds the React app and serves it statically through FastAPI - no separate frontend server needed in production.

---

##  ML Model Details

Four XGBoost models are trained independently for each skill position (QB, RB, WR, TE) on historical NFL data from 2022â€“2025 sourced via `nfl_data_py` and `nflreadpy`.

Each model outputs:
- **Floor**: 10th percentile projection
- **Ceiling**: 90th percentile projection
- **Confidence**: model certainty score

**SHAP (SHapley Additive exPlanations)** is used post-prediction to generate the top 5 features driving each player's projection, making every prediction human-readable and auditable.

---

##  What I Learned

This project pushed me across the full ML lifecycle, data ingestion, feature engineering, model training, evaluation, and serving predictions via a REST API. Integrating SHAP for explainability taught me how to make black-box models useful in a product context. Building the LangGraph ReAct agent required understanding tool-calling patterns and how to chain reasoning steps with real-time data lookups. Deploying with a Docker multi-stage build and managing two Git remotes (GitHub + HuggingFace) gave me practical experience with production deployment workflows. Deploying on a personal Ubuntu machine and exposing it via port-forwarding taught me real networking fundamentals(DNS, firewalls, TLS, etc)

---

##  Future Improvements

- Waiver wire ranker based on projected usage and opportunity share
- Head-to-head matchup win probability calculator
- Support for multiple fantasy scoring formats (PPR, half-PPR, standard)
- Model retraining pipeline triggered automatically each week
