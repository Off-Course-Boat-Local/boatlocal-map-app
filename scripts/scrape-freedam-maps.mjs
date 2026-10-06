// Scrapes listings from FreeDam Tours Google Maps lists using gstack browse
// Usage: node scripts/scrape-freedam-maps.mjs

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BROWSE_BIN = "/Users/beer/.claude/skills/gstack/browse/dist/browse";

const MAP_URLS = [
  { key: "lunch", name: "Amsterdam Lunch", url: "https://maps.app.goo.gl/Dwn7mtC9to5aAHc26" },
  { key: "dinner", name: "Amsterdam Dinner", url: "https://maps.app.goo.gl/FZeVuPQi8MdWC95H9" },
  { key: "vegan", name: "Vegan restaurants & Bakeries", url: "https://maps.app.goo.gl/W6xVNPChP7ijwcWu6" },
  { key: "nightlife", name: "Amsterdam Nightlife", url: "https://maps.app.goo.gl/rCCJETfPsEzzjLoa8" },
];

function runBrowse(cmd) {
  try {
    return execSync(`${BROWSE_BIN} ${cmd}`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    if (err.stdout) return err.stdout;
    throw err;
  }
}

function runBrowseJs(code) {
  const sanitized = code.replace(/'/g, "'\\''");
  const out = runBrowse(`js '${sanitized}'`);
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

async function scrapeList(listDef) {
  console.log(`\nNavigating to ${listDef.name} (${listDef.url})...`);
  runBrowse(`goto "${listDef.url}"`);
  
  // Wait a few seconds for page load / redirect
  execSync("sleep 3");
  
  // Check if consent page appeared
  const checkConsent = runBrowseJs(`(() => {
    const btn = document.querySelector("button[aria-label*='Accepteren'], form[action*='consent'] button");
    if (btn) { btn.click(); return true; }
    const allBtns = Array.from(document.querySelectorAll("button"));
    const accept = allBtns.find(b => b.textContent && b.textContent.includes("Alles accepteren"));
    if (accept) { accept.click(); return true; }
    return false;
  })()`);
  
  if (checkConsent) {
    console.log("Accepted cookie consent...");
    execSync("sleep 3");
  }

  // Scroll to load all items in the list container
  console.log("Scrolling list container to load all items...");
  const scrapeResult = runBrowseJs(`(async () => {
    const container = document.querySelector("div.m6QErb.DxyBCb") || document.querySelector("div[role='main']");
    if (!container) return { error: "No container found", url: window.location.href };
    
    let lastCount = 0;
    for (let i = 0; i < 30; i++) {
      container.scrollTop = container.scrollHeight;
      await new Promise(r => setTimeout(r, 1200));
      const count = document.querySelectorAll("div.BsJqK").length;
      if (count === lastCount && i > 3) break;
      lastCount = count;
    }
    
    const items = Array.from(document.querySelectorAll("div.BsJqK"));
    const results = items.map(el => {
      const title = el.querySelector(".fontHeadlineSmall")?.textContent?.trim() || "";
      const body = el.querySelector(".fontBodyMedium")?.textContent?.trim() || "";
      const allText = el.innerText || "";
      return { title, body, allText };
    }).filter(i => i.title && i.title !== "FreeDam Tours");
    
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";
    return { h1, count: results.length, items: results };
  })()`);

  if (!scrapeResult || scrapeResult.error) {
    console.error(`Error scraping ${listDef.name}:`, scrapeResult?.error);
    return [];
  }

  console.log(`Found ${scrapeResult.count} items in ${listDef.name} (H1: ${scrapeResult.h1})`);
  return scrapeResult.items.map(it => ({
    ...it,
    sourceList: listDef.key,
    sourceListName: listDef.name,
  }));
}

async function main() {
  const allResults = [];
  for (const listDef of MAP_URLS) {
    const items = await scrapeList(listDef);
    allResults.push({ list: listDef.key, name: listDef.name, items });
  }

  const outPath = path.resolve("scripts/data/freedam-maps-scraped.json");
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nSuccessfully saved raw scraped data to ${outPath}`);
  
  // Summary
  let total = 0;
  for (const r of allResults) {
    console.log(` - ${r.name}: ${r.items.length} items`);
    total += r.items.length;
  }
  console.log(`Total items across all lists: ${total}`);
}

main().catch(err => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
