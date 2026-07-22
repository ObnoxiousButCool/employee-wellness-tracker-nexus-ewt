"""Application settings loaded from environment variables."""

import os


def load_secret_key():
    """Load a safe secret key, allowing a fallback only for local development."""
    secret_key = os.getenv("SECRET_KEY")
    if secret_key:
        return secret_key
    environment = os.getenv("FLASK_ENV") or os.getenv("APP_ENV") or "development"
    if environment in {"development", "local", "testing"}:
        # Defect 8: keep the fallback out of non-local environments.
        return "local-development-secret"
    raise RuntimeError("SECRET_KEY must be set outside local development")


class Config:
    """Default Flask configuration for the EWT backend."""

    SECRET_KEY = load_secret_key()
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://ewt_user:ewt_password@localhost:5432/ewt",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://localhost:3000").split(",")
