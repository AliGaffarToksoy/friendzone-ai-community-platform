"""
Entry point for running the FriendZone application.

This file exposes the Flask application instance and initializes the
Socket.IO server when run directly. For production deployments,
the application should be served via a WSGI server such as Gunicorn.
"""

from . import create_app, socketio

# Create the Flask application

app = create_app()


if __name__ == '__main__':
    # Run using SocketIO's integrated development server
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)