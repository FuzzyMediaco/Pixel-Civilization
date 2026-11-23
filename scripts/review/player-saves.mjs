// Exercise the actual game UI and browser database against two isolated players and a simulated cloud service.
// Set PLAYER_TEST_ACCOUNT_SERVICE=real to use the local game server and a private test SQLite database.
// Start Vite first for the simulated service. Set PLAYER_TEST_URL and CHROME_PATH as needed. This script never uses a public account.
import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";

const base = process.env.PLAYER_TEST_URL ?? "http://127.0.0.1:5366";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname))
  throw Error("Use a local Vite development server for this test.");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--enable-unsafe-swiftshader", "--num-raster-threads=2"],
});
const real = process.env.PLAYER_TEST_ACCOUNT_SERVICE === "real";
const emailFor = (name) => name + "-" + runId + "@example.test";
const runId = Date.now().toString(36);
const alice = emailFor("alice"),
  bobEmail = emailFor("bob");
const cloud = new Map();
const ids = new Map([
  [alice, "alice"],
  [bobEmail, "bob"],
]);
async function device() {
  const c = await browser.newContext({
    viewport: { width: 1100, height: 720 },
  });
  let id,
    offline = false;
  const errors = [];
  await c.route("**/api/account/**", async (route) => {
    if (real) return offline ? route.abort() : route.continue();
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/account", "");
    const reply = (data, status = 200) => route.fulfill({ status, json: data });
    if (offline) return route.abort();
    if (path === "/login" || path === "/register") {
      const { email } = req.postDataJSON();
      id = ids.get(email);
      if (!id) return reply({ error: "Unknown test user" }, 401);
      if (!cloud.has(id)) cloud.set(id, new Map());
      return reply({ user: { id, email } });
    }
    if (path === "/logout") {
      id = undefined;
      return reply({ user: null });
    }
    if (!id || req.headers()["x-game-account"] !== id)
      return reply({ code: "account_changed", error: "Different player" }, 409);
    const saves = cloud.get(id);
    if (path === "/saves")
      return reply({
        saves: [...saves.values()].map(({ key, version }) => ({
          key,
          version,
        })),
      });
    const key = decodeURIComponent(path.slice(7)),
      prev = saves.get(key);
    if (req.method() === "GET") return reply(prev ?? {}, prev ? 200 : 404);
    const { baseVersion, data } = req.postDataJSON();
    if ((prev?.version ?? 0) !== baseVersion)
      return reply(
        { code: "conflict", error: "Versions differ", version: prev.version },
        409,
      );
    const row = { key, version: baseVersion + 1, data };
    saves.set(key, row);
    return reply({ key, version: row.version });
  });
  await c.addInitScript(() => {
    window.testModule = async (pathname) => {
      const uri = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((n) => new URL(n).pathname === pathname);
      return import(uri || pathname);
    };
  });
  const p = await c.newPage();
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  async function ready(world = false) {
    await p.waitForFunction(
      (world) =>
        window.__pixelWorld?.gameState &&
        (!world ||
          window.__pixelWorld.gameState.exampleWorldId === "meridian-fair"),
      world,
    );
  }
  async function account() {
    await p
      .getByRole("navigation")
      .getByRole("button", { name: /^More/i })
      .first()
      .click();
    await p.getByRole("button", { name: "Account", exact: true }).click();
  }
  async function auth(email, create = false) {
    const mobile = create && email === bobEmail;
    if (mobile) await p.setViewportSize({ width: 390, height: 844 });
    await account();
    if (create)
      await p
        .getByRole("button", { name: "Create account", exact: true })
        .click();
    if (mobile) {
      assert.equal(
        await p
          .locator(".player-account")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        "rgb(255, 252, 243)",
      );
      if (process.env.PLAYER_TEST_MOBILE_IMAGE)
        await p.screenshot({ path: process.env.PLAYER_TEST_MOBILE_IMAGE });
    }
    await p.getByLabel("Email", { exact: true }).fill(email);
    await p.getByLabel("Password", { exact: true }).fill("Testing-123456");
    await Promise.all([
      p.waitForNavigation(),
      p
        .getByRole("button", {
          name: create ? "Create account & sync" : "Sign in & sync",
          exact: true,
        })
        .click(),
    ]);
    await ready();
  }
  return {
    p,
    c,
    errors,
    ready,
    account,
    auth,
    offline: (value) => {
      offline = value;
    },
  };
}
try {
  const a = await device(),
    key = "pixel_civ_save_v1_example-real-meridian-fair";
  await a.c.addInitScript(() => {
    if (sessionStorage.getItem("legacy-fixture")) return;
    sessionStorage.setItem("legacy-fixture", "1");
    localStorage.setItem(
      "pixel_civ_saved_slots_v1",
      JSON.stringify([
        {
          name: "Pre-update town",
          slotIndex: 0,
          mode: "real",
          state: { elements: [] },
        },
        null,
        null,
      ]),
    );
    localStorage.setItem("pixel_civ_place_hints", "2");
  });
  await a.p.goto(base + "/#world=meridian-fair&mode=real");
  await a.ready(true);
  const size = await a.p.evaluate(async () => {
    const { persistMode } = await window.testModule(
        "/src/game/activeIsland.ts",
      ),
      { saveCivilizationToSlot, loadSaveSlots } = await window.testModule(
        "/src/game/saveSlots.ts",
      );
    const { flushDevice, readPlayerItem, writePlayerItem } =
      await window.testModule("/src/game/deviceSaves.ts");
    const s = window.__pixelWorld.gameState;
    if (
      loadSaveSlots()[0]?.name !== "Pre-update town" ||
      localStorage.getItem("pixel_civ_saved_slots_v1") !== null
    )
      throw Error("Named-slot migration failed");
    if (readPlayerItem("pixel_civ_place_hints") !== "2")
      throw Error("Preference migration failed");
    s.playSpeed = 0;
    s.taxRate = 13;
    persistMode(s);
    saveCivilizationToSlot(1, "Fair backup", s);
    writePlayerItem("pixel_civ_lab_snapshot", JSON.stringify(s));
    await flushDevice();
    return readPlayerItem("pixel_civ_save_v1_example-real-meridian-fair")
      .length;
  });
  assert.ok(
    size > 5 * 1024 * 1024,
    "Expected a multi-megabyte Meridian Fair save; got " + size,
  );
  await a.p.reload();
  await a.ready(true);
  assert.equal(
    await a.p.evaluate(() => window.__pixelWorld.gameState.taxRate),
    13,
  );
  await a.auth(alice, true);
  assert.equal(
    await a.p.evaluate(
      async () =>
        (await window.testModule("/src/game/deviceSaves.ts")).currentPlayer()
          .email,
    ),
    alice,
  );
  assert.ok(
    await a.p.evaluate(
      async (key) =>
        (
          await (
            await fetch("/api/account/saves", {
              headers: {
                "X-Game-Account": (
                  await window.testModule("/src/game/deviceSaves.ts")
                ).currentPlayer().id,
              },
            })
          ).json()
        ).saves.some((s) => s.key === key),
      key,
    ),
  );
  const second = await device();
  await second.p.goto(base);
  await second.ready();
  await second.auth(alice);
  assert.equal(
    await second.p.evaluate(
      async () =>
        (await window.testModule("/src/game/saveSlots.ts")).loadSaveSlots()[1]
          .name,
    ),
    "Fair backup",
  );
  assert.equal(
    await second.p.evaluate(() => window.__pixelWorld.gameState.taxRate),
    13,
  );
  // Write a deterministic preference while disconnected; change the same record on the other device.
  const edit = async (d, value) =>
    d.p.evaluate(async (val) => {
      const store = await window.testModule("/src/game/deviceSaves.ts");
      store.writePlayerItem("pixel_civ_place_hints", val);
      await store.flushDevice();
      await (await window.testModule("/src/game/accountSync.ts")).autosync();
    }, value);
  a.offline(true);
  await edit(a, "1");
  await edit(second, "0");
  a.offline(false);
  const conflicts = await a.p.evaluate(async () => {
    const s = await window.testModule("/src/game/accountSync.ts");
    await s.autosync();
    return s.syncState().conflicts;
  });
  if (!conflicts.includes("pixel_civ_place_hints")) {
    const details = await Promise.all(
      [a, second].map(({ p }) =>
        p.evaluate(async () => {
          const store = await window.testModule("/src/game/deviceSaves.ts"),
            sync = await window.testModule("/src/game/accountSync.ts");
          return {
            scope: store.scope(),
            issue: store.deviceIssue(),
            state: sync.syncState(),
            data: (await store.readRecords(store.scope())).find(
              (r) => r.key === "pixel_civ_place_hints",
            ),
          };
        }),
      ),
    );
    console.log(
      JSON.stringify({
        details,
        cloud: cloud.get("alice")?.get("pixel_civ_place_hints"),
      }),
    );
  }
  assert.ok(
    conflicts.includes("pixel_civ_place_hints"),
    JSON.stringify(conflicts),
  );
  await a.account();
  const conflict = a.p
    .locator(".player-conflict")
    .filter({ hasText: "place hints" });
  await Promise.all([
    a.p.waitForNavigation(),
    conflict.getByRole("button", { name: "Use account save" }).click(),
  ]);
  await a.ready();
  assert.ok(
    await a.p.evaluate(async () => {
      const s = await window.testModule("/src/game/deviceSaves.ts");
      return (
        s.readPlayerItem("pixel_civ_place_hints") === "0" &&
        (await s.listRecovery()).some(
          (r) => r.key === "pixel_civ_place_hints" && r.data === "1",
        )
      );
    }),
  );
  const guide = await a.c.newPage();
  await guide.goto(base + "/handbook.html");
  const guideEmail = () =>
    guide.evaluate(async () => {
      const store = await window.testModule("/src/game/deviceSaves.ts");
      await store.openDeviceSaves();
      return store.currentPlayer()?.email ?? null;
    });
  assert.equal(await guideEmail(), alice);
  await a.account();
  await Promise.all([
    a.p.waitForNavigation(),
    guide.waitForNavigation(),
    a.p.getByRole("button", { name: "Sign out", exact: true }).click(),
  ]);
  await a.ready();
  assert.equal(await guideEmail(), null);
  assert.equal(
    await a.p.evaluate(async () =>
      (await window.testModule("/src/game/deviceSaves.ts")).currentPlayer(),
    ),
    null,
  );
  await second.c.close();
  await a.c.close();
  const bob = await device();
  await bob.p.goto(base);
  await bob.ready();
  await bob.auth(bobEmail, true);
  assert.ok(
    !(await bob.p.evaluate(
      async (key) =>
        (
          await (
            await fetch("/api/account/saves", {
              headers: {
                "X-Game-Account": (
                  await window.testModule("/src/game/deviceSaves.ts")
                ).currentPlayer().id,
              },
            })
          ).json()
        ).saves.some((s) => s.key === key),
      key,
    )),
  );
  assert.ok(
    !(await bob.p.evaluate(async () =>
      (await window.testModule("/src/game/saveSlots.ts"))
        .loadSaveSlots()
        .some((s) => s?.name === "Fair backup"),
    )),
  );
  assert.deepEqual([...a.errors, ...second.errors, ...bob.errors], []);
  console.log(
    JSON.stringify({
      actualServer: real,
      meridianCharacters: size,
      quotaRegression: true,
      guestMigration: true,
      namedSlots: true,
      secondDeviceRestore: true,
      offlineConflictRecovery: true,
      accountIsolation: true,
      crossTabLogout: true,
      phoneAccountPanel: true,
    }),
  );
} finally {
  await browser.close();
}
