const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow = null;
let serverProcess = null;

const PORT = 3000;
const ICON_PATH = path.join(__dirname, 'public', 'icon.png');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function startServer() {
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: PORT.toString() },
    stdio: 'inherit',
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start internal backend server:', err);
  });
}

async function waitForServer(url, timeout = 15000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Continue polling
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

app.name = 'Seeker';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Seeker',
    icon: ICON_PATH,
    backgroundColor: '#020617',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const serverUrl = `http://localhost:${PORT}`;
  const ready = await waitForServer(`${serverUrl}/api/status`);

  if (ready) {
    mainWindow.loadURL(serverUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Open external links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Set custom Dock icon on macOS
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(ICON_PATH);
  }

  const serverUrl = `http://localhost:${PORT}`;
  const alreadyRunning = await waitForServer(`${serverUrl}/api/status`, 800);
  if (!alreadyRunning) {
    startServer();
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});
