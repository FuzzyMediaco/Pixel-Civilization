// Pin an App Store or Play release to the exact game already verified on the public site.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {access, mkdir, mkdtemp, rename, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {setTimeout as delay} from "node:timers/promises";

const [edition, destination] = process.argv.slice(2);
if (!/^[a-f0-9]{64}$/.test(edition || "") || !destination) {
    throw Error("Pass the 64-character web edition and a new output directory.");
}
const target = path.resolve(destination);
if (await access(target).then(() => true, () => false)) throw Error("Use a new output directory.");
const origin = "https://pixelcivilization.app/";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

async function download(route, queryName) {
    const url = new URL(route, origin);
    url.searchParams.set(queryName, edition);
    for (let attempt = 0; ; attempt++) {
        try {
            const response = await fetch(url, {
                redirect: "error", signal: AbortSignal.timeout(30000),
                headers: {"user-agent":"PixelCivilizationOffline/1 StoreBuild", "accept-encoding":"identity"}
            });
            if (!response.ok) throw Error(`${url.pathname} returned ${response.status}`);
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            if (attempt >= 2) throw error;
            await delay(500 * (attempt + 1));
        }
    }
}

const manifestBytes = await download("offline-index.json", "release");
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.release, edition, "The public site serves a different edition");
assert.ok(manifest.format === 1 && Array.isArray(manifest.files) && manifest.files.length > 0);
assert.equal(digest(JSON.stringify(manifest.files)), edition, "Manifest fingerprint");
const paths = new Set();
for (const file of manifest.files) {
    assert.ok(typeof file.path === "string" && !/[\\%?#:\u0000-\u001f]/.test(file.path));
    assert.ok(file.path.split("/").every(segment => segment && segment !== "." && segment !== ".."));
    assert.ok(Number.isSafeInteger(file.size) && file.size >= 0 && /^[0-9a-f]{64}$/.test(file.sha256));
    assert.ok(!paths.has(file.path), "Duplicate manifest entry");
    paths.add(file.path);
}

await mkdir(path.dirname(target), {recursive:true});
const stage = await mkdtemp(target + ".staging-");
try {
    let next = 0;
    let failed;
    async function worker() {
        while (!failed && next < manifest.files.length) {
            const file = manifest.files[next++];
            try {
                const route = file.path === "index.html" ? "" : file.path.replace(/\.html$/, "");
                const bytes = await download(route.split("/").map(encodeURIComponent).join("/"), "edition");
                assert.equal(bytes.length, file.size, file.path);
                assert.equal(digest(bytes), file.sha256, file.path);
                const output = path.join(stage, ...file.path.split("/"));
                await mkdir(path.dirname(output), {recursive:true});
                await writeFile(output, bytes);
            } catch (error) { failed = error; }
        }
    }
    await Promise.all(Array.from({length:12}, worker));
    if (failed) throw failed;
    await writeFile(path.join(stage, "offline-index.json"), manifestBytes);
    await rename(stage, target);
    console.log(`Verified all ${manifest.files.length} published game files for ${edition}.`);
} finally {
    await rm(stage, {recursive:true, force:true});
}
