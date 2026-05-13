#!/bin/bash
# Build a compiled-only wheel for Riftcheck.
#
# This script:
# 1. Compiles all .py files to .so/.pyd via Cython
# 2. Builds a wheel that contains ONLY the compiled binaries + __init__.py stubs
# 3. The resulting wheel has no readable Python source code
#
# Prerequisites:
#   pip install cython build wheel setuptools
#
# Usage:
#   ./build_wheel.sh
#
# Output:
#   dist/riftcheck-*.whl  (platform-specific compiled wheel)

set -euo pipefail

echo "=== Riftcheck Compiled Wheel Builder ==="
echo ""

# Step 1: Clean previous builds
echo "[1/4] Cleaning previous builds..."
rm -rf build/ dist/ src/*.egg-info src/riftcheck/**/*.c src/riftcheck/*.c

# Step 2: Compile with Cython
echo "[2/4] Compiling Python → C extensions with Cython..."
python setup.py build_ext --inplace

# Step 3: Build the wheel
echo "[3/4] Building wheel..."
python -m build --wheel

# Step 4: Verify no .py source in wheel (except __init__.py)
echo "[4/4] Verifying wheel contents..."
echo ""
WHEEL=$(ls dist/riftcheck-*.whl | head -1)
echo "Built: $WHEEL"
echo ""

echo "Python files in wheel (should only be __init__.py files):"
python -c "
import zipfile, sys
whl = zipfile.ZipFile('$WHEEL')
py_files = [f for f in whl.namelist() if f.endswith('.py')]
for f in sorted(py_files):
    print(f'  {f}')
if all('__init__' in f for f in py_files):
    print('  ✓ No source code exposed — only __init__.py stubs')
else:
    print('  ✗ WARNING: Non-init .py files found in wheel!')
    sys.exit(1)
"

echo ""
echo "Compiled extensions in wheel:"
python -c "
import zipfile
whl = zipfile.ZipFile('$WHEEL')
so_files = [f for f in whl.namelist() if f.endswith('.so') or f.endswith('.pyd')]
for f in sorted(so_files):
    print(f'  {f}')
print(f'  Total: {len(so_files)} compiled modules')
"

echo ""
echo "=== Done. Upload with: twine upload $WHEEL ==="
