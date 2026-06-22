// Catalog of the in-stock board colors from "有现货的板材颜色 2026.01.06.pdf".
// All are European-frameless (EU) finishes; no US/American-framed variants yet.
//
// `page` is the 1-based PDF page the swatch image is rasterized from (page -> name
// mapping was verified by reading the PDF). `promptDescription` describes only the
// color + finish + grain — rendering-prompt.ts prepends the European-style language.
// `swatchHex` is an eyeballed fallback tile color; the generated swatch image is primary.
//
// sortOrder for each seeded color is its position in this array (1-based).

export const CABINET_COLORS_EU = [
  {
    page: 1,
    name: "SYN ANNIVERSARY OAK 02",
    promptDescription:
      "light natural oak woodgrain in a soft warm-beige tone, fine straight grain with subtle knots, low-sheen matte synchronized texture",
    swatchHex: "#cbb293"
  },
  {
    page: 2,
    name: "SYN ANNIVERSARY OAK 03",
    promptDescription:
      "medium warm oak woodgrain in a tobacco-taupe brown tone, pronounced cathedral grain and knots, matte synchronized texture",
    swatchHex: "#a98a6e"
  },
  {
    page: 3,
    name: "SYN ART OAK 01",
    promptDescription:
      "pale whitewashed oak woodgrain in a creamy off-white tone with fine vertical grain, matte synchronized texture",
    swatchHex: "#e3dccb"
  },
  {
    page: 4,
    name: "SYN IDA 01",
    promptDescription:
      "light blond larch/pine woodgrain in a soft cream tone with delicate straight grain, matte synchronized texture",
    swatchHex: "#e8e0cf"
  },
  {
    page: 5,
    name: "SYN IDA 02",
    promptDescription:
      "warm natural larch/pine woodgrain in a honey-beige tone with flowing cathedral grain, matte synchronized texture",
    swatchHex: "#d8bd97"
  },
  {
    page: 6,
    name: "SYN IDA 03",
    promptDescription:
      "greige larch/pine woodgrain in a muted taupe-brown tone with soft straight grain, matte synchronized texture",
    swatchHex: "#b7a288"
  },
  {
    page: 7,
    name: "SYN MURATTI 01",
    promptDescription:
      "weathered driftwood oak woodgrain in a greyed mauve-taupe tone with fine linear grain, matte synchronized texture",
    swatchHex: "#a9988f"
  },
  {
    page: 8,
    name: "SYN MURATTI 03",
    promptDescription:
      "dark walnut woodgrain in a deep espresso-brown tone with straight grain, matte synchronized texture",
    swatchHex: "#5f4a3c"
  },
  {
    page: 9,
    name: "SYN MURATTI 04",
    promptDescription:
      "silvery whitewashed woodgrain in a cool off-white tone with fine vertical lineal grain, matte synchronized texture",
    swatchHex: "#e9e9e6"
  },
  {
    page: 10,
    name: "SYN OLMO 01",
    promptDescription:
      "very light elm woodgrain in a pale greige-white tone with soft subtle grain, matte synchronized texture",
    swatchHex: "#dedad6"
  },
  {
    page: 11,
    name: "SYN OLMO 03",
    promptDescription:
      "dark elm woodgrain in a rich aubergine-brown tone with straight grain, matte synchronized texture",
    swatchHex: "#5a4636"
  },
  {
    page: 12,
    name: "HG BLACK",
    promptDescription:
      "solid jet-black finish with a high-gloss, mirror-like lacquer surface",
    swatchHex: "#0a0a0a"
  },
  {
    page: 13,
    name: "HG METALLO 04",
    promptDescription:
      "oxidized dark-metal / concrete look in charcoal grey with subtle weathered mottling, high-gloss lacquer",
    swatchHex: "#3c3f42"
  },
  {
    page: 14,
    name: "HG CASHMERE",
    promptDescription:
      "solid warm greige (cashmere taupe) finish in a high-gloss lacquer surface",
    swatchHex: "#cdc4b8"
  },
  {
    page: 15,
    name: "HG GRIS NUBE",
    promptDescription:
      "solid soft cloud-grey finish in a high-gloss lacquer surface",
    swatchHex: "#d2d2d3"
  },
  {
    page: 16,
    name: "HG BLANCO POLAR",
    promptDescription:
      "solid bright polar-white finish in a high-gloss lacquer surface",
    swatchHex: "#f0f1f5"
  },
  {
    page: 17,
    name: "SM ORIENTAL BLACK",
    promptDescription:
      "black marble pattern (Oriental black) with fine white veining in a smooth super-matte finish",
    swatchHex: "#15161a"
  },
  {
    page: 18,
    name: "SM AZUL INDIGO",
    promptDescription:
      "solid deep indigo navy-blue finish in a smooth super-matte surface",
    swatchHex: "#3f4f6b"
  },
  {
    page: 19,
    name: "SM BASALTO",
    promptDescription:
      "solid warm taupe-grey (basalt) finish in a smooth super-matte surface",
    swatchHex: "#8c7f7b"
  },
  {
    page: 20,
    name: "SM BLANCO POLAR",
    promptDescription:
      "solid bright polar-white finish in a smooth super-matte, anti-fingerprint surface",
    swatchHex: "#f2f3f7"
  },
  {
    page: 21,
    name: "SM CASHMERE",
    promptDescription:
      "solid warm beige (cashmere) finish in a smooth super-matte surface",
    swatchHex: "#cfc4b4"
  },
  {
    page: 22,
    name: "VD-012",
    promptDescription:
      "solid dark charcoal-grey finish in a smooth matte surface",
    swatchHex: "#4a4a4c"
  },
  {
    page: 23,
    name: "SM VERDE SALVIA",
    promptDescription:
      "solid muted sage-green (salvia) finish in a smooth super-matte surface",
    swatchHex: "#474e46"
  },
  {
    page: 24,
    name: "ABC-WG 01",
    promptDescription:
      "soft whitewashed pine woodgrain in a pale cream tone with fine straight grain, matte finish",
    swatchHex: "#ece4da"
  },
  {
    page: 25,
    name: "ABC-WG 02",
    promptDescription:
      "pale silver-grey washed oak woodgrain in a near-white tone with fine grain, matte finish",
    swatchHex: "#e2e0df"
  },
  {
    page: 26,
    name: "ABC-WG 04",
    promptDescription:
      "light greige walnut woodgrain in a soft taupe tone with gentle grain, matte finish",
    swatchHex: "#cdbcb0"
  },
  {
    page: 27,
    name: "ABC-WG 16",
    promptDescription:
      "dark espresso oak woodgrain in a deep cocoa-brown tone with straight grain, matte finish",
    swatchHex: "#4f4036"
  },
  {
    page: 28,
    name: "ABC-WG 17",
    promptDescription:
      "weathered rustic oak woodgrain in a smoky grey-brown tone with pronounced sawn texture, matte finish",
    swatchHex: "#5f5550"
  },
  {
    page: 29,
    name: "ABC-WG 20",
    promptDescription:
      "warm golden oak woodgrain in a honey-amber tone with natural straight grain, matte finish",
    swatchHex: "#bd8a52"
  },
  {
    page: 30,
    name: "ABC-OT 01",
    promptDescription:
      "woven leather-look basketweave texture in a cream/ivory tone with a soft matte finish",
    swatchHex: "#efe9dc"
  }
];
