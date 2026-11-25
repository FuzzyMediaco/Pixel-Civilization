import { AccountError } from "./account-http.mjs";
export class PixLimit extends Error {}
function l(r, t) {
  return Response.json(t, {
    status: r,
    headers: { "cache-control": "no-store" },
  });
}
async function N(r) {
  let t = r.body?.getReader();
  if (!t) return {};
  let o = new TextDecoder(),
    e = "",
    i = 0;
  try {
    for (;;) {
      let { done: c, value: s } = await t.read();
      if (c) break;
      if (((i += s.byteLength), i > 65536))
        throw (t.cancel().catch(() => {}), new Error("PAYLOAD_TOO_LARGE"));
      e += o.decode(s, { stream: !0 });
    }
  } finally {
    t.releaseLock();
  }
  if (((e = (e + o.decode()).trim()), !e)) return {};
  let n = JSON.parse(e);
  if (!n || typeof n != "object" || Array.isArray(n))
    throw new Error("INVALID_JSON");
  return n;
}
function m(r, t) {
  return typeof r != "string" ? "" : r.trim().slice(0, t);
}
var E = {
    type: "OBJECT",
    properties: {
      name: {
        type: "STRING",
        description: "Short, evocative building/element title (2-4 words).",
      },
      description: {
        type: "STRING",
        description:
          "One crisp sentence explaining what this element does on the island.",
      },
      architectNote: {
        type: "STRING",
        description:
          "Brief 1-sentence explanation of visual details or revisions made.",
      },
      category: {
        type: "STRING",
        enum: [
          "housing",
          "agriculture",
          "commerce",
          "power_waste",
          "water_util",
          "civic_parks",
          "police_military",
          "faith",
          "maritime",
          "landmarks",
        ],
      },
      domain: { type: "STRING", enum: ["land", "water"] },
      footprintCells: {
        type: "INTEGER",
        description: "Footprint width/depth in island grid cells: 1, 2, or 3.",
      },
      cost: {
        type: "INTEGER",
        description: "Construction cost in treasury dollars (80 to 15000).",
      },
      popBase: {
        type: "INTEGER",
        description: "Base housing capacity at Lv 1 (0 to 300).",
      },
      jobs: { type: "INTEGER", description: "Jobs created (0 to 260)." },
      food: { type: "INTEGER", description: "Food supplied (0 to 120)." },
      power: {
        type: "INTEGER",
        description:
          "Net power: positive produces, negative consumes (-80 to 250).",
      },
      water: {
        type: "INTEGER",
        description:
          "Net water: positive produces, negative consumes (-80 to 200).",
      },
      waste: {
        type: "INTEGER",
        description: "Waste processing capacity (0 to 120).",
      },
      education: {
        type: "INTEGER",
        description: "School/education seats (0 to 180).",
      },
      recreation: {
        type: "INTEGER",
        description: "Park/culture/leisure capacity (0 to 180).",
      },
      government: {
        type: "INTEGER",
        description: "Civic/government coverage (0 to 150).",
      },
      police: { type: "INTEGER", description: "Police strength (0 to 60)." },
      policeRadius: {
        type: "INTEGER",
        description: "Police coverage radius in tiles (0 to 14).",
      },
      fireRadius: {
        type: "INTEGER",
        description: "Firefighting coverage radius in tiles (0 to 14).",
      },
      military: {
        type: "INTEGER",
        description: "Defense power rating (0 to 90).",
      },
      income: {
        type: "INTEGER",
        description: "Revenue/income per cycle (0 to 160).",
      },
      accentHex: {
        type: "STRING",
        description: "Hex accent color like #1d4ed8.",
      },
      lotGround: {
        type: "STRING",
        enum: ["grass", "asphalt", "path", "concrete", "sand", "deck"],
      },
      boxes: {
        type: "ARRAY",
        description:
          "Up to 28 voxel cuboids defining the 3D structure. Coordinates in voxel space: x,z in [-12,12], y in [0,28].",
        items: {
          type: "OBJECT",
          properties: {
            x0: { type: "INTEGER" },
            y0: { type: "INTEGER" },
            z0: { type: "INTEGER" },
            x1: { type: "INTEGER" },
            y1: { type: "INTEGER" },
            z1: { type: "INTEGER" },
            color: {
              type: "STRING",
              description:
                "Hex color like #d97706 or palette token (white, cream, brick, stone, slate, steel, steelDark, glass, glassCyan, warmGlow, gold, navy, crimson, teal, olive, wood, woodDark, copper, terracotta, neon, cyan, orange, leaf).",
            },
            emit: {
              type: "NUMBER",
              description:
                "Optional glow 0..1.5 (0 for matte surfaces, >0 for windows/signs/beacons).",
            },
          },
          required: ["x0", "y0", "z0", "x1", "y1", "z1", "color"],
        },
      },
      cylinders: {
        type: "ARRAY",
        description:
          "Optional towers, silos, domes, pillars, chimneys (up to 8).",
        items: {
          type: "OBJECT",
          properties: {
            cx: { type: "INTEGER" },
            cz: { type: "INTEGER" },
            y0: { type: "INTEGER" },
            y1: { type: "INTEGER" },
            radius: { type: "NUMBER" },
            color: { type: "STRING" },
            emit: { type: "NUMBER" },
          },
          required: ["cx", "cz", "y0", "y1", "radius", "color"],
        },
      },
      roof: {
        type: "OBJECT",
        description: "Optional pitched or flat roof cap on main mass.",
        properties: {
          style: {
            type: "STRING",
            enum: ["flat", "gable", "pyramid", "dome", "none"],
          },
          x0: { type: "INTEGER" },
          y: { type: "INTEGER" },
          z0: { type: "INTEGER" },
          x1: { type: "INTEGER" },
          z1: { type: "INTEGER" },
          color: { type: "STRING" },
          trimColor: { type: "STRING" },
        },
        required: ["style", "x0", "y", "z0", "x1", "z1", "color"],
      },
      blinkers: {
        type: "ARRAY",
        description: "Optional blinking rooftop beacons (up to 4).",
        items: {
          type: "OBJECT",
          properties: {
            x: { type: "INTEGER" },
            y: { type: "INTEGER" },
            z: { type: "INTEGER" },
            color: { type: "STRING" },
          },
          required: ["x", "y", "z", "color"],
        },
      },
      rotors: {
        type: "ARRAY",
        description:
          "Optional spinning water wheel, radar dish, helicopter blades, or turbine blades (up to 2).",
        items: {
          type: "OBJECT",
          properties: {
            px: { type: "INTEGER" },
            py: { type: "INTEGER" },
            pz: { type: "INTEGER" },
            axis: { type: "STRING", enum: ["x", "y", "z"] },
            speed: { type: "NUMBER" },
            radius: { type: "INTEGER" },
            color: { type: "STRING" },
          },
          required: ["px", "py", "pz", "axis", "speed", "radius", "color"],
        },
      },
      critters: {
        type: "ARRAY",
        description:
          "Optional animated moving animals roaming a pen on the lot (up to 2 pens).",
        items: {
          type: "OBJECT",
          properties: {
            kind: {
              type: "STRING",
              enum: [
                "cow",
                "sheep",
                "pig",
                "chicken",
                "horse",
                "goat",
                "duck",
                "bee",
              ],
            },
            count: { type: "INTEGER", description: "1 to 6 animals." },
            x0: { type: "INTEGER" },
            z0: { type: "INTEGER" },
            x1: { type: "INTEGER" },
            z1: { type: "INTEGER" },
          },
          required: ["kind", "count", "x0", "z0", "x1", "z1"],
        },
      },
      smoke: {
        type: "ARRAY",
        description: "Optional rising chimney smoke or steam vents (up to 2).",
        items: {
          type: "OBJECT",
          properties: {
            x: { type: "INTEGER" },
            y: { type: "INTEGER" },
            z: { type: "INTEGER" },
            kind: { type: "STRING", enum: ["smoke", "steam", "dark", "spark"] },
          },
          required: ["x", "y", "z"],
        },
      },
    },
    required: [
      "name",
      "description",
      "architectNote",
      "category",
      "domain",
      "footprintCells",
      "cost",
      "accentHex",
      "lotGround",
      "boxes",
    ],
  },
  w = {
    type: "OBJECT",
    properties: {
      summary: {
        type: "STRING",
        description:
          "Clear 1-2 sentence summary of what Pix will build or sculpt.",
      },
      terrainOps: {
        type: "ARRAY",
        description:
          "Up to 14 terrain sculpting or elevated bridge ops using signed island grid coordinates centered at (0,0) (dry land sits within gx,gz in [-19, 19]). Use kind='bridge' with depthOrHeight 2..6 to span tall elevated bridges over carved canyons or canals.",
        items: {
          type: "OBJECT",
          properties: {
            kind: {
              type: "STRING",
              enum: [
                "canal",
                "canyon",
                "river",
                "pond",
                "mountain",
                "raise",
                "lower",
                "paint_sand",
                "bridge",
              ],
            },
            x0: { type: "INTEGER", description: "Start grid X (-19..19)." },
            z0: { type: "INTEGER", description: "Start grid Z (-19..19)." },
            x1: { type: "INTEGER", description: "End grid X (-19..19)." },
            z1: { type: "INTEGER", description: "End grid Z (-19..19)." },
            radius: {
              type: "INTEGER",
              description: "Brush radius in grid cells (1..4).",
            },
            depthOrHeight: {
              type: "NUMBER",
              description:
                "Depth/height magnitude (0.6..3.5 for terrain, 2..6 for tall elevated bridges).",
            },
          },
          required: ["kind", "x0", "z0", "x1", "z1", "radius"],
        },
      },
      roadLines: {
        type: "ARRAY",
        description:
          "Up to 24 connected road/avenue/bridge corridors (gx,gz in [-19..19]).",
        items: {
          type: "OBJECT",
          properties: {
            roadId: {
              type: "STRING",
              enum: [
                "roads",
                "two_lane_roads",
                "pretty_roads",
                "highways",
                "bridges",
                "stone_bridges",
                "suspension_bridges",
              ],
            },
            x0: { type: "INTEGER" },
            z0: { type: "INTEGER" },
            x1: { type: "INTEGER" },
            z1: { type: "INTEGER" },
          },
          required: ["roadId", "x0", "z0", "x1", "z1"],
        },
      },
      placements: {
        type: "ARRAY",
        description:
          "Up to 90 structures in God mode (up to 18 in Real, up to 6 in Survival) placed near roads or coasts using ONLY elementIds from the provided catalog list (gx,gz in [-19..19], coast/water around 18..24).",
        items: {
          type: "OBJECT",
          properties: {
            elementId: { type: "STRING" },
            gx: { type: "INTEGER", description: "Grid X (-22..22)." },
            gz: { type: "INTEGER", description: "Grid Z (-22..22)." },
            level: {
              type: "INTEGER",
              description: "1..5 (respect mode caps).",
            },
            rot: { type: "INTEGER", description: "0, 1, 2, or 3." },
          },
          required: ["elementId", "gx", "gz"],
        },
      },
    },
    required: ["summary", "terrainOps", "roadLines", "placements"],
  },
  x = {
    type: "OBJECT",
    properties: {
      headline: {
        type: "STRING",
        description: "Crisp 4-8 word executive headline.",
      },
      diagnosis: {
        type: "STRING",
        description:
          "2-3 clear sentences diagnosing the island's current health, bottlenecks, and opportunities.",
      },
      tips: {
        type: "ARRAY",
        description:
          "3-5 short actionable bullet tips tailored to the current game mode.",
        items: { type: "STRING" },
      },
      actions: {
        type: "ARRAY",
        description:
          "Up to 4 clickable quick-actions the player can trigger right inside Pixel Civilization.",
        items: {
          type: "OBJECT",
          properties: {
            label: {
              type: "STRING",
              description: "Short button label (2-5 words).",
            },
            kind: {
              type: "STRING",
              enum: ["select_element", "open_layer", "focus_site"],
            },
            elementId: {
              type: "STRING",
              description: "Catalog elementId when kind is select_element.",
            },
            layerId: {
              type: "STRING",
              description:
                "Exact HeatmapKind overlay id when kind is open_layer: power, water, traffic, fire, police, defense, landvalue, pollution, food, waste, education, parks, transit, neighbors, jobs.",
            },
            gx: {
              type: "INTEGER",
              description: "Grid X when kind is focus_site.",
            },
            gz: {
              type: "INTEGER",
              description: "Grid Z when kind is focus_site.",
            },
          },
          required: ["label", "kind"],
        },
      },
    },
    required: ["headline", "diagnosis", "tips", "actions"],
  };
