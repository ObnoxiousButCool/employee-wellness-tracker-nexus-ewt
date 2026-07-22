"""Project structure and syntax checks for the generated EWT scaffold."""

from datetime import date
from pathlib import Path

import pytest


def test_required_files_exist():
    """Verify the required application files were generated."""
    root = Path(__file__).resolve().parents[1]
    expected = [
        ".gitignore",
        "backend/app/__init__.py",
        "backend/config/settings.py",
        "backend/app/models/user.py",
        "backend/app/models/department.py",
        "frontend/next-app/pages/_app.js",
        "frontend/next-app/pages/index.js",
        "ci_check.py",
        "docker-compose.yml",
        "Dockerfile",
    ]

    missing = [relative_path for relative_path in expected if not (root / relative_path).exists()]
    assert missing == []


def test_gitignore_excludes_dependency_artifacts():
    """Verify generated dependency directories are excluded from git."""
    root = Path(__file__).resolve().parents[1]
    ignored = set((root / ".gitignore").read_text(encoding="utf-8").splitlines())
    assert ".venv/" in ignored
    assert "node_modules/" in ignored
    assert "__pycache__/" in ignored


class TestConfig:
    """In-memory Flask configuration for API behavior tests."""

    TESTING = True
    SECRET_KEY = "test-secret-key"
    ACCESS_TOKEN_MAX_AGE = 3600
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = ["http://localhost:3000"]


def load_backend_dependencies():
    """Import Flask app dependencies, skipping API tests when they are unavailable."""
    pytest.importorskip("flask")
    from backend.app import create_app
    from backend.app.extensions import db
    from backend.app.models import Department, Role, User, WellnessEntry
    from backend.app.services.authentication.auth_service import AuthService

    return create_app, db, Department, Role, User, WellnessEntry, AuthService


@pytest.fixture()
def app():
    """Create a fresh in-memory app with baseline roles and users."""
    create_app, db, Department, Role, User, _, AuthService = load_backend_dependencies()
    test_app = create_app(TestConfig)
    with test_app.app_context():
        db.create_all()
        department = Department(department_name="Engineering")
        admin_role = Role(role_name="admin")
        manager_role = Role(role_name="manager")
        employee_role = Role(role_name="employee")
        db.session.add_all([department, admin_role, manager_role, employee_role])
        db.session.commit()

        auth = AuthService()
        admin = User(
            username="admin",
            email="admin@example.com",
            password=auth.hash_password("password"),
            role_id=admin_role.id,
            department_id=department.id,
        )
        manager = User(
            username="manager",
            email="manager@example.com",
            password=auth.hash_password("password"),
            role_id=manager_role.id,
            department_id=department.id,
        )
        employee = User(
            username="employee",
            email="employee@example.com",
            password=auth.hash_password("password"),
            role_id=employee_role.id,
            department_id=department.id,
        )
        db.session.add_all([admin, manager, employee])
        db.session.commit()

    yield test_app

    with test_app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    """Return a Flask test client."""
    return app.test_client()


def bearer(client, email):
    """Log in and return a bearer Authorization header."""
    response = client.post("/api/auth/login", json={"email": email, "password": "password"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


def user_id_for_email(app, email):
    """Return a seeded user's database id."""
    _, _, _, _, User, _, _ = load_backend_dependencies()
    with app.app_context():
        return User.query.filter_by(email=email).first().id


def test_login_returns_access_token_and_rejects_bad_credentials(client):
    """Defect 15: cover login success and failure behavior."""
    response = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "password"})
    assert response.status_code == 200
    assert response.get_json()["access_token"]

    bad_response = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrong"})
    assert bad_response.status_code == 401


def test_protected_routes_require_signed_token_and_role(client):
    """Defect 15: cover unauthorized access and role enforcement."""
    bypass_response = client.get("/api/users/", headers={"X-User-Role": "admin"})
    assert bypass_response.status_code == 401

    employee_headers = bearer(client, "employee@example.com")
    forbidden_response = client.get("/api/users/", headers=employee_headers)
    assert forbidden_response.status_code == 403

    admin_headers = bearer(client, "admin@example.com")
    allowed_response = client.get("/api/users/", headers=admin_headers)
    assert allowed_response.status_code == 200


