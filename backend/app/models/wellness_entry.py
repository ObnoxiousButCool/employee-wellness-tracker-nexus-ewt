"""Wellness entry model for daily employee metrics."""

from backend.app.extensions import db


class WellnessEntry(db.Model):
    """Persist a user's daily wellness measurements."""

    __tablename__ = "wellness_entries"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    stress_level = db.Column(db.Integer, nullable=False)
    work_hours = db.Column(db.Float, nullable=False)
    sleep_hours = db.Column(db.Float, nullable=False)
    mood = db.Column(db.String(40), nullable=False)
    energy_level = db.Column(db.Integer, nullable=False)

    user = db.relationship("User", back_populates="wellness_entries")

    def to_dict(self):
        """Serialize the wellness entry for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "date": self.date.isoformat(),
            "stress_level": self.stress_level,
            "work_hours": self.work_hours,
            "sleep_hours": self.sleep_hours,
            "mood": self.mood,
            "energy_level": self.energy_level,
        }

