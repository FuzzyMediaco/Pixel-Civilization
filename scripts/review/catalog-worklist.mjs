// From the repo root: node --import tsx scripts/review/catalog-worklist.mjs [--era=<key>]
// Read one composed ticket: node --import tsx scripts/review/catalog-worklist.mjs --show=ancient-egypt/public_library
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Session } from "node:inspector/promises";
import { fileURLToPath } from "node:url";
import "../../src/game/designs/index.ts";
import {
  ELEMENT_BY_ID,
  getMaxElementLevel,
  getElementGrowthNote,
  getStandardFootprintForLevel,
} from "../../src/game/catalog.ts";
import { DESIGNS } from "../../src/game/designs/registry.ts";
import { currentProductionArt, loadEraArt } from "../../src/game/eraArtLoader.ts";
import {
  ERA_LABELS,
  ROME_PILOT_IDS,
  eraElementName,
  eraElementSpec,
  eraLevelName,
} from "../../src/game/eraStyles.ts";
import { ERA_SIGNATURE_NAMES } from "../../src/game/eraNames/index.ts";
import { PRODUCTION_ERAS, productionArtFamily } from "../../src/game/designs/periodArtCatalog.ts";
import { roadWidth, VEHICLE_ROADS } from "../../src/game/roadStandards.ts";
import { SKYLINE_STYLES } from "../../src/game/skylineCatalog.ts";
import { voxels } from "../voxel-illustration.mjs";
import { silhouetteOf, silhouetteDistance } from "./silhouette.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const doc = path.join(root, "docs/redesign/worklist");
const data = path.join(doc, "matrix");
const eras = ["original", ...PRODUCTION_ERAS];
const ids = Object.keys(ELEMENT_BY_ID).sort();
const read = (file) => fs.readFileSync(file, "utf8");
const parse = (name) =>
  read(path.join(doc, name))
    .split(/\r?\n/)
    .filter((s) => s && !s.startsWith("#"))
    .map((s) => s.split(" | "));
const keyed = (rows) => {
  const result = new Map(rows.map(([key, ...fields]) => [key, fields]));
  assert.equal(result.size, rows.length, "duplicate design brief");
  return result;
};
const directions = parse("directions.txt");
const plans = keyed(directions.filter(([id]) => !id.startsWith("?")));
const planned = keyed(
  directions.filter(([id]) => id.startsWith("?")).map(([id, ...fields]) => [id.slice(1), ...fields]),
);
for (const [id, fields] of planned) {
  assert.ok(!plans.has(id), "remove the planned duplicate for " + id);
  if (ELEMENT_BY_ID[id]) plans.set(id, fields);
}
const approaches = keyed(parse("era-directions.txt"));
const originalVariants = JSON.parse(read(path.join(root, "src/game/designStyles.json")));
const evidence = keyed(parse("evidence.txt"));
const subtitles = [
  "homes",
  "trade",
  "institutions",
  "working sites",
  "routes and spans",
  "land and water",
  "vessels",
  "landmarks",
];
const branches = {
  homes: ["house", "apartment", "tower"],
  trade: ["market"],
  institutions: ["hall", "school", "faith", "defense"],
  "working sites": ["workshop", "farm", "power", "water", "dock"],
  "routes and spans": ["road", "track", "station", "bridge", "aqueduct"],
  "land and water": ["landscape"],
  vessels: ["vessel"],
  landmarks: ["landmark"],
};
function eraApproach(id, era) {
  const def = ELEMENT_BY_ID[id];
  if (def.category === "christmas")
    return "Seasonal presentations share the Original model and display names in every production era.";
  const family = productionArtFamily(id);
  let branch = Object.entries(branches).find(([, members]) => members.includes(family))?.[0];
  // The brief follows what the player does there. Some renderer families group unrelated functions.
  if (def.category === "commerce")
    branch = [
      "banks",
      "businesses",
      "buildings",
      "coworking_loft",
      "tech_startup_hub",
      "data_centers",
    ].includes(id)
      ? "working sites"
      : "trade";
  if (id === "banks") branch = "institutions";
  if (def.category === "agriculture") branch = "working sites";
  assert.ok(branch, `Add an era direction for ${id} (${family})`);
  return approaches.get(era)[subtitles.indexOf(branch)];
}
for (const id of ids) {
  const fields = plans.get(id);
  assert.ok(fields, `Add a governing idea and four layout directions to directions.txt for ${id}`);
  assert.ok(fields.length === 5 || (fields.length === 2 && fields[1] === "@variants"), id);
  assert.equal(originalVariants[id]?.length, 4, id);
}
assert.deepEqual([...plans.keys()].sort(), ids, "retire briefs only when the canonical ID is retired");
assert.deepEqual([...approaches.keys()].sort(), [...eras].sort(), "every production era needs a direction");
for (const era of eras) assert.equal(approaches.get(era).length, subtitles.length, era);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (a === "--index") return [a, true];
    const [k, v] = a.split("=");
    assert.ok(v && ["--era", "--show"].includes(k), `Unknown option ${a}`);
    return [k, v];
  }),
);
const eraPlans = keyed(parse("era-elements.txt"));
for (const key of [...eraPlans.keys(), ...evidence.keys()]) {
  const [era, id, ...extra] = key.split("/");
  assert.ok(!extra.length && eras.includes(era) && ELEMENT_BY_ID[id], "unknown style/ID: " + key);
}
for (const [key, fields] of eraPlans)
  assert.ok(
    fields.length === 1 || fields.length === 5,
    key + " needs one direction or one direction and four layouts",
  );
