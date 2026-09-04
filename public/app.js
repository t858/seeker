// Client-side Application Logic with Sandbox Browser & Account Deletion
document.addEventListener('DOMContentLoaded', () => {
  let ws = null;
  let historyData = [];
  let accountsData = [];
  let activeAccountId = 'default';
  let currentFilter = 'all';

  // Splash Screen Elements
  const splashScreen = document.getElementById('splashScreen');
  const splashProgressBar = document.getElementById('splashProgressBar');
  const splashStatusText = document.getElementById('splashStatusText');
  const splashPercent = document.getElementById('splashPercent');
  const appContainer = document.getElementById('appContainer');

  // Elements
  const authStatusBadge = document.getElementById('authStatusBadge');
  const loginBtn = document.getElementById('loginBtn');
  const accountSelect = document.getElementById('accountSelect');
  const openManageAccountsBtn = document.getElementById('openManageAccountsBtn');
  const manageAccountsModal = document.getElementById('manageAccountsModal');
  const closeManageAccountsBtn = document.getElementById('closeManageAccountsBtn');
  const doneManageAccountsBtn = document.getElementById('doneManageAccountsBtn');
  const accountsTableBody = document.getElementById('accountsTableBody');
  const newAccountInput = document.getElementById('newAccountInput');
  const createAccountBtn = document.getElementById('createAccountBtn');
  const activeSenderLabel = document.getElementById('activeSenderLabel');

  const tabSingle = document.getElementById('tabSingle');
  const tabBulk = document.getElementById('tabBulk');
  const singleForm = document.getElementById('singleForm');
  const bulkForm = document.getElementById('bulkForm');
  const singleRecipient = document.getElementById('singleRecipient');
  const singleMessage = document.getElementById('singleMessage');
  const charCount = document.getElementById('charCount');
  const sendSingleBtn = document.getElementById('sendSingleBtn');
  const stopTaskBtn = document.getElementById('stopTaskBtn');
  const bulkRecipients = document.getElementById('bulkRecipients');
  const bulkMessage = document.getElementById('bulkMessage');
  const bulkDelay = document.getElementById('bulkDelay');
  const startQueueBtn = document.getElementById('startQueueBtn');
  const consoleLogs = document.getElementById('consoleLogs');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const historyTableBody = document.getElementById('historyTableBody');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // Splash Screen Build-Up Animation Controller (5-second sequence)
  function runSplashScreen() {
    if (!splashScreen) return;

    const stages = [
      { progress: 15, text: 'Initializing Seeker security runtime...', delay: 600 },
      { progress: 35, text: 'Preparing isolated Chromium sandboxes...', delay: 1500 },
      { progress: 60, text: 'Connecting real-time telemetry stream...', delay: 2400 },
      { progress: 82, text: 'Loading multi-account profiles...', delay: 3300 },
      { progress: 95, text: 'Calibrating smart DOM selector engine...', delay: 4100 },
      { progress: 100, text: 'Seeker Studio ready.', delay: 4700 },
    ];

    stages.forEach(({ progress, text, delay }) => {
      setTimeout(() => {
        if (splashProgressBar) splashProgressBar.style.width = `${progress}%`;
        if (splashPercent) splashPercent.textContent = `${progress}%`;
        if (splashStatusText) splashStatusText.textContent = text;
      }, delay);
    });

    // Smoothly transition from splash to main dashboard UI at exactly 5 seconds
    setTimeout(() => {
      if (splashScreen) {
        splashScreen.classList.add('opacity-0', 'scale-105', 'pointer-events-none');
      }
      if (appContainer) {
        appContainer.classList.remove('app-hidden');
        appContainer.classList.add('app-visible');
      }

      setTimeout(() => {
        if (splashScreen) splashScreen.style.display = 'none';
      }, 750);
    }, 5000);
  }

  // 1. Character Counter
  singleMessage.addEventListener('input', () => {
    charCount.textContent = `${singleMessage.value.length} characters`;
  });

  // 2. Tab Navigation
  tabSingle.addEventListener('click', () => {
    tabSingle.className = 'flex items-center gap-2 text-sm font-semibold text-blue-400 border-b-2 border-blue-500 pb-2 transition';
    tabBulk.className = 'flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-200 pb-2 transition';
    singleForm.classList.remove('hidden');
    bulkForm.classList.add('hidden');
  });

  tabBulk.addEventListener('click', () => {
    tabBulk.className = 'flex items-center gap-2 text-sm font-semibold text-blue-400 border-b-2 border-blue-500 pb-2 transition';
    tabSingle.className = 'flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-200 pb-2 transition';
    bulkForm.classList.remove('hidden');
    singleForm.classList.add('hidden');
  });

  // 3. Accounts & Sandbox Management
  async function loadAccounts() {
    try {
      const res = await fetch('/api/accounts');
      accountsData = await res.json();
      renderAccountSelect();
      renderAccountsTable();
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  }

  function renderAccountSelect() {
    accountSelect.innerHTML = accountsData
      .map(
        (acc) =>
          `<option value="${acc.id}" ${acc.active ? 'selected' : ''}>${escapeHtml(acc.name)} ${
            acc.hasSession ? '🟢' : '🟡'
          }</option>`
      )
      .join('');

    const active = accountsData.find((a) => a.active) || accountsData[0];
    if (active) {
      activeAccountId = active.id;
      activeSenderLabel.textContent = active.name;
      updateAuthBadge(active.hasSession);
    }
  }

  function renderAccountsTable() {
    if (!accountsTableBody) return;

    accountsTableBody.innerHTML = accountsData
      .map((acc) => {
        const isReady = acc.hasSession;
        const statusBadge = isReady
          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ready
             </span>`
          : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Needs Login
             </span>`;

        return `
          <tr class="hover:bg-slate-900/50 transition">
            <td class="py-3 px-4">
              <div class="font-medium text-slate-200">${escapeHtml(acc.name)}</div>
              <div class="text-[10px] text-slate-500 font-mono">ID: ${escapeHtml(acc.id)}</div>
            </td>
            <td class="py-3 px-4">${statusBadge}</td>
            <td class="py-3 px-4 text-right space-x-2">
              <button class="launch-acc-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition" data-id="${acc.id}" title="Launch isolated sandbox browser for this account">
                🚀 Launch
              </button>
              <button class="reset-acc-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition" data-id="${acc.id}" title="Wipe session cookies for this sandbox">
                🧹 Wipe
              </button>
              <button class="delete-acc-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition" data-id="${acc.id}" data-name="${escapeHtml(acc.name)}" title="Delete account and purge sandbox from disk">
                🗑️ Delete
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    // Attach actions in modal table
    document.querySelectorAll('.launch-acc-btn').forEach((btn) => {
      btn.addEventListener('click', () => launchAccountSandbox(btn.dataset.id));
    });

    document.querySelectorAll('.reset-acc-btn').forEach((btn) => {
      btn.addEventListener('click', () => resetAccountSandbox(btn.dataset.id));
    });

    document.querySelectorAll('.delete-acc-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteAccount(btn.dataset.id, btn.dataset.name));
    });

    if (window.lucide) lucide.createIcons();
  }

  accountSelect.addEventListener('change', async (e) => {
    const selectedId = e.target.value;
    try {
      await fetch(`/api/accounts/${selectedId}/select`, { method: 'POST' });
      await loadAccounts();
    } catch (err) {
      console.error('Failed to switch account:', err);
    }
  });

  // Modal open/close
  openManageAccountsBtn.addEventListener('click', () => {
    loadAccounts();
    manageAccountsModal.classList.remove('hidden');
  });

  function closeAccountsModal() {
    manageAccountsModal.classList.add('hidden');
  }

  closeManageAccountsBtn.addEventListener('click', closeAccountsModal);
  doneManageAccountsBtn.addEventListener('click', closeAccountsModal);

  // Add Account in Modal
  createAccountBtn.addEventListener('click', async () => {
    const name = newAccountInput.value.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      newAccountInput.value = '';
      await loadAccounts();
      appendLog(`👤 Created new sandbox account: "${data.name}". Launch the sandbox browser to log in.`);
    } catch (err) {
      alert(`Error creating account: ${err.message}`);
    }
  });

  async function launchAccountSandbox(id) {
    try {
      appendLog(`🚀 Launching sandbox browser for account...`);
      const res = await fetch(`/api/accounts/${id}/login`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      appendLog(`❌ Error launching sandbox: ${err.message}`, 'error');
    }
  }

  async function resetAccountSandbox(id) {
    if (!confirm('Are you sure you want to wipe all stored cookies and session data for this sandbox?')) return;
    try {
      await fetch(`/api/accounts/${id}/reset`, { method: 'POST' });
      await loadAccounts();
    } catch (err) {
      console.error('Failed to reset sandbox:', err);
    }
  }

  async function deleteAccount(id, name) {
    if (!confirm(`Are you sure you want to permanently delete "${name}" and completely purge its sandbox from disk?`)) return;
    try {
      await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      appendLog(`🗑️ Deleted account "${name}" and removed sandbox.`);
      await loadAccounts();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  }

  // 4. WebSocket Connection
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      appendLog('🔌 Connected to live sandbox stream.', 'system');
      loadAccounts();
      loadHistory();
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        handleWsMessage(type, data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  }

  function handleWsMessage(type, data) {
    switch (type) {
      case 'log':
        appendLog(data);
        break;
      case 'task_start':
        setTaskRunning(true);
        appendLog(`🚀 [${data.account || 'Sandbox'}] Task started for: ${data.recipient}`);
        break;
      case 'task_complete':
        setTaskRunning(false);
        loadHistory();
        break;
      case 'task_error':
        setTaskRunning(false);
        appendLog(`❌ Task error: ${data.error}`, 'error');
        break;
      case 'countdown':
        appendLog(`⏳ Countdown: ${data.secondsLeft}s until next recipient (${data.nextIndex}/${data.total})`);
        break;
      case 'queue_finished':
        setTaskRunning(false);
        appendLog(`🏁 Queue finished for ${data.total} recipients.`);
        loadHistory();
        break;
      case 'accounts_updated':
        loadAccounts();
        break;
      case 'auth_status':
        loadAccounts();
        break;
    }
  }

  // 5. Logging Helper
  function appendLog(message, type = 'normal') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEl = document.createElement('div');
    logEl.className = 'log-entry flex items-start gap-2';

    let colorClass = 'text-slate-300';
    if (message.includes('❌') || message.includes('Error') || type === 'error') {
      colorClass = 'text-rose-400';
    } else if (message.includes('✅') || message.includes('🎉') || message.includes('verified')) {
      colorClass = 'text-emerald-400 font-semibold';
    } else if (message.includes('⚠️') || message.includes('⏳')) {
      colorClass = 'text-amber-400';
    } else if (message.includes('🎯') || message.includes('👉') || message.includes('👤') || message.includes('🛡️')) {
      colorClass = 'text-blue-400';
    }

    logEl.innerHTML = `
      <span class="text-slate-600 select-none">[${time}]</span>
      <span class="${colorClass}">${escapeHtml(message)}</span>
    `;

    consoleLogs.appendChild(logEl);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  clearLogsBtn.addEventListener('click', () => {
    consoleLogs.innerHTML = '<div class="text-slate-500 italic">Logs cleared. Ready for next task.</div>';
  });

  function updateAuthBadge(hasSession) {
    if (hasSession) {
      authStatusBadge.innerHTML = `<i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Sandbox Ready`;
      authStatusBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    } else {
      authStatusBadge.innerHTML = `<i data-lucide="shield-alert" class="w-3.5 h-3.5"></i> Needs Login`;
      authStatusBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
    if (window.lucide) lucide.createIcons();
  }

  // 6. Header Login Trigger for Active Account Sandbox
  loginBtn.addEventListener('click', () => {
    launchAccountSandbox(activeAccountId);
  });

  // 7. Single Message Submit
  singleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const recipient = singleRecipient.value.trim();
    const message = singleMessage.value.trim();

    if (!recipient || !message) return;

    setTaskRunning(true);
    appendLog(`📤 Sending message to "${recipient}" via active sandbox...`);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, message, accountId: activeAccountId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send request failed.');

      if (data.status === 'DELIVERED') {
        appendLog(`🎉 SUCCESS: Message delivered to "${recipient}"!`);
      } else {
        appendLog(`❌ FAILURE: ${data.diagnostic}`, 'error');
      }
    } catch (err) {
      appendLog(`❌ Error: ${err.message}`, 'error');
    } finally {
      setTaskRunning(false);
      loadHistory();
    }
  });

  // 8. Bulk Queue Submit
  bulkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawRecipients = bulkRecipients.value.trim().split('\n').map((s) => s.trim()).filter(Boolean);
    const message = bulkMessage.value.trim();
    const delaySeconds = parseInt(bulkDelay.value, 10) || 45;

    if (rawRecipients.length === 0 || !message) {
      alert('Please provide at least one recipient and a message.');
      return;
    }

    const items = rawRecipients.map((r) => ({ recipient: r, message }));

    setTaskRunning(true);
    appendLog(`📋 Enqueueing ${items.length} messages using active sandbox with ${delaySeconds}s delay...`);

    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, delaySeconds, accountId: activeAccountId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Queue failed to start.');
      appendLog('🚀 Batch sandbox queue started!');
    } catch (err) {
      appendLog(`❌ Error: ${err.message}`, 'error');
      setTaskRunning(false);
    }
  });

  // 9. Stop Task
  stopTaskBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/stop', { method: 'POST' });
      appendLog('⏹️ Sent cancellation request.');
    } catch (err) {
      console.error('Stop request failed:', err);
    }
  });

  function setTaskRunning(running) {
    if (running) {
      sendSingleBtn.disabled = true;
      sendSingleBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Processing...`;
      startQueueBtn.disabled = true;
      stopTaskBtn.classList.remove('hidden');
    } else {
      sendSingleBtn.disabled = false;
      sendSingleBtn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> <span>Send Message</span>`;
      startQueueBtn.disabled = false;
      stopTaskBtn.classList.add('hidden');
    }
    if (window.lucide) lucide.createIcons();
  }

  // 10. Delivery History Loader & Renderer
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      historyData = await res.json();
      renderHistory();
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function renderHistory() {
    let filtered = historyData;
    if (currentFilter !== 'all') {
      filtered = historyData.filter((item) => item.status === currentFilter);
    }

    if (filtered.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-slate-500 italic">No matching delivery records found.</td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = filtered
      .map((item) => {
        const isDelivered = item.status === 'DELIVERED';
        const statusBadge = isDelivered
          ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Delivered
             </span>`
          : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Failed
             </span>`;

        const timeString = new Date(item.timestamp).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return `
          <tr class="hover:bg-slate-900/60 transition group">
            <td class="py-3.5 px-4 font-medium text-slate-200">
              <div class="flex items-center gap-2">
                <span class="truncate max-w-[170px]" title="${escapeHtml(item.recipient)}">${escapeHtml(item.recipient)}</span>
                ${
                  item.resolvedUrl && item.resolvedUrl.startsWith('http')
                    ? `<a href="${item.resolvedUrl}" target="_blank" class="text-slate-500 hover:text-blue-400 transition" title="Open profile">
                        <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                      </a>`
                    : ''
                }
              </div>
            </td>
            <td class="py-3.5 px-4 text-slate-300 font-medium whitespace-nowrap">
              <span class="inline-flex items-center gap-1 text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                <i data-lucide="shield" class="w-3 h-3 text-blue-400"></i>
                ${escapeHtml(item.account || 'Sandbox 1')}
              </span>
            </td>
            <td class="py-3.5 px-4">
              <p class="truncate max-w-[180px] text-slate-400" title="${escapeHtml(item.message)}">
                ${escapeHtml(item.message)}
              </p>
            </td>
            <td class="py-3.5 px-4">${statusBadge}</td>
            <td class="py-3.5 px-4">
              <div class="text-xs text-slate-300 max-w-[260px]">
                <span class="font-mono text-[10px] uppercase text-slate-500 block">${escapeHtml(item.code || 'UNKNOWN')}</span>
                ${escapeHtml(item.diagnostic || 'No diagnostic info available.')}
              </div>
            </td>
            <td class="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">${timeString}</td>
            <td class="py-3.5 px-4 text-right">
              <button
                class="resend-btn text-xs text-blue-400 hover:text-blue-300 transition font-medium"
                data-recipient="${escapeHtml(item.recipient)}"
                data-message="${escapeHtml(item.message)}"
              >
                Retry
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    if (window.lucide) lucide.createIcons();

    // Attach retry button events
    document.querySelectorAll('.resend-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        singleRecipient.value = btn.dataset.recipient;
        singleMessage.value = btn.dataset.message;
        charCount.textContent = `${singleMessage.value.length} characters`;
        tabSingle.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // 11. History Filters & Clear
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => {
        b.className = 'filter-btn px-3 py-1 rounded-md text-slate-400 hover:text-slate-200';
      });
      btn.className = 'filter-btn px-3 py-1 rounded-md text-blue-400 bg-slate-800 font-medium';
      currentFilter = btn.dataset.filter;
      renderHistory();
    });
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear delivery history?')) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
      historyData = [];
      renderHistory();
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initialize
  runSplashScreen();
  connectWebSocket();
});
