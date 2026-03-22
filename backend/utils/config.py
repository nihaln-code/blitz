from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    espn_league_id: str = ""
    newsapi_key: str = ""
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"


def get_settings() -> Settings:
    return Settings()