// Phase A — Prepare swatch assets + colors manifest (local, no DB writes).
//
//   node scripts/prepare-cabinet-colors.mjs ["<path-to.pdf>"]
//
// 1. Rasterize each PDF page to JPEG with pdftoppm.
// 2. Center-crop the largest centered square (drops the bottom-corner name label) and
//    resize to 800px with sips -> clean texture tile per color.
// 3. Emit scripts/cabinet-colors-eu.json (swatch images as base64 data URLs).
// 4. Emit 300px review thumbnails under /tmp/abc-swatches/thumbs for a contact sheet.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CABINET_COLORS_EU } from "./cabinet-colors-eu.data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const DEFAULT_PDF = "/Users/yitianwu/Desktop/有现货的板材颜色 2026.01.06..pdf";
const pdfPath = process.argv[2] || DEFAULT_PDF;

const workDir = "/tmp/abc-swatches";
const thumbDir = join(workDir, "thumbs");
const SWATCH_PX = 800;
const THUMB_PX = 320;
const JPEG_QUALITY = "82";

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

function pixelDims(file) {
  const out = sh("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1]);
  if (!w || !h) throw new Error(`Could not read dimensions for ${file}: ${out}`);
  return { w, h };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

console.log(`PDF: ${pdfPath}`);
rmSync(workDir, { recursive: true, force: true });
mkdirSync(thumbDir, { recursive: true });

// 1. Rasterize all pages. pdftoppm pads to the page-count width (30 pages -> page-01..page-30).
console.log("Rasterizing pages with pdftoppm ...");
sh("pdftoppm", ["-jpeg", "-r", "150", pdfPath, join(workDir, "page")]);

const manifest = [];

for (const [index, color] of CABINET_COLORS_EU.entries()) {
  const sortOrder = index + 1;
  const src = join(workDir, `page-${pad2(color.page)}.jpg`);
  const swatch = join(workDir, `swatch-${pad2(color.page)}.jpg`);
  const thumb = join(thumbDir, `thumb-${pad2(sortOrder)}.jpg`);

  const { w, h } = pixelDims(src);
  const side = Math.min(w, h); // centered square -> excludes bottom-corner label on portrait pages

  // Centered square crop -> 800px -> JPEG (the DB swatch).
  sh("sips", [
    "-c", String(side), String(side),
    "-Z", String(SWATCH_PX),
    "-s", "format", "jpeg",
    "-s", "formatOptions", JPEG_QUALITY,
    src, "--out", swatch
  ]);

  // 320px review thumbnail (kept tiny for a contact sheet).
  sh("sips", ["-Z", String(THUMB_PX), "-s", "format", "jpeg", "-s", "formatOptions", "70", swatch, "--out", thumb]);

  const bytes = readFileSync(swatch);
  const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;

  manifest.push({
    name: color.name,
    cabinetStyle: "EUROPEAN_FRAMELESS",
    promptDescription: color.promptDescription,
    swatchHex: color.swatchHex,
    sortOrder,
    swatchImageUrl: dataUrl
  });

  console.log(
    `  ${pad2(sortOrder)}  ${color.name.padEnd(24)} src ${w}x${h} -> ${Math.round(bytes.length / 1024)}KB`
  );
}

const outPath = join(repoRoot, "scripts", "cabinet-colors-eu.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2));

const totalMB = (JSON.stringify(manifest).length / (1024 * 1024)).toFixed(2);
console.log(`\nWrote ${manifest.length} colors -> ${outPath} (~${totalMB} MB)`);
console.log(`Swatch tiles + thumbs under ${workDir}`);
