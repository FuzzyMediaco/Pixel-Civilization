# Wonder-tier wealth projects — round 2 redesign (design_projects_b)

File: `src/game/designs/projectsFuture.ts` (new). It is imported last in `src/game/designs/index.ts`,
so its `defineDesigns` call replaces the projects.ts entries for these 11 ids. projects.ts was not changed.
Footprints, level names and growth text still come from `WEALTH_PROJECTS` (`PROJECT_BY_ID`), so the
handbook, level spans and catalog tests do not change.

Variant language (matches `designStyles.json` names):
V0 Terracotta (warm Mediterranean / retro-Soviet) · V1 White & teal (clean future) ·
V2 Brick & evergreen (Victorian / collegiate + trees) · V3 Slate & brass (steampunk, amber light).

| id | growth concept | animated / live parts |
|---|---|---|
| spaceport | Rocket gets taller with each level (14→54 vox). The gantry is behind it with swing arms. Fuel spheres, mission control with a tracking dish, a VAB from L3, lightning towers and a passenger terminal from L4. L5 adds a landed booster on its own pad and a glowing "orbital gateway" arch. Rockets: V0 cluster rocket with strap-on boosters, V1 stainless starship with heat shield and chopsticks, V2 finned 1950s ogive rocket, V3 riveted brass bullet with nozzle bell | dish rotor; steam at the flame trench; blinks on the rocket nose, gantry and masts |
| pumped_storage_station | Upper reservoir at the back gets higher each level, with penstocks down to a powerhouse over the lower basin. Turbine wheels, transmission pylons, and a spillway waterfall at L5. V0 earth embankment, V1 elevated twin white tanks, V2 forested hill, V3 granite crag with a buttressed slate dam and brass valve tower | turbine rotors, steam, charge meter (lit bars = level) |
| flying_car_depot | Mast grows 7→48 with stacked cantilever pads. Hover taxis with spinning ducted fans, a glass cab ring, and a halo of air taxis circling the crown at L4–5. V0 adobe drum, V1 white needle, V2 brick tower with planted pads, V3 lattice truss with hex pads | fan rotors, orbit carousel rotor, blinks |
| teleportation_depot | L1 test gate → L2 arrival hall → L3 paired gates with a tesla pylon → L4/5 big raised gate with gyroscope rings, corner capacitors with energy beams, and a sky beam at L5. V0 star-gate with chevrons, V1 white torus, V2 pointed brick arch with ivy, V3 brass armillary with a violet portal | ring rotors (z / y / x axes), spark emitters |
| hanging_garden_arcology | 3→21 floors. V0 Babylonian tiers dripping with vines, V1 twisting rotated white floor plates, V2 Bosco-Verticale style brick tower with trees on the balconies, V3 slate core with spiralling brass greenhouse pods. Open lift, a front waterfall from L4, crown dome and wind rotor at L5 | crown rotor, blink |
| solar_canopy_orchard | Rows of fruit trees under panel canopies that spread out with each level. Picker court from L3, battery bank from L4, giant "sun tree" at L5. V0 pergola with alternating panels, V1 flower-petal solar trees, V2 brick piers with tilted shelves over vines, V3 brass heliostat dishes | up to 6 slowly tracking dish rotors (V3) |
| floodplain_park | L1 kidney-pond rain garden → meandering channel with a raised walk → meadows and pavilion → oxbow lake, islands and a flood gauge → arched footbridge, amphitheatre steps and kayaks. V0 terracotta terraces, V1 white zig-zag boardwalk, V2 willows, V3 slate gabions with a brass gauge clock tower | blink on the gauge |
| materials_foundry | Elevated scrap-sorting carousel over chutes and colour bins. From L2: furnace tower with a molten tap, belt conveyor and casting shed. L3 magnet gantry over a scrap pile, L4 domed rotunda, L5 rail spur and ladle pour. V0 beehive kilns, V1 electric-arc furnace, V2 brick blast furnace, V3 riveted brass dome furnace | carousel rotor; smoke / sparks / steam; blinks |
| rainwater_cathedral | Funnel collectors shaped like inverted umbrellas feed glowing cisterns. L1 filter court → vault → nave with aisles → glass cistern towers → twin funnel-spire towers, crossing lantern with a giant funnel, transepts and a cascade. V0 Romanesque, V1 ribbed white parabolic shells, V2 brick gothic with buttresses, V3 slate gothic with brass | steam at the spouts |
| skybridge_university | 2→4 lecture towers knitted together by 1→3 levels of skybridges. A lecture hall hangs under a bridge from L3, a funicular is added at L4, and L5 adds an observatory, clock and graduates. V0 Mediterranean with hip roofs and arched bridges, V1 round towers with glass tubes, V2 collegiate gothic with spires and covered bridges, V3 octagonal slate with brass trusses | blink |
| ocean_habitat_ring | Floating ring (it bobs; domain is water) that closes around a lagoon: 0.9π arc → full ring. Habitats stack 1–3 high, with net pens, a hub island, spoke bridges and a wind turbine. L5 adds a central spire (V0 campanile, V1 glass needle, V2 biodome, V3 brass lighthouse). The parcel corners stay open water for `ringBerthPorts` navigation | turbine rotor, berth buoy blinks |

Notes / known limits
- Voxel counts are at most about 21k (pumped storage L5 V1). Big masses are hollow shells.
- Gallery: `cat=projectsFuture` fails on the running Vite server because its glob list predates the
  new file. Use `cat=all&ids=...` until the server restarts.
- Rotor rings on the L4/5 teleport gates sweep a sphere of radius r+3…r+7. The gate is raised on a
  pedestal so the rings clear the plaza.
