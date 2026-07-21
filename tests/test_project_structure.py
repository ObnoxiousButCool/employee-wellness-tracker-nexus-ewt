"""Project structure and syntax checks for the generated EWT scaffold."""

from pathlib import Path


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
