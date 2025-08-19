import { test, expect } from '@playwright/test';

test.describe('Dark Mode Summary Search Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the summary search page
    await page.goto('/summary-search');
  });

  test('should load summary search page successfully', async ({ page }) => {
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Samenvatting Zoeken');
    
    // Check that the search form is visible
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should toggle dark mode successfully', async ({ page }) => {
    // Find and click the dark mode toggle button
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    
    // Check initial state (should be light mode by default)
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    
    // Toggle to dark mode
    await darkModeToggle.click();
    
    // Wait for dark mode to be applied
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Verify dark mode styling is applied
    const body = page.locator('body');
    await expect(body).toHaveClass(/dark:bg-gray-900/);
  });

  test('should display proper dark mode styling for form elements', async ({ page }) => {
    // Toggle to dark mode first
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    await darkModeToggle.click();
    
    // Wait for dark mode to be applied
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Check search input dark mode styling
    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput).toHaveClass(/dark:bg-gray-700/);
    await expect(searchInput).toHaveClass(/dark:text-gray-100/);
    await expect(searchInput).toHaveClass(/dark:border-gray-600/);
    
    // Check search button dark mode styling
    const searchButton = page.locator('button[type="submit"]');
    await expect(searchButton).toHaveClass(/dark:bg-blue-600/);
    await expect(searchButton).toHaveClass(/dark:hover:bg-blue-700/);
  });

  test('should perform search and display results with dark mode styling', async ({ page }) => {
    // Toggle to dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    await darkModeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Perform a search
    const searchInput = page.locator('input[type="text"]');
    const searchButton = page.locator('button[type="submit"]');
    
    await searchInput.fill('klimaat');
    await searchButton.click();
    
    // Wait for results to load (or no results message)
    await page.waitForTimeout(2000);
    
    // Check if results are displayed with proper dark mode styling
    const resultsContainer = page.locator('[data-testid="search-results"], .search-results, .results-container').first();
    
    if (await resultsContainer.isVisible()) {
      // Check result items have dark mode styling
      const resultItems = page.locator('[data-testid="search-result"], .search-result, .result-item');
      const firstResult = resultItems.first();
      
      if (await firstResult.isVisible()) {
        await expect(firstResult).toHaveClass(/dark:bg-gray-800/);
        await expect(firstResult).toHaveClass(/dark:border-gray-700/);
      }
    } else {
      // Check no results message has dark mode styling
      const noResultsMessage = page.locator('[data-testid="no-results"], .no-results, .empty-state').first();
      if (await noResultsMessage.isVisible()) {
        await expect(noResultsMessage).toHaveClass(/dark:text-gray-300/);
      }
    }
  });

  test('should display highlighted text with proper dark mode styling', async ({ page }) => {
    // Toggle to dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    await darkModeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Perform a search that should return results with highlighted text
    const searchInput = page.locator('input[type="text"]');
    const searchButton = page.locator('button[type="submit"]');
    
    await searchInput.fill('minister');
    await searchButton.click();
    
    // Wait for results to potentially load
    await page.waitForTimeout(2000);
    
    // Look for highlighted text elements
    const highlights = page.locator('mark, .highlight, [style*="background"], [class*="bg-yellow"]');
    
    if (await highlights.count() > 0) {
      const firstHighlight = highlights.first();
      // Check that highlighted text has proper dark mode styling
      // Should use dark:bg-yellow-700/40 for better dark mode visibility
      await expect(firstHighlight).toHaveCSS('background-color', /rgba?\(161,\s*138,\s*25,\s*0\.4\)|rgb\(161,\s*138,\s*25\)|#a18a19/);
    }
  });

  test('should maintain dark mode state during pagination', async ({ page }) => {
    // Toggle to dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    await darkModeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Perform a search that might return paginated results
    const searchInput = page.locator('input[type="text"]');
    const searchButton = page.locator('button[type="submit"]');
    
    await searchInput.fill('debat');
    await searchButton.click();
    
    // Wait for results
    await page.waitForTimeout(2000);
    
    // Check for pagination controls
    const paginationControls = page.locator('[data-testid="pagination"], .pagination, nav[aria-label*="pagination"]').first();
    
    if (await paginationControls.isVisible()) {
      // Verify pagination controls have dark mode styling
      const paginationButtons = paginationControls.locator('button, a');
      const firstPaginationButton = paginationButtons.first();
      
      if (await firstPaginationButton.isVisible()) {
        await expect(firstPaginationButton).toHaveClass(/dark:bg-gray-700/);
        await expect(firstPaginationButton).toHaveClass(/dark:text-gray-200/);
        
        // Click pagination button and verify dark mode is maintained
        await firstPaginationButton.click();
        await page.waitForTimeout(1000);
        
        // Verify dark mode is still active after pagination
        await expect(page.locator('html')).toHaveClass(/dark/);
      }
    }
  });

  test('should display proper dark mode styling for loading states', async ({ page }) => {
    // Toggle to dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    await darkModeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Perform a search to trigger loading state
    const searchInput = page.locator('input[type="text"]');
    const searchButton = page.locator('button[type="submit"]');
    
    await searchInput.fill('regering');
    
    // Click search and immediately check for loading indicators
    await searchButton.click();
    
    // Look for loading indicators with dark mode styling
    const loadingIndicators = page.locator('[data-testid="loading"], .loading, .spinner, .loader');
    
    if (await loadingIndicators.count() > 0) {
      const firstLoader = loadingIndicators.first();
      // Loading indicators should have appropriate dark mode colors
      await expect(firstLoader).toHaveClass(/dark:text-gray-400/);
    }
  });

  test('should handle form validation errors with dark mode styling', async ({ page }) => {
    // Toggle to dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    await darkModeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Try to submit empty form to trigger validation
    const searchButton = page.locator('button[type="submit"]');
    await searchButton.click();
    
    // Wait for potential error messages
    await page.waitForTimeout(1000);
    
    // Look for error messages
    const errorMessages = page.locator('[data-testid="error"], .error, .error-message, [role="alert"]');
    
    if (await errorMessages.count() > 0) {
      const firstError = errorMessages.first();
      // Error messages should have proper dark mode styling
      await expect(firstError).toHaveClass(/dark:text-red-400/);
    }
  });

  test('should maintain accessibility in dark mode', async ({ page }) => {
    // Toggle to dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], button[aria-label*="dark"], button[aria-label*="theme"]').first();
    await darkModeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Check that form elements have proper labels and accessibility attributes
    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput).toHaveAttribute('aria-label');
    
    const searchButton = page.locator('button[type="submit"]');
    await expect(searchButton).toHaveAttribute('aria-label');
    
    // Check that dark mode toggle has proper accessibility attributes
    await expect(darkModeToggle).toHaveAttribute('aria-label');
    
    // Verify color contrast is maintained in dark mode
    // This is a basic check - in practice, you'd want more comprehensive contrast testing
    const body = page.locator('body');
    const bodyBgColor = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
    const textColor = await body.evaluate((el) => getComputedStyle(el).color);
    
    // Ensure background and text colors are different (basic contrast check)
    expect(bodyBgColor).not.toBe(textColor);
  });
});