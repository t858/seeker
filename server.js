const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { sendFacebookMessage, launchSandboxBrowser, normalizeProfile } = require('./engine/messenger');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SANDBOXES_ROOT = path.join(__dirname, 'sandboxes');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SANDBOXES_ROOT)) {
  fs.mkdirSync(SANDBOXES_ROOT, { recursive: true });
}

// ----------------- Account & History Storage Helpers -----------------

function getAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((a) => ({
          ...a,
          sandboxDir: path.join(SANDBOXES_ROOT, a.id),
        }));
      }
    }
  } catch {
    // Ignore
  }

  // Default initial sandbox account
  const defaultAccs = [
    {
      id: 'default',
      name: 'Sandbox Account 1',
      sandboxDir: path.join(SANDBOXES_ROOT, 'default'),
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
  saveAccounts(defaultAccs);
  return defaultAccs;
}

function saveAccounts(accounts) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  } catch (err) {
    console.error('Failed to save accounts:', err);
  }
}

function getActiveAccount() {
  const accs = getAccounts();
  return accs.find((a) => a.active) || accs[0];
}

function getHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch {
    // Ignore
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

// Broadcast WebSocket message to all connected clients
function broadcast(type, data) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Queue state
let isQueueRunning = false;
let currentTask = null;
let stopRequested = false;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------- API Endpoints -----------------

// 1. Status endpoint
app.get('/api/status', async (req, res) => {
  const activeAcc = getActiveAccount();
  const sDir = activeAcc.sandboxDir || path.join(SANDBOXES_ROOT, activeAcc.id);
  const hasSavedSession = fs.existsSync(sDir) && fs.readdirSync(sDir).length > 0;

  res.json({
    hasSavedSession,
    isQueueRunning,
    currentTask,
    activeAccount: activeAcc,
  });
});

// 2. Accounts Endpoints
app.get('/api/accounts', (req, res) => {
  const accounts = getAccounts().map((acc) => {
    const sDir = acc.sandboxDir || path.join(SANDBOXES_ROOT, acc.id);
    const hasSession = fs.existsSync(sDir) && fs.readdirSync(sDir).length > 0;
    return {
      ...acc,
      sandboxDir: sDir,
      hasSession,
    };
  });
  res.json(accounts);
});

app.post('/api/accounts', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Account name is required.' });
  }

  const accounts = getAccounts();
  const id = `sandbox_${Date.now()}`;
  const sandboxDir = path.join(SANDBOXES_ROOT, id);
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true });
  }

  const newAcc = {
    id,
    name: name.trim(),
    sandboxDir,
    active: accounts.length === 0,
    createdAt: new Date().toISOString(),
  };

  accounts.push(newAcc);
  saveAccounts(accounts);
  broadcast('accounts_updated', accounts);
  res.json(newAcc);
});

app.post('/api/accounts/:id/select', (req, res) => {
  const { id } = req.params;
  const accounts = getAccounts().map((a) => ({
    ...a,
    active: a.id === id,
  }));
  saveAccounts(accounts);
  broadcast('accounts_updated', accounts);
  broadcast('log', `👤 Switched active sandbox account to: ${accounts.find((a) => a.id === id)?.name}`);
  res.json({ success: true, activeAccount: accounts.find((a) => a.id === id) });
});

