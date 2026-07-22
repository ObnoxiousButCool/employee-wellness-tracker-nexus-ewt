"""Authentication API routes."""

from flask import Blueprint, jsonify, request

from backend.app.services.authentication.auth_service import AuthService

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    """Authenticate a user with email and password."""
    payload = request.get_json(silent=True) or {}
    auth = AuthService()
    user = auth.authenticate(payload.get("email", ""), payload.get("password", ""))
    if not user:
        return jsonify({"error": "invalid credentials"}), 401
    # Defect 2: return a signed credential so protected routes can authenticate callers.
    return jsonify({"user": user.to_dict(), "access_token": auth.issue_token(user)})
