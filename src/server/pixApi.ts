import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const MODEL_ID = "gemini-4-hydrogen";
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("INVALID_JSON");
  }
  return parsed as Record<string, unknown>;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function clampString(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

const ELEMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Short, evocative building/element title (2-4 words)." },
    description: { type: Type.STRING, description: "One crisp sentence explaining what this element does on the island." },
    architectNote: { type: Type.STRING, description: "Brief 1-sentence explanation of visual details or revisions made." },
    category: {
      type: Type.STRING,
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
    domain: {
      type: Type.STRING,
      enum: ["land", "water"],
    },
    footprintCells: {
      type: Type.INTEGER,
      description: "Footprint width/depth in island grid cells: 1, 2, or 3.",
    },
    cost: { type: Type.INTEGER, description: "Construction cost in treasury dollars (80 to 15000)." },
    popBase: { type: Type.INTEGER, description: "Base housing capacity at Lv 1 (0 to 300)." },
    jobs: { type: Type.INTEGER, description: "Jobs created (0 to 260)." },
    food: { type: Type.INTEGER, description: "Food supplied (0 to 120)." },
    power: { type: Type.INTEGER, description: "Net power: positive produces, negative consumes (-80 to 250)." },
    water: { type: Type.INTEGER, description: "Net water: positive produces, negative consumes (-80 to 200)." },
    waste: { type: Type.INTEGER, description: "Waste processing capacity (0 to 120)." },
    education: { type: Type.INTEGER, description: "School/education seats (0 to 180)." },
    recreation: { type: Type.INTEGER, description: "Park/culture/leisure capacity (0 to 180)." },
    government: { type: Type.INTEGER, description: "Civic/government coverage (0 to 150)." },
    police: { type: Type.INTEGER, description: "Police strength (0 to 60)." },
    policeRadius: { type: Type.INTEGER, description: "Police coverage radius in tiles (0 to 14)." },
    fireRadius: { type: Type.INTEGER, description: "Firefighting coverage radius in tiles (0 to 14)." },
    military: { type: Type.INTEGER, description: "Defense power rating (0 to 90)." },
    income: { type: Type.INTEGER, description: "Revenue/income per cycle (0 to 160)." },
    accentHex: { type: Type.STRING, description: "Hex accent color like #1d4ed8." },
    lotGround: {
      type: Type.STRING,
      enum: ["grass", "asphalt", "path", "concrete", "sand", "deck"],
    },
    boxes: {
      type: Type.ARRAY,
      description: "Up to 28 voxel cuboids defining the 3D structure. Coordinates in voxel space: x,z in [-12,12], y in [0,28].",
      items: {
        type: Type.OBJECT,
        properties: {
          x0: { type: Type.INTEGER },
          y0: { type: Type.INTEGER },
          z0: { type: Type.INTEGER },
          x1: { type: Type.INTEGER },
          y1: { type: Type.INTEGER },
          z1: { type: Type.INTEGER },
          color: { type: Type.STRING, description: "Hex color like #d97706 or palette token (white, cream, brick, stone, slate, steel, steelDark, glass, glassCyan, warmGlow, gold, navy, crimson, teal, olive, wood, woodDark, copper, terracotta, neon, cyan, orange, leaf)." },
          emit: { type: Type.NUMBER, description: "Optional glow 0..1.5 (0 for matte surfaces, >0 for windows/signs/beacons)." },
        },
        required: ["x0", "y0", "z0", "x1", "y1", "z1", "color"],
      },
    },
    cylinders: {
      type: Type.ARRAY,
      description: "Optional towers, silos, domes, pillars, chimneys (up to 8).",
      items: {
        type: Type.OBJECT,
        properties: {
          cx: { type: Type.INTEGER },
          cz: { type: Type.INTEGER },
          y0: { type: Type.INTEGER },
          y1: { type: Type.INTEGER },
          radius: { type: Type.NUMBER },
          color: { type: Type.STRING },
          emit: { type: Type.NUMBER },
        },
        required: ["cx", "cz", "y0", "y1", "radius", "color"],
      },
    },
    roof: {
      type: Type.OBJECT,
      description: "Optional pitched or flat roof cap on main mass.",
      properties: {
        style: { type: Type.STRING, enum: ["flat", "gable", "pyramid", "dome", "none"] },
        x0: { type: Type.INTEGER },
        y: { type: Type.INTEGER },
        z0: { type: Type.INTEGER },
        x1: { type: Type.INTEGER },
        z1: { type: Type.INTEGER },
        color: { type: Type.STRING },
        trimColor: { type: Type.STRING },
      },
      required: ["style", "x0", "y", "z0", "x1", "z1", "color"],
    },
    blinkers: {
      type: Type.ARRAY,
      description: "Optional blinking rooftop beacons (up to 4).",
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.INTEGER },
          y: { type: Type.INTEGER },
          z: { type: Type.INTEGER },
          color: { type: Type.STRING },
        },
        required: ["x", "y", "z", "color"],
      },
    },
    rotors: {
      type: Type.ARRAY,
      description: "Optional spinning water wheel, radar dish, helicopter blades, or turbine blades (up to 2).",
      items: {
        type: Type.OBJECT,
        properties: {
          px: { type: Type.INTEGER },
          py: { type: Type.INTEGER },
          pz: { type: Type.INTEGER },
          axis: { type: Type.STRING, enum: ["x", "y", "z"] },
          speed: { type: Type.NUMBER },
          radius: { type: Type.INTEGER },
          color: { type: Type.STRING },
        },
        required: ["px", "py", "pz", "axis", "speed", "radius", "color"],
      },
    },
    critters: {
      type: Type.ARRAY,
      description: "Optional animated moving animals roaming a pen on the lot (up to 2 pens).",
      items: {
        type: Type.OBJECT,
        properties: {
          kind: { type: Type.STRING, enum: ["cow", "sheep", "pig", "chicken", "horse", "goat", "duck", "bee"] },
          count: { type: Type.INTEGER, description: "1 to 6 animals." },
          x0: { type: Type.INTEGER },
          z0: { type: Type.INTEGER },
          x1: { type: Type.INTEGER },
          z1: { type: Type.INTEGER },
        },
        required: ["kind", "count", "x0", "z0", "x1", "z1"],
      },
    },
    smoke: {
      type: Type.ARRAY,
      description: "Optional rising chimney smoke or steam vents (up to 2).",
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.INTEGER },
          y: { type: Type.INTEGER },
          z: { type: Type.INTEGER },
          kind: { type: Type.STRING, enum: ["smoke", "steam", "dark", "spark"] },
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
};

