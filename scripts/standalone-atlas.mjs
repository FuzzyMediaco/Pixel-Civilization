import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
/** Export a portable, searchable copy of the atlas with its font and all sheets embedded. */
export function writeStandaloneAtlas(root, outputs, catalog) {
  const font = readFileSync(
    path.join(root, "src/styles/dm-sans-latin.woff2"),
  ).toString("base64");
  const entries = catalog.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.categoryName,
    growth: item.growth,
    levels: item.levels,
    styles: item.styles,
    corridorWidth: item.id === "freeways" ? 3 : item.id === "highways" ? 2 : 1,
    image:
      "data:image/webp;base64," +
      readFileSync(path.join(root, "public", item.image.slice(1))).toString(
        "base64",
      ),
  }));
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixel Civilization · Design atlas</title><style>
@font-face{font-family:'DM Sans';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}*{box-sizing:border-box}body{margin:0;color:#243b35;background:#f7f5ea;font:16px/1.5 'DM Sans',sans-serif}header{background:#203f35;color:#fffdf2;padding:.85rem max(3vw,1rem);font-weight:700}main{width:min(1130px,100%);margin:auto;padding:1.5rem 1rem}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.12}h1{font-size:clamp(2.3rem,6vw,4rem);margin:0}h2{margin:1.5rem 0 .4rem;font-size:2rem}p{margin:.4rem 0 1rem}.controls{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:.65rem}label{display:grid;font-weight:650}input,select{font:inherit;color:inherit;background:#fffcf2;border:1px solid #afbbae;border-radius:5px;padding:.55rem;min-width:0}.sheet{overflow:auto}img{display:block;width:100%;height:auto;min-width:640px}img.wide{min-width:1270px}a{color:#2e5e49}@media(max-width:650px){.controls{grid-template-columns:1fr 1fr}.controls label:last-child{grid-column:span 2}}:focus-visible{outline:3px solid #ab632c}
</style></head><body><header>Pixel Civilization</header><main><h1>Design atlas</h1><p>${catalog.length} designs · Four visual styles · Up to eleven levels</p>
<div class="controls"><label>Search<input id="query" type="search" placeholder="Element name"></label><label>Category<select id="category"><option value="">All categories</option></select></label><label>Element<select id="items"></select></label></div>
<p id="empty" hidden>No matching designs.</p><section id="entry"><h2 id="name"></h2><p id="note"></p><div class="sheet"><img id="art" alt=""></div><p id="sizes"></p><a id="lesson">Open the illustrated handbook entry ↗</a></section></main>
<script id="data" type="application/json">${JSON.stringify(entries).replaceAll("<", "\\u003c")}</script><script>
const list=JSON.parse(document.getElementById("data").textContent), $=id=>document.getElementById(id), items=$("items"), category=$("category"), query=$("query");let current="skyscrapers";
for(const name of [...new Set(list.map(e=>e.category))].sort()) category.add(new Option(name,name));
function show(){current=items.value;const item=list.find(e=>e.id===current);$("entry").hidden=!item;$("empty").hidden=!!item;if(!item)return;
$("name").textContent=item.name;$("note").textContent=item.growth;$("art").src=item.image;$("art").className=item.levels.length>5?"wide":"";$("art").alt=item.name+" across levels, left to right, with a row for each visual style.";
$("sizes").textContent=item.corridorWidth>1 ? "Right of way · "+item.corridorWidth+" tiles wide per segment" : "Footprint by level · "+item.levels.map(l=>l.dimensions.join(" × ")).join(" → ");$("lesson").href="./Connected%20Island/handbook.html#design="+encodeURIComponent(item.id);}
function filter(){const rows=list.filter(e=>(!category.value||e.category===category.value)&&e.name.toLowerCase().includes(query.value.trim().toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));items.replaceChildren(...rows.map(e=>new Option(e.name,e.id)));if(rows.some(e=>e.id===current)) items.value=current;show();}
items.onchange=show;query.oninput=category.onchange=filter;filter();</script></body></html>`;
  writeFileSync(path.join(outputs, "Design atlas.html"), page);
}
