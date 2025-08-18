import { test, expect } from '@playwright/test';
import { expect as chaiExpect } from 'chai';

async function mockApi(page) {
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], total: 0, page: 1, page_size: 25 }) }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await mockApi(page);
});

test('contrast check on /search (dark)', async ({ page }) => {
  await page.goto('/search');
  await page.waitForLoadState('domcontentloaded');
  const els = await page.$$('*');
  let low = 0;
  for (const handle of els) {
    const box = await handle.boundingBox();
    if (!box || box.width < 10 || box.height < 10) continue;
    const text = (await handle.innerText()).trim();
    if (text.length < 2) continue;
    const cs = await handle.evaluate((el) => {
      const s = getComputedStyle(el as HTMLElement);
      // @ts-ignore
      const bgClip = (s as any).webkitBackgroundClip || (s as any).backgroundClip;
      return { color: s.color, bg: s.backgroundColor, clip: bgClip, fs: s.fontSize, fw: s.fontWeight };
    });
    if (cs.clip && String(cs.clip).includes('text')) continue;
    const parse = (c: string) => { const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); if (!m) return null; return { r:+m[1], g:+m[2], b:+m[3], a: m[4] ? +m[4] : 1 }; };
    const fg = parse(cs.color); const bg = parse(cs.bg || 'rgb(17,24,39)'); if (!fg || fg.a === 0 || !bg) continue;
    const toLin = (c:number)=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
    const L = (r:number,g:number,b:number)=>0.2126*toLin(r)+0.7152*toLin(g)+0.0722*toLin(b);
    const cr = (Math.max(L(fg.r,fg.g,fg.b),L(bg.r,bg.g,bg.b))+0.05)/(Math.min(L(fg.r,fg.g,fg.b),L(bg.r,bg.g,bg.b))+0.05);
    const px = parseFloat(cs.fs.replace('px',''))||14; const fw = parseInt(cs.fw)||400; const isLarge = px>=18 || (px>=14 && fw>=700);
    const min = isLarge ? 3.0 : 4.0;
    if (cr < min) { low++; console.log('LOW', cr.toFixed(2), 'text:', text.slice(0,60)); }
  }
  chaiExpect(low, 'low contrast items').to.equal(0);
});

