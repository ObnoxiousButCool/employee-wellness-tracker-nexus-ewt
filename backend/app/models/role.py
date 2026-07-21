"""Role model for role-based access control."""

from backend.app.extensions import db


class Role(db.Model):
    """Persist an authorization role such as admin, manager, or employee."""

    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(80), nullable=False, unique=True)

    users = db.relationship("User", back_populates="role", lazy=True)

    def to_dict(self):
        """Serialize the role for API responses."""
        return {"id": self.id, "role_name": self.role_name}

