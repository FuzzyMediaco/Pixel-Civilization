import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENTS, ELEMENT_BY_ID, getStandardFootprintForLevel, getElementLevelName, getMaxElementLevel } from "../src/game/catalog";
import { findGuideElements, getGuidePartner, getGuideVariant, getNeighborPreview } from "../src/game/connectionPreview";
import { DESIGNS } from "../src/game/designs/registry";
import styleNames from "../src/game/designStyles.json";
import catalog from "../src/handbook/catalog.json";
import neighbors from "../public/handbook/neighbors/index.json";
import { makeCtx } from "../src/game/designs/kit";
import { applyParcelAppearance } from "../src/game/parcelGeometry";
import { packVoxKey } from "../src/game/voxelCore";
import { getHandbookFrame, handbookLayout, sheetSize } from "../src/game/handbookLayout";

test("handbook includes current metadata, images, and all five saved levels and four styles per element", () => {
  assert.deepEqual(
    catalog.map((row) => row.id),
    ELEMENTS.map((def) => def.id),
  );
  const images = new Set<string>();
  for (const row of catalog) {
    const def = ELEMENT_BY_ID[row.id],
      design = DESIGNS[row.id],
      max = getMaxElementLevel(row.id);
    assert.deepEqual(
      [row.name, row.category, row.description, row.growth, row.maxLevel],
      [def.name, def.category, def.description, design.growth, max],
    );
    assert.deepEqual(
      [row.cost, row.domain, row.stage, row.wealthThreshold, row.isStarter],
      [def.cost, def.domain, def.stage, def.wealthThreshold, !!def.isStarter],
    );
    for (const [key, value] of Object.entries(row.stats)) {
      assert.equal(value, def[key === "population" ? "popBase" : (key as keyof typeof def)], row.id + " " + key);
    }
    assert.equal(row.partner.id, getGuidePartner(def.id));
    assert.equal(row.styles.length, 4);
    assert.equal(new Set(row.styles.map((style) => style.name)).size, 4);
    assert.deepEqual(
      row.styles.map((style) => style.name),
      styleNames[row.id as keyof typeof styleNames],
    );
    assert.deepEqual(
      row.levels,
      Array.from({ length: Math.max(5, max) }, (_, i) => ({
        name: max > 5 ? getElementLevelName(def, i+1) : design.levels[i],
        level: i + 1,
        dimensions: getStandardFootprintForLevel(def, Math.min(i+1, max)),
        legacy: i >= max,
      })),
    );
    images.add(row.image);
    images.add(row.thumbnail);
  }
  assert.equal(images.size, 2 * ELEMENTS.length);
  for (const example of neighbors) {
    assert.ok(example.ids.length >= 1 && example.ids.every((id) => ELEMENT_BY_ID[id]));
    images.add(example.image);
  }
  for (const image of images) {
    assert.match(image, /^\/handbook\/(?:catalog|neighbors)\/(?:thumbs\/)?[a-z0-9_-]+\.webp$/);
    const descriptor = fs.openSync(new URL("../public" + image, import.meta.url), "r");
    try {
      const signature = Buffer.alloc(12);
      assert.equal(fs.readSync(descriptor, signature), 12);
      assert.equal(signature.toString("ascii", 0, 4), "RIFF", image);
      assert.equal(signature.toString("ascii", 8), "WEBP", image);
    } finally {
      fs.closeSync(descriptor);
    }
  }
});

test("the illustrated viewer can isolate every style and level from its own sheet", () => {
  const { left, top, gap, cell } = handbookLayout;
  for (const columns of [5, 11]) for (let level = 1; level <= columns; level++)
    for (let style = 0; style < 4; style++) {
      const frame = getHandbookFrame(level, style, columns);
      const width = left + columns * (cell + gap);
      const [x, y] = frame.backgroundPosition.split(" ").map(parseFloat);
      assert.equal(Math.round((x * (width - cell)) / 100), left + (level - 1) * (cell + gap));
      assert.equal(Math.round((y * (sheetSize.height - cell)) / 100), top + style * (cell + gap));
    }
});

test("the starter shelf and multi-tile frontage previews follow the live catalog and streets", () => {
  assert.deepEqual(
    findGuideElements("", "starter"),
    ELEMENTS.filter((d) => d.isStarter),
  );
  assert.equal(findGuideElements("", "starter").length, 12);
  assert.deepEqual(
    findGuideElements("taxi_ranks", "roads_transit").map((d) => d.id),
    ["taxi_ranks"],
  );
  for (const id of ["train_stops", "taxi_ranks", "medium_sized_homes"]) {
    const plots = getNeighborPreview(id, 3),
      site = plots[0].el;
    assert.ok(plots.length >= 4, id);
    const occupied = new Set<string>();
    for (const { el } of plots)
      for (let dx = 0; dx < el.spanX; dx++)
        for (let dz = 0; dz < el.spanZ; dz++) {
          const cell = el.gx + dx + "," + (el.gz + dz);
          assert.equal(occupied.has(cell), false, id + " overlaps " + cell);
          occupied.add(cell);
        }
    const net = plots
      .slice(1)
      .map((plot) => plot.el.gx)
      .sort((a, b) => a - b);
    assert.deepEqual(
      net,
      Array.from({ length: site.spanX + 2 }, (_, i) => site.gx + i - 1),
    );
  }
  assert.equal(getNeighborPreview("farm_houses", 3).filter((p) => p.el.defId === "fields").length, 5);
  assert.equal(getGuideVariant("train_tracks", "train_tracks", 1, 2), 1);
});

test("compressed legacy sites resample painted ground and center the driveway on the saved frontage", () => {
  const c = makeCtx("house", 3, 0, 2, 2);
  c.v.box(-16, 0, -16, 16, 1, 16, "grass");
  applyParcelAppearance(
    c,
    { soils: ["sand"], edges: [{ side: "front", slot: 0, kind: "drive", neighbor: "roads" }] },
    1,
    1,
  );
  assert.equal(c.v.v.has(packVoxKey(11, 0, -11)), false, "eastern half still has a lawn");
  assert.equal(c.v.v.has(packVoxKey(10, 0, 10)), false, "southern half still has a lawn");
  for (let x = -6; x < 4; x++) assert.ok(c.v.v.has(packVoxKey(x, 0, 15)), "hole in driveway at " + x);
  assert.equal(c.v.v.has(packVoxKey(-10, 0, 15)), false, "driveway was shifted to a corner");
});

test("ferry and taxi stages and styles change their geometry independently of paint", () => {
  for (const id of ["ferry_landings", "taxi_ranks"]) {
    const design = DESIGNS[id],
      signatures = new Set<string>();
    for (let level = 1; level <= 5; level++)
      for (let variant = 0; variant < 4; variant++) {
        const [w, h] = design.footprints[level - 1],
          ctx = makeCtx(id, level, variant, w, h);
        design.build(ctx);
        const signature = Array.from(ctx.v.v.keys())
          .sort((a, b) => a - b)
          .join(",");
        assert.equal(
          signatures.has(signature),
          false,
          id + " repeated a silhouette at level " + level + ", style " + variant,
        );
        signatures.add(signature);
      }
  }
});
