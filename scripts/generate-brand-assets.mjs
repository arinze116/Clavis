import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(repositoryRoot, "frontend", "public");
const finalBrandRoot = path.join(repositoryRoot, "docs", "brand", "final");
const primaryMarkPath = path.join(publicRoot, "clavis-mark.svg");
const wordmarkFontPath = path.join(publicRoot, "fonts", "clavis-wordmark-newsreader-600.woff2");

const rasterTargets = [
  { background: "transparent", outputPath: path.join(publicRoot, "favicon-16.png"), size: 16, type: "png" },
  { background: "transparent", outputPath: path.join(publicRoot, "favicon-32.png"), size: 32, type: "png" },
  { background: "transparent", outputPath: path.join(publicRoot, "favicon.png"), size: 96, type: "png" },
  { background: "transparent", outputPath: path.join(publicRoot, "favicon-128.png"), size: 128, type: "png" },
  { background: "ink", outputPath: path.join(publicRoot, "apple-touch-icon.png"), size: 180, type: "png" },
  { background: "ink", outputPath: path.join(publicRoot, "clavis-avatar.png"), size: 512, type: "png" },
  { background: "ink", outputPath: path.join(publicRoot, "clavis-logo.jpg"), size: 512, type: "jpeg" },
];

function toDataUrl(mimeType, value) {
  return `data:${mimeType};base64,${Buffer.from(value).toString("base64")}`;
}

function createWordmarkSvg({ color, fontDataUrl }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 54" role="img" aria-labelledby="title">
  <title id="title">Clavis wordmark</title>
  <style>@font-face{font-family:ClavisWordmark;src:url(${fontDataUrl}) format("woff2");font-style:normal;font-weight:600}</style>
  <text x="2" y="42" fill="${color}" font-family="ClavisWordmark" font-size="44" font-weight="600">Clavis</text>
</svg>\n`;
}

function createLockupSvg({ color, fontDataUrl, markDataUrl }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 64" role="img" aria-labelledby="title">
  <title id="title">Clavis</title>
  <style>@font-face{font-family:ClavisWordmark;src:url(${fontDataUrl}) format("woff2");font-style:normal;font-weight:600}</style>
  <image href="${markDataUrl}" x="0" y="0" width="64" height="64" />
  <text x="80" y="47" fill="${color}" font-family="ClavisWordmark" font-size="43" font-weight="600">Clavis</text>
</svg>\n`;
}

async function renderRaster(browser, markSvg, target) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });

  try {
    const background = target.background === "ink" ? "#11130f" : "transparent";
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background}}svg{display:block;width:100%;height:100%}</style>${markSvg}`);
    await page.screenshot({
      omitBackground: target.background === "transparent",
      path: target.outputPath,
      type: target.type,
      ...(target.type === "jpeg" ? { quality: 95 } : {}),
    });
  } finally {
    await page.close();
  }
}

async function writeVectorAssets({ fontDataUrl, markDataUrl, markSvg }) {
  const assets = [
    [path.join(finalBrandRoot, "clavis-symbol-primary.svg"), markSvg],
    [path.join(finalBrandRoot, "clavis-wordmark-ink.svg"), createWordmarkSvg({ color: "#11130f", fontDataUrl })],
    [path.join(finalBrandRoot, "clavis-wordmark-white.svg"), createWordmarkSvg({ color: "#ffffff", fontDataUrl })],
    [path.join(finalBrandRoot, "clavis-lockup-light.svg"), createLockupSvg({ color: "#11130f", fontDataUrl, markDataUrl })],
    [path.join(finalBrandRoot, "clavis-lockup-dark.svg"), createLockupSvg({ color: "#ffffff", fontDataUrl, markDataUrl })],
  ];

  await Promise.all(assets.map(([outputPath, contents]) => writeFile(outputPath, contents)));
}

async function main() {
  await mkdir(finalBrandRoot, { recursive: true });
  const [markSvg, fontBuffer] = await Promise.all([readFile(primaryMarkPath, "utf8"), readFile(wordmarkFontPath)]);
  const markDataUrl = toDataUrl("image/svg+xml", markSvg);
  const fontDataUrl = toDataUrl("font/woff2", fontBuffer);

  await copyFile(primaryMarkPath, path.join(publicRoot, "favicon.svg"));
  await writeVectorAssets({ fontDataUrl, markDataUrl, markSvg });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const target of rasterTargets) {
      await renderRaster(browser, markSvg, target);
    }
  } finally {
    await browser.close();
  }

  await copyFile(path.join(publicRoot, "clavis-avatar.png"), path.join(finalBrandRoot, "clavis-avatar-512.png"));
  console.log(rasterTargets.map(({ outputPath }) => outputPath).join("\n"));
}

main().catch((error) => {
  console.error("Failed to generate Clavis brand assets.", error);
  process.exitCode = 1;
});
