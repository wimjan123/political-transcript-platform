const playwright = require('playwright');

async function testSearchFix() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  
  // Listen for console errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Listen for uncaught exceptions
  page.on('pageerror', (error) => {
    errors.push(`Uncaught exception: ${error.message}`);
  });
  
  try {
    console.log('Navigating to search page...');
    await page.goto('http://localhost:3000/search', { timeout: 30000 });
    
    console.log('Waiting for page to load...');
    await page.waitForSelector('input[type="search"], input[placeholder*="search"]', { timeout: 10000 });
    
    console.log('Performing search...');
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search"]').first();
    await searchInput.fill('trump');
    await searchInput.press('Enter');
    
    console.log('Waiting for search results...');
    await page.waitForTimeout(3000); // Give time for results to load
    
    console.log('Checking for errors...');
    if (errors.length > 0) {
      console.log('❌ Errors found:');
      errors.forEach(error => {
        console.log(`  - ${error}`);
      });
      return false;
    } else {
      console.log('✅ No errors found! Search functionality appears to be working.');
      return true;
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

testSearchFix().then(success => {
  process.exit(success ? 0 : 1);
});