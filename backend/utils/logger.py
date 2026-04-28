"""
Logging utility for the FriendZone backend.

This module configures a rotating file handler to store logs under
the `logs/` directory. It ensures that the logs directory exists and
attaches handlers to the Flask application's logger when invoked.
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask


def setup_logger(app: Flask) -> None:
    """Set up application logging with a rotating file handler.

    Args:
        app: The Flask application instance whose logger will be configured.
    """
    log_file = app.config.get('LOG_FILE', 'logs/app.log')
    log_level = app.config.get('LOG_LEVEL', 'INFO').upper()

    # Ensure the logs directory exists
    log_dir = os.path.dirname(log_file)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)

    # Create rotating file handler
    file_handler = RotatingFileHandler(log_file, maxBytes=1024 * 1024 * 5, backupCount=5)
    file_handler.setLevel(getattr(logging, log_level, logging.INFO))
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    )
    file_handler.setFormatter(formatter)

    # Attach handler to Flask's logger
    if not app.logger.handlers:
        app.logger.addHandler(file_handler)
    else:
        # Avoid duplicating handlers if setup_logger is called multiple times
        handler_types = [type(h) for h in app.logger.handlers]
        if RotatingFileHandler not in handler_types:
            app.logger.addHandler(file_handler)

    # Also configure the root logger for libraries used in the app
    logging.getLogger().setLevel(getattr(logging, log_level, logging.INFO))
    logging.getLogger().addHandler(file_handler)