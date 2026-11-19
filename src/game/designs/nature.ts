import { defineDesigns, type DesignEntry } from "./registry";
import { broadleaf, conifers, redwoods, flowers, topiaries, brambles } from "./woodland";
import { hills, mountains, canyons, deserts, tumbleweeds } from "./landforms";
import { ponds, lakes, swamps, alligators, beaches, umbrellas, sandArt } from "./wetlands";

type Footprints = DesignEntry["footprints"];
const treeLot: Footprints = [
  [1, 1],
  [1, 1],
  [1, 1],
  [2, 2],
  [2, 2],
];
const garden: Footprints = [
  [1, 1],
  [1, 1],
  [2, 1],
  [2, 2],
  [2, 2],
];
const landscape: Footprints = [
  [2, 2],
  [2, 2],
  [3, 2],
  [3, 3],
  [4, 3],
];

defineDesigns({
  trees: {
    footprints: treeLot,
    build: broadleaf,
    levels: ["Sapling", "Forked Young Tree", "Shade Canopy", "Wayside Veteran", "Swing Tree"],
    growth: "New branches spread into a shade canopy above a path, a bench and a rope swing.",
  },
  pine_trees: {
    footprints: treeLot,
    build: conifers,
    levels: ["Pine Seedling", "Young Evergreen", "Two Generations", "Pine Stand", "Old-Growth Copse"],
    growth: "A single evergreen develops its crown and shelters the next generation of trees.",
  },
  redwood_trees: {
    footprints: [
      [1, 1],
      [1, 1],
      [2, 2],
      [2, 2],
      [2, 2],
    ],
    build: redwoods,
    levels: ["Redwood Sprout", "Cinnamon Bark", "Buttressed Redwood", "Cathedral Grove", "Canopy Walk"],
    growth: "Buttress roots and high boughs carry the ancient giants above a timber observation walk.",
  },
  plants: {
    footprints: [
      [1, 1],
      [1, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    build: flowers,
    levels: ["First Bloom", "Flower Clump", "Wildflower Patch", "Flower Meadow", "Pollinator Reserve"],
    growth: "A first flower seeds a colourful meadow with a nesting shelter for its pollinators.",
  },
  shrubs: {
    footprints: garden,
    build: topiaries,
    levels: ["Potted Topiary", "Gate Pair", "Fountain Parterre", "Hedge Court", "Grand Topiary Garden"],
    growth: "Potted specimens frame a gate, then circle a formal fountain in a sculpted garden.",
  },
  bushes: {
    footprints: [
      [1, 1],
      [1, 1],
      [2, 1],
      [2, 1],
      [2, 2],
    ],
    build: brambles,
    levels: ["Lone Bush", "Berry Cluster", "Hedgerow", "Picking Patch", "Wildlife Thicket"],
    growth: "Fruiting canes and flower clusters knit into a thicket shared by pickers and wildlife.",
  },
  ponds: {
    footprints: garden,
    build: ponds,
    levels: ["Pocket Pool", "Reed Pond", "Shaded Pond", "Garden Landing", "Cascade Garden"],
    growth: "Living shallows gain a shade tree, a small landing and a rock cascade.",
  },
  lakes: {
    footprints: [
      [2, 2],
      [3, 2],
      [3, 3],
      [4, 3],
      [4, 4],
    ],
    build: lakes,
    levels: ["Hidden Tarn", "Landing Lake", "Island Lake", "Boathouse Lake", "Beacon Lake"],
    growth: "Shorelines open around a wooded island, a boathouse, a sailboat and a navigation light.",
  },
  hills: {
    footprints: [
      [1, 1],
      [2, 1],
      [2, 2],
      [2, 2],
      [3, 2],
    ],
    build: hills,
    levels: ["Walking Knoll", "Grazing Hillock", "Ridge Trail", "Twin Hills", "Beacon Downs"],
    growth: "A footpath crosses rising shoulders, rocky crests and a hilltop waymarker.",
  },
  mountains: {
    footprints: [
      [2, 2],
      [2, 2],
      [3, 2],
      [3, 3],
      [4, 4],
    ],
    build: mountains,
    levels: ["Rocky Crest", "Twin Peaks", "Mountain Pass", "Refuge Ridge", "Summit Massif"],
    growth: "New crags rise around a forested pass, then a refuge and a flag on the highest summit.",
  },
  canyons: {
    footprints: landscape,
    build: canyons,
    levels: ["Gully", "Stratified Gorge", "Natural Arch", "Mesa Canyon", "Grand Canyon"],
    growth: "The river cuts through bands of stone, under a natural arch and past isolated hoodoos.",
  },
  deserts: {
    footprints: landscape,
    build: deserts,
    levels: ["Dry Wash", "Desert Flat", "Dune Country", "Palm Oasis", "Caravan Oasis"],
    growth: "Dunes and rock formations surround a watered hollow that attracts palms and a caravan.",
  },
  sand: {
    footprints: garden,
    build: sandArt,
    levels: ["Bucket Mound", "Twin Turrets", "Sand Keep", "Castle & Moat", "Sandcastle Fortress"],
    growth: "Hand-built sand towers gather walls, then a moat, drawbridge and a pennant.",
  },
  beaches: {
    footprints: [
      [1, 1],
      [2, 1],
      [2, 2],
      [3, 2],
      [3, 2],
    ],
    build: beaches,
    levels: ["Cove", "Picnic Shore", "Family Beach", "Beach Pier", "Beach Pavilion"],
    growth: "A cove welcomes towels, sunshades, a long pier and a little pavilion.",
  },
  beach_umbrellas: {
    footprints: garden,
    build: umbrellas,
    levels: ["Lone Parasol", "Parasol Pair", "Boardwalk Row", "Beach Club", "Lifeguard Lido"],
    growth: "Loungers and sunshades spread along a boardwalk with a raised lifeguard hut.",
  },
  tubbleweeds: {
    footprints: garden,
    build: tumbleweeds,
    levels: [
      "Lone Tumbleweed",
      "Drifting Pair",
      "Fence-Line Scrub",
      "Tumbleweed Prairie",
      "Windpump Prairie",
    ],
    growth: "Wind rolls open tangles of brush past a ranch fence and turns a prairie windpump.",
  },
  swamps: {
    footprints: landscape,
    build: swamps,
    levels: ["Marshy Hollow", "Heron Marsh", "Boardwalk Bog", "Misty Bayou", "Bayou Bird Hide"],
    growth: "Shallows fill with roots and reeds around a raised boardwalk and wildlife hide.",
  },
  alligators: {
    footprints: [
      [1, 1],
      [2, 1],
      [2, 2],
      [2, 2],
      [3, 2],
    ],
    build: alligators,
    levels: ["Hatchling", "Basking Gator", "Gator Nest", "Nursery Lagoon", "King Croc"],
    growth: "A hatchling grows, guards a mound of eggs and shares the lagoon with the next generation.",
  },
});
