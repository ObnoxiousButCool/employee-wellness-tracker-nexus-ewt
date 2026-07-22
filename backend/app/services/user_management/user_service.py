"""Business logic for user management."""

from backend.app.repositories.user_repository import UserRepository
from backend.app.services.authentication.auth_service import (
    build_user_from_payload,
    validate_user_payload,
)


class UserService:
    """Coordinate user lifecycle operations."""

    def __init__(self, users=None):
        """Create the service with an optional repository override."""
        self.users = users or UserRepository()

    def create_user(self, payload):
        """Create and persist a user from request data."""
        # Defect 4: validate required fields and foreign keys before model creation.
        validated = validate_user_payload(payload)
        user = build_user_from_payload(validated)
        return self.users.add(user)

    def list_users(self):
        """Return serialized users."""
        return [user.to_dict() for user in self.users.list_all()]
