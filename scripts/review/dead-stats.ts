// Review: list catalog stats that the simulation never reads for that element.
import { ELEMENTS } from "../../src/game/catalog";
import { FARM_ANCHOR_IDS, FARM_MODULE_IDS } from "../../src/game/expansionCatalog";
const crops = new Set([...FARM_ANCHOR_IDS, ...FARM_MODULE_IDS, "farms", "fields", "orchards", "groves_of_olives", "plantations", "gardens", "terraced_glasshouses", "solar_canopy_orchard", "ocean_habitat_ring"]);
const industry = ["factories", "data_centers", "open_pit_mine", "materials_foundry", "freight_rail_terminal", "shipyards", "blacksmiths"];
const exportList = ["university", "research_university", "research_institute", "community_college", "businesses", "shops", "plantations", "orchards", "growers_exchange", "bakeries"];
const flight = ["regional_airport", "flying_car_depot", "spaceport", "teleportation_depot"];
const deadFood: string[] = [], deadIncome: string[] = [], deadPolice: string[] = [];
let incomeSum = 0;
for (const d of ELEMENTS) {
  const retail = d.id === "grocery_store" || d.id === "growers_exchange" || d.id === "bakery_coop" || d.archetype === "restaurant_bar";
  if ((d.food ?? 0) > 0 && !crops.has(d.id) && !retail && d.id !== "farm_houses") deadFood.push(`${d.id}(${d.food})`);
  const exports = !flight.includes(d.id) && (industry.includes(d.id) || (FARM_ANCHOR_IDS.has(d.id) && !!d.income) || exportList.includes(d.id));
  if ((d.income ?? 0) > 0 && !exports) { deadIncome.push(`${d.id}(${d.income})`); incomeSum++; }
  if ((d.police ?? 0) > 0 && !d.policeRadius) deadPolice.push(d.id);
}
console.log("DEAD food stat (" + deadFood.length + "):", deadFood.join(" "));
console.log("DEAD income stat, also exempt from upkeep (" + deadIncome.length + "):", deadIncome.join(" "));
console.log("police points without radius:", deadPolice.join(" "));
console.log("restaurant_bar archetype:", ELEMENTS.filter(d => d.archetype === "restaurant_bar").map(d => d.id).join(" "));
console.log("ids in export whitelist that don't exist:", exportList.filter(id => !ELEMENTS.some(d => d.id === id)).join(" "));
