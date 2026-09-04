#!/usr/bin/env bash
# ==============================================================================
# Seeker — Automated Terminal Installer for macOS & Linux
# ==============================================================================
set -e

echo ""
echo "███████╗███████╗███████╗██╗  ██╗███████╗██████╗ "
echo "██╔════╝██╔════╝██╔════╝██║ ██╔╝██╔════╝██╔══██╗"
echo "███████╗█████╗  █████╗  █████═╝ █████╗  ██████╔╝"
echo "╚════██║██╔══╝  ██╔══╝  ██╔═██╗ ██╔══╝  ██╔══██╗"
echo "███████║███████╗███████╗██║ ╚██╗███████╗██║  ██║"
echo "╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝"
echo "   Intelligent Messenger Automation Studio"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "👉 Please install Node.js (v18 or newer) from https://nodejs.org or run 'brew install node'"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Installing Seeker core dependencies..."
npm install

echo ""
echo "⚙️ Registering Seeker application with your system..."
bash "$SCRIPT_DIR/scripts/install-app.sh"

echo ""
echo "======================================================"
echo "🎉 SEEKER INSTALLATION COMPLETE!"
echo ""
echo "🚀 FIRST TIME LAUNCH:"
echo "   Run: npm start"
echo ""
echo "💡 SUBSEQUENT LAUNCHES (No terminal needed!):"
echo "   1. Press [ Cmd + Space ] to open Spotlight (or open Launchpad / Applications)."
echo "   2. Type 'Seeker' and hit Enter."
echo "   3. Enjoy the 5-second cinematic build-up animation and start messaging!"
echo "======================================================"
echo ""
