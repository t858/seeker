<div align="center">

# ⚡ Seeker — Intelligent Messenger Automation Studio

**A native desktop & web platform for automated messaging, isolated browser sandboxing, multi-account persona management, and real-time delivery diagnostics.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-emerald.svg)](https://github.com)
[![Engine](https://img.shields.io/badge/Engine-Playwright%20%2B%20Electron-indigo.svg)](https://github.com)

</div>

---

## 🚀 One-Line Terminal Installation

You can install and register **Seeker** on your system in seconds using the terminal.

### 🍏 macOS & 🐧 Linux

Open your **Terminal** and run:

```bash
git clone https://github.com/t858/seeker.git
cd seeker
./install.sh
npm start
```

> **What happens during installation?**  
> `install.sh` automatically installs core dependencies, configures the anti-detection sandbox engine, and registers **Seeker** as a native application (`/Applications/Seeker.app` on macOS or desktop launcher on Linux). Running `npm start` opens the application for the first time.

---

### 🪟 Windows

Open **Command Prompt** or **PowerShell** and run:

```cmd
git clone https://github.com/t858/seeker.git
cd seeker
install.bat
npm start
```

> `install.bat` configures all dependencies, verifies the desktop engine, and creates direct shortcuts in your **Start Menu** and on your **Desktop**. Running `npm start` opens the application for the first time.

---

## 🎯 How to Reopen Seeker Afterwards (No Terminal Needed!)

Once the first-time launch is complete, **you do NOT need to use the terminal again**.

### 🍏 On macOS:
1. Press <kbd>Cmd</kbd> + <kbd>Space</kbd> to open **Spotlight** (or open **Launchpad** / **Applications**).
2. Type **`Seeker`** and press <kbd>Enter</kbd>.
3. **Seeker** will launch automatically and open the full automation dashboard.

### 🪟 On Windows:
1. Open your **Start Menu** or search **`Seeker`**.
2. Click the **Seeker** icon (or double-click the **Seeker** shortcut on your Desktop).

### 🐧 On Linux:
1. Open your **Application Launcher** and click **`Seeker`**.

---

## ✨ Features

* **Smart Header Targeting**: Clicks strictly the profile header **"Message"** button. Completely avoids comment inputs, like buttons, or post boxes.
* **Isolated Multi-Account Sandboxes**: Manage unlimited Facebook accounts with isolated user profiles. Delete an account to instantly wipe its sandbox data from disk.
* **Direct Non-Friend Fallback**: Handles URL parameters, complex profile formats, and direct thread fallbacks (`/messages/t/<id>`).
* **Real-Time Delivery Diagnostics**: Live verification reporting delivery success or exact failure causes (`PRIVACY_RESTRICTED`, `PROFILE_NOT_FOUND`, `RATE_LIMITED`, `DELIVERED`).
* **Batch Queue Dispatcher**: Send to lists of profiles with configurable anti-spam safety delays.

---

## 🛠️ Developer & Advanced Commands

If you ever want to run Seeker directly from the command line:

```bash
# Launch Electron Desktop Studio
npm start

# Run Web Server Only (accessible on http://localhost:3000)
npm run server

# Re-register / Rebuild OS App Launcher
npm run install:app
```

---

## 📄 License
ISC License — built for efficiency and seamless automation.
