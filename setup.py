"""Build script for Cython compilation of Riftcheck.

Compiles all .py modules to C extensions (.so on Linux/macOS, .pyd on Windows),
so the PyPI distribution contains only compiled binaries — no readable source.

Usage:
    python setup.py build_ext --inplace   # compile in-place for testing
    python -m build                        # build wheel for distribution
"""

from __future__ import annotations

import os
from pathlib import Path

from Cython.Build import cythonize
from setuptools import Extension, setup
from setuptools.command.build_py import build_py as _build_py

SRC_DIR = Path("src")
PACKAGE_DIR = SRC_DIR / "riftcheck"

# Files to keep as .py (not compiled):
# - __init__.py files: needed for package discovery
KEEP_AS_PY = {"__init__.py"}

# Subpackages that must stay as pure Python (do not Cythonize).
# Framework adapters call into third-party objects (AG2, LangGraph, etc.).
# An inplace ``.so`` shadows the ``.py`` module; mixing that with conda /
# heavy native stacks has produced hard segfaults during integration tests.
SKIP_PACKAGE_SUBDIRS = frozenset({"adapters"})


def find_extensions() -> list[Extension]:
    """Find all .py files to compile, excluding __init__.py files."""
    extensions = []
    for py_file in PACKAGE_DIR.rglob("*.py"):
        if py_file.name in KEEP_AS_PY:
            continue

        rel_to_package = py_file.relative_to(PACKAGE_DIR)
        if rel_to_package.parts and rel_to_package.parts[0] in SKIP_PACKAGE_SUBDIRS:
            continue

        # Convert file path to dotted module name
        # src/riftcheck/engine.py -> riftcheck.engine
        rel_path = py_file.relative_to(SRC_DIR)
        module_name = str(rel_path).replace(os.sep, ".").removesuffix(".py")

        extensions.append(
            Extension(module_name, [str(py_file)])
        )

    return extensions


class BuildPyWithoutSource(_build_py):
    """Custom build_py that strips .py source files (except __init__.py).

    After the normal build_py copies all .py files into the build directory,
    this removes every .py that has a compiled .so/.pyd counterpart — so the
    wheel contains only compiled binaries and __init__.py stubs.
    """

    def run(self):
        super().run()
        build_lib = Path(self.build_lib)
        # Remove .py source files that have compiled .so counterparts
        for py_file in build_lib.rglob("*.py"):
            if py_file.name in KEEP_AS_PY:
                continue
            py_file.unlink()
        # Remove .c files (Cython intermediate output) — these are
        # nearly as readable as Python and must not ship
        for c_file in build_lib.rglob("*.c"):
            c_file.unlink()


extensions = find_extensions()

setup(
    ext_modules=cythonize(
        extensions,
        compiler_directives={
            "language_level": "3",      # Python 3 semantics
            "boundscheck": False,       # Faster execution
            "wraparound": False,        # Faster execution
        },
        nthreads=os.cpu_count() or 1,   # Parallel compilation
    ),
    cmdclass={"build_py": BuildPyWithoutSource},
)
