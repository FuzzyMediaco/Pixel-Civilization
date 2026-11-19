# Power & Waste designs — handoff

File: `src/game/designs/power.ts` (typechecks clean). All 15 `power_waste` ids registered and visually verified (mode=full + night Lv5). Status: **done** for all.

| id | footprints Lv1→5 | levels | variants (V0/V1/V2/V3) |
|---|---|---|---|
| solar_panels | 1×1,1×1,2×1,2×2,3×2 | Backyard Panel Kit / Rooftop Array Shed / Community Solar Rows / Inverter-Station Field / Solar Park & Megabattery | fixed-tilt rows / carport canopies + EV chargers / pole "sunflower" trackers / agrivoltaic stilts over crops & sheep |
| solar_farms | 2×2,2×2,3×2,3×3,4×4 | Solar Meadow / Solar Plantation / Utility Solar Farm / Gigawatt Array / Solar Power-Tower Park | meadow PV + sheep / desert PV / floating PV on reservoir / parabolic troughs; Lv5 CSP tower + heliostat ring |
| windmills | 1×1,1×1,1×1,2×1,2×2 | Post Mill / Smock Mill / Gallery Tower Mill / Mill & Miller's House / Windmill Village | Dutch (tulips, canal) / Mykonos jib sails / American windpump / La Mancha |
| wind_turbines | 1×1 ×5 | Farm Turbine / Community Turbine / Utility Turbine / Multi-Megawatt Giant / Titan Sky Turbine | white tube / steel lattice / helical VAWT (y rotor) / candy-stripe 2-blade with glass sky gallery |
| wind_farms | 2×2,2×2,3×2,3×3,4×4 | Wind Trio / Ridge Line / Wind Park / Wind Plains / Gigawatt Wind Range | green hills / red desert mesas / snowy tundra with pines / patchwork farmland |
| landfill | 1×1,2×1,2×2,3×2,3×3 | Town Dump Pit / Fenced Tip / Terraced Trash Hill / Sanitary Landfill / Trash Mountain | municipal / eco-capped grass terraces / scrapyard + magnet crane / desert tip, tyres, vultures |
| trash_compacting_plants | 1×1,2×1,2×2,3×2,3×3 | Recycling Drop-Off / Baling Shed / Material Recovery Facility / Compaction Plant / Zero-Waste Eco Hub | green municipal / blue corrugated barrel roof / brick sawtooth / futuristic white & cyan |
| factories | 1×1,2×1,2×2,3×2,3×3 | Tinkerer's Workshop / Sawtooth Mill / Assembly Plant / Industrial Works / Mega-Factory Complex | Victorian brick mill / modern blue steel / automotive (car lot, sparks) / foundry with blast furnace |
| coal_powerplants | 1×1,2×1,2×2,3×2,3×3 | Boiler House / Steam Station / Coal-Fired Station / Coal Power Station / Gigawatt Coal Complex | Victorian brick / Soviet concrete, red-white stacks / modern blue boiler + FGD / Battersea 4 white chimneys |
| natural_gas_power_plants | 2×1,2×1,2×2,3×2,3×3 | Peaker Turbine Hall / Twin Peaker Station / Combined-Cycle Plant / Two-Train CCGT / Gas Power Mega-Station | white/blue HRSG + ACC fans / yellow pipes + Horton spheres / brick + gasometer frame / desert + ACC fans |
| trash_burning_plants | 1×1,2×1,2×2,3×2,3×3 | Backyard Incinerator / Tipping-Hall Incinerator / Waste-to-Energy Plant / WtE Plant with Scrubbers / Landmark Energy Mountain | CopenHill ski-slope roof / Hundertwasser patchwork + gold ball / grim industrial furnace glow / Japanese white with rainbow stack |
| hydro_electric_power_plants | 2×1,2×2,3×2,3×3,4×3 | Water-Wheel Weir / Run-of-River Weir / Gravity Dam / Great Dam & Intakes / Mega Dam Spillway | concrete gravity / curved arch / Victorian masonry + valve towers / earth embankment + glory-hole spillway |
| geothermal_power_plants | 1×1,2×1,2×2,3×2,3×3 | Steam Vent Wellhead / Geothermal Pilot Plant / Geothermal Station / Hot-Lagoon Power Plant / Geothermal Valley Complex | Icelandic lava + moss / Yellowstone mineral / volcanic lava cracks / snowy highlands |
| micro_reactor_nuclear | 1×1,1×1,2×1,2×2,2×2 | Reactor Pod / Pod & Control Module / Twin-Pod Array / Modular Reactor Campus / Micro-Grid Core Hub | white/cyan capsules / military olive trailers / underground silos with glass hatches / violet pebble-bed spheres; Lv5 spire with spinning rings |
| nuclear_power_plants | 2×2,3×2,3×3,4×3,4×4 | Research Reactor / Twin-Tower Station / Nuclear Generating Station / Triple-Tower Power Station / Gigawatt Nuclear Complex | western white domes, red bands / French concrete / Soviet VVER blocks + striped vent stack / futuristic glass domes, cyan |

## Known issues
- Cooling towers use a local `cTower` helper with a thicker shell than the kit version. They still show slight vertical creases.
- Wind-turbine and wind-farm rotors are deliberately larger than the tile, and rotors are not clipped to the footprint.
- Hydro V3 Lv5 is about 31k voxels (the largest). Everything else is under 23k.
- Geothermal and micro-reactor Lv1 are quite small and low, by design.

## Resume / verify
```
./scripts/gallery-server.sh
node scripts/shoot-gallery.mjs "cat=power&ids=<id>&mode=full&cell=300" out.png
node scripts/shoot-gallery.mjs "cat=power&ids=<ids>&mode=variants&lv=5&cell=200&night=1" night.png
npx tsc --noEmit 2>&1 | grep designs/power
```
