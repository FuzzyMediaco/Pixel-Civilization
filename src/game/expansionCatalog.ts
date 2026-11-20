import type { CivElementDef } from "./catalog";

/** New elements retain the existing five-step art and simulation progression. */
export const EXPANSION_ELEMENTS: CivElementDef[] = [
  // Education: each school is separately placeable and has a distinct campus silhouette.
  { id: "preschool", name: "Preschool & Daycare", category: "civic_parks", isStarter: true, stage: 1, cost: 75, archetype: "school_campus", domain: "land", education: 30, recreation: 14, jobs: 5, water: -1, power: -1, accentHex: "#efae63", needsMaintenance: true, description: "Colorful classrooms, slides, sandbox and a fenced yard. Family-friendly early education." },
  { id: "country_schoolhouse", name: "Country Schoolhouse", category: "civic_parks", isStarter: true, stage: 1, cost: 65, archetype: "school_campus", domain: "land", education: 40, jobs: 4, water: -1, accentHex: "#e9d7bb", needsMaintenance: true, description: "Affordable one-room rural school with bell tower, porch and country garden." },
  { id: "elementary_school", name: "Elementary School", category: "civic_parks", stage: 2, cost: 155, archetype: "school_campus", domain: "land", education: 90, jobs: 16, recreation: 18, water: -2, power: -2, needsMaintenance: true, accentHex: "#d28762", description: "Neighborhood school with classrooms, playground and a yellow bus loop." },
  { id: "middle_school", name: "Middle School", category: "civic_parks", stage: 3, cost: 230, archetype: "school_campus", domain: "land", education: 135, recreation: 38, jobs: 28, water: -3, power: -4, needsMaintenance: true, accentHex: "#b87152", description: "Two-story campus with outdoor basketball courts, gymnasium and bike racks." },
  { id: "high_school", name: "High School", category: "civic_parks", stage: 4, cost: 360, archetype: "school_campus", domain: "land", education: 210, recreation: 60, jobs: 46, water: -5, power: -6, needsMaintenance: true, baseSpan: [2, 2], accentHex: "#bd714b", description: "Large high school with track, football field, bus entrance and gym." },
  { id: "trade_school", name: "Trade & Technical College", category: "civic_parks", stage: 5, cost: 420, archetype: "school_campus", domain: "land", education: 240, jobs: 48, power: -8, water: -3, needsMaintenance: true, baseSpan: [2, 1], accentHex: "#e2a145", description: "Workshops and vocational labs train skilled workers and improve industrial jobs." },
  { id: "community_college", name: "Community College", category: "civic_parks", stage: 6, cost: 480, archetype: "school_campus", domain: "land", education: 320, jobs: 58, income: 24, power: -9, water: -5, needsMaintenance: true, baseSpan: [2, 1], accentHex: "#66b8b8", description: "Open-access modern campus with a library, green courtyard and classrooms." },
  { id: "university", name: "University", category: "civic_parks", stage: 8, cost: 880, archetype: "school_campus", domain: "land", education: 620, recreation: 100, jobs: 125, income: 80, power: -17, water: -12, needsMaintenance: true, baseSpan: [2, 2], accentHex: "#c9ac80", description: "Collegiate quad, landmark clock tower, dormitories and a research library." },
  { id: "research_university", name: "Research University", category: "civic_parks", stage: 15, cost: 1550, archetype: "school_campus", domain: "land", education: 1050, jobs: 220, income: 150, power: -30, water: -15, needsMaintenance: true, baseSpan: [2, 2], accentHex: "#73cdd0", description: "Advanced glass laboratories, observatory and research towers supporting high-tech growth." },

  // Modular campus pieces; each may stand independently but forms a district when adjacent.
  { id: "sports_field", name: "School Sports Field", category: "civic_parks", stage: 4, cost: 190, archetype: "park_green", domain: "land", recreation: 110, jobs: 15, water: -2, baseSpan: [2, 1], accentHex: "#60a86b", description: "Football/soccer field with running track, bleachers and stadium lights. Beside a high school: Athletic Campus." },
  { id: "research_institute", name: "Research Institute", category: "civic_parks", stage: 12, cost: 690, archetype: "school_campus", domain: "land", education: 295, jobs: 95, income: 125, power: -18, water: -8, baseSpan: [2, 1], accentHex: "#6daec5", description: "Scientific laboratories, telescope dome and glass atrium. Beside a university: Innovation District." },

  // Distinct rural farm anchors: field modules connect through any anchor below.
  { id: "vegetable_farm", name: "Vegetable Farm", category: "agriculture", stage: 2, cost: 90, archetype: "farm_field", domain: "land", food: 145, jobs: 17, income: 18, water: -4, accentHex: "#80c954", description: "Pumpkins, tomatoes, carrots and fresh produce on irrigated beds." },
  { id: "grain_farm", name: "Grain Farm", category: "agriculture", stage: 2, cost: 100, archetype: "farm_field", domain: "land", food: 170, jobs: 19, income: 18, water: -3, accentHex: "#e8c65f", description: "Golden grain fields, silos, combine and stacked hay bales." },
  { id: "dairy_farm", name: "Dairy Farm", category: "agriculture", stage: 3, cost: 155, archetype: "barn_farmhouse", domain: "land", food: 195, jobs: 28, income: 29, water: -5, accentHex: "#db5144", description: "Milk production with red barns, grazing cows, silos and a delivery truck." },
  { id: "poultry_farm", name: "Poultry Farm", category: "agriculture", stage: 3, cost: 125, archetype: "barn_farmhouse", domain: "land", food: 165, jobs: 21, income: 23, water: -2, accentHex: "#eebc77", description: "Chicken coops, feed bins, shaded pens and egg distribution." },
  { id: "cattle_ranch", name: "Cattle Ranch", category: "agriculture", stage: 4, cost: 185, archetype: "barn_farmhouse", domain: "land", food: 210, jobs: 35, income: 36, water: -6, baseSpan: [2, 1], accentHex: "#b68d63", description: "Wide cattle paddocks, ranch house, feed stations and grazing herds." },
  { id: "horse_ranch", name: "Horse Ranch", category: "agriculture", stage: 4, cost: 165, archetype: "barn_farmhouse", domain: "land", food: 25, recreation: 85, jobs: 26, income: 48, water: -4, baseSpan: [2, 1], accentHex: "#b98c5b", description: "Stables, paddocks and riding arenas that create jobs and recreation." },
  { id: "apiary", name: "Honey & Bee Farm", category: "agriculture", stage: 4, cost: 100, archetype: "farm_field", domain: "land", food: 95, jobs: 13, income: 28, water: -1, accentHex: "#ecbf37", description: "Beehives, flowering meadows, honey processing and pollination." },
  { id: "vineyard", name: "Vineyard", category: "agriculture", stage: 5, cost: 180, archetype: "orchard_grove", domain: "land", food: 120, recreation: 40, jobs: 30, income: 70, water: -3, baseSpan: [2, 1], accentHex: "#96568e", description: "Trellised grapes, stone paths and a Mediterranean winery." },
  { id: "rice_farm", name: "Rice Farm", category: "agriculture", stage: 6, cost: 190, archetype: "farm_field", domain: "land", food: 240, jobs: 40, income: 34, water: -11, baseSpan: [2, 1], accentHex: "#6fbd64", description: "Reflective rice paddies, raised earth paths and irrigation wheels." },
  { id: "greenhouse_farm", name: "Greenhouse Farm", category: "agriculture", stage: 7, cost: 245, archetype: "farm_field", domain: "land", food: 310, jobs: 36, income: 52, water: -5, power: -8, baseSpan: [2, 1], accentHex: "#8ccfbd", description: "Glass tunnels, glowing grow lamps and reliable all-weather yields." },
  { id: "vertical_farm", name: "Vertical Farm", category: "agriculture", stage: 15, cost: 860, archetype: "factory_mill", domain: "land", food: 780, jobs: 95, income: 145, water: -9, power: -35, baseSpan: [1, 1], accentHex: "#49bb98", description: "Multi-level indoor greenhouses on a compact urban lot." },

  // Modular field, livestock, and utility pieces form one connected farm without individual road access.
  { id: "vegetable_fields", name: "Vegetable Field", category: "agriculture", stage: 2, cost: 34, archetype: "farm_field", domain: "land", food: 85, jobs: 4, water: -1, accentHex: "#80bd59", description: "Connect adjacent crop beds to a farm anchor; fields also relay connection to one another." },
  { id: "grain_fields", name: "Grain Field", category: "agriculture", stage: 2, cost: 34, archetype: "farm_field", domain: "land", food: 95, jobs: 4, water: -1, accentHex: "#e2c25a", description: "Golden wheat rows link to farms and other agricultural modules." },
  { id: "orchard_block", name: "Orchard Block", category: "agriculture", stage: 3, cost: 48, archetype: "orchard_grove", domain: "land", food: 100, jobs: 5, water: -1, accentHex: "#b8d55c", description: "Additional fruit trees automatically join a neighboring agricultural operation." },
  { id: "grazing_pasture", name: "Grazing Pasture", category: "agriculture", stage: 3, cost: 38, archetype: "farm_field", domain: "land", food: 70, jobs: 4, water: -1, recreation: 4, accentHex: "#70b95f", description: "Fenced grassland with livestock; can connect through other pasture pieces." },
  { id: "livestock_pen", name: "Livestock Pen", category: "agriculture", stage: 3, cost: 48, archetype: "barn_farmhouse", domain: "land", food: 105, jobs: 8, water: -2, accentHex: "#bd9268", description: "Cows and feed troughs in a fenced paddock, connected through farm modules." },
  { id: "chicken_coop", name: "Chicken Coop", category: "agriculture", stage: 3, cost: 39, archetype: "barn_farmhouse", domain: "land", food: 90, jobs: 5, water: -1, accentHex: "#d9ad70", description: "Roaming chickens, feed bins and a tiny coop near an anchor farm." },
  { id: "feed_silo", name: "Feed Silo", category: "agriculture", stage: 4, cost: 55, archetype: "barn_farmhouse", domain: "land", food: 20, jobs: 5, accentHex: "#c4c9b9", description: "Storage and feed support building connecting to neighboring fields and barns." },
  { id: "irrigation_pond", name: "Irrigation Pond", category: "agriculture", stage: 4, cost: 65, archetype: "farm_field", domain: "land", food: 30, jobs: 4, water: -2, recreation: 8, accentHex: "#5db6c7", description: "A little irrigation reservoir with bridges and green banks." },
  { id: "greenhouse_bay", name: "Greenhouse Bay", category: "agriculture", stage: 7, cost: 88, archetype: "farm_field", domain: "land", food: 180, jobs: 8, water: -2, power: -3, accentHex: "#84cbb5", description: "Expandable glazed growing tunnel that joins a farm complex." },
];

export const SCHOOL_IDS = new Set<string>([
  "school", "preschool", "country_schoolhouse", "elementary_school", "middle_school",
  "high_school", "trade_school", "community_college", "university", "research_university",
]);

export const FARM_ANCHOR_IDS = new Set<string>([
  "farms", "farm_houses", "plantations", "orchards", "groves_of_olives",
  "vegetable_farm", "grain_farm", "dairy_farm", "poultry_farm", "cattle_ranch",
  "horse_ranch", "apiary", "vineyard", "rice_farm", "greenhouse_farm", "vertical_farm",
]);

export const FARM_MODULE_IDS = new Set<string>([
  "fields", "vegetable_fields", "grain_fields", "orchard_block",
  "grazing_pasture", "livestock_pen", "chicken_coop", "feed_silo",
  "irrigation_pond", "greenhouse_bay",
]);
