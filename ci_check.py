#!/usr/bin/env python3
"""CI sanity check run by Agent OS after each code-generation iteration."""

from __future__ import annotations

import glob
import importlib
import os
import subprocess
import sys


IGNORED_PACKAGE_DIRS = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "env",
    "node_modules",
    "venv",
}


def run(command: str) -> int:
    """Run a shell command, echo captured output, and return its exit code."""
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.stdout:
        print(result.stdout)
    if result.returncode != 0 and result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


def discover_top_level_packages(root: str) -> list[str]:
    """Find importable top-level Python packages in the repository root."""
    packages: list[str] = []
    for entry in os.listdir(root):
        path = os.path.join(root, entry)
        if entry in IGNORED_PACKAGE_DIRS or not os.path.isdir(path):
            continue
        if not entry.isidentifier():
            continue
        if os.path.exists(os.path.join(path, "__init__.py")):
            packages.append(entry)
    return sorted(packages)


def check_imports(root: str) -> int:
    """Import discovered top-level packages to verify syntax and availability."""
    packages = discover_top_level_packages(root)
    if not packages:
        print("No top-level Python package found - skipping import check")
        return 0

    sys.path.insert(0, root)
    for package in packages:
        try:
            importlib.import_module(package)
        except Exception as exc:
            print(f"Import check failed for {package}: {exc}", file=sys.stderr)
            return 1
    print(f"Import check passed: {', '.join(packages)}")
    return 0


def pytest_executable(root: str) -> str:
    """Resolve the pytest executable from the project virtual environment."""
    venv = os.path.join(root, ".venv")
    windows_pytest = os.path.join(venv, "Scripts", "pytest")
    if os.path.exists(windows_pytest):
        return windows_pytest
    return os.path.join(venv, "bin", "pytest")


def check_tests(root: str) -> int:
    """Run only repository test files matching tests/test_*.py."""
    test_files = glob.glob(os.path.join(root, "tests", "test_*.py"))
    if not test_files:
        print("No test files found - skipping pytest")
        return 0

    pytest_path = pytest_executable(root)
    files_arg = " ".join(f'"{path}"' for path in test_files)
    command = f'"{pytest_path}" {files_arg} --tb=short -q --no-header'
    return run(command)


def main() -> int:
    """Run CI checks and return 0 when all checks pass."""
    root = os.path.dirname(os.path.abspath(__file__))
    checks = [
        ("pytest", check_tests(root)),
        ("import", check_imports(root)),
    ]
    failed = [name for name, code in checks if code != 0]
    if failed:
        print(f"CI sanity check failed: {', '.join(failed)}")
        return 1
    print("CI sanity check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
