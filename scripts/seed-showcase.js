// Page-context script for scripts/shoot-game.mjs: builds a God-Mode showcase city containing
// every land element (levels cycling 1..5) on a road grid, saves it, and reloads.
//   node scripts/shoot-game.mjs out.png scripts/seed-showcase.js
(async () => {
  await import("/src/game/designs/index.ts");
  const cat = await import("/src/game/catalog.ts");
  const sim = await import("/src/game/simulation.ts");
  const st = sim.createInitialGameState("god");
  const mk = (defId, gx, gz, level, spanX, spanZ, variant) => ({
    id: sim.makeElementId(),
    defId,
    gx,
    gz,
    spanX,
    spanZ,
    rotation: 0,
    level,
    variant,
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
    animKind: "place",
  });
  const land = cat.ELEMENTS.filter((d) => !d.isNetwork && d.domain !== "water");
  let gx = -24;
  let gz = -24;
  let rowDepth = 0;
  let i = 0;
  const roadRow = (z) => {
    for (let x = -26; x <= 25; x++) {
      if (sim.checkPlacementValid(st, cat.ELEMENT_BY_ID.roads, x, z, 1, 1).valid) st.elements.push(mk("roads", x, z, 1, 1, 1, 0));
    }
  };
  roadRow(gz - 1);
  for (const d of land) {
    const level = (i % 5) + 1;
    const [sx, sz] = cat.getStandardFootprintForLevel(d, level);
    if (gx + sx > 25) {
      gz += rowDepth + 1;
      roadRow(gz - 1);
      gx = -24;
      rowDepth = 0;
    }
    if (sim.checkPlacementValid(st, d, gx, gz, sx, sz).valid) {
      st.elements.push(mk(d.id, gx, gz, level, sx, sz, i % 4));
      gx += sx;
      rowDepth = Math.max(rowDepth, sz);
      i += 1;
    } else {
      gx += 1;
    }
  }
  sim.recomputeConnectivityAndMetrics(st);
  localStorage.setItem("pixel_civ_save_v1_god", JSON.stringify(st));
  location.reload();
})();
