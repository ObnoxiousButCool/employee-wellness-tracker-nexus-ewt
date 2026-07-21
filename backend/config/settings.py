"""Application settings loaded from environment variables."""

import os


class Config:
    """Default Flask configuration for the EWT backend."""

    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://ewt_user:ewt_password@localhost:5432/ewt",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://localhost:3000").split(",")

