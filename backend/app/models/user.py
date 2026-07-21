"""User model for employee accounts."""

from backend.app.extensions import db


class User(db.Model):
    """Persist an authenticated application user."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)

    role = db.relationship("Role", back_populates="users")
    department = db.relationship("Department", back_populates="users")
    wellness_entries = db.relationship("WellnessEntry", back_populates="user", lazy=True)

    def to_dict(self):
        """Serialize the user without exposing password material."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role.role_name if self.role else None,
            "department": self.department.department_name if self.department else None,
        }

