"""Authentication and authorization helpers."""

from functools import wraps

from flask import jsonify, request

from backend.app.extensions import bcrypt
from backend.app.models.user import User
from backend.app.repositories.user_repository import UserRepository


class AuthService:
    """Coordinate password hashing and basic credential checks."""

    def __init__(self, users=None):
        """Create the service with an optional repository override."""
        self.users = users or UserRepository()

    def hash_password(self, plain_password):
        """Hash a plaintext password with bcrypt."""
        return bcrypt.generate_password_hash(plain_password).decode("utf-8")

    def verify_password(self, user, plain_password):
        """Return whether a plaintext password matches the stored hash."""
        return bcrypt.check_password_hash(user.password, plain_password)

    def authenticate(self, email, plain_password):
        """Return the authenticated user or None."""
        user = self.users.get_by_email(email)
        if not user or not self.verify_password(user, plain_password):
            return None
        return user


def require_role(*allowed_roles):
    """Protect a Flask route using a simple role header for service-to-service calls."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            role_name = request.headers.get("X-User-Role", "")
            if role_name not in allowed_roles:
                return jsonify({"error": "forbidden"}), 403
            return view_func(*args, **kwargs)

        return wrapper

    return decorator


def build_user_from_payload(payload):
    """Create a user model from validated request payload."""
    service = AuthService()
    return User(
        username=payload["username"],
        email=payload["email"],
        password=service.hash_password(payload["password"]),
        role_id=payload["role_id"],
        department_id=payload.get("department_id"),
    )

