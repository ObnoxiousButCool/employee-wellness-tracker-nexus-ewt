"""Authentication and authorization helpers."""

from dataclasses import dataclass
from functools import wraps

from flask import current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from backend.app.extensions import bcrypt, db
from backend.app.models.department import Department
from backend.app.models.role import Role
from backend.app.models.user import User
from backend.app.repositories.user_repository import UserRepository


class ValidationError(ValueError):
    """Raised when request payloads fail service-layer validation."""

    def __init__(self, errors):
        """Store one or more validation errors for API responses."""
        super().__init__(str(errors))
        self.errors = errors


@dataclass(frozen=True)
class AccessClaims:
    """Trusted identity claims extracted from a signed access token."""

    user_id: int
    role: str


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

    def issue_token(self, user):
        """Issue a signed bearer token containing the user's identity and role."""
        serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        return serializer.dumps(
            {"user_id": user.id, "role": user.role.role_name if user.role else None},
            salt="ewt-access-token",
        )


def verify_access_token(authorization_header):
    """Verify a bearer token and return trusted identity claims."""
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise ValidationError("missing bearer token")
    token = authorization_header.removeprefix("Bearer ").strip()
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        payload = serializer.loads(
            token,
            salt="ewt-access-token",
            max_age=current_app.config.get("ACCESS_TOKEN_MAX_AGE", 3600),
        )
        user_id = int(payload["user_id"])
        role = payload["role"]
    except (BadSignature, SignatureExpired, KeyError, TypeError, ValueError) as exc:
        raise ValidationError("invalid bearer token") from exc
    return AccessClaims(user_id=user_id, role=role)


def require_role(*allowed_roles):
    """Protect a Flask route using signed authenticated identity claims."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            try:
                # Defect 1: trust signed token claims instead of client-controlled role headers.
                claims = verify_access_token(request.headers.get("Authorization"))
            except ValidationError:
                return jsonify({"error": "unauthorized"}), 401
            if claims.role not in allowed_roles:
                return jsonify({"error": "forbidden"}), 403
            current_user = UserRepository().get_by_id(claims.user_id)
            if current_user is None:
                return jsonify({"error": "unauthorized"}), 401
            g.current_user = current_user
            g.access_claims = claims
            return view_func(*args, **kwargs)

        return wrapper

    return decorator


def validate_user_payload(payload):
    """Validate and normalize create-user request payloads."""
    required = ["username", "email", "password", "role_id"]
    # Defect 5: validate required fields before payload indexing can raise KeyError.
    missing = [key for key in required if key not in payload]
    if missing:
        raise ValidationError({"missing": missing})

    try:
        role_id = int(payload["role_id"])
    except (TypeError, ValueError) as exc:
        raise ValidationError({"role_id": "must be an integer"}) from exc

    role = db.session.get(Role, role_id)
    if role is None:
        raise ValidationError({"role_id": "unknown role"})

    department_id = payload.get("department_id")
    if department_id is not None:
        try:
            department_id = int(department_id)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"department_id": "must be an integer"}) from exc
        if db.session.get(Department, department_id) is None:
            raise ValidationError({"department_id": "unknown department"})

    return {
        "username": payload["username"],
        "email": payload["email"],
        "password": payload["password"],
        "role_id": role.id,
        "department_id": department_id,
    }


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
