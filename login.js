const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

async function login() {
  console.log('🚀 Opening Chrome for one-time Facebook login...');
  
  const browser = await chromium.launchPersistentContext(path.join(__dirname, 'browser_profile'), {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });

  const page = browser.pages()[0] || (await browser.newPage());
  
  // Set generous navigation timeout and wait for domcontentloaded instead of full load
  page.setDefaultNavigationTimeout(90000);
  
  try {
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    console.log('Page navigation continuing in browser...');
  }

  console.log('\n=============================================================');
  console.log('👉 Please log into your Facebook account in the browser window.');
  console.log('👉 Once you are logged in, press ENTER in this terminal to save.');
  console.log('=============================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Press ENTER here once you are logged in to save: ', async () => {
    console.log('\n💾 Saving session cookies...');
    await page.waitForTimeout(2000);
    await browser.close();
    rl.close();
    console.log('✅ Setup complete! You can now run:');
    console.log('   node bot.js "ngozi peter" "This is a test im working on"\n');
    process.exit(0);
  });
}

login().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