function ticket(row, era) {
  const [overhead, ...layout] = plans.get(row.id);
  const sitePlan = eraPlans.get(era + "/" + row.id);
  const elementLayouts = layout[0] === "@variants" ? originalVariants[row.id] : layout;
  return {
    ...row,
    overhead,
    layouts: sitePlan?.length === 5 ? sitePlan.slice(1) : elementLayouts,
    layoutBasis: sitePlan?.length === 5 ? "era design brief" : "element design brief",
    eraDirection: sitePlan?.[0] ?? eraApproach(row.id, era),
    evidence: evidence.get(era + "/" + row.id) ?? null,
  };
}
function sourceDigest() {
  const files = fs
    .readdirSync(path.join(root, "src/game"), { recursive: true })
    .filter((file) => /\.(ts|json|mjs)$/.test(file))
    .map((file) => "src/game/" + file.split(path.sep).join("/"));
  files.push(
    "scripts/review/catalog-worklist.mjs",
    "scripts/review/silhouette.ts",
    "scripts/voxel-illustration.mjs",
    "docs/redesign/worklist/evidence.txt",
  );
  const hash = createHash("sha256");
  for (const file of files.sort())
    hash
      .update(file)
      .update("\0")
      .update(read(path.join(root, file)).replaceAll("\r\n", "\n"))
      .update("\0");
  return hash.digest("hex");
}
const source = sourceDigest();
function snapshot(era) {
  const [header, ...rows] = read(path.join(data, era + ".jsonl"))
    .trimEnd()
    .split("\n")
    .map(JSON.parse);
  assert.equal(header.era, era, "refresh the snapshot to add its source header");
  return { header, rows };
}
if (args["--show"]) {
  const [era, id, ...extra] = args["--show"].split("/");
  assert.ok(!extra.length && eras.includes(era) && ELEMENT_BY_ID[id], "use --show=ERA/CANONICAL_ID");
  const { header, rows } = snapshot(era);
  const row = rows.find((item) => item.id === id);
  assert.ok(row, `refresh ${era} to add ${id}`);
  console.log(
    JSON.stringify(
      { ...ticket(row, era), source: header.source, matchesCheckout: header.source === source },
      null,
      2,
    ),
  );
  process.exit(0);
}

