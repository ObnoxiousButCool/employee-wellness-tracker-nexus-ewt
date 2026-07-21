"""Repository functions for user persistence."""

from backend.app.extensions import db
from backend.app.models.user import User


class UserRepository:
    """Read and write users through SQLAlchemy."""

    def get_by_email(self, email):
        """Return a user by email address."""
        return User.query.filter_by(email=email).first()

    def get_by_id(self, user_id):
        """Return a user by primary key."""
        return User.query.get(user_id)

    def list_all(self):
        """Return all users ordered by username."""
        return User.query.order_by(User.username.asc()).all()

    def add(self, user):
        """Persist a user and return it."""
        db.session.add(user)
        db.session.commit()
        return user

