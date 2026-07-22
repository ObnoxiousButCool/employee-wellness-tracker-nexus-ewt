"""Analytics calculations for wellness trends."""

from backend.app.repositories.wellness_repository import WellnessRepository


class AnalyticsService:
    """Compute aggregate wellness insights."""

    def __init__(self, wellness=None):
        """Create the service with an optional repository override."""
        self.wellness = wellness or WellnessRepository()

    def summary(self):
        """Return average wellness measurements for all entries."""
        # Defect 7: delegate aggregation to the repository/database layer.
        return self.wellness.aggregate_summary()
