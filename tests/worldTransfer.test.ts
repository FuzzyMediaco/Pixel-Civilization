import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState } from "../src/game/simulation";
import { importWorldIntoSlot, readWorldFile, serializeWorld } from "../src/game/worldTransfer";

test("world exports round-trip and legacy imports preserve other saves", async () => {
  const state = createInitialGameState("god");
  const snapshot = JSON.parse(serializeWorld("My Island", state));
  const [world] = readWorldFile(JSON.stringify(snapshot));
  assert.equal(world.name, "My Island");
  assert.deepEqual(world.state, snapshot.state);
  const backup = { format: "pixel_civ_backup_v1", activeState: state, slots: [null, { name: "Saved island", state }], storage: {} };
  assert.deepEqual(readWorldFile(JSON.stringify(backup)).map(w => w.name), ["Imported Civilization", "Saved island"]);

  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } });
  try {
    await importWorldIntoSlot(0, world);
    const first = storage.get("pixel_civ_slot_0");
    await assert.rejects(importWorldIntoSlot(0, world), /empty slot/);
    await importWorldIntoSlot(1, { ...world, name: "Second world" });
    assert.equal(storage.get("pixel_civ_slot_0"), first);
    assert.equal(JSON.parse(storage.get("pixel_civ_slot_1")!).name, "Second world");
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("world imports reject unrelated and malformed backups", () => {
  assert.throws(() => readWorldFile('{"format":"unknown"}'), /format/);
  assert.throws(() => readWorldFile('{"format":"pixel_civ_world_v1","state":{"__proto__":{}}}'), /valid/);
  assert.throws(() => readWorldFile('{"format":"pixel_civ_world_v1","state":{"mode":"god","elements":[]}}'), /invalid/);
});
