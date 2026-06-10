from pydantic_settings import BaseSettings
from functools import lru_cache


# BaseSettings automatically reads values from .env file and environment variables.
# Each field below maps to a line in backend/.env - e.g. OPENAI_API_KEY=sk-...
# Defaults to "" so the server still starts even if a key is missing.
class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"       # swap to gpt-4o-mini to reduce cost
    espn_league_id: str = ""           # not implemented yet
    newsapi_key: str = ""
    redis_url: str = "redis://localhost:6379"   # not integrated yet
    cache_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"   # tells pydantic where to look for the file


def get_settings() -> Settings:
    # Called by any module that needs an API key - returns a fresh Settings object each time
    return Settings()