import type { GameMode } from "../game/catalog";

export interface ModeMeta {
  id: GameMode;
  label: string;
  shortLabel: string;
  tagline: string;
  winLoop: string;
  pace: string;
}

export const PLAYBOOK_MODES: ModeMeta[] = [
  {
    id: "god",
    label: "God Mode",
    shortLabel: "God",
    tagline: "Unlimited sandbox for sculpting terrain, testing systems, and designing dream islands.",
    winLoop: "Sculpt landscapes, place any Stage 1–20 landmark at Levels 1–5, control weather & clock, or experiment with PixBuilder freely.",
    pace: "Zero cost · all 290+ elements unlocked",
  },
  {
    id: "real",
    label: "Real Mode",
    shortLabel: "Real",
    tagline: "Classic city-builder progression from Stage 1 Village to Stage 20 Eternal Civilization on a live treasury.",
    winLoop: "Grow population with auto-linking roads, food, power, and water; keep taxes fair; unlock new districts, transit, police (Stage 5), and defense (Stage 10).",
    pace: "Live treasury · 20 progression stages",
  },
  {
    id: "survival",
    label: "Survival",
    shortLabel: "Survival",
    tagline: "High-stakes city leadership where extended shortages, fires, or disrepair can collapse your island.",
    winLoop: "Keep cash reserves buffered, maintain buildings (or enable Auto-Maintain), expand fire & police coverage early, and fortify military defense before raids.",
    pace: "Repair cycles · active disaster & raid pressure",
  },
  {
    id: "idle",
    label: "Idle Mode",
    shortLabel: "Idle",
    tagline: "Watch a randomized algorithmic planner construct and connect an entire Stage 1–20 civilization automatically.",
    winLoop: "Pan, orbit, zoom, use the Top-Right Quick Menu (Adaptive or Manual), switch map layers, and tap any structure to inspect live metrics while your island grows on its own.",
    pace: "Hands-off · pause/resume & speed controls",
  },
  {
    id: "manager",
    label: "Manager",
    shortLabel: "Manager",
    tagline: "Lead your city as Chief Executive: the planner builds automatically and brings you Yes/No & multi-option decisions.",
    winLoop: "Review briefing cards, customize your Top-Right Quick Menu, choose districts and infrastructure priorities, and tap any placed building anytime to swap its style variant.",
    pace: "Executive decisions · free style customization",
  },
];

export interface HandbookSectionDef {
  id: string;
  label: string;
  chapterIds: string[];
}

export const HANDBOOK_SECTIONS: HandbookSectionDef[] = [
  {
    id: "controls_quick",
    label: "Quick Menus & Controls",
    chapterIds: ["quick_menus", "interface"],
  },
  {
    id: "city_growth",
    label: "City, Districts & Growth",
    chapterIds: ["city", "neighbors", "districts", "sanctuaries", "projects"],
  },
  {
    id: "transport_defense",
    label: "Transit, Works & Defense",
    chapterIds: ["railworks", "travel", "works", "tour", "safety_military"],
  },
  {
    id: "modes_pix",
    label: "Modes, God Tools & Pix",
    chapterIds: ["idle_manager", "sandbox", "pixbuilder"],
  },
];

export interface ChapterModeBrief {
  goal: string;
  tip: string;
  watchOut: string;
  checklist: string[];
}

export interface ExtraPlaybookLesson {
  id: string;
  title: string;
  steps: string[];
  examples: { image: string; caption: string; alt: string; width: number; height: number }[];
  designs?: string[];
  summary?: string;
}

export interface ExtraPlaybookChapter {
  id: string;
  title: string;
  label: string;
  intro: string;
  cover: string;
  lessons: ExtraPlaybookLesson[];
}