// Delete Account & purge sandbox from disk
app.delete('/api/accounts/:id', (req, res) => {
  const { id } = req.params;
  let accounts = getAccounts();

  const target = accounts.find((a) => a.id === id);
  if (target) {
    const sDir = target.sandboxDir || path.join(SANDBOXES_ROOT, target.id);
    if (fs.existsSync(sDir)) {
      try {
        fs.rmSync(sDir, { recursive: true, force: true });
        broadcast('log', `🗑️ Purged sandbox profile storage for: "${target.name}"`);
      } catch (e) {
        console.error('Error removing sandbox dir:', e);
      }
    }
  }

  accounts = accounts.filter((a) => a.id !== id);

  // If no accounts remain, generate a fresh clean account
  if (accounts.length === 0) {
    const freshId = `sandbox_${Date.now()}`;
    const freshDir = path.join(SANDBOXES_ROOT, freshId);
    if (!fs.existsSync(freshDir)) {
      fs.mkdirSync(freshDir, { recursive: true });
    }
    accounts.push({
      id: freshId,
      name: 'Sandbox Account 1',
      sandboxDir: freshDir,
      active: true,
      createdAt: new Date().toISOString(),
    });
  } else if (!accounts.some((a) => a.active)) {
    accounts[0].active = true;
  }

  saveAccounts(accounts);
  broadcast('accounts_updated', accounts);
  res.json({ success: true, accounts });
});

