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
    description:"Retrieve deeds, charters and city plans from hanging index drawers, a fan of tabbed folders, a filing carousel or rolled map vaults.",
    levelNames:["Deed Office","Index Room","Municipal Stacks","Public Reading Archive","Hall of Records"],
    styleNames:["Hanging Index","Folio Fan","Retrieval Carousel","Rolled Plan Vault"],
    growth:"Retrieval machinery and public reading rooms grow from a registry counter into a municipal archive.",
  },
  {
    id:"city_planning_bureau", name:"City Planning Bureau", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:7, cost:510, government:155, jobs:38, power:-4, water:-2, accentHex:"#438993", footprints:campus,
    description:"Surveyors, residents and planning staff gather around survey instruments, contour models, drawing desks and maps.",
    levelNames:["Survey Office","Drafting Studio","Public Map Gallery","District Planning Bureau","Metropolitan Planning Campus"],
    styleNames:["Surveyor’s Tripod","Contour Terrace","Cantilever Drafting Hall","Rolled Map Gallery"],
    growth:"Public drafting rooms gain relief models, observation galleries and walkways where residents can study the next district.",
  },
  {
    id:"public_works_directorate", name:"Public Works Directorate", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:10, cost:740, government:235, jobs:52, power:-6, water:-4, accentHex:"#528d83", footprints:campus,
    description:"Crews inspect a bridge, gauge a reservoir, operate a lift or examine the layers beneath a city street.",
    levelNames:["Field Inspection Office","District Inspection Yard","Infrastructure Depot","Engineering Directorate","Metropolitan Works Campus"],
    styleNames:["Bridge Inspection Yard","Reservoir Gauge House","Gantry Lift Depot","Street Section Hall"],
    growth:"Field crews gain inspection offices, testing equipment, public viewing walks and full-size infrastructure to examine.",
  },
  {
    id:"national_parliament", name:"National Parliament", category:"civic_parks", domain:"land", archetype:"civic_hall",
    stage:16, cost:2250, government:460, jobs:78, recreation:42, power:-10, water:-6, accentHex:"#d2b66d", footprints:landmark,
    description:"Delegates meet in open chambers framed by terraced galleries, division bridges, limestone sails or a crown of vaulted committee rooms.",
    levelNames:["Delegates’ Hall","Legislative Chamber","Assembly of Regions","Parliamentary Estate","National Parliament"],
    styleNames:["Terraced Hemicycle","Division Bridges","Speaker’s Sails","Committee Crown"],
    growth:"Public entrances and committee rooms gather around the chamber as each assembly gains a gallery overlooking its debates.",
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
