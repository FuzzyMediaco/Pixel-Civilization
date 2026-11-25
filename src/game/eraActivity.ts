import type { GameState, PlacedElement } from "./simulation";
import type { EraActivity, RomeFamily } from "./eraStyles";
import { hydraulics } from "./terrain";

export function eraActiveSites(state: GameState) {
  const passengers = new Set<string>(), deliveries = new Set<string>();
  for (const line of state.mobility?.lines ?? []) {
    if (!line.enabled || !line.at || line.dwell <= 0 || line.blocked) continue;
    const contract = line.rail?.contract;
    if (contract && line.at === contract.drop && (contract.unloadedHere ?? 0) > 0) deliveries.add(contract.sink);
    else if (line.rail?.service !== "freight" && line.mode !== "freight") passengers.add(line.at);
  }
  return {passengers, deliveries, hydro: hydraulics(state)};
}
export function presentationActivity(state: GameState, site: PlacedElement, family: RomeFamily, sites: ReturnType<typeof eraActiveSites>): EraActivity {
  if (site.disrepair || site.onFire) return "idle";
  if (family === "market") return sites.deliveries.has(site.id) ? "active" : "idle";
  if (family === "station") return sites.passengers.has(site.id) ? "active" : "idle";
  if (family === "aqueduct") return (sites.hydro.runs.get(site.gx+","+site.gz)?.flow ?? 0) > 0 ? "active" : "idle";
  if (family === "water" || family === "farm") {
    const water = sites.hydro.services.get(site.id);
    return water && water.freshwater + water.irrigation + water.potable > 0 ? "active" : "idle";
  }
  return site.connected && (family !== "power" || state.metrics.powerSupply > 0) ? "active" : "idle";
}
