"""User management API routes."""

from flask import Blueprint, jsonify, request

from backend.app.services.authentication.auth_service import ValidationError, require_role
from backend.app.services.user_management.user_service import UserService

users_bp = Blueprint("users", __name__)


@users_bp.get("/")
@require_role("admin", "manager")
def list_users():
    """Return all registered users."""
    return jsonify({"users": UserService().list_users()})


@users_bp.post("/")
@require_role("admin")
def create_user():
    """Create a user account."""
    payload = request.get_json(silent=True) or {}
    try:
        user = UserService().create_user(payload)
    except ValidationError as exc:
        # Defect 4: convert service validation failures into controlled 400 responses.
        return jsonify({"error": exc.errors}), 400
    return jsonify({"user": user.to_dict()}), 201