def test_user_creation_validation_returns_controlled_400(client):
    """Defect 15: cover required-field and foreign-key validation for users."""
    admin_headers = bearer(client, "admin@example.com")
    missing_response = client.post("/api/users/", headers=admin_headers, json={"username": "new-user"})
    assert missing_response.status_code == 400
    assert "missing" in missing_response.get_json()["error"]

    invalid_role_response = client.post(
        "/api/users/",
        headers=admin_headers,
        json={
            "username": "new-user",
            "email": "new@example.com",
            "password": "password",
            "role_id": 999,
        },
    )
    assert invalid_role_response.status_code == 400


def test_employee_wellness_access_is_scoped_to_authenticated_user(app, client):
    """Defect 15: cover wellness ownership checks for employee actors."""
    employee_headers = bearer(client, "employee@example.com")
    manager_id = user_id_for_email(app, "manager@example.com")
    employee_id = user_id_for_email(app, "employee@example.com")

    create_response = client.post(
        "/api/wellness/",
        headers=employee_headers,
        json={
            "user_id": manager_id,
            "date": "2026-07-21",
            "stress_level": 4,
            "work_hours": 8,
            "sleep_hours": 7,
            "mood": "focused",
            "energy_level": 6,
        },
    )
    assert create_response.status_code == 201
    assert create_response.get_json()["entry"]["user_id"] == employee_id

    forbidden_response = client.get(f"/api/wellness/?user_id={manager_id}", headers=employee_headers)
    assert forbidden_response.status_code == 403

    own_response = client.get("/api/wellness/", headers=employee_headers)
    assert own_response.status_code == 200
    assert [entry["user_id"] for entry in own_response.get_json()["entries"]] == [employee_id]


def test_wellness_entry_validation_rejects_bad_dates_and_ranges(client):
    """Defect 15: cover wellness payload validation failures."""
    employee_headers = bearer(client, "employee@example.com")
    invalid_date_response = client.post(
        "/api/wellness/",
        headers=employee_headers,
        json={
            "date": "07/21/2026",
            "stress_level": 4,
            "work_hours": 8,
            "sleep_hours": 7,
            "mood": "focused",
            "energy_level": 6,
        },
    )
    assert invalid_date_response.status_code == 400

    invalid_range_response = client.post(
        "/api/wellness/",
        headers=employee_headers,
        json={
            "date": "2026-07-21",
            "stress_level": 11,
            "work_hours": 8,
            "sleep_hours": 7,
            "mood": "focused",
            "energy_level": 6,
        },
    )
    assert invalid_range_response.status_code == 400


def test_analytics_summary_uses_persisted_aggregate_results(app, client):
    """Defect 15: cover analytics summary values from stored wellness rows."""
    _, db, _, _, _, WellnessEntry, _ = load_backend_dependencies()
    admin_headers = bearer(client, "admin@example.com")
    employee_id = user_id_for_email(app, "employee@example.com")
    manager_id = user_id_for_email(app, "manager@example.com")
    with app.app_context():
        db.session.add_all(
            [
                WellnessEntry(
                    user_id=employee_id,
                    date=date(2026, 7, 20),
                    stress_level=2,
                    work_hours=8,
                    sleep_hours=7,
                    mood="calm",
                    energy_level=8,
                ),
                WellnessEntry(
                    user_id=manager_id,
                    date=date(2026, 7, 21),
                    stress_level=6,
                    work_hours=9,
                    sleep_hours=5,
                    mood="stretched",
                    energy_level=4,
                ),
            ]
        )
        db.session.commit()

    response = client.get("/api/analytics/summary", headers=admin_headers)
    assert response.status_code == 200
    assert response.get_json()["summary"] == {
        "entry_count": 2,
        "average_stress_level": 4.0,
        "average_sleep_hours": 6.0,
        "average_energy_level": 6.0,
    }
