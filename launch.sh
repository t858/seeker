#!/usr/bin/env bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/node_modules/.bin/electron" ]; then
    "$SCRIPT_DIR/node_modules/.bin/electron" . > /dev/null 2>&1 &
else
    npx electron . > /dev/null 2>&1 &
fi
