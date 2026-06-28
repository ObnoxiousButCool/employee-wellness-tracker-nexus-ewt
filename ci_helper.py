"""Shared helpers for the Agent OS CI sanity check."""

from __future__ import annotations

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
    "tests",
    "venv",
}


def run(command: list[str]) -> int:
    """Run a command without shell parsing and return its exit code."""
    # Defect 1: shell=False with argv avoids shell injection from generated paths.
    result = subprocess.run(
        command,
        shell=False,
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
