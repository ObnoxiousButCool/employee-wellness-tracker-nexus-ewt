"""Department model for employee grouping."""

from backend.app.extensions import db


class Department(db.Model):
    """Persist an organizational department."""

    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    department_name = db.Column(db.String(120), nullable=False, unique=True)

    users = db.relationship("User", back_populates="department", lazy=True)

    def to_dict(self):
        """Serialize the department for API responses."""
        return {"id": self.id, "department_name": self.department_name}

