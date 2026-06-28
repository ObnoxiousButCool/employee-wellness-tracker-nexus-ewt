"""Tests for the Agent OS CI helper behavior."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import ci_helper
import test_runner


def test_run_uses_argv_without_shell(monkeypatch):
    """Verify commands are executed without shell parsing."""
    captured: dict[str, object] = {}

    def fake_run(command, **kwargs):
        captured["command"] = command
        captured["shell"] = kwargs["shell"]
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(ci_helper.subprocess, "run", fake_run)

    assert ci_helper.run(["pytest", "--version"]) == 0
    assert captured == {"command": ["pytest", "--version"], "shell": False}


def test_run_tests_fails_when_no_tests_exist(tmp_path, monkeypatch, capsys):
    """Verify missing tests fail CI instead of being skipped."""
    monkeypatch.setattr(test_runner, "pytest_executable", lambda root: os.devnull)

    assert test_runner.run_tests(str(tmp_path)) == 1

    captured = capsys.readouterr()
    assert "No test files found" in captured.err


def test_run_tests_fails_when_pytest_is_missing(tmp_path, capsys):
    """Verify a missing pytest executable produces a clear CI failure."""
    tests_dir = tmp_path / "tests"
    tests_dir.mkdir()
    (tests_dir / "test_sample.py").write_text("def test_sample():\n    assert True\n")
    original_path = os.environ.get("PATH", "")
    os.environ["PATH"] = ""

    try:
        assert test_runner.run_tests(str(tmp_path)) == 1
    finally:
        os.environ["PATH"] = original_path

    captured = capsys.readouterr()
    assert "pytest executable not found" in captured.err


def test_run_tests_builds_pytest_argv(tmp_path, monkeypatch):
    """Verify pytest receives an argv list with discovered test files."""
    tests_dir = tmp_path / "tests"
    tests_dir.mkdir()
    test_file = tests_dir / "test_sample.py"
    test_file.write_text("def test_sample():\n    assert True\n")
    pytest_path = tmp_path / "pytest.exe"
    pytest_path.write_text("")
    captured: dict[str, list[str]] = {}

    def fake_run(command: list[str]) -> int:
        captured["command"] = command
        return 0

    monkeypatch.setattr(test_runner, "run", fake_run)
    monkeypatch.setattr(test_runner, "pytest_executable", lambda root: str(pytest_path))

    assert test_runner.run_tests(str(tmp_path)) == 0
    assert captured["command"] == [
        str(pytest_path),
        str(Path(test_file)),
        "--tb=short",
        "-q",
        "--no-header",
    ]
