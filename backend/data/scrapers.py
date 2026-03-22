"""
data/scrapers.py - Multi-source data ingestion pipeline

Pulls from:
- nfl_data_py (free, historical stats)
- ESPN Fantasy API
- Injury reports (NFL official)
- News/press conferences via NewsAPI
- Weather via Open-Meteo (free)
"""
import nfl_data_py as nfl
import pandas as pd
import requests
from datetime import datetime, timedelta
from loguru import logger
from utils.config import get_settings
from utils.cache import cached

settings = get_settings()


class NFLStatsIngester:
    """Pulls historical and current season stats using nfl_data_py (free)."""

    @cached(ttl=3600 * 6)  # Cache 6 hours
    def get_weekly_stats(self, seasons: list[int]) -> pd.DataFrame:
        """Get weekly player stats for given seasons."""
        logger.info(f"Fetching weekly stats for seasons: {seasons}")
        df = nfl.import_weekly_data(seasons)
        return self._clean_weekly_stats(df)

    @cached(ttl=3600 * 24)
    def get_schedules(self, seasons: list[int]) -> pd.DataFrame:
        """Get full schedule data including bye weeks."""
        return nfl.import_schedules(seasons)

    @cached(ttl=3600 * 6)
    def get_depth_charts(self) -> pd.DataFrame:
        """Current depth chart positions - crucial for identifying startable players."""
        current_year = datetime.now().year
        return nfl.import_depth_charts([current_year])

    @cached(ttl=3600 * 2)
    def get_snap_counts(self, seasons: list[int]) -> pd.DataFrame:
        """
        Snap count percentage is one of the best predictors of target/carry share.
        High snap % + improving role = buy-low candidate.
        """
        return nfl.import_snap_counts(seasons)

    @cached(ttl=3600 * 1)
    def get_injuries(self) -> pd.DataFrame:
        """Current injury report - updated multiple times per week."""
        return nfl.import_injuries([datetime.now().year])

    def _clean_weekly_stats(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardize and enrich raw stats."""
        df = df.dropna(subset=["player_id"])
        # Compute fantasy points (half-PPR by default, make configurable)
        df["fantasy_points_half_ppr"] = (
            df.get("passing_yards", 0) * 0.04
            + df.get("passing_tds", 0) * 4
            + df.get("rushing_yards", 0) * 0.1
            + df.get("rushing_tds", 0) * 6
            + df.get("receptions", 0) * 0.5
            + df.get("receiving_yards", 0) * 0.1
            + df.get("receiving_tds", 0) * 6
            - df.get("interceptions", 0) * 2
            - df.get("fumbles_lost", 0) * 2
        )
        return df


class InjuryTracker:
    """
    Monitors NFL injury reports with practice participation trends.
    
    Practice status progression matters:
    - DNP → Limited → Full = likely to play (buy)
    - Full → Limited → DNP = trending toward out (sell/drop)
    """
    
    PRACTICE_STATUS_SCORES = {
        "Full Participation": 1.0,
        "Limited Participation": 0.5,
        "Did Not Participate": 0.0,
        "Not Listed": 1.0,
    }

    def get_injury_risk_score(self, player_name: str) -> dict:
        """
        Returns an injury risk assessment with practice trend.
        Score: 0.0 (likely out) → 1.0 (fully healthy)
        """
        df = NFLStatsIngester().get_injuries()
        player_injuries = df[df["full_name"].str.contains(player_name, case=False, na=False)]

        if player_injuries.empty:
            return {"player": player_name, "risk_score": 1.0, "status": "Healthy", "details": "No injury listed"}

        latest = player_injuries.sort_values("report_date").iloc[-1]
        score = self.PRACTICE_STATUS_SCORES.get(latest.get("practice_status", "Not Listed"), 0.7)

        return {
            "player": player_name,
            "risk_score": score,
            "status": latest.get("report_status", "Unknown"),
            "injury_type": latest.get("injury_type", "Unknown"),
            "practice_status": latest.get("practice_status", "Unknown"),
            "report_date": str(latest.get("report_date", "")),
        }


class WeatherFetcher:
    """
    Fetches game-day weather using Open-Meteo (completely free, no API key).
    
    Conditions that HURT fantasy output:
    - Wind > 20 mph → reduces passing game significantly
    - Rain/Snow > moderate → reduces all scoring
    - Cold < 20°F → reduces overall scoring
    """

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    # Approximate stadium coordinates - extend this dict
    STADIUM_COORDS = {
        "Lambeau Field": (44.5013, -88.0622),
        "MetLife Stadium": (40.8135, -74.0745),
        "Soldier Field": (41.8623, -87.6167),
        "Arrowhead Stadium": (39.0489, -94.4839),
        "Highmark Stadium": (42.7738, -78.7870),
        "Empower Field": (39.7439, -105.0201),
        # Indoor stadiums - skip weather check
        "SoFi Stadium": None,
        "Allegiant Stadium": None,
        "Lucas Oil Stadium": None,
    }

    def get_game_weather(self, stadium: str, game_date: str) -> dict:
        """Get weather forecast for a specific game."""
        coords = self.STADIUM_COORDS.get(stadium)
        if coords is None:
            return {"stadium": stadium, "indoor": True, "impact": "none"}

        lat, lon = coords
        params = {
            "latitude": lat, "longitude": lon,
            "daily": "precipitation_sum,windspeed_10m_max,temperature_2m_min",
            "start_date": game_date, "end_date": game_date,
            "timezone": "America/New_York",
        }
        resp = requests.get(self.BASE_URL, params=params)
        data = resp.json().get("daily", {})

        wind = data.get("windspeed_10m_max", [0])[0] or 0
        precip = data.get("precipitation_sum", [0])[0] or 0
        temp = data.get("temperature_2m_min", [70])[0] or 70

        return {
            "stadium": stadium,
            "indoor": False,
            "wind_mph": wind * 0.621,     # km/h to mph
            "precipitation_in": precip * 0.0394,
            "temp_f": (temp * 9/5) + 32,
            "passing_game_penalty": self._calc_passing_penalty(wind, precip, temp),
            "impact": self._categorize_impact(wind, precip, temp),
        }

    def _calc_passing_penalty(self, wind_kmh: float, precip_mm: float, temp_c: float) -> float:
        """Returns a 0.0-1.0 multiplier for expected passing output. 1.0 = no impact."""
        penalty = 1.0
        wind_mph = wind_kmh * 0.621
        if wind_mph > 20: penalty -= 0.15
        if wind_mph > 30: penalty -= 0.15
        if precip_mm > 5: penalty -= 0.10
        temp_f = (temp_c * 9/5) + 32
        if temp_f < 20: penalty -= 0.10
        return max(0.5, penalty)

    def _categorize_impact(self, wind: float, precip: float, temp: float) -> str:
        penalty = self._calc_passing_penalty(wind, precip, temp)
        if penalty >= 0.90: return "minimal"
        if penalty >= 0.75: return "moderate"
        return "severe"


class PressConferenceScraper:
    """
    Scrapes and analyzes coach press conferences for player intel.
    
    Key signals to extract:
    - "He'll be our starter going forward" → snap count increase
    - "We want to get him more involved" → target share increase  
    - "Day-to-day" / "We'll see" → injury uncertainty
    - "Limited role this week" → fade
    """

    def __init__(self):
        from newsapi import NewsApiClient
        self.client = NewsApiClient(api_key=settings.newsapi_key)

    @cached(ttl=3600 * 2)
    def get_recent_news(self, player_name: str, days_back: int = 7) -> list[dict]:
        """Get recent news articles mentioning a player."""
        from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        articles = self.client.get_everything(
            q=f'"{player_name}" NFL fantasy football',
            from_param=from_date,
            language="en",
            sort_by="publishedAt",
        )
        return articles.get("articles", [])[:10]

    def extract_sentiment_signals(self, articles: list[dict]) -> dict:
        """Run NLP over articles to extract actionable signals."""
        from transformers import pipeline

        # Use a financial/news sentiment model - works well for sports too
        sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="ProsusAI/finbert",
            truncation=True,
        )

        BUY_KEYWORDS = ["starter", "more involved", "healthy", "full practice", "explosive", "featured back"]
        SELL_KEYWORDS = ["limited", "questionable", "doubtful", "reduced role", "day-to-day", "out", "IR"]

        buy_signals, sell_signals, sentiments = [], [], []

        for article in articles:
            text = f"{article.get('title', '')} {article.get('description', '')}".lower()
            sentiment = sentiment_pipeline(text[:512])[0]
            sentiments.append(sentiment)

            for kw in BUY_KEYWORDS:
                if kw in text:
                    buy_signals.append({"keyword": kw, "source": article.get("source", {}).get("name"), "title": article.get("title")})
            for kw in SELL_KEYWORDS:
                if kw in text:
                    sell_signals.append({"keyword": kw, "source": article.get("source", {}).get("name"), "title": article.get("title")})

        avg_sentiment = sum(1 if s["label"] == "positive" else -1 if s["label"] == "negative" else 0
                           for s in sentiments) / max(len(sentiments), 1)

        return {
            "buy_signals": buy_signals,
            "sell_signals": sell_signals,
            "sentiment_score": avg_sentiment,  # -1 (very negative) to +1 (very positive)
            "recommendation": "BUY" if avg_sentiment > 0.3 and buy_signals else
                             "SELL" if avg_sentiment < -0.3 and sell_signals else "HOLD",
        }
