const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // Test Mobile
  await page.setViewport({ width: 375, height: 667 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  // Click hamburger
  await page.click('#sidebar-toggle');
  await page.waitForTimeout(500);
  
  const sidebarPos = await page.evaluate(() => {
    const el = document.getElementById('sidebar');
    const rect = el.getBoundingClientRect();
    return { x: rect.x, width: rect.width, display: window.getComputedStyle(el).display };
  });
  
  console.log('Mobile sidebar after click:', sidebarPos);

  // Test Desktop
  await page.setViewport({ width: 1024, height: 768 });
  await page.click('#sidebar-toggle');
  await page.waitForTimeout(500);
  
  const sidebarPosDesktop = await page.evaluate(() => {
    const el = document.getElementById('sidebar');
    const rect = el.getBoundingClientRect();
    return { x: rect.x, width: rect.width, display: window.getComputedStyle(el).display };
  });
  
  console.log('Desktop sidebar after click:', sidebarPosDesktop);
  
  await browser.close();
})();
