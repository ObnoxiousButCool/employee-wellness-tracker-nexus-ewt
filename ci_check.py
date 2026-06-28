#!/usr/bin/env python3
"""CI sanity check run by Agent OS after each code-generation iteration."""

from __future__ import annotations

import os
import sys

from ci_helper import check_imports
from test_runner import run_tests


def main() -> int:
    """Run CI checks and return 0 when all checks pass."""
    root = os.path.dirname(os.path.abspath(__file__))
    checks = [
        ("pytest", run_tests(root)),
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
