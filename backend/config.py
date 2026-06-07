"""
Application configuration classes.

Configuration values are loaded from environment variables using
python-dotenv. Sensitive keys should be provided via a `.env` file
in the project root or through the system environment.
"""

import os
from datetime import timedelta
from dotenv import load_dotenv


load_dotenv()

class Config:
    """Base configuration loaded for all environments."""

    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'super-secret-key')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=1)

    # Database settings
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///friendzone.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # CORS settings
    FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://localhost:5500')

    # OpenAI API key
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')

    # Admin credentials
    ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')

    # Logging settings
    LOG_FILE = os.getenv('LOG_FILE', 'logs/app.log')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()


class DevelopmentConfig(Config):
    """Development-specific configuration."""

    DEBUG = True
class ProductionConfig(Config):
    """Production-specific configuration."""

    DEBUG = False