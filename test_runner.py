"""Pytest discovery and execution for the Agent OS CI sanity check."""

from __future__ import annotations

import glob
import os
import shutil
import sys

from ci_helper import run


def pytest_executable(root: str) -> str:
    """Resolve the pytest executable from the project virtual environment."""
    venv = os.path.join(root, ".venv")
    windows_pytest = os.path.join(venv, "Scripts", "pytest.exe")
    if os.path.exists(windows_pytest):
        return windows_pytest
    posix_pytest = os.path.join(venv, "bin", "pytest")
    if os.path.exists(posix_pytest):
        return posix_pytest
    path_pytest = shutil.which("pytest")
    if path_pytest:
        return path_pytest
    return windows_pytest


def discover_test_files(root: str) -> list[str]:
    """Return iteration-safe pytest files under the tests directory."""
    return sorted(glob.glob(os.path.join(root, "tests", "test_*.py")))


def run_tests(root: str) -> int:
    """Run repository tests selected for the Agent OS CI check."""
    test_files = discover_test_files(root)
    # Defect 2: missing tests are now a CI failure instead of a silent pass.
    if not test_files:
        print("No test files found", file=sys.stderr)
        return 1

    pytest_path = pytest_executable(root)
    # Defect 3: report missing pytest directly before subprocess execution.
    if not os.path.exists(pytest_path):
        print(f"pytest executable not found: {pytest_path}", file=sys.stderr)
        return 1

    # Defect 1: construct argv instead of a shell command string.
    command = [pytest_path, *test_files, "--tb=short", "-q", "--no-header"]
    return run(command)
