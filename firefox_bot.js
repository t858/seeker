const { firefox, chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const profileDir = path.join(__dirname, 'firefox_profile');
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

const CONFIG = {
  cdpUrl: 'http://127.0.0.1:9222',
  profileDir,
  typingDelay: 50,
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finds the chat input textbox in Messenger/Facebook
 */
async function findChatInput(page) {
  const selectors = [
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label="Message"][contenteditable="true"]',
    'div[aria-label*="Message"][contenteditable="true"]',
    'div[aria-label*="Write a message"][contenteditable="true"]',
    'div[aria-placeholder*="Aa"][contenteditable="true"]',
    'div[data-lexical-editor="true"]',
    'p.xat24cr[data-lexical-text="true"]',
    'div[contenteditable="true"]',
  ];

  for (let attempt = 0; attempt < 8; attempt++) {
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          if (await el.isVisible()) {
            return el;
          }
        }
      } catch {
        // Continue
      }
    }
    await sleep(1000);
  }

  return null;
}

/**
 * Dismiss common popups and banners
 */
async function dismissPopups(page) {
  const popupButtons = [
    'div[aria-label="Close"]',
    'div[role="button"]:has-text("Continue")',
    'div[role="button"]:has-text("Not now")',
    'div[role="button"]:has-text("Dismiss")',
    'button:has-text("Allow all cookies")',
    'button:has-text("Accept all")',
  ];

  for (const sel of popupButtons) {
    try {
      const btn = await page.$(sel);
      if (btn && (await btn.isVisible())) {
        await btn.click();
        await sleep(500);
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Searches for a recipient in Messenger by name and opens their chat
 */
async function searchAndOpenChat(page, recipientName) {
  console.log(`🔎 Opening Messenger & searching for "${recipientName}"...`);
  
  await page.goto('https://www.facebook.com/messages/t/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await dismissPopups(page);

  // 1. Check if recipient is already in chats list
  try {
    const existingChat = page.locator(`div[aria-label="Chats"], div[role="navigation"], div[role="grid"]`).getByText(new RegExp(recipientName, 'i')).first();
    if (await existingChat.isVisible({ timeout: 2500 })) {
      console.log(`👉 Found existing chat for "${recipientName}", opening...`);
      await existingChat.click();
      await sleep(3000);
      return;
    }
  } catch {
    // Continue
  }

  // 2. Search input
  const searchSelectors = [
    'input[aria-label*="Search"]',
    'input[placeholder*="Search"]',
    'div[role="search"] input',
    'label input',
    'input[type="search"]',
    'input[type="text"]',
  ];

  let searchInput = null;
  for (const sel of searchSelectors) {
    try {
      const el = await page.$(sel);
      if (el && (await el.isVisible())) {
        searchInput = el;
        break;
      }
    } catch {
      // Continue
    }
  }

  if (searchInput) {
    console.log(`⌨️  Typing "${recipientName}" into search...`);
    await searchInput.click();
    await sleep(300);
    await searchInput.fill('');
    await page.keyboard.type(recipientName, { delay: 70 });
    console.log(`⏳ Waiting for search results...`);
    await sleep(3000);

    let clicked = false;
    try {
      const resultMatch = page.locator(`div[role="listbox"], ul[role="listbox"], div[aria-label*="Search results"], div[aria-label*="Chats"]`).getByText(new RegExp(recipientName, 'i')).first();
      if (await resultMatch.isVisible({ timeout: 3000 })) {
        console.log(`👉 Clicking search result for "${recipientName}"...`);
        await resultMatch.click();
        clicked = true;
        await sleep(3000);
      }
    } catch {
      // Fallback
    }

    if (!clicked) {
      console.log('Pressing Enter on selected search item...');
      await page.keyboard.press('ArrowDown');
      await sleep(300);
      await page.keyboard.press('Enter');
      await sleep(3000);
    }
  } else {
    console.log('Trying page text locator...');
    try {
      const linkMatch = page.getByText(new RegExp(recipientName, 'i')).first();
      if (await linkMatch.isVisible({ timeout: 3000 })) {
        await linkMatch.click();
        await sleep(3000);
      }
    } catch {
      // Ignore
    }
  }

  await dismissPopups(page);
}

async function sendFacebookMessage(recipient, messageText) {
  let browserContext;
  let isConnectedToExisting = false;

  // 1. Try connecting to already running browser first (CDP / Remote Debugging)
  try {
    console.log(`🔍 Checking for active browser on port 9222...`);
    const browser = await chromium.connectOverCDP(CONFIG.cdpUrl, { timeout: 1500 });
    const contexts = browser.contexts();
    browserContext = contexts[0] || (await browser.newContext());
    isConnectedToExisting = true;
    console.log(`🌐 Connected to your active browser session on port 9222!`);
  } catch {
    // 2. Launch Firefox with persistent profile
    console.log(`🚀 Launching Firefox with saved profile (${CONFIG.profileDir})...`);
    browserContext = await firefox.launchPersistentContext(CONFIG.profileDir, {
      headless: false,
      viewport: null,
      args: ['--start-maximized'],
    });
  }

  const pages = browserContext.pages();
  let page = pages[0] || (await browserContext.newPage());
  await page.bringToFront();

  // Search and open the recipient chat
  await searchAndOpenChat(page, recipient);

  // Check login state
  if (page.url().includes('login') || (await page.$('input[name="email"]'))) {
    console.log('\n⚠️  Please log in to Facebook in the opened Firefox window.');
    await page.waitForURL((url) => !url.toString().includes('login'), { timeout: 120000 });
    console.log('✅ Logged in successfully!');
    await sleep(3000);
    await searchAndOpenChat(page, recipient);
  }

  console.log('🔍 Locating chat message input box...');
  let inputEl = await findChatInput(page);

  if (!inputEl) {
    await dismissPopups(page);
    await sleep(1500);
    inputEl = await findChatInput(page);
  }

  if (!inputEl) {
    const screenshotPath = path.join(__dirname, 'debug_chat_not_found.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Saved debug screenshot to: ${screenshotPath}`);
    throw new Error(
      `Could not locate the message input box for "${recipient}". See screenshot at ${screenshotPath}`
    );
  }

  console.log(`✍️  Focusing chat input and typing message...`);
  await inputEl.click();
  await sleep(400);

  // Type message
  await page.keyboard.type(messageText, { delay: CONFIG.typingDelay });
  await sleep(500);

  console.log('🚀 Pressing Enter to send...');
  await page.keyboard.press('Enter');
  await sleep(3000);

  console.log(`\n🎉 Message successfully sent to "${recipient}"!`);

  if (!isConnectedToExisting) {
    console.log('Browser will close in 8 seconds...');
    await sleep(8000);
    await browserContext.close();
  }
}

// CLI argument parsing
const recipient = process.argv[2];
const message = process.argv[3];

if (!recipient || !message) {
  console.log(`
Usage:
  node firefox_bot.js "<recipient_name_or_id>" "<message>"

Examples:
  node firefox_bot.js "ngozi peter" "This is a test im working on"
  `);
  process.exit(1);
}

sendFacebookMessage(recipient, message)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
