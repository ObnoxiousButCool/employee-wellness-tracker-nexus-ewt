"""Wellness tracking API routes."""

from flask import Blueprint, jsonify, request

from backend.app.services.authentication.auth_service import require_role
from backend.app.services.wellness_tracking.wellness_service import WellnessService

wellness_bp = Blueprint("wellness", __name__)


@wellness_bp.get("/")
@require_role("admin", "manager", "employee")
def list_entries():
    """Return wellness entries, optionally scoped to a user."""
    user_id = request.args.get("user_id", type=int)
    return jsonify({"entries": WellnessService().list_entries(user_id=user_id)})


@wellness_bp.post("/")
@require_role("admin", "manager", "employee")
def create_entry():
    """Create a wellness entry."""
    payload = request.get_json(silent=True) or {}
    entry = WellnessService().create_entry(payload)
    return jsonify({"entry": entry.to_dict()}), 201

