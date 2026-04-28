"""
Database connection and initialization for FriendZone.

This module instantiates the SQLAlchemy database and Flask-Migrate
extensions. It does not bind them to a Flask application; this
occurs in the application factory (see backend/__init__.py).
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# Create SQLAlchemy database instance
db = SQLAlchemy()

# Create Migrate instance
migrate = Migrate()