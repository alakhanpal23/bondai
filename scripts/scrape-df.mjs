// Playwright scraper for the Diamond Foundry site (df.com).
//
// Runs a real Chromium browser so Cloudflare's bot check is satisfied, then
// crawls same-origin pages breadth-first and writes structured content to disk.
//
// Usage:
//   npm run scrape                       # scrape https://www.df.com/, up to 40 pages
//   node scripts/scrape-df.mjs --url https://www.df.com/about-us
//   node scripts/scrape-df.mjs --max 100 --out scrape-output --headed
//
// Flags:
//   --url <url>     Start URL (default https://www.df.com/)
//   --max <n>       Max pages to crawl (default 40)
//   --out <dir>     Output directory (default scrape-output)
//   --delay <ms>    Delay between pages (default 1500)
//   --headed        Show the browser window (useful if Cloudflare needs a nudge)
//   --no-crawl      Scrape only the start URL, don't follow links
//   --no-shots      Skip full-page screenshots (faster, smaller output)
//
// Output layout (per run):
//   <out>/index.json          summary of every page scraped
//   <out>/pages/<slug>.json   structured content for one page
//   <out>/html/<slug>.html    the fully-rendered HTML of one page
//   <out>/shots/<slug>.png    full-page screenshot (unless --no-shots)

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function parseArgs(argv) {
  const args = {
    url: 'https://www.df.com/',
    max: 40,
    out: 'scrape-output',
    delay: 1500,
    headed: false,
    crawl: true,
    shots: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--max') args.max = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--delay') args.delay = Number(argv[++i]);
    else if (a === '--headed') args.headed = true;
    else if (a === '--no-crawl') args.crawl = false;
    else if (a === '--no-shots') args.shots = false;
    else if (a === '--help' || a === '-h') {
      console.log('See the header comment in scripts/scrape-df.mjs for usage.');
      process.exit(0);
    }
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Turn a URL into a filesystem-safe slug for output filenames.
function slugify(u) {
  const url = new URL(u);
  let path = (url.pathname + url.search).replace(/\/+$/, '');
  let slug = (url.hostname + path).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return slug.toLowerCase() || 'index';
}

// Strip hash + trailing slash so the same page isn't queued twice.
function normalize(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return null;
  }
}

// Cloudflare shows an interstitial ("Just a moment...", "Checking your browser").
// Wait for the real page title/content to appear before scraping.
async function waitPastCloudflare(page, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const title = (await page.title().catch(() => '')) || '';
    const isChallenge =
      /just a moment|checking your browser|attention required|verify you are human/i.test(title);
    if (!isChallenge) {
      // Also require some real body text so we don't scrape a blank shell.
      const len = await page.evaluate(() => (document.body?.innerText || '').trim().length).catch(() => 0);
      if (len > 40) return true;
    }
    await sleep(1000);
  }
  return false;
}

