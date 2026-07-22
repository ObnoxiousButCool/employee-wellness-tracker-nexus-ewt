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

    def aggregate_summary(self):
        """Return database-computed wellness aggregate measurements."""
        # Defect 7: aggregate in SQL instead of loading every wellness row.
        from sqlalchemy import func

        row = db.session.query(
            func.count(WellnessEntry.id),
            func.avg(WellnessEntry.stress_level),
            func.avg(WellnessEntry.sleep_hours),
            func.avg(WellnessEntry.energy_level),
        ).one()
        return {
            "entry_count": row[0],
            "average_stress_level": round(row[1], 2) if row[1] is not None else None,
            "average_sleep_hours": round(row[2], 2) if row[2] is not None else None,
            "average_energy_level": round(row[3], 2) if row[3] is not None else None,
        }
