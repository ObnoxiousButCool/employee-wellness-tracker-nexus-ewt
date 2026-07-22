"""Business logic for wellness tracking."""

from datetime import date

from backend.app.models.wellness_entry import WellnessEntry
from backend.app.repositories.wellness_repository import WellnessRepository
from backend.app.services.authentication.auth_service import ValidationError


def parse_iso_date(value):
    """Parse an ISO date string, returning None for invalid input."""
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def require_number_in_range(payload, field_name, minimum, maximum, number_type=float):
    """Return a numeric payload value after validating an inclusive range."""
    try:
        value = number_type(payload[field_name])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValidationError({field_name: f"must be between {minimum} and {maximum}"}) from exc
    if not minimum <= value <= maximum:
        raise ValidationError({field_name: f"must be between {minimum} and {maximum}"})
    return value


class WellnessService:
    """Coordinate wellness entry capture and retrieval."""

    def __init__(self, wellness=None):
        """Create the service with an optional repository override."""
        self.wellness = wellness or WellnessRepository()

    def create_entry(self, payload):
        """Create and persist a wellness entry from request data."""
        # Defect 6.1: parse and validate required input before creating the model.
        entry_date = parse_iso_date(payload.get("date"))
        if entry_date is None:
            raise ValidationError({"date": "must be YYYY-MM-DD"})
        mood = payload.get("mood")
        if not mood:
            raise ValidationError({"mood": "is required"})

        # Defect 6.2: enforce wellness metric domains before persistence.
        stress_level = require_number_in_range(payload, "stress_level", 1, 10, int)
        work_hours = require_number_in_range(payload, "work_hours", 0, 24)
        sleep_hours = require_number_in_range(payload, "sleep_hours", 0, 24)
        energy_level = require_number_in_range(payload, "energy_level", 1, 10, int)

        entry = WellnessEntry(
            user_id=payload["user_id"],
            date=entry_date,
            stress_level=stress_level,
            work_hours=work_hours,
            sleep_hours=sleep_hours,
            mood=mood,
            energy_level=energy_level,
        )
        return self.wellness.add(entry)

    def create_entry_for_actor(self, actor, payload):
        """Create an entry while enforcing authenticated actor ownership."""
        normalized = dict(payload)
        actor_role = actor.role.role_name if actor.role else None
        requested_user_id = normalized.get("user_id")
        if actor_role == "employee":
            normalized["user_id"] = actor.id
        elif requested_user_id is None:
            normalized["user_id"] = actor.id
        return self.create_entry(normalized)

    def list_entries(self, user_id=None):
        """Return serialized wellness entries for one user or all users."""
        entries = self.wellness.list_for_user(user_id) if user_id else self.wellness.list_all()
        return [entry.to_dict() for entry in entries]

    def list_entries_for_actor(self, actor, user_id=None):
        """Return wellness entries allowed for the authenticated actor."""
        actor_role = actor.role.role_name if actor.role else None
        if actor_role == "employee":
            if user_id is not None and user_id != actor.id:
                raise ValidationError("forbidden")
            user_id = actor.id
        return self.list_entries(user_id=user_id)