const WORLD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Clear 1-2 sentence summary of what Pix will build or sculpt." },
    terrainOps: {
      type: Type.ARRAY,
      description: "Up to 14 terrain sculpting or elevated bridge ops using signed island grid coordinates centered at (0,0) (dry land sits within gx,gz in [-19, 19]). Use kind='bridge' with depthOrHeight 2..6 to span tall elevated bridges over carved canyons or canals.",
      items: {
        type: Type.OBJECT,
        properties: {
          kind: {
            type: Type.STRING,
            enum: ["canal", "canyon", "river", "pond", "mountain", "raise", "lower", "paint_sand", "bridge"],
          },
          x0: { type: Type.INTEGER, description: "Start grid X (-19..19)." },
          z0: { type: Type.INTEGER, description: "Start grid Z (-19..19)." },
          x1: { type: Type.INTEGER, description: "End grid X (-19..19)." },
          z1: { type: Type.INTEGER, description: "End grid Z (-19..19)." },
          radius: { type: Type.INTEGER, description: "Brush radius in grid cells (1..4)." },
          depthOrHeight: { type: Type.NUMBER, description: "Depth/height magnitude (0.6..3.5 for terrain, 2..6 for tall elevated bridges)." },
        },
        required: ["kind", "x0", "z0", "x1", "z1", "radius"],
      },
    },
    roadLines: {
      type: Type.ARRAY,
      description: "Up to 24 connected road/avenue/bridge corridors (gx,gz in [-19..19]).",
      items: {
        type: Type.OBJECT,
        properties: {
          roadId: {
            type: Type.STRING,
            enum: ["roads", "two_lane_roads", "pretty_roads", "highways", "bridges", "stone_bridges", "suspension_bridges"],
          },
          x0: { type: Type.INTEGER },
          z0: { type: Type.INTEGER },
          x1: { type: Type.INTEGER },
          z1: { type: Type.INTEGER },
        },
        required: ["roadId", "x0", "z0", "x1", "z1"],
      },
    },
    placements: {
      type: Type.ARRAY,
      description: "Up to 90 structures in God mode (up to 18 in Real, up to 6 in Survival) placed near roads or coasts using ONLY elementIds from the provided catalog list (gx,gz in [-19..19], coast/water around 18..24).",
      items: {
        type: Type.OBJECT,
        properties: {
          elementId: { type: Type.STRING },
          gx: { type: Type.INTEGER, description: "Grid X (-22..22)." },
          gz: { type: Type.INTEGER, description: "Grid Z (-22..22)." },
          level: { type: Type.INTEGER, description: "1..5 (respect mode caps)." },
          rot: { type: Type.INTEGER, description: "0, 1, 2, or 3." },
        },
        required: ["elementId", "gx", "gz"],
      },
    },
  },
  required: ["summary", "terrainOps", "roadLines", "placements"],
};