// Extract structured content from the current page in the browser context.
async function extractContent(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const abs = (href) => {
      try {
        return new URL(href, location.href).toString();
      } catch {
        return null;
      }
    };
    const headings = {};
    for (const tag of ['h1', 'h2', 'h3']) {
      headings[tag] = [...document.querySelectorAll(tag)]
        .map((el) => clean(el.textContent))
        .filter(Boolean);
    }
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => ({ text: clean(a.textContent), href: abs(a.getAttribute('href')) }))
      .filter((l) => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:'));

    const images = [...document.querySelectorAll('img')]
      .map((img) => ({
        src: abs(img.getAttribute('src') || img.getAttribute('data-src')),
        alt: clean(img.getAttribute('alt')),
      }))
      .filter((i) => i.src);

    const meta = {};
    for (const m of document.querySelectorAll('meta[name], meta[property]')) {
      const key = m.getAttribute('name') || m.getAttribute('property');
      const val = m.getAttribute('content');
      if (key && val) meta[key] = val;
    }

    // Paragraph-level body copy, de-duplicated and de-noised.
    const seen = new Set();
    const paragraphs = [...document.querySelectorAll('p, li, blockquote, figcaption')]
      .map((el) => clean(el.textContent))
      .filter((t) => t.length > 2 && !seen.has(t) && seen.add(t));

    const buttons = [...document.querySelectorAll('button, [role="button"], a.button, .btn')]
      .map((el) => clean(el.textContent))
      .filter(Boolean);

    return {
      title: document.title,
      description: meta['description'] || meta['og:description'] || '',
      meta,
      headings,
      paragraphs,
      buttons: [...new Set(buttons)],
      links,
      images,
      text: clean(document.body?.innerText || ''),
    };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const startUrl = normalize(args.url);
  if (!startUrl) {
    console.error(`Invalid --url: ${args.url}`);
    process.exit(1);
  }
  const origin = new URL(startUrl).origin;

  await mkdir(join(args.out, 'pages'), { recursive: true });
  await mkdir(join(args.out, 'html'), { recursive: true });
  if (args.shots) await mkdir(join(args.out, 'shots'), { recursive: true });

  console.log(`Scraping ${startUrl}`);
  console.log(`  origin=${origin}  max=${args.max}  crawl=${args.crawl}  out=${args.out}`);

  const browser = await chromium.launch({
    headless: !args.headed,
    // Allow pointing at a pre-installed Chromium (e.g. in CI/sandboxes where
    // `playwright install` is disabled): set PLAYWRIGHT_CHROMIUM to the binary.
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });
  // Hide the most obvious automation tell.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const queue = [startUrl];
  const seen = new Set([startUrl]);
  const index = [];

  const page = await context.newPage();

  while (queue.length && index.length < args.max) {
    const url = queue.shift();
    const slug = slugify(url);
    process.stdout.write(`[${index.length + 1}/${args.max}] ${url} ... `);

    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const status = resp ? resp.status() : 0;

      const passed = await waitPastCloudflare(page);
      if (!passed) {
        console.log(`blocked (Cloudflare challenge did not clear${args.headed ? '' : ', try --headed'})`);
        index.push({ url, slug, status, blocked: true });
        continue;
      }
      // Let lazy content settle.
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const content = await extractContent(page);
      const html = await page.content();

      await writeFile(join(args.out, 'html', `${slug}.html`), html, 'utf8');
      await writeFile(
        join(args.out, 'pages', `${slug}.json`),
        JSON.stringify({ url, status, ...content }, null, 2),
        'utf8',
      );
      if (args.shots) {
        await page
          .screenshot({ path: join(args.out, 'shots', `${slug}.png`), fullPage: true })
          .catch(() => {});
      }

      index.push({
        url,
        slug,
        status,
        title: content.title,
        description: content.description,
        h1: content.headings.h1,
        links: content.links.length,
        images: content.images.length,
      });
      console.log(`ok (${content.paragraphs.length} blocks, ${content.links.length} links)`);

      // Enqueue same-origin links.
      if (args.crawl) {
        for (const l of content.links) {
          const n = normalize(l.href);
          if (!n || seen.has(n)) continue;
          if (new URL(n).origin !== origin) continue;
          // Skip obvious non-HTML assets.
          if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|webm|css|js|json|xml|ico|woff2?)$/i.test(n)) continue;
          seen.add(n);
          queue.push(n);
        }
      }
    } catch (err) {
      console.log(`error: ${err.message}`);
      index.push({ url, slug, error: err.message });
    }

    if (queue.length && index.length < args.max) await sleep(args.delay);
  }

  await writeFile(
    join(args.out, 'index.json'),
    JSON.stringify(
      { startUrl, origin, scrapedAt: new Date().toISOString(), count: index.length, pages: index },
      null,
      2,
    ),
    'utf8',
  );

  await browser.close();

  const ok = index.filter((p) => !p.error && !p.blocked).length;
  const blocked = index.filter((p) => p.blocked).length;
  console.log(`\nDone. ${ok} page(s) scraped, ${blocked} blocked. Output in ./${args.out}/`);
  if (blocked) console.log('If pages were blocked, re-run with --headed to clear the Cloudflare check.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
