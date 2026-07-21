"""Analytics API routes."""

from flask import Blueprint, jsonify

from backend.app.services.analytics.analytics_service import AnalyticsService
from backend.app.services.authentication.auth_service import require_role

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/summary")
@require_role("admin", "manager")
def wellness_summary():
    """Return aggregate wellness analytics."""
    return jsonify({"summary": AnalyticsService().summary()})

