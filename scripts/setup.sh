#!/usr/bin/env bash
set -euo pipefail

# Kodama App development setup script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "=== Kodama App Development Setup ==="
echo ""

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "ERROR: Rust/Cargo not found. Install from https://rustup.rs"
    exit 1
fi

echo "Rust version: $(rustc --version)"
echo ""

# Check for bun
if ! command -v bun &> /dev/null; then
    echo "ERROR: bun not found. Install from https://bun.sh"
    exit 1
fi

echo "bun version: $(bun --version)"
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ui && bun install && cd ..
cd app && bun install && cd ..

echo ""
echo "Verifying build..."
cargo check

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  cd app && bun run tauri dev    # Run desktop app in dev mode"
echo "  cd app && bun run tauri build  # Build desktop app for release"
echo ""
