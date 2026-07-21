#!/usr/bin/env python3
"""CI sanity check run by Agent OS after each code-generation iteration."""

import compileall
import glob
import importlib
import os
import subprocess
import sys


def run(cmd):
    """Run a shell command and stream captured output."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
    if result.stdout:
        print(result.stdout)
    if result.returncode != 0 and result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


def pytest_executable(root):
    """Resolve the project virtual environment pytest executable."""
    venv = os.path.join(root, ".venv")
    windows_pytest = os.path.join(venv, "Scripts", "pytest")
    linux_pytest = os.path.join(venv, "bin", "pytest")
    if os.path.exists(windows_pytest):
        return windows_pytest
    if os.path.exists(linux_pytest):
        return linux_pytest
    return "pytest"


def validate_syntax(root):
    """Compile project Python files without importing framework dependencies."""
    targets = [os.path.join(root, "backend"), os.path.join(root, "tests")]
    return all(compileall.compile_dir(path, quiet=1) for path in targets if os.path.exists(path))


if __name__ == "__main__":
    root_dir = os.path.dirname(os.path.abspath(__file__))

    print("Running EWT CI sanity checks")
    if not validate_syntax(root_dir):
        print("Python syntax validation failed", file=sys.stderr)
        sys.exit(1)

    importlib.import_module("backend")
    print("Top-level package import succeeded: backend")

    test_files = glob.glob(os.path.join(root_dir, "tests", "test_*.py"))
    if not test_files:
        print("No test files found - skipping pytest")
        sys.exit(0)

    files_arg = " ".join(f'"{file_path}"' for file_path in test_files)
    pytest_cmd = f'"{pytest_executable(root_dir)}" {files_arg} --tb=short -q --no-header'
    rc = run(pytest_cmd)
    if rc == 0:
        print("CI sanity checks passed")
    else:
        print("CI sanity checks failed", file=sys.stderr)
    sys.exit(0 if rc == 0 else 1)

