import { test, expect } from '@playwright/test';

test('should navigate to the search page from the homepage', async ({ page }) => {
  await page.goto('http://localhost:3000/');

  await page.click('text=Search');

  await expect(page).toHaveURL('http://localhost:3000/search');

  const searchInput = page.locator('input[type="search"], input[type="text"]');
  await expect(searchInput.first()).toBeVisible();
});

