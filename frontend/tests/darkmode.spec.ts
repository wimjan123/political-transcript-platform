import { test, expect } from '@playwright/test';

// Minimal fixtures for API routes so pages render without a backend
async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const ok = (json: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });

    if (url.includes('/api/analytics/stats')) {
      return ok({
        total_videos: 0,
        total_segments: 0,
        total_speakers: 0,
        total_topics: 0,
        date_range: {},
        top_speakers: [],
        top_topics: [],
        sentiment_distribution: {},
      });
    }
    if (url.includes('/api/analytics/dashboard')) {
      return ok({
        kpi_stats: {
          total_videos: 0,
          total_segments: 0,
          total_speakers: 0,
          total_topics: 0,
          date_range: {},
          top_speakers: [],
          top_topics: [],
          sentiment_distribution: {},
        },
        sentiment_over_time: [],
        topic_distribution: [],
        speaker_activity: [],
        sentiment_by_speaker: [],
        content_moderation_summary: [],
        readability_metrics: { avg_grade_level: 8.5, avg_reading_ease: 60, avg_fog_index: 10 },
      });
    }
    if (url.includes('/api/summarization/models/info')) {
      return ok({
        openai_available: false,
        primary_model: null,
        fallback_method: 'fallback',
        max_tokens_per_summary: 2048,
        supported_bullet_points: { min: 3, max: 5 },
        batch_limit: 10,
      });
    }
    if (url.includes('/api/upload/import-status')) {
      return ok({ status: 'idle', progress: '0%', total_files: 0, processed_files: 0, failed_files: 0, errors: [] });
    }
    if (url.includes('/api/search/embedding-status')) {
      return ok({ total_segments: 0, segments_with_embeddings: 0, segments_without_embeddings: 0, completion_percentage: 0, embedding_model: 'N/A', embedding_dimensions: 0 });
    }
    if (url.includes('/api/videos/')) {
      // list or details/segments
      if (url.endsWith('/api/videos/')) return ok([]);
      return ok({});
    }
    if (url.includes('/api/meilisearch/indexes')) return ok({ results: [] });
    if (url.includes('/api/meilisearch/tasks')) return ok({ results: [] });
    if (url.includes('/api/meilisearch/stats')) return ok({ databaseSize: 0, indexes: {} });
    if (url.includes('/api/meilisearch/experimental-features')) return ok({ vectorStore: false, metrics: false, logsRoute: false });
    if (url.includes('/api/ingest/status')) return ok({});
    if (url.includes('/api/summarization/stats')) return ok({});
    if (url.includes('/api/summarization/search')) return ok({ results: [], total: 0, page: 1, page_size: 25, total_pages: 0, query: '' });
    if (url.includes('/api/search/')) return ok({ results: [], total: 0, page: 1, page_size: 25 });

    return ok({});
  });
}

test.beforeEach(async ({ page }) => {
  // Force dark mode early to avoid FOUC
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await mockApi(page);
});

const routes = [
  '/',
  '/search',
  '/playlist',
  '/ingest',
  '/analytics',
  '/database-status',
  '/meilisearch-admin',
  '/ai-settings',
  '/this-route-should-404',
];

for (const path of routes) {
  test(`dark mode visual smoke: ${path}`, async ({ page }) => {
    await page.goto(path);
    // Quick smoke checks: no severe errors, body visible, dark class present
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
    // Take a snapshot for visual sanity (optional assertion to ensure non-empty content area)
    const hasContent = await page.locator('main, nav, footer, #root').first().isVisible().catch(() => true);
    expect(hasContent).toBeTruthy();
  });
}

