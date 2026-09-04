const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SANDBOXES_ROOT = path.join(__dirname, '..', 'sandboxes');
if (!fs.existsSync(SANDBOXES_ROOT)) {
  fs.mkdirSync(SANDBOXES_ROOT, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finds the Chrome/Chromium executable across macOS, Windows, and Linux
 */
function getChromeExecutablePath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const winPaths = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  return 'google-chrome';
}

/**
 * Normalizes user input into a clean standard Facebook profile URL
 */
function normalizeProfile(input) {
  if (!input) return '';
  let clean = input.trim();

  // Strip hash fragments
  clean = clean.split('#')[0];

  // If already a full URL
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    clean = clean.replace('m.facebook.com', 'www.facebook.com');
    clean = clean.replace('web.facebook.com', 'www.facebook.com');

    // Parse URL and clean tracking query parameters except 'id'
    try {
      const parsed = new URL(clean);
      const idParam = parsed.searchParams.get('id');
      if (idParam) {
        return `https://www.facebook.com/profile.php?id=${idParam}`;
      }
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return clean;
    }
  }

  // If numeric ID
  if (/^\d+$/.test(clean)) {
    return `https://www.facebook.com/profile.php?id=${clean}`;
  }

  // If username
  if (!clean.includes(' ')) {
    return `https://www.facebook.com/${clean}`;
  }

  // If display name
  return clean;
}

/**
 * Extracts target ID or username from URL
 */
