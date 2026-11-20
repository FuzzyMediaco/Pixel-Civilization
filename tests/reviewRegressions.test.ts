import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { Mesh, Scene, BoxGeometry } from "three";
import catalog from "../src/handbook/catalog.json";
import { relatedLessons } from "../src/handbook/relatedLessons";
import chapters from "../src/handbook/chapters.json";
import { createCanalDistrict } from "../src/game/canalDistrict";
import { MobilityVisuals } from "../src/game/mobilityVisuals";
import { createInitialGameState } from "../src/game/simulation";
import { loadSaveSlots, renameCivilizationSlot, saveCivilizationToSlot } from "../src/game/saveSlots";

test("restoring a city that reuses a service ID draws the new kind of vehicle", () => {
  const city = createCanalDistrict();
  const line = city.mobility!.lines[0];
  line.enabled = true;
  line.position = [0, 0];
  line.mode = "bus";
  const roadGeometry = new BoxGeometry();
  const display = new MobilityVisuals(new Scene(), () => roadGeometry);
  const service = () => display.root.children.find((object) => object.userData.serviceId === line.id) as Mesh;
  try {
    display.update(city, 1);
    assert.equal(service().geometry, roadGeometry);
    const bus = service();
    line.mode = "ferry";
    display.update(city, 1);
    assert.equal(service().userData.kind, "ferry");
    assert.notEqual(service().geometry, roadGeometry);
    assert.equal(bus.parent, null);
    assert.equal(display.root.children.filter((object) => object.userData.serviceId === line.id).length, 1);
  } finally {
    display.dispose();
    roadGeometry.dispose();
  }
});

test("a full save store reports the failure and preserves the last saved city", () => {
  const values = new Map<string, string>();
  let full = false;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (full) throw new Error("Storage full");
        values.set(key, value);
      },
    },
  });
  try {
    const city = createInitialGameState("real");
    saveCivilizationToSlot(0, "Home island", city);
    full = true;
    assert.throws(() => saveCivilizationToSlot(0, "Replacement", city), /Storage full/);
    assert.throws(() => renameCivilizationSlot(0, "New name"), /Storage full/);
    assert.equal(loadSaveSlots()[0]?.name, "Home island");
    assert.equal(loadSaveSlots()[0]?.mode, "real");
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("every handbook chapter and lesson opens a real illustrated example", () => {
  const pages = new Set<string>();
  const photos = new Set<string>();
  for (const ch of chapters) {
    assert.ok(!pages.has(ch.id), ch.id);
    pages.add(ch.id);
    photos.add(ch.cover);
    const lessons = new Set<string>();
    for (const l of ch.lessons) {
      assert.ok(!lessons.has(l.id), l.id);
      lessons.add(l.id);
      assert.ok(l.steps.length > 0 && l.examples.length > 0, l.id);
      for (const picture of l.examples) {
        assert.ok(picture.caption && picture.alt, l.id);
        photos.add(picture.image);
      }
    }
  }
  for (const photo of photos) {
    const name = photo.replace(/^\//, "");
    assert.match(name, /^handbook\/[\w/-]+\.(jpg|webp)$/);
    const contents = readFileSync(new URL("../public/" + name, import.meta.url));
    assert.ok(contents.length > 512, name);
    if (name.endsWith(".webp")) assert.equal(contents.toString("ascii", 8, 12), "WEBP");
    else assert.equal(contents.readUInt16BE(0), 0xffd8);
  }
});

test("every design leads to a playable lesson and the spaceport links directly to its launch instructions", () => {
  for (const entry of catalog) {
    assert.ok(relatedLessons(entry.id, entry.category).length > 0, entry.id);
  }
  assert.equal(relatedLessons("spaceport", "wealth_projects")[0].id, "city-rocket");
  assert.ok(relatedLessons("farm_houses", "agriculture").some((lesson) => lesson.id === "neighbor-farmstead"));
});
