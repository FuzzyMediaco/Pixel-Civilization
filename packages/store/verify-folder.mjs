import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {storePage} from "./bundle-content.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function verifyStoreFolder(folder) {
    const source = path.resolve(process.env.PIXEL_WEB_DIST || path.join(here, "../../dist"));
    const manifest = JSON.parse(await readFile(path.join(source, "offline-index.json"), "utf8"));
    const edition = JSON.parse(await readFile(path.join(folder, "store-edition.json"), "utf8"));
    assert.deepEqual(edition, {release:manifest.release, files:manifest.files.length});
    assert.deepEqual(await readFile(path.join(folder, "store-bridge.js")), await readFile(path.join(here, "bridge.js")));
    for (const file of manifest.files) {
        const bytes = await readFile(path.join(folder, file.path));
        if (file.path.endsWith(".html")) {
            const original = await readFile(path.join(source, file.path), "utf8");
            assert.equal(bytes.toString("utf8"), storePage(original), file.path);
        } else {
            assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
        }
    }
    return edition;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const folder = process.argv[2];
    if (!folder) throw Error("Pass the archived application's web directory.");
    const edition = await verifyStoreFolder(path.resolve(folder));
    console.log(`Verified all ${edition.files} game files and the native bridge for ${edition.release}.`);
}
