"""Repository functions for wellness entries."""

from backend.app.extensions import db
from backend.app.models.wellness_entry import WellnessEntry


class WellnessRepository:
    """Read and write wellness entries through SQLAlchemy."""

    def add(self, entry):
        """Persist a wellness entry and return it."""
        db.session.add(entry)
        db.session.commit()
        return entry

    def list_for_user(self, user_id):
        """Return all wellness entries for one user ordered by date."""
        return WellnessEntry.query.filter_by(user_id=user_id).order_by(WellnessEntry.date.desc()).all()

    def list_all(self):
        """Return all wellness entries ordered by date."""
        return WellnessEntry.query.order_by(WellnessEntry.date.desc()).all()

