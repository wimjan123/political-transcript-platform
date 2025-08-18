"""
Configuration settings for the Political Transcript Search Platform
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Database settings
    POSTGRES_DB: str = "political_transcripts"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: Optional[str] = None
    
    # API settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Data settings
    HTML_DATA_DIR: str = "/root/polibase/out/html"
    XML_DATA_DIR: str = "/root/tweedekamer_scrape/tweede-kamer-scraper/output/xml/"
    PROCESSED_DATA_DIR: str = "./data/processed"
    UPLOAD_DIR: str = "./data/uploads"
    
    # Security
    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Application settings
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    
    # Search settings
    MAX_SEARCH_RESULTS: int = 1000000
    DEFAULT_PAGE_SIZE: int = 25
    
    # Elasticsearch settings
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    ELASTICSEARCH_INDEX: str = "transcript_segments"
    ELASTICSEARCH_TIMEOUT: int = 30

    # Meilisearch settings
    MEILI_HOST: str = "http://localhost:7700"
    MEILI_MASTER_KEY: str = ""
    MEILI_PUBLIC_SEARCH_KEY: str = ""
    MEILI_EMBEDDER_ID: str | None = None
    MEILI_EMBEDDER_PROVIDER: str = "openai"
    MEILI_TIMEOUT: int = 30
    
    # AI Configuration
    OPENAI_API_KEY: str = ""
    CONVERSATIONAL_LLM_API_KEY: str = ""
    
    # Airtable Configuration
    AIRTABLE_API_KEY: str = ""
    AIRTABLE_BASE_ID: str = ""
    
    @property
    def database_url(self) -> str:
        """Build database URL if not provided"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Create global settings instance
settings = Settings()

# Backward compatibility: support alternate env var names if provided
# Many setups use MEILISEARCH_URL / MEILISEARCH_MASTER_KEY; map them if primary vars are empty
override_meili_host = os.getenv("MEILISEARCH_URL")
override_meili_key = os.getenv("MEILISEARCH_MASTER_KEY")
if override_meili_host and (os.getenv("MEILI_HOST") is None or settings.MEILI_HOST == "http://localhost:7700"):
    try:
        settings.MEILI_HOST = override_meili_host
    except Exception:
        pass
if override_meili_key and (os.getenv("MEILI_MASTER_KEY") is None or settings.MEILI_MASTER_KEY == ""):
    try:
        settings.MEILI_MASTER_KEY = override_meili_key
    except Exception:
        pass
