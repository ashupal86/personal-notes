const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  console.log("Navigating to http://localhost:3000");
  await page.goto('http://localhost:3000');
  
  // wait for react
  await page.waitForTimeout(2000);
  
  // check if sidebar is in DOM
  const sidebarBefore = await page.$('#sidebar');
  if (sidebarBefore) {
    const box = await sidebarBefore.boundingBox();
    console.log("Sidebar bounding box BEFORE click:", box);
    const classes = await sidebarBefore.getAttribute('className');
    console.log("Sidebar classes BEFORE click:", classes);
  }

  // click the hamburger menu
  const btn = await page.$('#sidebar-toggle');
  if (btn) {
    console.log("Clicking sidebar toggle...");
    await btn.click();
    await page.waitForTimeout(1000);
  } else {
    console.log("Sidebar toggle not found!");
  }

  const sidebarAfter = await page.$('#sidebar');
  if (sidebarAfter) {
    const box = await sidebarAfter.boundingBox();
    console.log("Sidebar bounding box AFTER click:", box);
    const classes = await sidebarAfter.getAttribute('className');
    console.log("Sidebar classes AFTER click:", classes);
  }

  await browser.close();
})();
