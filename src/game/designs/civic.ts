import { type Ctx, bench, byLv, flatRoof, gable, lot, speckle, tree, windows } from "./kit";
import { defineDesigns, type DesignEntry } from "./registry";

/**
 * CIVIC & PARKS — PLACEHOLDER builds (redesign not started; see docs/handoff/civic_faith.md).
 * Parks get a lawn with trees; buildings get a simple block whose height grows with level.
 */
function placeholderPark(c: Ctx): void {
  const { v, hx, hz } = c;
  lot(c, "grass2");
  speckle(c, "grass3", 0.12);
  v.box(-1, 0, -hz, 1, 1, hz, "path");
  const n = byLv(c, [2, 3, 5, 7, 10]);
  for (let i = 0; i < n; i++) tree(v, c.ri(-hx + 2, hx - 3), 1, c.ri(-hz + 2, hz - 3), c.pick(["round", "oak", "blossom"] as const), 1 + c.rand() * 0.6, i);
  bench(v, 2, 1, 0);
}

function placeholderBuilding(wall: string, roof: string) {
  return (c: Ctx): void => {
    const { v, lv, hx, hz } = c;
    lot(c, "grass2");
    v.box(-2, 0, hz - 3, 2, 1, hz, "path");
    const h = 1 + byLv(c, [5, 8, 10, 12, 14]);
    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 3;
    v.hollowBox(x0, 1, z0, x1, h, z1, wall);
    windows(c, x0, 1, z0, x1, h, z1, { stepV: 4, h: 2, emit: 0.4 });
    v.box(-1, 1, z1 - 1, 1, 4, z1, "woodDark");
    if (lv >= 3) flatRoof(c, x0, h, z0, x1, z1, "concreteDark", roof, false);
    else gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "x", roof);
  };
}

const park = (fp: DesignEntry["footprints"], levels: DesignEntry["levels"]): DesignEntry => ({ footprints: fp, levels, growth: "Placeholder: more trees as it levels.", build: placeholderPark });
const bldg = (fp: DesignEntry["footprints"], levels: DesignEntry["levels"], wall: string, roof: string): DesignEntry => ({ footprints: fp, levels, growth: "Placeholder: grows taller as it levels.", build: placeholderBuilding(wall, roof) });

defineDesigns({
  school: bldg([[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]], ["One-Room Schoolhouse", "Brick Grade School", "School Campus", "High School", "University Quad"], "brick", "slate"),
  park: park([[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]], ["Village Green", "Playground Park", "Pond & Gazebo Park", "Carousel Park", "Grand Amphitheater Park"]),
  little_parks: park([[1, 1], [1, 1], [1, 1], [2, 1], [2, 1]], ["Bench & Tree", "Swing Corner", "Splash Pad", "Pocket Plaza", "Jewel-Box Park"]),
  gardens: park([[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]], ["Raised Beds", "Community Allotments", "Greenhouse Garden", "Conservatory Garden", "Botanical Palm House"]),
  city_offices: bldg([[1, 1], [1, 2], [2, 2], [2, 2], [2, 3]], ["Town Clerk Office", "Brick Town Hall", "City Hall", "Civic Center", "Grand City Hall"], "limestone", "slate"),
  post_offices: bldg([[1, 1], [2, 1], [2, 2], [3, 2], [3, 2]], ["Mail Counter", "Village Post Office", "Post Office", "Mail Depot", "Regional Sorting Hub"], "brick", "slate"),
  tax_collecting_office: bldg([[1, 1], [1, 1], [1, 2], [2, 2], [2, 2]], ["Tax Booth", "Collections Office", "Audit Bureau", "Vault Headquarters", "Treasury Fortress"], "concrete", "steelDark"),
  fire_department: bldg([[1, 1], [2, 1], [2, 2], [3, 2], [3, 2]], ["Volunteer Fire Shed", "Firehouse", "Fire Station", "Fire Hall", "Fire Command HQ"], "red", "charcoal"),
  community_centers: bldg([[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]], ["Meeting Hall", "Community Hall", "Rec Center", "Community Campus", "Grand Civic Commons"], "cream", "teal"),
  italian_gardens: park([[2, 2], [2, 2], [3, 2], [3, 3], [4, 3]], ["Cypress Walk", "Fountain Terrace", "Parterre Garden", "Statue Garden", "Villa Garden Estate"]),
  courthouses: bldg([[1, 1], [2, 1], [2, 2], [2, 3], [3, 3]], ["Magistrate Office", "County Courthouse", "District Courthouse", "Hall of Justice", "Supreme Court"], "marble", "copper"),
  government_buildings: bldg([[2, 2], [2, 2], [3, 2], [3, 3], [4, 3]], ["Government Office", "Ministry Building", "State House", "Capitol", "Grand Capitol Dome"], "marble", "copper"),
  large_parks: park([[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]], ["Meadow Park", "Lake Park", "Boathouse Park", "Bandshell Park", "Central Park"]),
});
