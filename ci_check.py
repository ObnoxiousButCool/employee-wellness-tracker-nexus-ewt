#!/usr/bin/env python3
"""CI sanity check, run by Agent OS after each code-generation iteration.

Owned by Agent OS, not by a layer specialist. Extend it if your layer adds a
test suite; do not move it, and do not add it to .gitignore.

Commands run with shell=False and an argument list — a path containing shell
metacharacters must never become executable input.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str], cwd: Path | None = None) -> int:
    """Run one command, echo its output, and return its exit code."""
    exe = shutil.which(cmd[0])
    if exe is None:
        print(f"[ci] skipping {cmd[0]!r} - not installed")
        return 0
    result = subprocess.run(
        [exe, *cmd[1:]], cwd=str(cwd or ROOT),
        capture_output=True, text=True, timeout=300,
    )
    if result.stdout:
        print(result.stdout)
    if result.returncode != 0 and result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


def main() -> int:
    failures: list[str] = []

    # Python tests, if any layer wrote them.
    test_files = sorted(
        p for p in ROOT.rglob("test_*.py")
        if ".venv" not in p.parts and "node_modules" not in p.parts
    )
    if test_files:
        rc = run([sys.executable, "-m", "pytest", *[str(p) for p in test_files],
                  "--tb=short", "-q", "--no-header"])
        if rc != 0:
            failures.append("pytest")
    else:
        print("[ci] no python tests found - skipping pytest")

    # Node syntax check for each layer that declares a package.json.
    for pkg in sorted(ROOT.glob("*/package.json")):
        layer = pkg.parent
        plain_js = [
            p for p in layer.rglob("*.js")
            if "node_modules" not in p.parts
        ]
        for src in plain_js:
            if run(["node", "--check", str(src)]) != 0:
                failures.append(f"node --check {src.relative_to(ROOT)}")

        # `node --check` cannot parse JSX, so .jsx files need their own
        # syntax-capable gate. esbuild (a transitive dep of vite/vitest)
        # ships a binary under node_modules/.bin that parses+transforms JSX
        # without executing it, so it can be used as a pure syntax check.
        esbuild = layer / "node_modules" / ".bin" / ("esbuild.cmd" if sys.platform == "win32" else "esbuild")
        jsx_sources = [
            p for p in layer.rglob("*.jsx")
            if "node_modules" not in p.parts
        ]
        if jsx_sources and not esbuild.is_file():
            print(f"[ci] {esbuild} not found - skipping .jsx syntax check for {layer.name}")
        else:
            for src in jsx_sources:
                # esbuild infers the "jsx" loader from the .jsx extension on
                # its own; passing the file straight through (no bundling,
                # output discarded) is a pure parse/transform syntax check.
                result = subprocess.run(
                    [str(esbuild), str(src)],
                    cwd=str(ROOT), capture_output=True, text=True, timeout=60,
                )
                if result.returncode != 0:
                    if result.stdout:
                        print(result.stdout)
                    if result.stderr:
                        print(result.stderr, file=sys.stderr)
                    failures.append(f"esbuild (jsx syntax check) {src.relative_to(ROOT)}")

    # Backend Node test suite (node:test), if present.
    backend_tests = ROOT / "backend" / "tests"
    if backend_tests.is_dir():
        test_files = sorted(str(p) for p in backend_tests.glob("*.test.js"))
        if test_files:
            rc = run(["node", "--test", *test_files], cwd=ROOT / "backend")
            if rc != 0:
                failures.append("backend node --test")

    # Frontend test suite (vitest), if present.
    frontend_dir = ROOT / "frontend"
    if (frontend_dir / "package.json").is_file() and (frontend_dir / "node_modules").is_dir():
        rc = run(["npx", "vitest", "run"], cwd=frontend_dir)
        if rc != 0:
            failures.append("frontend vitest run")
    elif (frontend_dir / "package.json").is_file():
        print("[ci] frontend/node_modules not installed - skipping vitest")

    if failures:
        print(f"CI sanity check failed: {', '.join(failures)}", file=sys.stderr)
        return 1
    print("CI sanity check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
