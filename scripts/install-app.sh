#!/usr/bin/env bash
# ==============================================================================
# Seeker — Native Application Setup & OS Registration Script (macOS / Linux)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

OS="$(uname -s)"

echo "⚡ Registering Seeker with your operating system..."

# Create launch.sh runner
LAUNCH_SCRIPT="$SCRIPT_DIR/launch.sh"
cat << 'EOF' > "$LAUNCH_SCRIPT"
#!/usr/bin/env bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/node_modules/.bin/electron" ]; then
    "$SCRIPT_DIR/node_modules/.bin/electron" . > /dev/null 2>&1 &
else
    npx electron . > /dev/null 2>&1 &
fi
EOF
chmod +x "$LAUNCH_SCRIPT"

if [ "$OS" = "Darwin" ]; then
    # --- macOS Native .app Bundle ---
    APP_TARGET_DIR="/Applications"
    if [ ! -w "$APP_TARGET_DIR" ]; then
        APP_TARGET_DIR="$HOME/Applications"
        mkdir -p "$APP_TARGET_DIR"
    fi

    APP_PATH="$APP_TARGET_DIR/Seeker.app"
    echo "🍏 Creating macOS Application at: $APP_PATH"

    rm -rf "$APP_PATH"

    # Compile native AppleScript app bundle pointing to launch.sh
    TEMP_SCRIPT="/tmp/seeker_compile_$$.applescript"
    echo "do shell script \"$LAUNCH_SCRIPT > /dev/null 2>&1 &\"" > "$TEMP_SCRIPT"
    osacompile -o "$APP_PATH" "$TEMP_SCRIPT"
    rm -f "$TEMP_SCRIPT"

    # Copy ICNS icon
    if [ -f "$SCRIPT_DIR/assets/Seeker.icns" ]; then
        cp "$SCRIPT_DIR/assets/Seeker.icns" "$APP_PATH/Contents/Resources/applet.icns"
        cp "$SCRIPT_DIR/assets/Seeker.icns" "$APP_PATH/Contents/Resources/Seeker.icns"
    fi

    # Update Info.plist
    PLIST="$APP_PATH/Contents/Info.plist"
    if [ -f "$PLIST" ]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleName Seeker" "$PLIST" 2>/dev/null || true
        /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Seeker" "$PLIST" 2>/dev/null || true
        /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.seeker.app" "$PLIST" 2>/dev/null || true
    fi

    # Refresh macOS LaunchServices & Spotlight cache
    touch "$APP_PATH"
    if command -v mdimport &> /dev/null; then
        mdimport "$APP_PATH" 2>/dev/null || true
    fi

    echo "✅ Seeker.app successfully registered in Applications!"
    echo "💡 You can now search 'Seeker' in Spotlight (Cmd + Space) or Launchpad to open it anytime!"

elif [ "$OS" = "Linux" ]; then
    # --- Linux Desktop Entry ---
    DESKTOP_DIR="$HOME/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    
    cat << EOF > "$DESKTOP_DIR/seeker.desktop"
[Desktop Entry]
Name=Seeker
Comment=Seeker — Automated Messenger Studio & Sandbox Dispatcher
Exec=$LAUNCH_SCRIPT
Icon=$SCRIPT_DIR/public/icon.png
Terminal=false
Type=Application
Categories=Network;Utility;
EOF

    chmod +x "$DESKTOP_DIR/seeker.desktop"
    echo "✅ Seeker desktop launcher created at $DESKTOP_DIR/seeker.desktop"
fi