async function h(r, t, o, e) {
  try {
    let i = await r.generate(t, o, e);
    if (!i || typeof i != "object" || Array.isArray(i))
      throw new Error("Pix returned an invalid structured response");
    return { ok: !0, data: i };
  } catch (i) {
    if (i instanceof AccountError) return {ok:false,status:i.status,error:i.message};
    return i instanceof PixLimit
      ? { ok: !1, status: 429, error: i.message }
      : (console.error(
          "[PixBuilder API error]",
          i instanceof Error ? i.name : "Unknown error",
        ),
        {
          ok: !1,
          status: 502,
          error:
            "Pix could not generate a response. Try again or rephrase your request.",
        });
  }
}
export async function handlePixRequest(r, t) {
  let o = new URL(r.url).pathname;
  if (o === "/api/pix/status" && r.method === "GET")
    return l(200, {
      ok: !0,
      connectedModel: t?.modelId ?? null,
      modelLabel: t?.modelLabel ?? null,
      configured: !!t,
    });
  if (r.method !== "POST")
    return l(405, { ok: !1, error: "Method not allowed. Use POST." });
  if (
    ![
      "/api/pix/element",
      "/api/pix/element-levels",
      "/api/pix/world",
      "/api/pix/advise",
    ].includes(o)
  )
    return l(404, { ok: !1, error: "Unknown Pix API endpoint." });
  let e;
  try {
    e = await N(r);
  } catch (i) {
    let n = i instanceof Error && i.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return l(n, {
      ok: !1,
      error:
        n === 413
          ? "Request body too large (max 64 KB)."
          : "Invalid JSON payload.",
    });
  }
  if (!t)
    return l(503, {
      ok: !1,
      error: "Pix AI is not configured on this server.",
    });
  if (o === "/api/pix/element") {
    let i = m(e.prompt, 1200),
      n = m(e.mode, 24) || "real",
      c =
        e.previousDesign && typeof e.previousDesign == "object"
          ? e.previousDesign
          : null;
    if (!i)
      return l(400, {
        ok: !1,
        error:
          "Please describe the civilization element you want Pix to design.",
      });
    let s = [
        "You are Pix, the lead 3D voxel architect for Pixel Civilization.",
        "DEFAULT LEVEL 5 FLAGSHIP: Always design the fully upgraded LEVEL 5 flagship edition of the requested element \u2014 grand silhouette, rich architectural trim, layered stories, glowing windows/signs, beacons, optional spinning rotors (water wheels, radar dishes, turbines, helicopter blades), optional animated moving critters, and optional rising smoke/steam chimneys.",
        "Coordinate grid: footprintCells=1 maps to voxel space x,z in [-7,7]; footprintCells=2 maps to [-11,11]; footprintCells=3 maps to [-12,12]. Base starts at y=1 (ground pad is y=0). Use crisp architectural silhouettes, entrances on +z face, contrasting trims, and warm glowing windows (emit: 0.6..1.1).",
        `Game mode is "${n}". Express the stats for this fully upgraded Level 5 flagship fairly for "${n}" mode (in survival keep outputs modest and costs realistic; in real/idle/manager keep balanced high-tier Lv 5 stats; in god mode you may create grand unrestricted landmarks).`,
        "If previousDesign is supplied, preserve its identity while applying the user's requested visual or stat refinements.",
      ].join(" "),
      y = c
        ? `Refinement request for this Level 5 flagship element: ${i}

Existing Level 5 design JSON to refine:
${JSON.stringify(c).slice(0, 8e3)}`
        : `Create a brand-new Level 5 flagship Pixel Civilization 3D voxel element for this request: ${i}`,
      p = await h(t, s, y, E);
    return p.ok
      ? l(200, { ok: !0, model: t.modelId, design: p.data })
      : l(p.status, { ok: !1, error: p.error });
  }
  if (o === "/api/pix/element-levels") {
    let i = m(e.mode, 24) || "real",
      n =
        e.level5Design && typeof e.level5Design == "object"
          ? e.level5Design
          : null;
    if (!n)
      return l(400, { ok: !1, error: "Missing confirmed Level 5 design." });
    let s = {
        type: "OBJECT",
        properties: {
          levels: {
            type: "ARRAY",
            description:
              "Exactly 4 progression tiers for levels 1, 2, 3, and 4 leading cleanly into the confirmed Level 5 flagship.",
            items: {
              type: "OBJECT",
              properties: {
                level: {
                  type: "INTEGER",
                  description: "Upgrade tier: 1, 2, 3, or 4.",
                },
                title: {
                  type: "STRING",
                  description:
                    "Distinct level title progressing from humble Lv 1 starter toward the Lv 5 flagship.",
                },
                description: {
                  type: "STRING",
                  description:
                    "Short 1-sentence description of what this level looks like and adds.",
                },
                footprintCells: {
                  type: "INTEGER",
                  description:
                    "1, 2, or 3 (must be <= Lv 5 footprintCells and monotonically non-decreasing from Lv 1 to Lv 5).",
                },
                cost: { type: "INTEGER" },
                popBase: { type: "INTEGER" },
                jobs: { type: "INTEGER" },
                food: { type: "INTEGER" },
                power: { type: "INTEGER" },
                water: { type: "INTEGER" },
                waste: { type: "INTEGER" },
                education: { type: "INTEGER" },
                recreation: { type: "INTEGER" },
                government: { type: "INTEGER" },
                police: { type: "INTEGER" },
                policeRadius: { type: "INTEGER" },
                fireRadius: { type: "INTEGER" },
                military: { type: "INTEGER" },
                income: { type: "INTEGER" },
                boxes: E.properties.boxes,
                cylinders: E.properties.cylinders,
                roof: E.properties.roof,
                blinkers: E.properties.blinkers,
                rotors: E.properties.rotors,
                critters: E.properties.critters,
                smoke: E.properties.smoke,
              },
              required: ["level", "title", "footprintCells", "cost", "boxes"],
            },
          },
        },
        required: ["levels"],
      },
      y = [
        "You are Pix, the lead 3D voxel architect for Pixel Civilization.",
        "The player has confirmed their LEVEL 5 FLAGSHIP custom element. Now generate the 4 earlier upgrade levels (Level 1, Level 2, Level 3, and Level 4) that visibly and mechanically evolve into that exact Level 5 flagship!",
        "Keep the exact same architectural theme, color palette, and identity across all levels, growing naturally:",
        "- Level 1: Humble starter version (~40\u201350% height, simpler compact core silhouette, ~35% of Lv 5 stats & lower cost).",
        "- Level 2: Expanded local version (~58\u201365% height, adds entrance awning/trim or first wing, ~50% of Lv 5 stats).",
        "- Level 3: Established landmark (~72\u201380% height, adds second story/tower/courtyard details, ~68% of Lv 5 stats).",
        "- Level 4: Grand near-flagship (~86\u201392% height, almost full silhouette with slightly less rooftop ornament than Lv 5, ~84% of Lv 5 stats).",
        `Ensure footprintCells stays monotonically non-decreasing (1 <= lv1 <= lv2 <= lv3 <= lv4 <= lv5) and stats scale smoothly for "${i}" mode.`,
      ].join(" "),
      p = `Generate Levels 1, 2, 3, and 4 visuals and stats leading up to this confirmed Level 5 flagship:
${JSON.stringify(n).slice(0, 9e3)}`,
      a = await h(t, y, p, s);
    return a.ok
      ? l(200, { ok: !0, model: t.modelId, levels: a.data.levels ?? [] })
      : l(a.status, { ok: !1, error: a.error });
  }
  if (o === "/api/pix/world") {
    let i = m(e.prompt, 1400),
      n = m(e.mode, 24) || "god",
      c =
        e.islandSummary && typeof e.islandSummary == "object"
          ? e.islandSummary
          : {},
      s = Array.isArray(e.availableIds)
        ? e.availableIds.filter((d) => typeof d == "string").slice(0, 290)
        : [];
    if (!i)
      return l(400, {
        ok: !1,
        error: "Describe what you want Pix to build or sculpt on your island.",
      });
    let y = [
        "You are Pix, an expert urban planner and terraforming director for Pixel Civilization.",
        "CRITICAL COORDINATE SYSTEM: The island uses SIGNED grid coordinates centered at (0, 0). Dry land spans roughly gx in [-19, 19] and gz in [-19, 19]. Coastlines sit around radius 19..21 and ocean beyond 22.",
        "Return a clean, cohesive, structured world-building plan with terrainOps (canyons, canals, rivers, ponds, hills, beaches, and tall elevated kind='bridge' spans with depthOrHeight 3..6), connected roadLines (using plural catalog IDs like 'roads', 'two_lane_roads', 'pretty_roads', 'highways', 'bridges', 'suspension_bridges'), and building placements aligned near those roads.",
        "ONLY use elementId values from the provided availableIds list! Never invent unknown IDs.",
        "If the user asks for a canyon or big canal with tall bridges over it, emit the canyon/canal terrainOp FIRST, then emit kind='bridge' terrainOps (depthOrHeight 4..5) crossing perpendicularly over it, plus connecting roadLines on both banks.",
        "If the user asks to cover the whole island in God mode (e.g. with a spaceport at center 0,0), lay a clean grid of roadLines across [-16..16] and place 45\u201380 varied buildings (housing, commerce, utilities, parks, transit, safety, defense, landmarks) spaced 3\u20134 cells apart.",
        `Mode is "${n}": in 'god' mode you have full terraforming and up to 90 placements; in 'real' mode skip terrainOps and plan up to 16 budget-conscious unlocked placements; in 'survival' mode skip terrainOps and plan up to 6 critical survival placements.`,
      ].join(" "),
      p = [
        `Mode: ${n}`,
        `Player request: ${i}`,
        `Island telemetry: ${JSON.stringify(c).slice(0, 4e3)}`,
        `Allowed elementIds: ${s.join(", ")}`,
      ].join(`

`),
      a = await h(t, y, p, w);
    return a.ok
      ? l(200, { ok: !0, model: t.modelId, plan: a.data })
      : l(a.status, { ok: !1, error: a.error });
  }
  if (o === "/api/pix/advise") {
    let i =
        m(e.question, 1e3) ||
        "Analyze my island right now and tell me the best next moves.",
      n = m(e.mode, 24) || "real",
      c = e.telemetry && typeof e.telemetry == "object" ? e.telemetry : {},
      s = Array.isArray(e.availableIds)
        ? e.availableIds.filter((u) => typeof u == "string").slice(0, 290)
        : [],
      y = Array.isArray(e.history)
        ? e.history
            .slice(-6)
            .map((u) => {
              if (!u || typeof u != "object") return "";
              let R = u;
              return `${R.role === "pix" ? "Pix" : "Player"}: ${m(R.text, 320)}`;
            })
            .filter(Boolean).join(`
`)
        : "",
      p = [
        "You are Pix, the strategic city advisor inside Pixel Civilization.",
        "You know every mechanic in Pixel Civilization: road connectivity (front doors must touch roads to get water, power, food, and jobs), water distribution, food supply & farm complexes, power balance, waste, fire/police/helicopter coverage, military defense & naval/air wings, stages 1\u201320, taxes, and all 5 modes (God, Real, Survival, Idle, Manager).",
        "Give sharp, practical, friendly coaching grounded directly in the live island telemetry provided.",
        `Tailor advice to game mode "${n}".`,
        "When recommending a building via action kind='select_element', use ONLY IDs from availableIds.",
        "When recommending a map layer via action kind='open_layer', use ONLY exact HeatmapKind values: power, water, food, waste, education, parks, police, fire, defense, traffic, transit, neighbors, jobs, landvalue, pollution.",
        "When highlighting a problem coordinate from telemetry.hotspots via kind='focus_site', pass its exact gx and gz so the camera flies straight to that site.",
      ].join(" "),
      a = [
        y
          ? `Recent conversation:
${y}`
          : "",
        `Player question: ${i}`,
        `Live island telemetry: ${JSON.stringify(c).slice(0, 6e3)}`,
        `Available unlocked elementIds: ${s.join(", ")}`,
      ].filter(Boolean).join(`

`),
      d = await h(t, p, a, x);
    return d.ok
      ? l(200, { ok: !0, model: t.modelId, advice: d.data })
      : l(d.status, { ok: !1, error: d.error });
  }
  return l(404, { ok: !1, error: "Unknown Pix API endpoint." });
}