export const EXTRA_PLAYBOOK_CHAPTERS: ExtraPlaybookChapter[] = [
  {
    id: "quick_menus",
    title: "Quick Menus, Top-Right Menu & Smart Controls",
    label: "Quick Menus",
    intro: "Build and edit in seconds right on the map with radial spiral Quick Menus, an adaptive or manual Top-Right Quick Menu, auto-linking roads, and compact background-less sheets.",
    cover: "",
    lessons: [
      {
        id: "qm-radial-build-modes",
        title: "Smart Build, Quick Build & Exact Build",
        steps: [
          "Tap any empty land or water tile to open your radial spiral build menu directly around your finger. Pick your preferred style anytime from the Top-Right Quick Menu or More → Settings → Quick Menus.",
          "Smart Build (Default · 3 clicks): Tap empty ground → choose 1 of 6 adaptive categories → choose 1 of 6 adaptive elements tailored to your stage, city needs, nearby terrain/roads, and personal build habits.",
          "Quick Build (2 clicks): Skips categories completely and spirals straight into the 6 elements you are most likely to place on that exact tile.",
          "Exact Build (4 clicks): A fixed, non-adaptive 7 × 7 × 6 decision tree covering every unlocked element so you always know the exact path to any building.",
          "Customize focus (Balanced, City Needs, Habits, Nearby Tile), branch order, and after-place behavior safely under More → Settings → Quick Menus.",
        ],
        examples: [],
        designs: ["road", "house", "farm", "wind_turbine"],
      },
      {
        id: "qm-quick-edit",
        title: "Quick Edit spiral menu & instant post-placement editing",
        steps: [
          "Quick Edit is always active: tap any placed building or road (and right after placing an element via Quick Menus) to spiral out instant controls — Upgrade, Move, Rotate, Swap Style, Repair, Fire Dispatch, Undo, Demolish, and Details (•••).",
          "Urgent actions like Fire Dispatch or Repair automatically rise to the top when a structure needs help.",
          "Open More → Settings → Quick Menus → Quick Edit to switch between Adaptive Order (learns the buttons you tap most) and Fixed Order, reorder buttons, or hide optional controls while keeping core editing safe.",
        ],
        examples: [],
        designs: ["house", "artisan_bakery", "fire_station"],
      },
      {
        id: "qm-top-right-menu",
        title: "Top-Right Quick Menu (Adaptive & Manual in every mode)",
        steps: [
          "The slim top bar keeps stats compact, gives Pix a tight sparkles badge, and places the icon-only Quick Menu trigger on the far right (with simulation speed nested inside instead of cluttering the HUD).",
          "Tap the far-right icon to drop down 6 floating, background-less pills directly over the island. By default it starts with Bulk Select, Smart Build, Quick Build, Exact Build, Simulation Speed (Pause / 1× / 2× / 4×), and contextual quick access — then adapts live across a 25-action catalog of features and settings.",
          "Want full control in God, Real, Survival, Idle, or Manager mode? Tap the sliders icon at the bottom of the drop-down (or open More → Settings → Quick Menus → Top-Right Quick Menu) to switch from Adaptive to Manual and pick or reorder up to 6 pinned shortcuts.",
        ],
        examples: [],
      },
      {
        id: "qm-bulk-roads-compact",
        title: "Auto-linking roads, multi-tile confirm, Bulk Select & compact menus",
        steps: [
          "Auto-Linking Roads: Every road, avenue, bridge, and street automatically links to all adjacent buildings and neighboring roads the instant you place it — in every game mode, with zero manual wiring required.",
          "Multi-Tile Roads & Bridges: Drag a road or bridge stroke across multiple tiles to preview its cost and route, then tap the floating green checkmark to confirm (or tap anywhere else on the map to cancel cleanly).",
          "Bulk Select & Draw-to-Delete: Activate Bulk Select from the Top-Right Quick Menu to paint-select multiple buildings or roads (filtered by All, Roads, or Buildings) and demolish them in one tap.",
          "Compact Floating Menus: Bottom sheets (Build, Layers, City, Transit, More, Inspector) open background-less at a compact ~1/3 screen height with icon-driven controls so your live 3D island stays front and center. Tap the sheet header chevron or drag its title bar to expand or collapse.",
        ],
        examples: [],
        designs: ["road", "bridge", "avenue"],
      },
    ],
  },
  {
    id: "safety_military",
    title: "Police, emergency response & armed forces",
    label: "Safety & Military",
    intro: "Protect growing neighborhoods with layered policing, fire & rescue stations, and air, sea, and land defense commands.",
    cover: "",
    lessons: [
      {
        id: "safety-emergency-grid",
        title: "Build overlapping police, fire & rescue coverage",
        steps: [
          "Crime stays inactive until Stage 5 when Police unlock (unless toggled on in God Mode View). Place a Police Precinct, Traffic Control Center, or Fire Rescue Substation near dense housing and commercial strips.",
          "Open Layers → Fire or Police to see exact tile coverage rings. Gaps turn warm/red when neighborhoods sit outside response range.",
          "Add SWAT Command, Crime Forensics Lab, or Emergency Dispatch 911 in later stages to lock down city-wide safety and shorten response times.",
        ],
        examples: [],
        designs: [
          "police_station",
          "swat_command",
          "fire_rescue_substation",
          "emergency_dispatch",
          "hazmat_response",
        ],
      },
      {
        id: "safety-helipads-boats",
        title: "Launch live sky helicopters & coastal rescue boats",
        steps: [
          "Place a Police Helipad, Medevac Helipad, Fire Helipad, or Search & Rescue Airpad on land to automatically launch patrolling emergency helicopters across your skyline.",
          "When a building catches fire, active Fire & Rescue helicopters automatically divert toward the blaze to assist your ground fire crews.",
          "Place a Harbor Police Pier or Coastal Rescue Station along the shoreline so patrol cutters and rescue launches cruise the surrounding bay.",
        ],
        examples: [],
        designs: [
          "police_helipad",
          "medevac_helipad",
          "fire_helipad",
          "sar_helipad",
          "coastal_rescue_station",
          "harbor_police_pier",
        ],
      },
      {
        id: "military-branches",
        title: "Coordinate Army, Navy, Air Force & Marine Corps",
        steps: [
          "From Stage 10 onward, National Defense protects your island from raids. Combine Army bases (Infantry Barracks, Artillery Battery, Command Bunker, Logistics Depot) with coastal Navy shipyards.",
          "Build Naval Destroyer Piers, Cruiser Docks, Submarine Pens, Fleet Command, or Coast Guard Bases on the water to send autonomous naval vessels cruising around your island perimeter.",
          "Construct Air Force Bomber Wings (B-52 Stratofortress & B-2 Spirit Stealth), Fighter Squadrons, Airlift Wings, AWACS Radar bases, and Marine Tilt-Rotor Wings to watch authentic aircraft patrol the skies overhead.",
        ],
        examples: [],
        designs: [
          "b52_bomber_wing",
          "b2_stealth_base",
          "fighter_wing_base",
          "naval_destroyer_pier",
          "naval_cruiser_dock",
          "marine_air_wing",
        ],
      },
      {
        id: "commerce-main-street",
        title: "Grow vibrant Main Street & waterfront commerce",
        steps: [
          "Pair new residential blocks with neighborhood shops like Artisan Bakery, Coffee Roastery, Retro Diner, Hardware Store, Independent Bookstore, and Corner Florist for strong local jobs and tax income.",
          "In mid-to-late stages, add entertainment and tech anchors — Multiplex Cinema, Bowling Alley, Retro Arcade, Jazz Club, Coworking Loft, Tech Startup Hub, and Night Market — to elevate land value and happiness.",
          "Line your harbors with Seafood Piers and Boutique Hotels connected by waterfront streets to turn coastal strips into booming revenue engines.",
        ],
        examples: [],
        designs: [
          "artisan_bakery",
          "coffee_roastery",
          "retro_diner",
          "multiplex_cinema",
          "night_market",
          "seafood_pier",
        ],
      },
    ],
  },
  {
    id: "idle_manager",
    title: "Autonomous growth in Idle & Manager modes",
    label: "Idle & Manager",
    intro: "Switch on purely algorithmic city building to watch islands evolve from Stage 1 to Stage 20 — either hands-off or guided by your executive decisions.",
    cover: "",
    lessons: [
      {
        id: "idle-how-it-works",
        title: "Watch a unique island grow in Idle Mode",
        steps: [
          "Switch to Idle Mode from More → Mode. Each run rolls a randomized street-grid style (grid, ring, avenue, or coastal spine), block spacing, and district priorities.",
          "The algorithmic planner builds auto-linking streets and bridges, balances food, power, water, and waste, adds commercial streets and military/safety bases as stages unlock, and upgrades high-value sites.",
          "Pan, orbit, zoom, inspect map overlays, customize your Top-Right Quick Menu (Adaptive or Manual), adjust speed (Pause / 1× / 2× / 4×), and tap any structure to read live metrics.",
        ],
        examples: [],
        designs: ["road", "bridge", "house", "artisan_bakery", "b2_stealth_base"],
      },
      {
        id: "manager-executive-flow",
        title: "Lead through decisions in Manager Mode",
        steps: [
          "In Manager Mode, the same algorithmic planner lays roads and handles routine infrastructure while pausing to present concise executive Decision Cards.",
          "Answer Yes/No or pick between 2–3 strategic proposals — such as expanding a residential avenue, constructing a new police helipad, opening a bakery district, or upgrading existing buildings.",
          "Want to customize your skyline's look? Tap any placed building on the island to open Quick Edit and swap its visual style variant anytime!",
        ],
        examples: [],
        designs: ["city_hall", "police_helipad", "coffee_roastery", "boutique_hotel"],
      },
    ],
  },
  {
    id: "pixbuilder",
    title: "Create elements, sculpt worlds & get advice with Pix",
    label: "PixBuilder (Pix)",
    intro: "Open PixBuilder Studio from the top-bar Pix sparkles button or More → Pix to design custom 3D voxel buildings (Lv5 flagship first with auto-generated Lv1–4 progression), sculpt island regions, or get live coaching in any mode.",
    cover: "",
    lessons: [
      {
        id: "pix-create-element",
        title: "Design custom 3D voxel elements (Lv5 flagship + auto Lv1–4)",
        steps: [
          "Open Pix → Create Element and describe any building, landmark, harbor pier, or facility you imagine — from an Art Deco Observatory to a Floating Solar Market.",
          "Pix generates your flagship Level 5 masterpiece first so you can inspect the full 360° 3D voxel model and ask for tweaks ('make the dome gold', 'add a rooftop spinning radar', 'make it taller') until it looks perfect.",
          "When you approve and confirm, Pix automatically synthesizes the full Levels 1–4 visual evolution ladder and balanced progression stats from your Lv5 design, then adds it straight to your Pix Custom build category and Quick Menus.",
        ],
        examples: [],
      },
      {
        id: "pix-world-builder",
        title: "Sculpt terrain & lay districts with Build World",
        steps: [
          "Switch to the Build World tab and ask Pix to carve a canyon or canal, lay a coastal boulevard, or populate a neighborhood district.",
          "Review Pix's structured action plan (terrain ops, auto-linking road lines, and building placements) before clicking Apply to Island.",
          "In God Mode, Pix can reshape land, carve waterways, and place any Stage 1–20 landmark. In Real or Survival Mode, Pix respects your budget and unlocked stages. Every batch supports Ctrl+Z Undo.",
        ],
        examples: [],
      },
      {
        id: "pix-live-advisor",
        title: "Diagnose bottlenecks with Advise with Pix",
        steps: [
          "Available in all five modes (God, Real, Survival, Idle, and Manager). Open Advise with Pix and tap Analyze My Island Now or ask a specific question.",
          "Pix reads your live treasury, population limiter, utility surpluses, congestion, crime, and problem sites, then delivers a tailored diagnosis and step-by-step advice.",
          "Click any recommended Action Button right in Pix's reply to jump the camera to a problem building, open the relevant Map Layer, or select a suggested building to place.",
        ],
        examples: [],
      },
    ],
  },
];

