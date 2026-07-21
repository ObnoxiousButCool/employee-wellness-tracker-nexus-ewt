"""Analytics calculations for wellness trends."""

from statistics import mean

from backend.app.repositories.wellness_repository import WellnessRepository


class AnalyticsService:
    """Compute aggregate wellness insights."""

    def __init__(self, wellness=None):
        """Create the service with an optional repository override."""
        self.wellness = wellness or WellnessRepository()

    def summary(self):
        """Return average wellness measurements for all entries."""
        entries = self.wellness.list_all()
        if not entries:
            return {
                "entry_count": 0,
                "average_stress_level": None,
                "average_sleep_hours": None,
                "average_energy_level": None,
            }
        return {
            "entry_count": len(entries),
            "average_stress_level": round(mean(entry.stress_level for entry in entries), 2),
            "average_sleep_hours": round(mean(entry.sleep_hours for entry in entries), 2),
            "average_energy_level": round(mean(entry.energy_level for entry in entries), 2),
        }