const ADVISE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: "Crisp 4-8 word executive headline." },
    diagnosis: { type: Type.STRING, description: "2-3 clear sentences diagnosing the island's current health, bottlenecks, and opportunities." },
    tips: {
      type: Type.ARRAY,
      description: "3-5 short actionable bullet tips tailored to the current game mode.",
      items: { type: Type.STRING },
    },
    actions: {
      type: Type.ARRAY,
      description: "Up to 4 clickable quick-actions the player can trigger right inside Pixel Civilization.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Short button label (2-5 words)." },
          kind: { type: Type.STRING, enum: ["select_element", "open_layer", "focus_site"] },
          elementId: { type: Type.STRING, description: "Catalog elementId when kind is select_element." },
          layerId: {
            type: Type.STRING,
            description: "Exact HeatmapKind overlay id when kind is open_layer: power, water, traffic, fire, police, defense, landvalue, pollution, food, waste, education, parks, transit, neighbors, jobs.",
          },
          gx: { type: Type.INTEGER, description: "Grid X when kind is focus_site." },
          gz: { type: Type.INTEGER, description: "Grid Z when kind is focus_site." },
        },
        required: ["label", "kind"],
      },
    },
  },
  required: ["headline", "diagnosis", "tips", "actions"],
};

async function runStructuredPrompt(systemInstruction: string, userContent: string, schema: Record<string, unknown>) {
  const ai = getAiClient();
  if (!ai) {
    return { ok: false as const, status: 503, error: "GEMINI_API_KEY is not configured on the server." };
  }
  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });
    const text = response.text?.trim();
    if (!text) {
      return { ok: false as const, status: 502, error: "Pix returned an empty response. Try rephrasing your prompt." };
    }
    const parsed = JSON.parse(text);
    return { ok: true as const, data: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected Gemini API failure.";
    console.error("[PixBuilder API error]", message);
    return { ok: false as const, status: 502, error: `Pix request failed: ${message}` };
  }
}

