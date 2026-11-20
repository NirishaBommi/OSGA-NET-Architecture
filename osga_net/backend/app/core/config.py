from __future__ import annotations
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Determine project base directory: osga_net/
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "OSGA-Net Bone Age Workstation"
    VERSION: str = "2.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Storage & Database
    DATA_DIR: Path = BASE_DIR / "backend" / "data"
    SPLITS_CSV: Path = BASE_DIR / "data" / "splits.csv"
    RAW_DATA_DIR: Path = BASE_DIR / "data" / "raw"
    DATABASE_URL: str = Field(default_factory=lambda: f"sqlite:///{(BASE_DIR / 'backend' / 'data' / 'osga.db').as_posix()}")
    UPLOAD_DIR: Path = BASE_DIR / "backend" / "data" / "uploads"
    MAX_UPLOAD_MB: int = 15
    
    # Security
    JWT_SECRET: str = "osga-net-clinical-research-secret-key-change-in-prod-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    COOKIE_NAME: str = "osga_access_token"
    
    # Model & Runs paths
    CKPT_PATH: str = Field(default_factory=lambda: os.environ.get("CKPT_PATH", str(BASE_DIR / "runs" / "osga" / "best.pt")))
    RUNS_DIR: str = Field(default_factory=lambda: os.environ.get("RUNS_DIR", str(BASE_DIR / "runs")))
    RESULTS_JSON: str = Field(default_factory=lambda: os.environ.get("RESULTS_JSON", str(BASE_DIR / "results" / "results.json")))
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]




settings = Settings()

# Ensure directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
