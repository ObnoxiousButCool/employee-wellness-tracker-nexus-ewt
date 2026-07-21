"""Flask application factory for Employee Wellness Tracker Nexus."""

from flask import Flask, jsonify

from backend.app.controllers.analytics_controller import analytics_bp
from backend.app.controllers.auth_controller import auth_bp
from backend.app.controllers.user_controller import users_bp
from backend.app.controllers.wellness_controller import wellness_bp
from backend.app.extensions import bcrypt, cors, db
from backend.config.settings import Config


def create_app(config_class=Config):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(wellness_bp, url_prefix="/api/wellness")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")

    @app.get("/api/health")
    def health_check():
        """Return service health metadata."""
        return jsonify({"status": "ok", "service": "ewt-backend"})

    return app

