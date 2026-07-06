# scripts/scrape-df.mjs — Diamond Foundry (df.com) scraper

A Playwright-based scraper that drives a real Chromium browser (so Cloudflare's
bot check passes), crawls same-origin pages breadth-first, and writes structured
content to disk.

> Run this **locally**, not in the Claude web sandbox — that environment's
> network egress policy blocks `df.com`. Your own machine can reach it.

## Setup

```bash
npm install                 # installs playwright (added as a devDependency)
npx playwright install chromium
```

## Run

```bash
npm run scrape                          # crawl https://www.df.com/, up to 40 pages
node scripts/scrape-df.mjs --headed     # show the browser (helps clear Cloudflare)
node scripts/scrape-df.mjs --url https://www.df.com/about-us --no-crawl
node scripts/scrape-df.mjs --max 100 --out df-dump
```

### Flags

| Flag | Default | Meaning |
|---|---|---|
| `--url <url>` | `https://www.df.com/` | Start URL |
| `--max <n>` | `40` | Max pages to crawl |
| `--out <dir>` | `scrape-output` | Output directory (git-ignored) |
| `--delay <ms>` | `1500` | Politeness delay between pages |
| `--headed` | off | Show the browser window |
| `--no-crawl` | off | Only scrape the start URL |
| `--no-shots` | off | Skip full-page screenshots |

## Output

```
scrape-output/
  index.json          # summary of every page (url, title, description, counts)
  pages/<slug>.json   # per-page: title, meta, headings, paragraphs, buttons, links, images, full text
  html/<slug>.html    # fully-rendered HTML of each page
  shots/<slug>.png    # full-page screenshot (unless --no-shots)
```

## Notes

- If a page reports `blocked (Cloudflare challenge did not clear)`, re-run with
  `--headed` and, if needed, solve the check once — the session cookie carries
  through the rest of the crawl.
- The crawler stays on the start URL's origin and skips asset links
  (images, PDFs, JS/CSS, fonts, media).
- Be respectful: keep `--delay` reasonable and `--max` bounded. Check
  `df.com/robots.txt` and the site's terms before large crawls.
