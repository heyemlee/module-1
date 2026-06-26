// Inlines the scenario renderings into public/test-dialogues.html as base64
// data URIs so the file is fully self-contained (no /renderings/ dependency).
// Downscales to ~1000px JPEG first — the card displays at ~260px, so full-res
// PNGs (~2MB each) would bloat the HTML ~13× for zero visible gain.
// ponytail: uses macOS `sips` (already installed) instead of an image lib dep.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "public", "test-dialogues.html");
let html = readFileSync(htmlPath, "utf8");

let totalB64 = 0;
for (let n = 1; n <= 10; n++) {
  const src = join(root, "public", "renderings", `s${n}.png`);
  const tmp = join("/tmp", `embed-s${n}.jpg`);
  // -Z N  → fit within N px (keeps aspect); format jpeg @ quality 82.
  execFileSync("sips", [
    "-Z", "1000",
    "-s", "format", "jpeg",
    "-s", "formatOptions", "82",
    src, "--out", tmp
  ], { stdio: "ignore" });

  const b64 = readFileSync(tmp).toString("base64");
  const dataUri = `data:image/jpeg;base64,${b64}`;
  const needle = `"/renderings/s${n}.png"`;
  if (!html.includes(needle)) {
    console.error(`s${n}: anchor ${needle} not found in HTML`);
    process.exit(1);
  }
  html = html.replace(needle, `"${dataUri}"`);
  totalB64 += b64.length;
  console.log(`s${n}: inlined ${(b64.length / 1024).toFixed(0)} KB`);
}

writeFileSync(htmlPath, html);
const remaining = (html.match(/\/renderings\//g) || []).length;
console.log(`\nHTML now ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB; remaining /renderings/ refs: ${remaining}`);
