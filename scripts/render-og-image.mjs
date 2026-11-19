/**
 * Render the link-preview (Open Graph) image shown when the site URL is shared
 * on Messenger, Facebook, Viber, Slack, etc.
 *
 *   node scripts/render-og-image.mjs
 *
 * Writes app/opengraph-image.png (1200×630). Next.js picks it up by file
 * convention and emits the og:image tags; layout.tsx's metadataBase makes the
 * URL absolute. Needs network access for the Google Fonts stylesheet.
 * Colors and glyph mirror app/icon.svg, BrandGlyph, and the --brand tokens.
 */
import { chromium } from "playwright";

const OUT = "app/opengraph-image.png";
const WIDTH = 1200;
const HEIGHT = 630;

const glyph = (size, opacity = 1) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="opacity:${opacity}">
    <path d="M4 15c2.5 0 2.5-2.2 5-2.2S11.5 15 14 15s2.5-2.2 5-2.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <path d="M4 19c2.5 0 2.5-2.2 5-2.2S11.5 19 14 19s2.5-2.2 5-2.2" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
    <path d="M12 4.2 6.8 6.3v3.1c0 3.2 5.2 5 5.2 5s5.2-1.8 5.2-5V6.3z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" fill="rgba(255,255,255,0.18)"/>
  </svg>`;

// Repeating swell lines across the lower canvas, echoing the glyph's waves.
const waves = Array.from({ length: 7 }, (_, i) => {
  const y = 470 + i * 26;
  const amp = 14;
  const period = 120;
  let d = `M -60 ${y}`;
  for (let x = -60; x < WIDTH + 120; x += period) {
    d += ` q ${period / 4} ${-amp} ${period / 2} 0 t ${period / 2} 0`;
  }
  const opacity = (0.22 - i * 0.026).toFixed(3);
  return `<path d="${d}" stroke="#34d399" stroke-width="2" fill="none" stroke-linecap="round" opacity="${opacity}"/>`;
}).join("");

const stages = ["Lead", "Applicant", "Client", "Policyholder", "Renewal"];

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;600;700;800&family=JetBrains+Mono:wght@500&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    position: relative;
    overflow: hidden;
    font-family: "Hanken Grotesk", sans-serif;
    color: #e9efea;
    background:
      radial-gradient(ellipse 60% 70% at 82% 34%, rgba(16, 185, 129, 0.30), transparent 70%),
      radial-gradient(ellipse 50% 60% at 6% 0%, rgba(5, 150, 105, 0.22), transparent 70%),
      linear-gradient(160deg, #06291e 0%, #04170f 55%, #030f0a 100%);
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(233, 239, 234, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(233, 239, 234, 0.035) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 80% at 30% 40%, #000 30%, transparent 85%);
  }
  .waves { position: absolute; left: 0; top: 0; }
  .watermark {
    position: absolute; right: -70px; top: 30px;
    filter: drop-shadow(0 0 40px rgba(16, 185, 129, 0.25));
  }
  .content {
    position: absolute; left: 88px; top: 92px; right: 88px;
    display: flex; flex-direction: column;
  }
  .lockup { display: flex; align-items: center; gap: 30px; }
  .tile {
    width: 128px; height: 128px; border-radius: 34px;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #10b981, #047857);
    box-shadow: 0 18px 40px rgba(4, 120, 87, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.25);
  }
  .wordmark { display: flex; flex-direction: column; line-height: 1; }
  .wordmark b { font-size: 92px; font-weight: 800; letter-spacing: -0.035em; color: #fff; }
  .wordmark span {
    margin-top: 10px; font-size: 27px; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase; color: #6ee7b7;
  }
  .tagline {
    margin-top: 54px; max-width: 760px;
    font-size: 38px; font-weight: 600; line-height: 1.22; letter-spacing: -0.015em;
    color: #e9efea;
  }
  .tagline em { font-style: normal; color: #34d399; }
  .stages { margin-top: 38px; display: flex; align-items: center; gap: 10px; }
  .chip {
    padding: 9px 18px; border-radius: 999px;
    font-size: 20px; font-weight: 600; color: #cfe3d8;
    background: rgba(16, 185, 129, 0.10);
    border: 1.5px solid rgba(52, 211, 153, 0.30);
  }
  .chip.last { background: #10b981; border-color: #10b981; color: #04140d; }
  .arrow { color: rgba(110, 231, 183, 0.7); font-size: 24px; font-family: "JetBrains Mono", monospace; }
</style>
</head>
<body>
  <div class="grid"></div>
  <svg class="waves" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${waves}</svg>
  <div class="watermark">${glyph(520, 0.055)}</div>
  <div class="content">
    <div class="lockup">
      <div class="tile">${glyph(84)}</div>
      <div class="wordmark"><b>Pacific</b><span>Insurance PH</span></div>
    </div>
    <p class="tagline">Every lead, policy, renewal, and claim,<br><em>in one place.</em></p>
    <div class="stages">
      ${stages
        .map((s, i) => `<span class="chip${i === stages.length - 1 ? " last" : ""}">${s}</span>`)
        .join('<span class="arrow">→</span>')}
    </div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, type: "png" });
  console.log(`Wrote ${OUT}`);
} finally {
  await browser.close();
}
