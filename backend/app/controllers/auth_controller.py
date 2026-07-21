"""Authentication API routes."""

from flask import Blueprint, jsonify, request

from backend.app.services.authentication.auth_service import AuthService

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    """Authenticate a user with email and password."""
    payload = request.get_json(silent=True) or {}
    user = AuthService().authenticate(payload.get("email", ""), payload.get("password", ""))
    if not user:
        return jsonify({"error": "invalid credentials"}), 401
    return jsonify({"user": user.to_dict()})