function renderIndex() {
  const counts = [];
  const snapshots = new Map();
  const older = [];
  for (const era of eras) {
    const { header, rows } = snapshot(era);
    if (header.source !== source) older.push(era);
    assert.deepEqual(
      rows.map((r) => r.id),
      ids,
      "refresh " + era + " before rebuilding the index",
    );
    counts.push([
      era,
      rows.reduce((n, r) => n + r.levels.length * r.variants.length, 0),
      rows.filter((r) => r.repeatVariants).length,
      rows.filter((r) => r.repeatLevels).length,
      rows.filter((r) => r.lowGrowth).length,
      rows.filter((r) => r.nearest[1] < 0.12).length,
    ]);
    snapshots.set(era, rows);
  }
  const original = snapshots.get("original");
  const out = [
    "# Playable art worklist",
    "",
    `Source fingerprint: \`${source}\`. ${older.length ? "Refresh these style files: " + older.join(", ") + "." : `All ${eras.length} snapshots match this checkout.`}`,
    "",
    "The table counts canonical IDs with one or more flags. Distances screen models for visual inspection. Index totals count a seasonal element in every selectable style.",
    "",
    "| Style | Presentations | Repeated variants | Repeated upgrades | Small upgrade silhouette changes | Close neighboring IDs at L3 A |",
    "|---|---:|---:|---:|---:|---:|",
    ...counts.map(
      ([key, ...values]) => `| [${ERA_LABELS[key]}](matrix/${key}.jsonl) | ${values.join(" | ")} |`,
    ),
    "",
    `Total: **${counts.reduce((n, row) => n + row[1], 0).toLocaleString("en-US")} presentations**, across **${ids.length} IDs** and **${eras.length} selectable styles**.`,
    "",
    "Each row lists the governing idea and proposed A–D layout directions. The style files hold the resolved display labels, model source, footprints, voxel counts and nearest measured neighbor. Read [the field guide](README.md) for single-ID lookup and refresh commands.",
    "",
  ];
  for (const cat of [...new Set(original.map((r) => r.category))].sort()) {
    const members = original.filter((r) => r.category === cat);
    out.push(
      "## " + cat,
      "",
      `${members.length} canonical IDs · ${members.reduce((n, r) => n + r.levels.length * r.variants.length, 0)} presentations per style.`,
      "",
      "| Canonical ID | Overhead cue | Layout directions, A through D |",
      "|---|---|---|",
    );
    for (const row of members) {
      const t = ticket(row, "original");
      out.push(`| [${row.id}](../../../${row.original}) | ${t.overhead} | ${t.layouts.join(" · ")} |`);
    }
    out.push("");
  }
  fs.writeFileSync(path.join(doc, "INDEX.md"), out.join("\n").trimEnd() + "\n");
}
if (args["--index"]) {
  renderIndex();
  process.exit(0);
}
const selected = args["--era"] ? [args["--era"]] : eras;
assert.ok(
  selected.every((era) => eras.includes(era)),
  "unknown era",
);
const inspect = new Session();
inspect.connect();
const scripts = new Map();
inspect.on("Debugger.scriptParsed", ({ params }) => scripts.set(params.scriptId, params.url));
await inspect.post("Debugger.enable");
const paths = new WeakMap();
// Ask V8 for the loaded function's defining module. Registration order includes category
// overrides, and several catalogs register imported builders inside map()/Object.fromEntries().
async function moduleOf(build) {
  if (paths.has(build)) return paths.get(build);
  globalThis.worklistSource = build;
  const { result } = await inspect.post("Runtime.evaluate", {
    expression: "globalThis.worklistSource",
    objectGroup: "worklist",
  });
  const { internalProperties } = await inspect.post("Runtime.getProperties", { objectId: result.objectId });
  const location = internalProperties.find((p) => p.name === "[[FunctionLocation]]")?.value?.value;
  assert.ok(location?.scriptId, "missing builder definition");
  const source = path
    .relative(root, fileURLToPath(scripts.get(location.scriptId)))
    .split(path.sep)
    .join("/");
  assert.ok(source.startsWith("src/") && fs.existsSync(path.join(root, source)), source);
  paths.set(build, source);
  return source;
}
const originals = {};
for (const id of ids) originals[id] = await moduleOf(DESIGNS[id].build);
const catalogSources = new Map();
for (const [file, symbol] of [
  ["wealthProjects", "WEALTH_PROJECTS"],
  ["expansionCatalog", "EXPANSION_ELEMENTS"],
  ["historicalCatalog", "HISTORICAL_WONDERS"],
  ["expansionSafetyMilitaryCommerce", "NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS"],
  ["expansionBalancedCatalog", "BALANCED_EXPANSION_ELEMENTS"],
  ["christmasCatalog", "CHRISTMAS_ELEMENTS"],
  ["skylineCatalog", "SKYLINE_ELEMENTS"],
]) {
  const exports = await import(`../../src/game/${file}.ts`);
  for (const def of exports[symbol]) catalogSources.set(def.id, `src/game/${file}.ts`);
}
function provenance(def, era, signature) {
  const original = def.category === "christmas" || era === "original";
  const roman = !original && !signature && era === "rome-aqueduct" && ROME_PILOT_IDS.includes(def.id);
  const named = ERA_SIGNATURE_NAMES[era]?.[def.id];
  const model = original
    ? originals[def.id]
    : signature || (roman ? "src/game/designs/romePilot.ts" : "src/game/designs/periodArchitecture.ts");
  const family = original
    ? undefined
    : roman
      ? eraElementSpec(def.id, era).family
      : productionArtFamily(def.id);
  let nameSource = "src/game/eraStyles.ts";
  let variantSource = "src/game/designs/periodArtCatalog.ts";
  let levelSource = nameSource;
  let state = "production family; review open";
  if (original) {
    nameSource = catalogSources.get(def.id) ?? "src/game/catalog.ts";
    variantSource = "src/game/designStyles.json";
    levelSource = VEHICLE_ROADS.has(def.id)
      ? "src/game/roadStandards.ts"
      : "src/game/catalog.ts#getElementLevelName";
    state = era === "original" ? "review open" : "shared seasonal";
  } else if (named) {
    nameSource = levelSource = variantSource = `src/game/eraNames/${era}.ts`;
  } else if (roman) {
    variantSource = nameSource;
    state = "Roman pilot; review open";
  } else if (SKYLINE_STYLES.has(def.id)) {
    variantSource = "src/game/skylineCatalog.ts";
  }
  if (signature) state = "signature present; review open";
  const recorded = evidence.get(era + "/" + def.id);
  if (recorded) state = recorded[2] ?? "review evidence";
  return {
    state,
    model,
    original: originals[def.id],
    ...(!original && Boolean(signature) !== Boolean(named)
      ? { signatureMismatch: signature ? "art without era-specific labels" : "era-specific labels without art" }
      : {}),
    ...(family ? { family } : {}),
    ...(roadWidth(def.id) > 1 ? { joinedDeck: "src/game/designs/carriageways.ts" } : {}),
    labels: { element: nameSource, levels: levelSource, variants: variantSource },
  };
}
function measure(map) {
  assert.ok(map.size, "empty model");
  // Commutative fingerprint of coordinate/style pairs, independent of insertion order.
  let sum = 0,
    xor = 0;
  for (const [key, color] of map) {
    const mix = Math.imul(key ^ Math.imul(color, 2654435761), 2246822519);
    sum = (sum + mix) | 0;
    xor ^= Math.imul(mix ^ (mix >>> 16), 3266489917);
  }
  return map.size + "/" + sum + "/" + xor;
}
function sameVoxels(cell, map, fingerprint) {
  if (!cell || cell.fingerprint !== fingerprint) return false;
  // Confirm collisions and byte-identical appearances with the actual coordinate/material map.
  for (const [key, value] of map) if (cell.map.get(key) !== value) return false;
  return true;
}
const rounded = (x) => Number(x.toFixed(4));
const originalConsoleError = console.error;
console.error = (...a) => {
  throw Error(a.map(String).join(" "));
}; // buildDesignVoxels logs and returns a magenta box on builder errors.
fs.mkdirSync(data, { recursive: true });
try {
  for (const era of selected) {
    await loadEraArt(era);
    const rows = [],
      shapes = [];
    for (const id of ids) {
      const def = ELEMENT_BY_ID[id],
        n = getMaxElementLevel(id),
        spec = eraElementSpec(id, era);
      const signature = currentProductionArt(era)?.ink.signatures?.[id];
      const src = provenance(def, era, signature && (await moduleOf(signature)));
      const variants = spec?.variants ?? originalVariants[id];
      assert.equal(variants.length, 4, id);
      const levels = [],
        repeatVariants = [],
        nearVariants = [],
        repeatLevels = [],
        lowGrowth = [];
      let usesOriginal = false;
      const placed = DESIGNS[id];
      const build = placed.build;
      const observe = (ctx) => {
        usesOriginal = true;
        return build(ctx);
      };
      let previous = [];
      for (let level = 1; level <= n; level++) {
        const span = getStandardFootprintForLevel(def, level);
        const cells = [];
        for (let variant = 0; variant < 4; variant++) {
          // Sample the real path to distinguish period-built structures from an Original machine
          // with a period surround; restore the entry before measuring the next presentation.
          const probe = level === 1 && variant === 0;
          if (probe) placed.build = observe;
          let map;
          try {
            map = voxels(id, level, variant, undefined, [], { era, eraActivity: "active" });
          } finally {
            if (probe) placed.build = build;
          }
          const road = roadWidth(id);
          const silhouette = silhouetteOf(map, road > 1 ? 48 : span[0] * 8, road > 1 ? road * 16 : span[1] * 8);
          if (road > 1) {
            for (const view of [silhouette.plan, silhouette.front, silhouette.side])
              for (let k = 0; k < view.length; k++) view[k] /= 2;
            silhouette.top /= 2;
          }
          const fingerprint = measure(map);
          const prior = previous[variant];
          if (sameVoxels(prior, map, fingerprint)) repeatLevels.push([level, variant]);
          for (let earlier = 0; earlier < cells.length; earlier++) {
            if (sameVoxels(cells[earlier], map, fingerprint)) repeatVariants.push([level, earlier, variant]);
            const distance = silhouetteDistance(cells[earlier].silhouette, silhouette);
            if (distance < 0.12) nearVariants.push([level, earlier, variant, rounded(distance)]);
          }
          const delta = prior ? silhouetteDistance(prior.silhouette, silhouette) : undefined;
          if (delta !== undefined && delta < 0.06) lowGrowth.push([level, variant, rounded(delta)]);
          cells.push({ map, fingerprint, silhouette });
        }
        if (level === Math.min(n, 3)) shapes.push(cells[0].silhouette);
        levels.push([eraLevelName(id, level, era), span, cells.map((x) => x.map.size)]);
        previous = cells;
      }
      const row = {
        id,
        category: def.category,
        name: eraElementName(id, era),
        ...src,
        usesOriginalAtL1A: usesOriginal,
        variants,
        levels,
        originalGrowth: getElementGrowthNote(def) ?? "",
        ...(spec ? { eraDescription: spec.description } : {}),
        ...(nearVariants.length ? { nearVariants } : {}),
        ...(repeatVariants.length ? { repeatVariants } : {}),
        ...(repeatLevels.length ? { repeatLevels } : {}),
        ...(lowGrowth.length ? { lowGrowth } : {}),
      };
      rows.push(row);
    }
    // Stable ID order resolves equal distances deterministically.
    for (let i = 0; i < rows.length; i++) {
      let distance = Infinity,
        nearest = "";
      for (let j = 0; j < rows.length; j++)
        if (i !== j) {
          const d = silhouetteDistance(shapes[i], shapes[j]);
          if (d < distance) {
            distance = d;
            nearest = rows[j].id;
          }
        }
      rows[i].nearest = [nearest, rounded(distance)];
    }
    const save = path.join(data, era + ".jsonl");
    const temporary = save + "." + process.pid + ".tmp";
    fs.writeFileSync(temporary, [{ era, source }, ...rows].map((x) => JSON.stringify(x)).join("\n") + "\n");
    fs.renameSync(temporary, save);
    console.log(
      ERA_LABELS[era],
      rows.length,
      rows.reduce((s, r) => s + r.levels.length * r.variants.length, 0),
      "presentations",
    );
  }
  if (!args["--era"]) renderIndex();
} finally {
  console.error = originalConsoleError;
  delete globalThis.worklistSource;
  inspect.disconnect();
}