const CHAPTER_MODE_OVERRIDES: Record<string, Partial<Record<GameMode, ChapterModeBrief>>> = {
  quick_menus: {
    god: {
      goal: "Build at light speed with Quick Build (2 clicks), Exact Build (all 290+ items), and pinned God tools in the Top-Right Quick Menu.",
      tip: "Switch the Top-Right Quick Menu to Manual to pin Weather, Day/Night, Exact Build, and Bulk Select right under your thumb.",
      watchOut: "Multi-tile roads & bridges preview first — tap the green checkmark to place or tap anywhere else to cancel.",
      checklist: [
        "Tap empty ground to test Smart Build, then try Quick Build & Exact Build",
        "Open the Top-Right Quick Menu and tap the sliders icon to test Manual mode",
        "Drag a road next to buildings and notice automatic linking with zero wiring",
      ],
    },
    real: {
      goal: "Cut menu time to 2–3 clicks with Smart Build while keeping your live treasury safe.",
      tip: "Smart Build automatically surfaces unlocked buildings that solve your active city bottleneck and fit your nearby roads.",
      watchOut: "After placing with a Quick Menu, Quick Edit opens right away so you can rotate, swap styles, or undo immediately.",
      checklist: [
        "Place a road & house using Smart Build (3 clicks)",
        "Adjust simulation speed (Pause / 1× / 2× / 4×) inside the Top-Right Quick Menu",
        "Customize Quick Edit button order in More → Settings → Quick Menus",
      ],
    },
    survival: {
      goal: "Pin emergency overlays, Repair All, and Speed Pause into your Top-Right Quick Menu for instant crisis response.",
      tip: "Switch Top-Right Quick Menu to Manual or let Adaptive learn your Fire/Power map and Repair All habits.",
      watchOut: "When a building catches fire or degrades, emergency actions jump to the front of Quick Edit automatically.",
      checklist: [
        "Test Bulk Select from the Top-Right Quick Menu",
        "Pin or use Power/Safety layers and Repair All from the Quick Menu",
        "Use compact 1/3-height sheets so you never lose sight of emergencies",
      ],
    },
    idle: {
      goal: "Curate a hands-free observation toolkit in the Top-Right Quick Menu (Speed, 360° Spin, Recenter, Map Layers, Pix Advisor).",
      tip: "Switch the Top-Right Quick Menu to Manual in Idle mode to pin your favorite camera and overlay shortcuts.",
      watchOut: "Manual build menus stay hidden in Idle mode, while Quick Edit & compact floating sheets work anytime.",
      checklist: [
        "Open the Top-Right Quick Menu and toggle Manual customization",
        "Pin Simulation Speed, Orbit Spin, and a Map Layer",
        "Tap any building to inspect it inside a compact floating Inspector sheet",
      ],
    },
    manager: {
      goal: "Pair Manager Decision Cards with quick style swaps in Quick Edit and pinned executive shortcuts in the Top-Right Quick Menu.",
      tip: "Keep City Issues, Pix Advisor, and Speed pinned in the Top-Right Quick Menu to evaluate proposals fast.",
      watchOut: "Tap any building between Decision Cards to open Quick Edit and swap its visual variant freely.",
      checklist: [
        "Customize your Top-Right Quick Menu for Manager mode",
        "Use Quick Edit to swap a building's visual style variant",
        "Check City stats in the compact 1/3-height floating sheet before deciding",
      ],
    },
  },
  interface: {
    god: {
      goal: "Master fast camera orbit, Lv 1–5 brushes, Quick Edit, and compact floating sheets.",
      tip: "Use Exact Build or Build sheet with the Lv 1–5 selector to drop fully upgraded landmarks immediately at $0 cost.",
      watchOut: "Right-drag orbits and Space+drag pans even while a build brush is active.",
      checklist: [
        "Open Build and test placing a Level 3 landmark",
        "Tap a placed building to open Quick Edit",
        "Try Swap Variant and Rotate on Quick Edit",
      ],
    },
    real: {
      goal: "Build cleanly with minimal misclicks to protect your Stage 1 treasury.",
      tip: "Use Smart Build (3 clicks) or Smart placement mode so multi-tile roads preview before confirming while buildings place once.",
      watchOut: "Tap Ctrl+Z or Undo on Quick Edit if you misplace a pricey structure.",
      checklist: [
        "Lay a road segment and confirm with the floating checkmark",
        "Check your treasury & limiting need in compact City sheet",
        "Tap any building and open ••• to read its growth needs",
      ],
    },
    survival: {
      goal: "Use Quick Edit and the Top-Right Quick Menu for rapid emergency repairs and fire dispatch.",
      tip: "When a building catches fire or enters disrepair, emergency icons jump to the top of Quick Edit.",
      watchOut: "Leaving damaged utilities unaddressed can trigger cascading power or water blackouts.",
      checklist: [
        "Open Layers → Fire to check coverage gaps",
        "Inspect Auto-Maintain inside City",
        "Practice zooming straight to alerts from City → Issues",
      ],
    },
    idle: {
      goal: "Navigate your autonomous island smoothly using compact floating menus and the Top-Right Quick Menu.",
      tip: "Tap any structure the planner builds to inspect its stats, level, and connectivity.",
      watchOut: "Use Pause inside the Top-Right Quick Menu or Idle banner if you want to study a busy district closely.",
      checklist: [
        "Orbit and zoom across your growing town",
        "Tap a building to inspect its live stats",
        "Toggle Layers to watch utility coverage expand",
      ],
    },
    manager: {
      goal: "Use camera controls, Top-Right Quick Menu shortcuts, and Quick Edit styling between Decision Cards.",
      tip: "Between briefs, tap any building and hit Swap Visual Variant on Quick Edit to curate your island's architecture.",
      watchOut: "Check the slim top HUD (people, cash, happiness) before approving expensive proposals.",
      checklist: [
        "Review your first Manager Decision Card",
        "Swap a building's visual variant from Quick Edit",
        "Open City to verify reserves before major projects",
      ],
    },
  },
  city: {
    god: {
      goal: "Experiment with city dynamics, hold economic sliders, and test high-density skylines.",
      tip: "In God mode, open City to pin treasury or test how tax rates and synergies reshape population.",
      watchOut: "Remember that Crime stays off in God mode unless you toggle it on under More → God tools.",
      checklist: [
        "Inspect Supply vs Demand in City",
        "Check the Land Value layer around parks and shops",
        "Compare Day vs Night lighting on commercial districts",
      ],
    },
    real: {
      goal: "Keep Supply ahead of Demand so population grows smoothly toward the next Stage.",
      tip: "Watch the single 'Limiting Need' readout in City — solving that one bottleneck unlocks immediate growth.",
      watchOut: "Raising taxes too high stalls immigration and drops happiness below growth thresholds.",
      checklist: [
        "Balance Housing, Jobs, Food, Power, Water, and Waste",
        "Keep Taxes moderate while climbing Stages 1–5",
        "Prepare Police coverage as you approach Stage 5",
      ],
    },
    survival: {
      goal: "Maintain strict utility surpluses and cash reserves to survive emergencies.",
      tip: "Aim for +20% surplus on Power, Water, and Food before expanding housing density.",
      watchOut: "Prolonged shortages or bankrupt treasuries cause population flight and eventual collapse.",
      checklist: [
        "Verify positive net cash flow in City → Money",
        "Keep Fire coverage over every residential cluster",
        "Enable Auto-Maintain once daily income easily covers it",
      ],
    },
    idle: {
      goal: "Observe how the algorithmic planner resolves shortages automatically.",
      tip: "Open City → Issues to watch which need the planner is about to satisfy next.",
      watchOut: "Speeding up to 4× via the Top-Right Quick Menu lets you watch multiple stages unfold quickly.",
      checklist: [
        "Watch the stage counter climb from Village upward",
        "Check how net income grows as shops come online",
        "Open Advise with Pix for a live city health summary",
      ],
    },
    manager: {
      goal: "Balance rapid expansion against utility stability when choosing proposals.",
      tip: "When City flags a shortage, prioritize utility or food proposals on your next Decision Card.",
      watchOut: "Saying yes to luxury landmarks while power or water is tight will temporarily stall growth.",
      checklist: [
        "Check Limiting Need before approving new housing",
        "Approve a commercial or bakery district to boost tax revenue",
        "Watch happiness rise as parks and services join the grid",
      ],
    },
  },
  safety_military: {
    god: {
      goal: "Design grand naval harbors, stealth air bases, and active sky/sea patrol corridors.",
      tip: "Combine B-52 Bomber Wings, B-2 Stealth Bases, Naval Destroyer Piers, and Police Helipads to fill sky and sea with live patrols.",
      watchOut: "Naval bases need coastal or open water; helipads and air bases sit on flat land with road access.",
      checklist: [
        "Place a Police or Fire Helipad and watch its helicopter lift off",
        "Build a B-52 or B-2 Air Force base and spot a flyover",
        "Place a Naval Destroyer Pier or Coastal Rescue Station on the coast",
      ],
    },
    real: {
      goal: "Phase in Police at Stage 5 and National Defense from Stage 10 without draining your budget.",
      tip: "Start with compact Police Precincts and Fire Substations, then upgrade to Helipads and Naval/Air bases as tax revenue surges.",
      watchOut: "Military bases carry steady upkeep — pair them with strong commercial strips.",
      checklist: [
        "Place Police Precincts right as Stage 5 unlocks",
        "Cover dense blocks with Fire Rescue Substations",
        "Build Army, Navy, or Air Force bases from Stage 10 onward",
      ],
    },
    survival: {
      goal: "Exceed required Defense Power before raids arrive and keep fire helicopters ready.",
      tip: "Fire Helipads actively dispatch helicopters to fires across the island, saving blocks during multi-fire emergencies.",
      watchOut: "Check More → View → Defense regularly so your defense rating stays comfortably in the green.",
      checklist: [
        "Achieve 100% Fire coverage across core housing",
        "Add a Fire Helipad or Emergency Dispatch 911",
        "Stack Naval, Air Force, and Army bases past Stage 10",
      ],
    },
    idle: {
      goal: "Watch autonomous patrols come alive as your island reaches Stages 5 and 10+.",
      tip: "Once the planner hits Stage 10+, zoom out slightly to watch aircraft flyovers and coastal patrol ships.",
      watchOut: "Tap any military or police base to see its live defense or coverage contribution.",
      checklist: [
        "Track Police coverage on Layers → Police after Stage 5",
        "Spot active helicopters patrolling overhead",
        "Spot naval cutters & destroyers patrolling the bay",
      ],
    },
    manager: {
      goal: "Approve safety and military proposals at key stage milestones to keep citizens secure.",
      tip: "Pick Helipads or Coastal Rescue when offered — they provide wide coverage and dynamic patrols.",
      watchOut: "Don't defer fire or defense briefs too many times in a row when population climbs fast.",
      checklist: [
        "Approve a safety or rescue proposal on a Decision Card",
        "Inspect Police/Fire coverage via Layers",
        "Customize a base's visual variant with Quick Edit",
      ],
    },
  },
};