export async function handlePixApi(req: IncomingMessage, res: ServerResponse, urlPath: string): Promise<boolean> {
  if (!urlPath.startsWith("/api/pix/")) return false;

  if (urlPath === "/api/pix/status" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      connectedModel: MODEL_ID,
      modelLabel: "Gemini 4 Hydrogen",
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
    return true;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed. Use POST." });
    return true;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const code = err instanceof Error && err.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    sendJson(res, code, { ok: false, error: code === 413 ? "Request body too large (max 64 KB)." : "Invalid JSON payload." });
    return true;
  }

  if (urlPath === "/api/pix/element") {
    const prompt = clampString(body.prompt, 1200);
    const mode = clampString(body.mode, 24) || "real";
    const previousDesign = body.previousDesign && typeof body.previousDesign === "object" ? body.previousDesign : null;
    if (!prompt) {
      sendJson(res, 400, { ok: false, error: "Please describe the civilization element you want Pix to design." });
      return true;
    }

    const systemInstruction = [
      "You are Pix, the lead 3D voxel architect for Pixel Civilization.",
      "DEFAULT LEVEL 5 FLAGSHIP: Always design the fully upgraded LEVEL 5 flagship edition of the requested element — grand silhouette, rich architectural trim, layered stories, glowing windows/signs, beacons, optional spinning rotors (water wheels, radar dishes, turbines, helicopter blades), optional animated moving critters, and optional rising smoke/steam chimneys.",
      "Coordinate grid: footprintCells=1 maps to voxel space x,z in [-7,7]; footprintCells=2 maps to [-11,11]; footprintCells=3 maps to [-12,12]. Base starts at y=1 (ground pad is y=0). Use crisp architectural silhouettes, entrances on +z face, contrasting trims, and warm glowing windows (emit: 0.6..1.1).",
      `Game mode is "${mode}". Express the stats for this fully upgraded Level 5 flagship fairly for "${mode}" mode (in survival keep outputs modest and costs realistic; in real/idle/manager keep balanced high-tier Lv 5 stats; in god mode you may create grand unrestricted landmarks).`,
      "If previousDesign is supplied, preserve its identity while applying the user's requested visual or stat refinements.",
    ].join(" ");

    const userContent = previousDesign
      ? `Refinement request for this Level 5 flagship element: ${prompt}\n\nExisting Level 5 design JSON to refine:\n${JSON.stringify(previousDesign).slice(0, 8000)}`
      : `Create a brand-new Level 5 flagship Pixel Civilization 3D voxel element for this request: ${prompt}`;

    const result = await runStructuredPrompt(systemInstruction, userContent, ELEMENT_SCHEMA);
    if (!result.ok) {
      sendJson(res, result.status, { ok: false, error: result.error });
      return true;
    }
    sendJson(res, 200, { ok: true, model: MODEL_ID, design: result.data });
    return true;
  }

  if (urlPath === "/api/pix/element-levels") {
    const mode = clampString(body.mode, 24) || "real";
    const level5Design = body.level5Design && typeof body.level5Design === "object" ? body.level5Design : null;
    if (!level5Design) {
      sendJson(res, 400, { ok: false, error: "Missing confirmed Level 5 design." });
      return true;
    }

    const LEVEL_ITEM_SCHEMA = {
      type: Type.OBJECT,
      properties: {
        level: { type: Type.INTEGER, description: "Upgrade tier: 1, 2, 3, or 4." },
        title: { type: Type.STRING, description: "Distinct level title progressing from humble Lv 1 starter toward the Lv 5 flagship." },
        description: { type: Type.STRING, description: "Short 1-sentence description of what this level looks like and adds." },
        footprintCells: { type: Type.INTEGER, description: "1, 2, or 3 (must be <= Lv 5 footprintCells and monotonically non-decreasing from Lv 1 to Lv 5)." },
        cost: { type: Type.INTEGER },
        popBase: { type: Type.INTEGER },
        jobs: { type: Type.INTEGER },
        food: { type: Type.INTEGER },
        power: { type: Type.INTEGER },
        water: { type: Type.INTEGER },
        waste: { type: Type.INTEGER },
        education: { type: Type.INTEGER },
        recreation: { type: Type.INTEGER },
        government: { type: Type.INTEGER },
        police: { type: Type.INTEGER },
        policeRadius: { type: Type.INTEGER },
        fireRadius: { type: Type.INTEGER },
        military: { type: Type.INTEGER },
        income: { type: Type.INTEGER },
        boxes: ELEMENT_SCHEMA.properties.boxes,
        cylinders: ELEMENT_SCHEMA.properties.cylinders,
        roof: ELEMENT_SCHEMA.properties.roof,
        blinkers: ELEMENT_SCHEMA.properties.blinkers,
        rotors: ELEMENT_SCHEMA.properties.rotors,
        critters: ELEMENT_SCHEMA.properties.critters,
        smoke: ELEMENT_SCHEMA.properties.smoke,
      },
      required: ["level", "title", "footprintCells", "cost", "boxes"],
    };

    const LEVELS_SCHEMA = {
      type: Type.OBJECT,
      properties: {
        levels: {
          type: Type.ARRAY,
          description: "Exactly 4 progression tiers for levels 1, 2, 3, and 4 leading cleanly into the confirmed Level 5 flagship.",
          items: LEVEL_ITEM_SCHEMA,
        },
      },
      required: ["levels"],
    };

    const systemInstruction = [
      "You are Pix, the lead 3D voxel architect for Pixel Civilization.",
      "The player has confirmed their LEVEL 5 FLAGSHIP custom element. Now generate the 4 earlier upgrade levels (Level 1, Level 2, Level 3, and Level 4) that visibly and mechanically evolve into that exact Level 5 flagship!",
      "Keep the exact same architectural theme, color palette, and identity across all levels, growing naturally:",
      "- Level 1: Humble starter version (~40–50% height, simpler compact core silhouette, ~35% of Lv 5 stats & lower cost).",
      "- Level 2: Expanded local version (~58–65% height, adds entrance awning/trim or first wing, ~50% of Lv 5 stats).",
      "- Level 3: Established landmark (~72–80% height, adds second story/tower/courtyard details, ~68% of Lv 5 stats).",
      "- Level 4: Grand near-flagship (~86–92% height, almost full silhouette with slightly less rooftop ornament than Lv 5, ~84% of Lv 5 stats).",
      `Ensure footprintCells stays monotonically non-decreasing (1 <= lv1 <= lv2 <= lv3 <= lv4 <= lv5) and stats scale smoothly for "${mode}" mode.`,
    ].join(" ");

    const userContent = `Generate Levels 1, 2, 3, and 4 visuals and stats leading up to this confirmed Level 5 flagship:\n${JSON.stringify(level5Design).slice(0, 9000)}`;

    const result = await runStructuredPrompt(systemInstruction, userContent, LEVELS_SCHEMA);
    if (!result.ok) {
      sendJson(res, result.status, { ok: false, error: result.error });
      return true;
    }
    sendJson(res, 200, { ok: true, model: MODEL_ID, levels: (result.data as { levels?: unknown[] }).levels ?? [] });
    return true;
  }

  if (urlPath === "/api/pix/world") {
    const prompt = clampString(body.prompt, 1400);
    const mode = clampString(body.mode, 24) || "god";
    const islandSummary = body.islandSummary && typeof body.islandSummary === "object" ? body.islandSummary : {};
    const availableIds = Array.isArray(body.availableIds)
      ? body.availableIds.filter((x): x is string => typeof x === "string").slice(0, 290)
      : [];

    if (!prompt) {
      sendJson(res, 400, { ok: false, error: "Describe what you want Pix to build or sculpt on your island." });
      return true;
    }

    const systemInstruction = [
      "You are Pix, an expert urban planner and terraforming director for Pixel Civilization.",
      "CRITICAL COORDINATE SYSTEM: The island uses SIGNED grid coordinates centered at (0, 0). Dry land spans roughly gx in [-19, 19] and gz in [-19, 19]. Coastlines sit around radius 19..21 and ocean beyond 22.",
      "Return a clean, cohesive, structured world-building plan with terrainOps (canyons, canals, rivers, ponds, hills, beaches, and tall elevated kind='bridge' spans with depthOrHeight 3..6), connected roadLines (using plural catalog IDs like 'roads', 'two_lane_roads', 'pretty_roads', 'highways', 'bridges', 'suspension_bridges'), and building placements aligned near those roads.",
      "ONLY use elementId values from the provided availableIds list! Never invent unknown IDs.",
      "If the user asks for a canyon or big canal with tall bridges over it, emit the canyon/canal terrainOp FIRST, then emit kind='bridge' terrainOps (depthOrHeight 4..5) crossing perpendicularly over it, plus connecting roadLines on both banks.",
      "If the user asks to cover the whole island in God mode (e.g. with a spaceport at center 0,0), lay a clean grid of roadLines across [-16..16] and place 45–80 varied buildings (housing, commerce, utilities, parks, transit, safety, defense, landmarks) spaced 3–4 cells apart.",
      `Mode is "${mode}": in 'god' mode you have full terraforming and up to 90 placements; in 'real' mode skip terrainOps and plan up to 16 budget-conscious unlocked placements; in 'survival' mode skip terrainOps and plan up to 6 critical survival placements.`,
    ].join(" ");

    const userContent = [
      `Mode: ${mode}`,
      `Player request: ${prompt}`,
      `Island telemetry: ${JSON.stringify(islandSummary).slice(0, 4000)}`,
      `Allowed elementIds: ${availableIds.join(", ")}`,
    ].join("\n\n");

    const result = await runStructuredPrompt(systemInstruction, userContent, WORLD_SCHEMA);
    if (!result.ok) {
      sendJson(res, result.status, { ok: false, error: result.error });
      return true;
    }
    sendJson(res, 200, { ok: true, model: MODEL_ID, plan: result.data });
    return true;
  }

  if (urlPath === "/api/pix/advise") {
    const question = clampString(body.question, 1000) || "Analyze my island right now and tell me the best next moves.";
    const mode = clampString(body.mode, 24) || "real";
    const telemetry = body.telemetry && typeof body.telemetry === "object" ? body.telemetry : {};
    const availableIds = Array.isArray(body.availableIds)
      ? body.availableIds.filter((x): x is string => typeof x === "string").slice(0, 290)
      : [];
    const history = Array.isArray(body.history)
      ? body.history
          .slice(-6)
          .map((h) => {
            if (!h || typeof h !== "object") return "";
            const rec = h as Record<string, unknown>;
            const role = rec.role === "pix" ? "Pix" : "Player";
            return `${role}: ${clampString(rec.text, 320)}`;
          })
          .filter(Boolean)
          .join("\n")
      : "";

    const systemInstruction = [
      "You are Pix, the strategic city advisor inside Pixel Civilization.",
      "You know every mechanic in Pixel Civilization: road connectivity (front doors must touch roads to get water, power, food, and jobs), water distribution, food supply & farm complexes, power balance, waste, fire/police/helicopter coverage, military defense & naval/air wings, stages 1–20, taxes, and all 5 modes (God, Real, Survival, Idle, Manager).",
      "Give sharp, practical, friendly coaching grounded directly in the live island telemetry provided.",
      `Tailor advice to game mode "${mode}".`,
      "When recommending a building via action kind='select_element', use ONLY IDs from availableIds.",
      "When recommending a map layer via action kind='open_layer', use ONLY exact HeatmapKind values: power, water, food, waste, education, parks, police, fire, defense, traffic, transit, neighbors, jobs, landvalue, pollution.",
      "When highlighting a problem coordinate from telemetry.hotspots via kind='focus_site', pass its exact gx and gz so the camera flies straight to that site.",
    ].join(" ");

    const userContent = [
      history ? `Recent conversation:\n${history}` : "",
      `Player question: ${question}`,
      `Live island telemetry: ${JSON.stringify(telemetry).slice(0, 6000)}`,
      `Available unlocked elementIds: ${availableIds.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await runStructuredPrompt(systemInstruction, userContent, ADVISE_SCHEMA);
    if (!result.ok) {
      sendJson(res, result.status, { ok: false, error: result.error });
      return true;
    }
    sendJson(res, 200, { ok: true, model: MODEL_ID, advice: result.data });
    return true;
  }

  sendJson(res, 404, { ok: false, error: "Unknown Pix API endpoint." });
  return true;
}
