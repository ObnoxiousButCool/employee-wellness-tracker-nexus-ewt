"""Wellness tracking API routes."""

from flask import Blueprint, g, jsonify, request

from backend.app.services.authentication.auth_service import ValidationError, require_role
from backend.app.services.wellness_tracking.wellness_service import WellnessService

wellness_bp = Blueprint("wellness", __name__)


@wellness_bp.get("/")
@require_role("admin", "manager", "employee")
def list_entries():
    """Return wellness entries, optionally scoped to a user."""
    try:
        # Defect 3.1: derive actor from signed token and enforce employee ownership.
        entries = WellnessService().list_entries_for_actor(
            g.current_user,
            user_id=request.args.get("user_id", type=int),
        )
    except ValidationError as exc:
        return jsonify({"error": exc.errors}), 403
    return jsonify({"entries": entries})


@wellness_bp.post("/")
@require_role("admin", "manager", "employee")
def create_entry():
    """Create a wellness entry."""
    payload = request.get_json(silent=True) or {}
    try:
        # Defect 3.2: service receives authenticated actor, not a trusted body user_id.
        entry = WellnessService().create_entry_for_actor(g.current_user, payload)
    except ValidationError as exc:
        return jsonify({"error": exc.errors}), 400
    return jsonify({"entry": entry.to_dict()}), 201
