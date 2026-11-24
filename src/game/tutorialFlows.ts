import type { GameMode } from "./catalog";
import type { NavSheet } from "../components/BottomNav";

export type TutorialEventKind =
  | "open_build"
  | "place_item"
  | "select_element"
  | "open_inspector"
  | "open_layers"
  | "pick_layer"
  | "open_city"
  | "open_transit"
  | "open_more";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  demoHint: string;
  /** Which bottom navigation buttons are revealed at this step. */
  visibleNav: NavSheet[];
  /** Whether the top HUD status bar is revealed at this step. */
  showHud: boolean;
  /** Which menu button (if any) pulses with a focus ring until opened. */
  highlightNav?: NavSheet;
  /** Event kinds that satisfy this step's interactive demo. */
  completeOn: TutorialEventKind[];
}

export const MODE_TUTORIAL_LABELS: Record<GameMode, string> = {
  god: "God Mode",
  real: "Real Mode",
  survival: "Survival Mode",
  idle: "Idle Mode",
  manager: "Manager Mode",
};

export const TUTORIAL_FLOWS: Record<GameMode, TutorialStep[]> = {
  god: [
    {
      id: "god-build",
      title: "Build freely at any level",
      body: "In God mode every stage, landmark, and level is unlocked for free. Tap Build below, pick any element, adjust Lv 1–5 in the bar, and place it on the island.",
      demoHint: "Demo: Open Build and place any element on the island",
      visibleNav: ["build"],
      showHud: false,
      highlightNav: "build",
      completeOn: ["place_item"],
    },
    {
      id: "god-select",
      title: "Floating Selection Ring",
      body: "Tap any placed structure to bloom its circular ring right around it. Rotate, swap visual styles, upgrade, undo, or tap ••• for site overrides.",
      demoHint: "Demo: Tap a placed element on the island",
      visibleNav: ["build"],
      showHud: false,
      completeOn: ["select_element", "open_inspector"],
    },
    {
      id: "god-layers",
      title: "Inspect with Map Layers",
      body: "Layers just unlocked! Open Layers to visualize Power, Water, Land Value, Traffic, Fire, or Police coverage across your island.",
      demoHint: "Demo: Open Layers and pick any overlay",
      visibleNav: ["build", "layers"],
      showHud: false,
      highlightNav: "layers",
      completeOn: ["pick_layer"],
    },
    {
      id: "god-city",
      title: "City Dashboard & Sandbox Values",
      body: "Your top HUD and City menu are now live. Open City to inspect People, Money, Goals, and hold live economic values in God mode.",
      demoHint: "Demo: Open the City menu",
      visibleNav: ["build", "layers", "city"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_city"],
    },
    {
      id: "god-transit",
      title: "Transit, Ferries & Railways",
      body: "Transit lives right inside City! Open City and tap the Transit tab to inspect bus lines, dispatch boats across water, or manage rail corridors.",
      demoHint: "Demo: Open City → Transit",
      visibleNav: ["build", "layers", "city", "sculpt"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_transit"],
    },
    {
      id: "god-more",
      title: "Weather, Time, Crime & 3D Atlas",
      body: "All menus are now unlocked! Open More (…) to control weather, time of day, toggle crime in View, explore the searchable 3D Atlas & Handbook, or open PixBuilder.",
      demoHint: "Demo: Open More (…) to finish the God mode tour",
      visibleNav: ["build", "layers", "city", "sculpt", "more"],
      showHud: true,
      highlightNav: "more",
      completeOn: ["open_more"],
    },
  ],
  real: [
    {
      id: "real-build",
      title: "Lay your Stage 1 foundations",
      body: "Real mode grows your island from Village to Stage 20 on a live treasury. Open Build and place a road, house, farm, or utility from Starter 10.",
      demoHint: "Demo: Open Build and place an element on the island",
      visibleNav: ["build"],
      showHud: true,
      highlightNav: "build",
      completeOn: ["place_item"],
    },
    {
      id: "real-select",
      title: "Check Needs & Growth",
      body: "Tap any building to open its Selection Ring, then tap ••• to see road access, element-specific stats, and what it needs to level up.",
      demoHint: "Demo: Tap a placed building on the island",
      visibleNav: ["build"],
      showHud: true,
      completeOn: ["select_element", "open_inspector"],
    },
    {
      id: "real-city",
      title: "Treasury, Taxes & Stage Goals",
      body: "City just unlocked! Open City to watch Issues, adjust your tax rate, check Supply vs Demand, and track population toward Stage 2. Crime stays off until Police unlock at Stage 5.",
      demoHint: "Demo: Open the City menu",
      visibleNav: ["build", "city"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_city"],
    },
    {
      id: "real-layers",
      title: "Spot Bottlenecks with Layers",
      body: "Layers just unlocked! Open Layers and choose Power, Water, Traffic, or Fire coverage to see where your town needs upgrades.",
      demoHint: "Demo: Open Layers and pick an overlay",
      visibleNav: ["build", "layers", "city"],
      showHud: true,
      highlightNav: "layers",
      completeOn: ["pick_layer"],
    },
    {
      id: "real-transit",
      title: "Connect Workers & Food",
      body: "Transit is right inside City! Open City → Transit to inspect routes moving residents, food harvests, and freight across neighborhoods.",
      demoHint: "Demo: Open City → Transit",
      visibleNav: ["build", "layers", "city", "sculpt"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_transit"],
    },
    {
      id: "real-more",
      title: "3D Atlas, Saves & PixBuilder",
      body: "All menus are now unlocked! Open More (…) to browse the searchable 3D Atlas & Playbook, open PixBuilder, save your city, or visit example islands.",
      demoHint: "Demo: Open More (…) to finish the Real mode tour",
      visibleNav: ["build", "layers", "city", "sculpt", "more"],
      showHud: true,
      highlightNav: "more",
      completeOn: ["open_more"],
    },
  ],
  survival: [
    {
      id: "surv-build",
      title: "Build Resilient Essentials",
      body: "Track happiness and population. Roads, homes and public services use your construction budget. Businesses are free to open and create jobs and tax revenue. Place a road or home to begin.",
      demoHint: "Demo: Open Build and place an element on the island",
      visibleNav: ["build"],
      showHud: true,
      highlightNav: "build",
      completeOn: ["place_item"],
    },
    {
      id: "surv-select",
      title: "Direct Repair & Emergency Ring",
      body: "Tap a building marked for maintenance to service it for free. Fires need a fire crew, which you can dispatch from the Selection Ring.",
      demoHint: "Demo: Tap a placed building on the island",
      visibleNav: ["build"],
      showHud: true,
      completeOn: ["select_element", "open_inspector"],
    },
    {
      id: "surv-city",
      title: "Shortages, Auto-Maintain & Safety",
      body: "Open City to see what is limiting growth, check the next maintenance deadline and choose free auto-maintenance for essential utilities or all buildings.",
      demoHint: "Demo: Open the City menu",
      visibleNav: ["build", "city"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_city"],
    },
    {
      id: "surv-layers",
      title: "Audit Fire & Utility Coverage",
      body: "Layers just unlocked! Open Layers and switch on Fire or Power coverage so no neighborhood is left exposed.",
      demoHint: "Demo: Open Layers and pick a coverage layer",
      visibleNav: ["build", "layers", "city"],
      showHud: true,
      highlightNav: "layers",
      completeOn: ["pick_layer"],
    },
    {
      id: "surv-transit",
      title: "Keep Emergency Corridors Open",
      body: "Fire crews, police, and food deliveries all travel connected routes. Open City → Transit to inspect active lines.",
      demoHint: "Demo: Open City → Transit",
      visibleNav: ["build", "layers", "city", "sculpt"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_transit"],
    },
    {
      id: "surv-more",
      title: "Defense, Saves & Tutorial Controls",
      body: "All menus are now unlocked! Open More (…) to monitor Defense in View, back up your survival run in Saves, or open Settings to replay any tutorial.",
      demoHint: "Demo: Open More (…) to complete the Survival tour",
      visibleNav: ["build", "layers", "city", "sculpt", "more"],
      showHud: true,
      highlightNav: "more",
      completeOn: ["open_more"],
    },
  ],
  idle: [
    {
      id: "idle-watch",
      title: "Watch Your Island Grow Automatically",
      body: "In Idle mode, the algorithmic city planner lays connected roads, bridges, homes, utilities, shops, safety bases, and landmarks from Stage 1 to Stage 20 while you watch.",
      demoHint: "Demo: Tap any placed structure on the island to inspect its live stats",
      visibleNav: ["layers", "city"],
      showHud: true,
      completeOn: ["select_element", "open_inspector"],
    },
    {
      id: "idle-layers",
      title: "Inspect Live Overlays",
      body: "You stay completely hands-off while watching, panning, orbiting, and zooming. Open Layers to watch Power, Water, Traffic, and Safety coverage expand in real time.",
      demoHint: "Demo: Open Layers and choose any map overlay",
      visibleNav: ["layers", "city"],
      showHud: true,
      highlightNav: "layers",
      completeOn: ["pick_layer"],
    },
    {
      id: "idle-city",
      title: "Track Growth & Milestones",
      body: "Open City to track population, treasury, supply vs demand, and stage advancement as your autonomous civilization matures.",
      demoHint: "Demo: Open the City menu",
      visibleNav: ["layers", "city", "sculpt"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_city"],
    },
    {
      id: "idle-more",
      title: "Switch Modes, Atlas & Pix Advisor",
      body: "Open More (…) to browse the 3D Atlas & Playbook, switch to Manager or God mode anytime, or ask Pix for live analysis.",
      demoHint: "Demo: Open More (…) to finish the Idle mode tour",
      visibleNav: ["build", "layers", "city", "sculpt", "more"],
      showHud: true,
      highlightNav: "more",
      completeOn: ["open_more"],
    },
  ],
  manager: [
    {
      id: "mgr-decide",
      title: "Lead Through Executive Decisions",
      body: "In Manager mode, the algorithmic planner builds roads and districts automatically, then brings you Yes/No and multi-option briefs for key sites, shortages, and projects.",
      demoHint: "Demo: Tap any building on the island to inspect it or swap its visual style",
      visibleNav: ["layers", "city"],
      showHud: true,
      completeOn: ["select_element", "open_inspector"],
    },
    {
      id: "mgr-city",
      title: "Monitor Reserves Before You Say Yes",
      body: "Open City to inspect treasury, food, power, and safety needs so you can pick the smartest option on each briefing card.",
      demoHint: "Demo: Open the City menu",
      visibleNav: ["layers", "city", "sculpt"],
      showHud: true,
      highlightNav: "city",
      completeOn: ["open_city"],
    },
    {
      id: "mgr-layers",
      title: "Audit Coverage Across Districts",
      body: "Open Layers to see where the planner should focus fire, police, water, or transit next.",
      demoHint: "Demo: Open Layers and pick an overlay",
      visibleNav: ["layers", "city", "sculpt"],
      showHud: true,
      highlightNav: "layers",
      completeOn: ["pick_layer"],
    },
    {
      id: "mgr-more",
      title: "Playbook, Saves & PixBuilder",
      body: "All menus are unlocked! Open More (…) to read the Manager Playbook, save your campaign, or consult Pix for strategic advice.",
      demoHint: "Demo: Open More (…) to finish the Manager mode tour",
      visibleNav: ["build", "layers", "city", "sculpt", "more"],
      showHud: true,
      highlightNav: "more",
      completeOn: ["open_more"],
    },
  ],
};
