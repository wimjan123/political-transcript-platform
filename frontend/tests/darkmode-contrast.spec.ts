import { test, expect } from '@playwright/test';

// Reuse the same API mocking from darkmode.spec
async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const ok = (json: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });

    if (url.includes('/api/analytics/stats')) return ok({ total_videos: 0, total_segments: 0, total_speakers: 0, total_topics: 0, date_range: {}, top_speakers: [], top_topics: [], sentiment_distribution: {} });
    if (url.includes('/api/analytics/dashboard')) return ok({ kpi_stats: { total_videos: 0, total_segments: 0, total_speakers: 0, total_topics: 0, date_range: {}, top_speakers: [], top_topics: [], sentiment_distribution: {} }, sentiment_over_time: [], topic_distribution: [], speaker_activity: [], sentiment_by_speaker: [], content_moderation_summary: [], readability_metrics: { avg_grade_level: 8.5, avg_reading_ease: 60, avg_fog_index: 10 } });
    if (url.includes('/api/summarization/models/info')) return ok({ openai_available: false, primary_model: null, fallback_method: 'fallback', max_tokens_per_summary: 2048, supported_bullet_points: { min: 3, max: 5 }, batch_limit: 10 });
    if (url.includes('/api/upload/import-status')) return ok({ status: 'idle', progress: '0%', total_files: 0, processed_files: 0, failed_files: 0, errors: [] });
    if (url.includes('/api/search/embedding-status')) return ok({ total_segments: 0, segments_with_embeddings: 0, segments_without_embeddings: 0, completion_percentage: 0, embedding_model: 'N/A', embedding_dimensions: 0 });
    if (url.includes('/api/videos/')) { if (url.endsWith('/api/videos/')) return ok([]); return ok({}); }
    if (url.includes('/api/meilisearch/indexes')) return ok({ results: [] });
    if (url.includes('/api/meilisearch/tasks')) return ok({ results: [] });
    if (url.includes('/api/meilisearch/stats')) return ok({ databaseSize: 0, indexes: {} });
    if (url.includes('/api/meilisearch/experimental-features')) return ok({ vectorStore: false, metrics: false, logsRoute: false });
    if (url.includes('/api/ingest/status')) return ok({});
    if (url.includes('/api/summarization/search')) return ok({ results: [], total: 0, page: 1, page_size: 25, total_pages: 0, query: '' });
    if (url.includes('/api/search/')) return ok({ results: [], total: 0, page: 1, page_size: 25 });
    return ok({});
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await mockApi(page);
});

const targets = ['/', '/search', '/playlist', '/ingest', '/analytics', '/database-status', '/meilisearch-admin', '/ai-settings', '/this-route-should-404'];

function contrastRatio(fg: number[], bg: number[]) {
  // sRGB to linear
  const toLin = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = (rgb: number[]) => 0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2]);
  const L1 = L(fg);
  const L2 = L(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColor(str: string): { rgb: number[]; alpha: number } | null {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (!m) return null;
  const rgb = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
  return { rgb, alpha };
}

test('dark mode contrast smoke across key pages', async ({ page }) => {
  const failures: Array<{ path: string; text: string; ratio: number; fg: string; bg: string }> = [];
  for (const path of targets) {
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    // Evaluate contrast for visible text elements
    const elements = await page.$$eval('*', (nodes) => {
      const candidates: any[] = [];
      for (const el of nodes as HTMLElement[]) {
        const cs = getComputedStyle(el);
        const text = (el.innerText || '').trim();
        if (!text || text.length < 2) continue;
        if (el.offsetWidth < 10 || el.offsetHeight < 10) continue;
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        // Skip background-clip:text and fully transparent text
        // @ts-ignore
        const bgClip = (cs as any).webkitBackgroundClip || (cs as any).backgroundClip;
        if (bgClip && String(bgClip).includes('text')) continue;
        candidates.push({
          text: text.slice(0, 60),
          color: cs.color,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          background: cs.backgroundColor,
        });
      }
      return candidates;
    });

    try {
      // Get body background once per page
      const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      for (const el of elements) {
        const fg = parseColor(el.color);
        if (!fg || fg.alpha === 0) continue;
        let bg = parseColor(el.background);
        if (!bg || bg.alpha === 0) {
          bg = parseColor(bodyBg || 'rgb(0,0,0)');
        }
        if (!bg) continue;
        const ratio = contrastRatio(fg.rgb, bg.rgb);
        const fontPx = parseFloat(String(el.fontSize).replace('px', '')) || 14;
        const weight = parseInt(String(el.fontWeight), 10) || 400;
        const isLarge = fontPx >= 18 || (fontPx >= 14 && weight >= 700);
        const min = isLarge ? 3.0 : 4.0; // slightly lenient, still readable
        if (ratio < min) {
          failures.push({ path, text: el.text, ratio: Number(ratio.toFixed(2)), fg: el.color, bg: el.background });
        }
      }
    } catch (e: any) {
      console.log('Contrast evaluation error on path', path, e?.message || e);
      throw e;
    }
  }

  if (failures.length > 0) {
    console.log('Low-contrast elements found:', failures.slice(0, 20));
  }
  expect(failures, 'All visible texts should meet contrast baseline').toHaveLength(0);
});