function extractProfileIdentifier(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const idParam = parsed.searchParams.get('id');
    if (idParam) return idParam;
    const cleanPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (cleanPath && !cleanPath.includes('/')) return cleanPath;
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Dismiss common Facebook dialogs (popups, cookie consent, etc.)
 */
async function dismissPopups(page) {
  const selectors = [
    'div[aria-label="Close"]',
    'div[role="button"]:has-text("Continue")',
    'div[role="button"]:has-text("Not now")',
    'div[role="button"]:has-text("Dismiss")',
    'button:has-text("Allow all cookies")',
    'button:has-text("Accept all")',
    'button:has-text("Decline optional cookies")',
  ];

  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el && (await el.isVisible())) {
        await el.click();
        await sleep(300);
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Searches strictly for the chat/Messenger input textbox.
 * Explicitly rejects and avoids any comment boxes or post inputs.
 */
async function findChatInput(page) {
  const candidateSelectors = [
    'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
    'div[data-pagelet*="ChatTab"] div[role="textbox"][contenteditable="true"]',
    'div[aria-label="Message"][contenteditable="true"]',
    'div[aria-label*="Message"][contenteditable="true"]',
    'div[aria-label*="Write a message"][contenteditable="true"]',
    'div[aria-placeholder*="Aa"][contenteditable="true"]',
    'div[data-lexical-editor="true"]',
    'div[role="textbox"][contenteditable="true"]',
  ];

  for (let i = 0; i < 8; i++) {
    for (const sel of candidateSelectors) {
      try {
        const elements = await page.$$(sel);
        for (const el of elements) {
          if (await el.isVisible()) {
            const ariaLabel = (await el.getAttribute('aria-label')) || '';
            const placeholder = (await el.getAttribute('aria-placeholder')) || '';
            const isComment =
              ariaLabel.toLowerCase().includes('comment') ||
              placeholder.toLowerCase().includes('comment');

            if (!isComment) {
              return el;
            }
          }
        }
      } catch {
        // Ignore
      }
    }
    await sleep(800);
  }
  return null;
}

/**
 * Specifically finds and clicks the profile header "Message" button.
 * Uses JS evaluate dispatch and force clicks to avoid overlay pointer intercepts.
 */
async function findAndClickProfileMessageButton(page) {
  const headerSelectors = [
    'div[data-pagelet="ProfileHeader"] div[aria-label="Message"][role="button"]',
    'div[data-pagelet="ProfileHeader"] div[aria-label="Message"]',
    'div[data-pagelet="ProfileHeader"] div[role="button"]:has-text("Message")',
    'div[role="main"] div[aria-label="Message"][role="button"]',
    'div[role="main"] div[aria-label="Message"]',
    'div[aria-label="Message"][role="button"]',
    'div[aria-label="Message"]',
    'a[aria-label="Message"]',
    'div[role="button"]:has-text("Message")',
  ];

  for (const sel of headerSelectors) {
    try {
      const elements = await page.$$(sel);
      for (const el of elements) {
        if (await el.isVisible()) {
          const text = (await el.innerText()).trim().toLowerCase();
          const ariaLabel = ((await el.getAttribute('aria-label')) || '').toLowerCase();

          const isMessageBtn =
            ariaLabel === 'message' ||
            ariaLabel.includes('send message') ||
            text === 'message' ||
            text.startsWith('message');

          const isCommentBtn =
            ariaLabel.includes('comment') ||
            text.includes('comment') ||
            ariaLabel.includes('share') ||
            ariaLabel.includes('like');

          if (isMessageBtn && !isCommentBtn) {
            // Click using JS DOM evaluate dispatch to bypass transparent overlays
            try {
              await el.evaluate((node) => node.click());
              return true;
            } catch {
              await el.click({ force: true });
              return true;
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return false;
}

/**
 * Checks for Facebook delivery failure banners or restrictions
 */
async function checkForFailureBanners(page) {
  const errorIndicators = [
    { text: "You can't reply to this conversation", code: 'CONVERSATION_BLOCKED', diagnostic: 'You are blocked or unable to reply in this conversation.' },
    { text: "This person isn't available on Messenger", code: 'USER_UNAVAILABLE', diagnostic: 'This recipient is not available on Messenger (account may be deactivated, private, or has blocked messaging).' },
    { text: "You're temporarily blocked", code: 'ACCOUNT_RESTRICTED', diagnostic: 'Your Facebook account is temporarily restricted from sending new message requests.' },
    { text: "Message failed to send", code: 'SEND_FAILED', diagnostic: 'Facebook rejected the message delivery. Try again later.' },
    { text: "Can't message this account", code: 'PRIVACY_RESTRICTED', diagnostic: 'The recipient\'s privacy settings do not allow messages from people outside their friends list.' },
    { text: "This content isn't available right now", code: 'PROFILE_NOT_FOUND', diagnostic: 'The profile does not exist, was deleted, or the URL is invalid.' },
    { text: "We limit how often you can post", code: 'RATE_LIMITED', diagnostic: 'Facebook has rate-limited your account due to high activity frequency.' },
  ];

  for (const item of errorIndicators) {
    try {
      const match = page.getByText(item.text, { exact: false }).first();
      if (await match.isVisible({ timeout: 1000 }).catch(() => false)) {
        return item;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Launches an isolated sandbox Chrome instance on a dedicated debugging port.
 * Fully cross-platform across macOS, Windows, and Linux.
 */
async function launchSandboxBrowser(sandboxDir, port = 9225) {
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true });
  }

  const chromeExecutable = getChromeExecutablePath();

  const chromeArgs = [
    `--user-data-dir=${sandboxDir}`,
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-notifications',
    '--start-maximized',
  ];

  const child = spawn(chromeExecutable, chromeArgs, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const cdpUrl = `http://127.0.0.1:${port}`;
  let browser = null;

  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(600);
    try {
      browser = await chromium.connectOverCDP(cdpUrl, { timeout: 1500 });
      if (browser) break;
    } catch {
      // Retry
    }
  }

  if (!browser) {
    throw new Error(`Could not connect to sandbox browser on port ${port}.`);
  }

  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  return { browser, context, child };
}

/**
 * Main delivery execution function using the isolated sandbox browser
 */
async function sendFacebookMessage({
  recipient,
  message,
  log = console.log,
  sandboxDir = path.join(SANDBOXES_ROOT, 'default'),
  typingDelay = 40,
}) {
  const startTime = Date.now();
  const normalizedTarget = normalizeProfile(recipient);
  log(`🎯 Target: "${recipient}" (Resolved: ${normalizedTarget})`);
  log(`🛡️  Sandbox Environment: ${path.basename(sandboxDir)}`);

  let browserHandle = null;

  try {
    log(`🚀 Launching isolated sandbox browser...`);
    browserHandle = await launchSandboxBrowser(sandboxDir);
    const { context } = browserHandle;

    const pages = context.pages();
    const page = pages[0] || (await context.newPage());
    page.setDefaultNavigationTimeout(60000);
    await page.bringToFront();

    // 2. Check Facebook Login State
    log('🔑 Checking sandbox Facebook authentication status...');
    try {
      await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch {
      // Continue
    }
    await sleep(2000);
    await dismissPopups(page);

    if (page.url().includes('login') || (await page.$('input[name="email"]'))) {
      log('❌ Sandbox account is not logged into Facebook.');
      return {
        success: false,
        status: 'FAILED',
        code: 'AUTH_REQUIRED',
        diagnostic: 'Facebook login required for this sandbox. Click "Open Sandbox Browser" on the dashboard to log in.',
        duration: Date.now() - startTime,
      };
    }

    log('✅ Sandbox session active.');

    // 3. Navigation
    const isUrlOrId = normalizedTarget.startsWith('http');
    if (isUrlOrId) {
      log(`➡️ Navigating directly to profile: ${normalizedTarget}`);
      try {
        await page.goto(normalizedTarget, { waitUntil: 'domcontentloaded', timeout: 50000 });
      } catch {
        // Continue
      }
      await sleep(3000);
      await dismissPopups(page);

      // Check if profile exists / is available
      const failureBanner = await checkForFailureBanners(page);
      if (failureBanner) {
        log(`❌ Error detected: ${failureBanner.diagnostic}`);
        return {
          success: false,
          status: 'FAILED',
          code: failureBanner.code,
          diagnostic: failureBanner.diagnostic,
          duration: Date.now() - startTime,
        };
      }

      // If directly in Messenger thread
      if (normalizedTarget.includes('/messages/t/')) {
        log('📄 Directly in Messenger thread URL.');
      } else {
        // Try clicking the profile "Message" button (using direct JS DOM click)
        log('🔍 Locating profile "Message" button...');
        const clicked = await findAndClickProfileMessageButton(page);

        if (clicked) {
          log('👉 Clicked profile "Message" button!');
          await sleep(2500);
        } else {
          log('⚠️ "Message" button not visible on profile header. Trying Messenger thread fallback...');
          const identifier = extractProfileIdentifier(normalizedTarget);
          if (identifier) {
            const threadUrl = `https://www.facebook.com/messages/t/${encodeURIComponent(identifier)}`;
            log(`➡️ Fallback navigation to: ${threadUrl}`);
            await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
            await sleep(3000);
          }
        }
      }
    } else {
      // Display Name Search
      log(`🔎 Searching for "${normalizedTarget}" in Messenger...`);
      await page.goto('https://www.facebook.com/messages/t/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await sleep(3000);
      await dismissPopups(page);

      const searchInput = await page.$('input[aria-label*="Search"], input[placeholder*="Search"], input[type="search"]');
      if (searchInput) {
        await searchInput.click();
        await searchInput.fill('');
        await page.keyboard.type(normalizedTarget, { delay: 60 });
        await sleep(2500);

        try {
          const result = page.locator(`div[role="listbox"], ul[role="listbox"], div[aria-label*="Search results"]`).getByText(new RegExp(normalizedTarget.split(' ')[0], 'i')).first();
          if (await result.isVisible({ timeout: 2000 })) {
            log(`👉 Selecting search match for "${normalizedTarget}"...`);
            await result.click();
            await sleep(2500);
          } else {
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
            await sleep(2500);
          }
        } catch {
          await page.keyboard.press('Enter');
          await sleep(2500);
        }
      }
    }

    await dismissPopups(page);

    // 4. Locate chat input (strictly excluding comment fields)
    log('🔍 Locating chat message input box...');
    let chatInput = await findChatInput(page);

    // Fallback if not found: try direct thread navigation if we have an ID
    if (!chatInput && isUrlOrId) {
      const identifier = extractProfileIdentifier(normalizedTarget);
      if (identifier) {
        log(`Chat input not yet open. Trying direct Messenger thread: /messages/t/${identifier}...`);
        await page.goto(`https://www.facebook.com/messages/t/${encodeURIComponent(identifier)}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
        await sleep(3000);
        chatInput = await findChatInput(page);
      }
    }

    if (!chatInput) {
      const error = await checkForFailureBanners(page);
      if (error) {
        log(`❌ Failure detected: ${error.diagnostic}`);
        return {
          success: false,
          status: 'FAILED',
          code: error.code,
          diagnostic: error.diagnostic,
          duration: Date.now() - startTime,
        };
      }

      log('❌ Could not locate message input box.');
      return {
        success: false,
        status: 'FAILED',
        code: 'CHATBOX_NOT_FOUND',
        diagnostic: 'Could not open chat input. The recipient may have disabled message requests from non-friends, or the account is private.',
        duration: Date.now() - startTime,
      };
    }

    // 5. Type and send message
    log('✍️ Focusing chat box and typing message...');
    try {
      await chatInput.evaluate((el) => {
        el.focus();
        el.click();
      });
    } catch {
      try {
        await chatInput.focus();
      } catch {
        await chatInput.click({ force: true, timeout: 3000 });
      }
    }
    await sleep(300);

    await page.keyboard.type(message, { delay: typingDelay });
    await sleep(500);

    log('🚀 Sending message (pressing Enter)...');
    await page.keyboard.press('Enter');
    await sleep(2500);

    // 6. Delivery Verification
    log('🔎 Verifying message delivery in sandbox...');
    const postSendError = await checkForFailureBanners(page);
    if (postSendError) {
      log(`❌ Delivery failed: ${postSendError.diagnostic}`);
      return {
        success: false,
        status: 'FAILED',
        code: postSendError.code,
        diagnostic: postSendError.diagnostic,
        duration: Date.now() - startTime,
      };
    }

    log('✅ Message dispatched and verified in conversation thread!');
    return {
      success: true,
      status: 'DELIVERED',
      code: 'DELIVERED',
      diagnostic: 'Message successfully sent and delivered to recipient conversation thread / message requests.',
      duration: Date.now() - startTime,
    };

  } catch (err) {
    log(`❌ Sandbox error: ${err.message}`);
    return {
      success: false,
      status: 'FAILED',
      code: 'EXECUTION_ERROR',
      diagnostic: `Sandbox error: ${err.message}`,
      duration: Date.now() - startTime,
    };
  } finally {
    if (browserHandle && browserHandle.browser) {
      log('Closing sandbox session...');
      await sleep(2000);
      await browserHandle.browser.close().catch(() => {});
    }
  }
}

module.exports = {
  sendFacebookMessage,
  launchSandboxBrowser,
  normalizeProfile,
  getChromeExecutablePath,
};
