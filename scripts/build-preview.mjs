import { writeStandaloneAtlas } from "./standalone-atlas.mjs";
import { buildSync } from "esbuild";
import { zipSync, unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const base = path.join(root, "dist");
const outputs = path.resolve(process.argv[2] ?? path.join(root, "portable")),
  out = path.join(outputs, "Connected Island");
const pages = {
  "index.html": "root",
  "field-guide.html": "guide",
  "handbook.html": "handbook",
};
const generated = new Map();
const assetPath = (url) => path.resolve(base, url.replace(/^\/+|^\.\//, ""));
const icon = readFileSync(path.join(base, "favicon.ico")).toString("base64");
const mime = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
function inlineCss(file) {
  const css = readFileSync(file, "utf8");
  assert.ok(
    !/@import\s/i.test(css),
    "Build left an unresolved @import in " + file,
  );
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (whole, _quote, ref) => {
    if (ref.startsWith("data:") || ref.startsWith("#")) return whole;
    assert.ok(
      !/^(?:https?:)?\/\//i.test(ref),
      "Remote stylesheet asset " + ref,
    );
    const relative = decodeURIComponent(ref.split(/[?#]/)[0]);
    const target = relative.startsWith("/")
      ? assetPath(relative)
      : path.resolve(path.dirname(file), relative);
    assert.ok(
      mime[path.extname(target)],
      "Unknown stylesheet asset " + relative,
    );
    return (
      'url("data:' +
      mime[path.extname(target)] +
      ";base64," +
      readFileSync(target).toString("base64") +
      '")'
    );
  });
}
for (const [page, root] of Object.entries(pages)) {
  const html = readFileSync(path.join(base, page), "utf8");
  const scripts = [
    ...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g),
  ].map((m) => m[1]);
  assert.equal(scripts.length, 1, page + " must have one JavaScript entry");
  const sheets = [
    ...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g),
  ].map((m) => m[1]);
  assert.ok(sheets.length, page + " styles are missing");
  const css = sheets.map((src) => inlineCss(assetPath(src))).join("\n");
  const js = buildSync({
    entryPoints: [assetPath(scripts[0])],
    bundle: true,
    write: false,
    format: "iife",
    minify: true,
    target: "es2022",
    logLevel: "silent",
  }).outputFiles[0].text;
  const title = html.match(/<title>([\s\S]+?)<\/title>/i)[1];
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  generated.set(
    page,
    Buffer.from(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>' +
        title +
        '</title><link rel="icon" href="data:image/x-icon;base64,' +
        icon +
        '"><style>' +
        css +
        '</style></head><body><div id="' +
        root +
        '"></div><script>' +
        safeJs +
        "</script></body></html>",
    ),
  );
}
function gather(directory, prefix) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name),
      relative = prefix + "/" + item.name;
    if (item.isDirectory()) gather(file, relative);
    else if (item.isFile()) generated.set(relative, readFileSync(file));
  }
}
gather(path.join(base, "handbook"), "handbook");
generated.set(
  "licenses/DM-Sans.txt",
  readFileSync(path.resolve(root, "src/styles/DM-Sans-LICENSE.txt")),
);
const src = path.resolve(root, "src/handbook");
const catalog = JSON.parse(readFileSync(path.join(src, "catalog.json"))),
  chapters = JSON.parse(readFileSync(path.join(src, "chapters.json")));
const playable = chapters.find((c) => c.id === "worlds")?.lessons ?? [];
assert.equal(playable.length, 3, "Three playable handbook worlds are required");
const escapeHtml = (s) =>
  s.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
for (const world of playable) {
  const jump = "./index.html#world=" + encodeURIComponent(world.world),
    title = escapeHtml(world.title);
  const guide =
    "./handbook.html#section=worlds&amp;lesson=" + encodeURIComponent(world.id);
  const launcher =
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    title +
    ' · Pixel Civilization</title><meta http-equiv="refresh" content="0;url=' +
    jump +
    '"><main><h1>' +
    title +
    '</h1><a href="' +
    jump +
    '">Play ' +
    title +
    '</a><p><a href="' +
    guide +
    '">Read the island tour</a></p></main></html>';
  generated.set(world.title + ".html", Buffer.from(launcher));
}
const refs = new Set(["handbook/travel/canal-district.jpg"]);
for (const row of catalog) {
  refs.add(row.image);
  refs.add(row.thumbnail);
}
for (const chapter of chapters) {
  refs.add(chapter.cover);
  for (const lesson of chapter.lessons)
    for (const ex of lesson.examples) refs.add(ex.image);
}
for (const ref of refs)
  assert.ok(
    generated.has(ref.replace(/^\//, "")),
    "Missing handbook picture " + ref,
  );
for (const world of playable)
  assert.ok(
    generated.has("handbook/worlds/" + world.world + ".webp"),
    "Missing world cover " + world.world,
  );
for (const [file, bytes] of generated)
  if (Object.hasOwn(pages, file)) {
    const contents = bytes.toString("utf8");
    assert.match(
      contents,
      /@font-face\s*\{[^}]*font-family:\s*["']?DM Sans/i,
      "DM Sans missing from " + file,
    );
    assert.match(
      contents,
      /data:[^;]*woff2;base64,/i,
      "Offline font file missing from " + file,
    );
  }
for (const [name, data] of generated) {
  const file = path.join(out, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
}
const zipped = {};
for (const [name, bytes] of generated)
  zipped["Connected Island/" + name] = [
    bytes,
    { level: /\.(webp|jpe?g|png)$/i.test(name) ? 0 : 7 },
  ];
const folderName = "Connected Island.zip";
const archive = zipSync(zipped),
  decoded = unzipSync(archive);
assert.equal(Object.keys(decoded).length, generated.size);
for (const [name, data] of generated)
  assert.ok(
    Buffer.from(decoded["Connected Island/" + name]).equals(data),
    name,
  );
const temp = path.join(outputs, folderName + ".partial");
writeFileSync(temp, archive);
renameSync(temp, path.join(outputs, folderName));
writeStandaloneAtlas(root, outputs, catalog);
console.log(
  JSON.stringify({
    pages: Object.keys(pages),
    designs: catalog.length,
    chapters: chapters.length,
    handbookImages: refs.size,
    files: generated.size,
    zipBytes: archive.length,
  }),
);
