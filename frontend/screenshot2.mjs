import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

await page.goto('http://localhost:5173');
await page.waitForTimeout(1000);
await page.click('button.welcome-btn');

// Wait for roster to actually load (Firebase auth)
await page.waitForSelector('.player-row', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/Users/nihal/AppData/Local/Temp/roster_loaded.png' });
console.log('roster loaded done');

// Waiver tab
await page.click('button:has-text("WAIVER")');
await page.waitForTimeout(400);
await page.screenshot({ path: 'C:/Users/nihal/AppData/Local/Temp/waiver.png' });
console.log('waiver done');

await browser.close();
