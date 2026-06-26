// Generates per-scenario concept renderings for public/test-dialogues.html by
// calling the same OpenAI Images API the app uses (text-to-image `generate`).
// Usage: node scripts/generate-renderings.mjs [s1 s3 ...]   (default: all)
// ponytail: no deps — reads .env.local by hand, uses global fetch + node:fs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function envFromFile(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}

const env = { ...envFromFile(join(root, ".env.local")), ...process.env };
const apiKey = env.OPENAI_API_KEY?.trim();
const model = env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
const baseUrl = (env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY (.env.local)");
  process.exit(1);
}

const BASE =
  "Create a warm, spacious, photorealistic customer concept rendering of a high-end residential kitchen for a sales preview in a luxury California Bay Area single-family home. High ceilings, airy open-concept feel, bright natural daylight, restrained neutral surfaces. Camera: wide-angle one-point perspective, standing at the front of the room looking straight at the back wall (front wall is behind the camera, not shown). Use American residential appliances and proportions (large stainless or panel-ready). ONLY draw the appliances explicitly listed — do not add any extra ovens, microwaves, or appliances. This is a sales-estimate concept only: do NOT draw any text, numbers, dimension lines, labels, or legends anywhere on the image.";

const SCENES = {
  s1: "U-shaped kitchen with a large central island. Frameless European flat-slab handleless cabinets in warm white. On the back wall: a stainless undermount sink and a stainless gas range, with a large window above. On the right wall: a tall appliance cabinet holding a stacked wall-oven-and-microwave tower. On the left wall: a large stainless refrigerator. Grand, luxurious, very spacious.",
  s2: "Left L-shaped kitchen, no island. American framed shaker cabinets in soft sage green with polished hardware. On the back wall: a stainless sink and a freestanding range. A wide cased doorway opening (no door panel) on one side leads out of the room. A window on a side wall. Approachable, bright, mid-sized.",
  s3: "U-shaped kitchen with a large central island; a built-in cooktop (burners only, no oven door) sits on the island. On the right wall: a tall cabinet with a stacked wall-oven-and-microwave tower. On the back wall: a stainless sink and dishwasher. On the left wall: a large panel-ready refrigerator. Frameless European flat-slab cabinets in matte deep navy with brass accents. High-end, magazine-quality.",
  s4: "A simple, representative mid-sized kitchen with neutral white shaker cabinets. On the back wall: a stainless sink and a freestanding range; a standard refrigerator at the end of the run. Plain, clean, unfurnished feel — a generic default concept with no special features and no island.",
  s5: "Left L-shaped kitchen, no island. Frameless European flat-slab cabinets in light oak wood-grain. On the back wall: a stainless sink, a freestanding range, and a dishwasher; a refrigerator on the short return wall. Bright, calm, contemporary.",
  s6: "U-shaped kitchen, no island. On the right wall: a tall cabinet with a stacked wall-oven-and-microwave tower. On the left wall: a refrigerator recessed flush into the surrounding cabinetry. On the back wall: a stainless sink and a freestanding range. American framed cabinets in charcoal grey with restrained hardware. Crisp, detailed, well-built feel.",
  s7: "A small, narrow single-run galley kitchen: one counter run along a single wall, the opposite side is open walkway. Bright white frameless flat-slab cabinets. On the run: a compact apartment-size refrigerator, a stainless sink, a small freestanding range, and a small countertop toaster oven sitting on the counter. No island. Light and airy to make the tiny space feel open.",
  s8: "U-shaped kitchen with cabinetry on all three walls, no island. Classic white American framed shaker cabinets. On the back wall: a stainless sink and a freestanding range; a refrigerator and a dishwasher integrated into the runs. Warm, traditional, inviting.",
  s9: "U-shaped kitchen, no island. A door opening on the right wall; a window on the back wall above a stainless sink and a stainless gas range. On the right run: a tall cabinet housing a built-in steam oven. Frameless European flat-slab cabinets in warm greige. Refined and modern.",
  s10: "An open-concept kitchen that flows into an adjacent dining area through a wide opening. On the back wall: a stainless sink and a freestanding range only. IMPORTANT: there is NO refrigerator anywhere in the kitchen — do not draw a refrigerator. Bright white frameless flat-slab cabinets. Open, casual, connected to the dining space."
};

const size = "1536x1024";
const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);

mkdirSync(join(root, "public", "renderings"), { recursive: true });

async function generate(id) {
  const scene = SCENES[id];
  if (!scene) { console.error(`skip ${id}: unknown scene`); return; }
  const prompt = `${BASE}\n\nThis specific kitchen: ${scene}`;
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, size, n: 1 })
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      console.error(`${id}: FAILED ${res.status}: ${detail}`);
      return;
    }
    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) { console.error(`${id}: no image data returned`); return; }
    writeFileSync(join(root, "public", "renderings", `${id}.png`), Buffer.from(b64, "base64"));
    console.log(`${id}: ok ${(Date.now() - t0) / 1000}s → public/renderings/${id}.png`);
  } catch (e) {
    console.error(`${id}: ERROR: ${e.message}`);
  }
}

// Fire all targets concurrently — finishes in ~one image's wall-time, not the sum.
// ponytail: gpt-image concurrency is fine for 10; bump to a pool if rate-limited.
console.log(`generating ${targets.length} concurrently (${model}, ${size})…`);
await Promise.all(targets.map(generate));
console.log("done");