export function getModeChapterBrief(chapterId: string, mode: GameMode): ChapterModeBrief {
  const custom = CHAPTER_MODE_OVERRIDES[chapterId]?.[mode];
  if (custom) return custom;

  switch (mode) {
    case "god":
      return {
        goal: "Test these mechanics freely with zero cost, full terrain tools, and Lv 1–5 brushes.",
        tip: "Try combining this chapter's elements with PixBuilder World Sculpting or God Tools clock/weather controls.",
        watchOut: "Roads auto-link to every adjacent building automatically — even in God mode.",
        checklist: [
          "Try placing one featured element from this chapter at Lv 3–5",
          "Inspect its neighbor connections on the Connections layer",
          "Orbit close in 3D to enjoy day and night details",
        ],
      };
    case "real":
      return {
        goal: "Apply these mechanics efficiently on a live budget to accelerate Stage 1 → Stage 20 growth.",
        tip: "Place compact Starter and early-stage versions first via Smart Build, then upgrade in place via Quick Edit once tax revenue is steady.",
        watchOut: "Place new structures beside any road tile so they auto-link immediately.",
        checklist: [
          "Verify treasury can cover construction plus upkeep",
          "Place each new site adjacent to your road network (auto-links)",
          "Check City → Goals to track your next stage unlock",
        ],
      };
    case "survival":
      return {
        goal: "Use these systems to harden resilience, protect reserves, and prevent collapse.",
        tip: "Favor redundant power, water, food, and fire networks over single huge facilities.",
        watchOut: "Keep an emergency cash cushion before expanding into high-upkeep infrastructure.",
        checklist: [
          "Check Layers to verify zero coverage blind spots",
          "Keep every critical utility repaired and adjacent to a road",
          "Save a backup slot in More → Saves before major expansions",
        ],
      };
    case "idle":
      return {
        goal: "Understand how your autonomous city uses these systems as it evolves on its own.",
        tip: "Open compact Layers while watching to see live traffic, power, water, and neighbor synergies update.",
        watchOut: "Use speed controls (Pause / 1× / 2× / 4×) in the Top-Right Quick Menu whenever you want to inspect details.",
        checklist: [
          "Watch how roads and bridges connect new districts automatically",
          "Tap any featured building to read its live stats",
          "Ask Pix Advisor for an instant progress summary",
        ],
      };
    case "manager":
      return {
        goal: "Use this chapter's insights to pick the highest-impact choice on Manager Decision Cards.",
        tip: "Balance immediate citizen needs (food, power, water, safety) with long-term landmarks and commerce.",
        watchOut: "Remember you can tap any placed building anytime to open Quick Edit and swap its visual style variant.",
        checklist: [
          "Check compact City stats before answering your next Decision Card",
          "Choose options that align with your next Stage milestone",
          "Customize building visual variants to match your district theme",
        ],
      };
  }
}