// Reset Sandbox (Wipe cookies/session data)
app.post('/api/accounts/:id/reset', (req, res) => {
  const { id } = req.params;
  const accounts = getAccounts();
  const target = accounts.find((a) => a.id === id);

  if (target) {
    const sDir = target.sandboxDir || path.join(SANDBOXES_ROOT, target.id);
    if (fs.existsSync(sDir)) {
      try {
        fs.rmSync(sDir, { recursive: true, force: true });
        fs.mkdirSync(sDir, { recursive: true });
        broadcast('log', `🧹 Wiped session data for sandbox: "${target.name}"`);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  broadcast('accounts_updated', getAccounts());
  res.json({ success: true });
});

// 3. Launch Interactive Sandbox Browser for Login
app.post('/api/accounts/:id/login', async (req, res) => {
  const { id } = req.params;
  const accounts = getAccounts();
  const targetAcc = accounts.find((a) => a.id === id) || getActiveAccount();
  const sDir = targetAcc.sandboxDir || path.join(SANDBOXES_ROOT, targetAcc.id);

  broadcast('log', `🚀 Launching isolated sandbox browser for: "${targetAcc.name}"...`);

  try {
    const handle = await launchSandboxBrowser(sDir);
    const { context, browser } = handle;
    const page = context.pages()[0] || (await context.newPage());
    page.setDefaultNavigationTimeout(90000);

    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' }).catch(() => {});
    broadcast('log', `👉 Sandbox window open. Please log into Facebook for "${targetAcc.name}".`);

    // Listen for login completion
    const checkLogin = setInterval(async () => {
      try {
        const url = page.url();
        const emailInput = await page.$('input[name="email"]');
        if (!url.includes('login') && !emailInput && url.includes('facebook.com')) {
          clearInterval(checkLogin);
          broadcast('log', `🎉 Login detected for "${targetAcc.name}"! Saving sandbox session...`);
          await page.waitForTimeout(3000);
          await browser.close().catch(() => {});
          broadcast('log', `✅ Sandbox session for "${targetAcc.name}" saved! Ready to dispatch.`);
          broadcast('accounts_updated', getAccounts());
          broadcast('auth_status', { loggedIn: true, account: targetAcc });
        }
      } catch {
        // Window closed or navigation
      }
    }, 2500);

    res.json({ success: true, message: `Sandbox browser launched for ${targetAcc.name}.` });
  } catch (err) {
    broadcast('log', `❌ Error launching sandbox browser: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// 4. Single Send Endpoint
app.post('/api/send', async (req, res) => {
  const { recipient, message, accountId } = req.body;

  if (!recipient || !message) {
    return res.status(400).json({ error: 'Recipient and message are required.' });
  }

  if (isQueueRunning || currentTask) {
    return res.status(409).json({ error: 'Another automation task is currently in progress.' });
  }

  const accounts = getAccounts();
  const senderAccount = accounts.find((a) => a.id === accountId) || getActiveAccount();
  const sDir = senderAccount.sandboxDir || path.join(SANDBOXES_ROOT, senderAccount.id);

  currentTask = {
    recipient,
    message,
    account: senderAccount.name,
    startedAt: new Date().toISOString(),
  };
  broadcast('task_start', currentTask);

  const logFn = (msg) => {
    console.log(msg);
    broadcast('log', msg);
  };

  try {
    const result = await sendFacebookMessage({
      recipient,
      message,
      sandboxDir: sDir,
      log: logFn,
    });

    const history = getHistory();
    const record = {
      id: Date.now().toString(),
      recipient,
      resolvedUrl: normalizeProfile(recipient),
      message,
      account: senderAccount.name,
      status: result.status,
      code: result.code,
      diagnostic: result.diagnostic,
      durationMs: result.duration,
      timestamp: new Date().toISOString(),
    };

    history.unshift(record);
    saveHistory(history);

    broadcast('task_complete', record);
    currentTask = null;

    res.json(record);
  } catch (err) {
    currentTask = null;
    broadcast('task_error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// 5. Batch Queue Endpoint
app.post('/api/queue', async (req, res) => {
  const { items, delaySeconds = 45, accountId } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required.' });
  }

  if (isQueueRunning) {
    return res.status(409).json({ error: 'Queue is already running.' });
  }

  const accounts = getAccounts();
  const senderAccount = accounts.find((a) => a.id === accountId) || getActiveAccount();
  const sDir = senderAccount.sandboxDir || path.join(SANDBOXES_ROOT, senderAccount.id);

  isQueueRunning = true;
  stopRequested = false;

  res.json({ success: true, message: `Started queue of ${items.length} messages using "${senderAccount.name}".` });

  (async () => {
    const logFn = (msg) => {
      console.log(msg);
      broadcast('log', msg);
    };

    logFn(`📋 Starting batch queue of ${items.length} recipients using sandbox "${senderAccount.name}"...`);

    for (let i = 0; i < items.length; i++) {
      if (stopRequested) {
        logFn('⏹️ Batch queue cancelled by user.');
        break;
      }

      const item = items[i];
      logFn(`\n[${i + 1}/${items.length}] Processing: ${item.recipient}`);

      currentTask = {
        recipient: item.recipient,
        message: item.message,
        account: senderAccount.name,
        startedAt: new Date().toISOString(),
      };
      broadcast('task_start', currentTask);

      const result = await sendFacebookMessage({
        recipient: item.recipient,
        message: item.message,
        sandboxDir: sDir,
        log: logFn,
      });

      const history = getHistory();
      const record = {
        id: Date.now().toString(),
        recipient: item.recipient,
        resolvedUrl: normalizeProfile(item.recipient),
        message: item.message,
        account: senderAccount.name,
        status: result.status,
        code: result.code,
        diagnostic: result.diagnostic,
        durationMs: result.duration,
        timestamp: new Date().toISOString(),
      };
      history.unshift(record);
      saveHistory(history);

      broadcast('task_complete', record);
      currentTask = null;

      if (i < items.length - 1 && !stopRequested) {
        logFn(`⏳ Safe delay: waiting ${delaySeconds}s before next message...`);
        for (let s = delaySeconds; s > 0; s--) {
          if (stopRequested) break;
          broadcast('countdown', { secondsLeft: s, nextIndex: i + 2, total: items.length });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    isQueueRunning = false;
    stopRequested = false;
    broadcast('queue_finished', { total: items.length });
    logFn('🏁 Batch queue execution complete.');
  })();
});

// 6. Stop Endpoint
app.post('/api/stop', (req, res) => {
  stopRequested = true;
  isQueueRunning = false;
  currentTask = null;
  broadcast('log', '⏹️ Stop requested. Halting tasks...');
  res.json({ success: true, message: 'Stop requested.' });
});

// 7. History Endpoints
app.get('/api/history', (req, res) => {
  res.json(getHistory());
});

app.delete('/api/history', (req, res) => {
  saveHistory([]);
  broadcast('history_cleared', {});
  res.json({ success: true, message: 'History cleared.' });
});

// Start Server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Facebook Messenger Automation Studio is live!`);
  console.log(`👉 Open: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
