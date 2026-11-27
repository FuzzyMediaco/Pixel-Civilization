import { BALANCED_EXPANSION_BY_ID } from "./expansionBalancedCatalog";
import type { ExpandedCivElement } from "./expansionSafetyMilitaryCommerce";
import type { LevelSpanTuple } from "./levelSpans";

const local: LevelSpanTuple = [[1,1],[2,1],[2,2],[3,2],[3,3]];
const campus: LevelSpanTuple = [[2,2],[2,2],[3,2],[3,3],[4,3]];
const landmark: LevelSpanTuple = [[2,2],[3,2],[3,3],[4,3],[4,4]];
const tower: LevelSpanTuple = [[2,2],[2,2],[3,3],[3,3],[4,4]];

export const SKYLINE_ELEMENTS: ExpandedCivElement[] = [
  {
    id:"borough_assembly", name:"Borough Assembly", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:3, cost:195, government:55, jobs:18, power:-2, water:-1, accentHex:"#b77547", footprints:local,
    description:"Residents take the floor in an open council chamber with rising timber benches.",
    levelNames:["Ward Meeting","Public Hearing Room","Delegates’ Chamber","Borough Forum","Grand Borough Assembly"],
    styleNames:["Open Circle","Opposition Benches","Fan Chamber","Twin Councils"],
    growth:"The dais gains public seating, committee rooms and illuminated galleries around the council floor.",
  },
  {
    id:"civic_records_archive", name:"Civic Records Archive", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:5, cost:330, government:105, education:18, jobs:26, power:-3, water:-2, accentHex:"#aa7857", footprints:local,
    description:"Deep bronze-edged record stacks preserve the city’s deeds, charters and maps.",
    levelNames:["Deed Office","Index Room","Municipal Stacks","Public Reading Archive","Hall of Records"],
    styleNames:["Index Drawers","Fanned Folios","Twin Cabinets","Stepped Repository"],
    growth:"New stacks rise above the registry, followed by a glazed reading room and a street-facing reading wing.",
  },
  {
    id:"city_planning_bureau", name:"City Planning Bureau", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:7, cost:510, government:155, jobs:38, power:-4, water:-2, accentHex:"#438993", footprints:campus,
    description:"Surveyors work above a walkable scale model of the island beneath an enormous drafting instrument.",
    levelNames:["Survey Office","Drafting Studio","Mapping Bureau","Metropolitan Planning Lab","City Planning Campus"],
    styleNames:["Surveyor’s Compass","Armillary Studio","Triangulation Lab","Meridian Ring"],
    growth:"The drafting wing adds survey floors, a larger city model and a high instrument over the public map court.",
  },
  {
    id:"public_works_directorate", name:"Public Works Directorate", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:10, cost:740, government:235, jobs:52, power:-6, water:-4, accentHex:"#528d83", footprints:campus,
    description:"Covered inspection lanes and staffed engineering offices administer public infrastructure.",
    levelNames:["Works Office","Inspection Yard","District Works Depot","Engineering Directorate","Metropolitan Works Hall"],
    styleNames:["Sawtooth Offices","Reservoir Vault","A-Frame Gantry","Wave Crane Hall"],
    growth:"More inspection bays fill the open shed as the engineering wing, reservoir or lifting gantry grows overhead.",
  },
  {
    id:"national_parliament", name:"National Parliament", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:16, cost:2250, government:460, jobs:78, recreation:42, power:-10, water:-6, accentHex:"#d2b66d", footprints:landmark,
    description:"Sweeping limestone chamber roofs gather around a glazed debating hall and a public stair.",
    levelNames:["Delegates’ Hall","Legislative Chamber","Assembly of Regions","Parliamentary Estate","National Parliament"],
    styleNames:["Twin Sails","Three Estates","Diagonal Chambers","Crown of Chambers"],
    growth:"Parliamentary wings rise and spread around the central skylight, ceremonial steps and garden forecourt.",
  },
  {
    id:"mega_skyscraper", name:"Mega-Skyscraper", category:"housing", domain:"land", archetype:"skyscraper",
    stage:20, cost:7800, popBase:1280, jobs:190, income:215, power:-35, water:-32, waste:-27, accentHex:"#498295", footprints:tower,
    description:"A vertical neighborhood whose occupied upper floors rise above the previous island height record.",
    levelNames:["High Observatory","Cloud District","Sky Borough","Stratosphere Quarter","Summit Metropolis"],
    styleNames:["Trihelix","Golden Escarpment","Meridian Gate","Orbital Spindle"],
    growth:"Sky clubs, occupied decks and higher crowns carry four very different supertalls above the existing skyline.",
  },
  {
    id:"supertree_grove", name:"Supertree Grove", category:"civic_parks", domain:"land", archetype:"park_green",
    stage:8, cost:690, recreation:155, education:24, jobs:15, power:-4, water:-3, accentHex:"#b46da5", footprints:landmark,
    description:"Singapore-inspired living towers flare into branching, illuminated crowns over a garden skywalk.",
    levelNames:["First Supertree","Twin Canopies","Canopy Walk","Lantern Grove","Supertree Gardens"],
    styleNames:["Orchid Chalices","Amber Rosettes","Jade Fans","Helix Crowns"],
    growth:"A single planted tower gains companions, elevated walks, forked canopy lights and a four-tree grove.",
  },
  {
    id:"guggenheim_bilbao", name:"Guggenheim Museum Bilbao", category:"landmarks", domain:"land", archetype:"landmark_smithsonian",
    stage:15, cost:2450, recreation:260, education:300, happinessBonus:2, jobs:56, income:65, power:-8, water:-5, accentHex:"#a4afb9", footprints:landmark,
    description:"Folded titanium galleries gather around a glazed atrium, reflecting pool and public sculpture court.",
    levelNames:["Atrium Gallery","River Galleries","Sculpture Court","Titanium Pavilion","Guggenheim Museum Bilbao"],
    styleNames:["River Ribbon","Titanium Bouquet","Bridge Gallery","Sculpture Court"],
    growth:"Curved metal wings unfold around the atrium. The public plaza gains water, sculpture and a teaching gallery.",
  },
];

export const SKYLINE_DESIGNS = [BALANCED_EXPANSION_BY_ID.mixed_use_midrise, BALANCED_EXPANSION_BY_ID.penthouse_tower, ...SKYLINE_ELEMENTS];
export const SKYLINE_STYLES = new Map(SKYLINE_DESIGNS.map(d => [d.id,d.styleNames]));

export const SKYLINE_GOVERNMENT_IDS = SKYLINE_ELEMENTS.filter(d => d.government).map(d => d.id);
