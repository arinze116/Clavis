import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(repositoryRoot, "frontend", "public", "og-banner.png");
const markPath = path.join(repositoryRoot, "frontend", "public", "clavis-mark.svg");
const wordmarkFontPath = path.join(repositoryRoot, "frontend", "public", "fonts", "clavis-wordmark-newsreader-600.woff2");
const [markSvg, wordmarkFont] = await Promise.all([readFile(markPath, "utf8"), readFile(wordmarkFontPath)]);
const markDataUrl = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;
const wordmarkFontDataUrl = `data:font/woff2;base64,${wordmarkFont.toString("base64")}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

try {
  await page.setContent(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @font-face { font-family: ClavisWordmark; src: url(${wordmarkFontDataUrl}) format("woff2"); font-style: normal; font-weight: 600; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body {
      background: #11130f;
      color: #f7f4ee;
      font-family: Inter, Arial, sans-serif;
    }
    .frame {
      position: relative;
      width: 100%;
      height: 100%;
      padding: 58px 64px;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 54px;
      align-items: center;
    }
    .frame::after {
      content: "";
      position: absolute;
      inset: 22px;
      border: 1px solid rgba(247,244,238,.12);
      border-radius: 24px;
      pointer-events: none;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .mark { width: 48px; height: 48px; display: block; }
    .wordmark { font-family: ClavisWordmark, Georgia, serif; font-size: 32px; font-weight: 600; }
    .eyebrow { margin-top: 64px; color: #c8ff62; font: 600 14px/1.2 Consolas, monospace; }
    h1 { margin: 18px 0 0; font-family: Georgia, serif; font-size: 67px; line-height: .96; letter-spacing: -2.2px; font-weight: 500; }
    .sub { margin: 24px 0 0; max-width: 520px; color: rgba(247,244,238,.62); font-size: 20px; line-height: 1.45; }
    .proof { margin-top: 30px; display: flex; align-items: center; gap: 10px; color: rgba(247,244,238,.52); font-size: 13px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #c8ff62; }
    .line { width: 54px; height: 1px; background: rgba(200,255,98,.45); }
    .panel { transform: rotate(1.6deg); border: 1px solid rgba(247,244,238,.14); border-radius: 24px; background: #1a1d17; padding: 26px; box-shadow: 0 28px 70px rgba(0,0,0,.36); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 1px solid rgba(247,244,238,.1); }
    .label { color: #c8ff62; font: 600 11px/1.2 Consolas, monospace; }
    .cycle { margin-top: 8px; font-size: 21px; font-weight: 600; }
    .status { border-radius: 7px; background: rgba(76,195,138,.13); color: #85deb1; padding: 7px 10px; font-size: 12px; font-weight: 600; }
    .rules { margin-top: 20px; display: grid; gap: 10px; }
    .rule { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid rgba(247,244,238,.09); border-radius: 12px; background: rgba(247,244,238,.035); font-size: 13px; color: rgba(247,244,238,.74); }
    .check { width: 24px; height: 24px; border-radius: 7px; background: #c8ff62; color: #11130f; display: grid; place-items: center; font-weight: 800; }
    .number { color: rgba(247,244,238,.28); font: 11px Consolas, monospace; }
    .result { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .result > div { min-height: 104px; border-radius: 14px; padding: 18px; }
    .protected { background: #c8ff62; color: #11130f; }
    .private { border: 1px solid rgba(247,244,238,.11); }
    .big { margin-top: 18px; font-family: Georgia, serif; font-size: 30px; font-weight: 600; }
    .small { margin-top: 3px; font-size: 11px; opacity: .58; }
  </style>
</head>
<body>
  <main class="frame">
    <section>
      <div class="brand"><img class="mark" src="${markDataUrl}" alt=""><div class="wordmark">Clavis</div></div>
      <div class="eyebrow">VERSIONED PAYROLL · PUBLIC EVIDENCE</div>
      <h1>Payroll that keeps its promises</h1>
      <p class="sub">Source v0.2 keeps native NEAR settlement inside the contract and labels legacy deployments honestly.</p>
      <div class="proof"><span class="dot"></span><span>NEAR testnet</span><span class="line"></span><span>Source v0.2 verified</span><span class="line"></span><span>Audit fields minimized</span></div>
    </section>
    <section class="panel">
      <div class="panel-head"><div><div class="label">SOURCE EVIDENCE</div><div class="cycle">Contract v0.2.0</div></div><div class="status">Versioned</div></div>
      <div class="rules">
        <div class="rule"><span class="check">✓</span><span>Contract controls native NEAR</span><span class="number">01</span></div>
        <div class="rule"><span class="check">✓</span><span>Approval follows transfer success</span><span class="number">02</span></div>
        <div class="rule"><span class="check">✓</span><span>Unsupported routes fail closed</span><span class="number">03</span></div>
        <div class="rule"><span class="check">✓</span><span>Legacy deployments are labelled</span><span class="number">04</span></div>
      </div>
      <div class="result"><div class="protected"><div class="big">Native</div><div class="small">Contract-paid in source v0.2</div></div><div class="private"><div class="big">Legacy</div><div class="small">Clearly disclosed when deployed</div></div></div>
    </section>
  </main>
</body>
</html>`);

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: outputPath, type: "png" });
  console.log(outputPath);
} finally {
  await browser.close();
}
