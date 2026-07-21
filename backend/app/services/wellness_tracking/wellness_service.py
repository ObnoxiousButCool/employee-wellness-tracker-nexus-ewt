"""Business logic for wellness tracking."""

from datetime import date

from backend.app.models.wellness_entry import WellnessEntry
from backend.app.repositories.wellness_repository import WellnessRepository


class WellnessService:
    """Coordinate wellness entry capture and retrieval."""

    def __init__(self, wellness=None):
        """Create the service with an optional repository override."""
        self.wellness = wellness or WellnessRepository()

    def create_entry(self, payload):
        """Create and persist a wellness entry from request data."""
        entry = WellnessEntry(
            user_id=payload["user_id"],
            date=date.fromisoformat(payload["date"]),
            stress_level=payload["stress_level"],
            work_hours=payload["work_hours"],
            sleep_hours=payload["sleep_hours"],
            mood=payload["mood"],
            energy_level=payload["energy_level"],
        )
        return self.wellness.add(entry)

    def list_entries(self, user_id=None):
        """Return serialized wellness entries for one user or all users."""
        entries = self.wellness.list_for_user(user_id) if user_id else self.wellness.list_all()
        return [entry.to_dict() for entry in entries]

