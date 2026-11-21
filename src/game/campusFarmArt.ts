import type { LevelSpanTuple } from "./levelSpans";

interface Art {
  footprints: LevelSpanTuple;
  levels: [string, string, string, string, string];
  styles: [string, string, string, string];
}

function art(spans: string, stages: string, styles: string): Art {
  return {
    footprints: spans.split(" ").map((n) => [Number(n[0]), Number(n[1])]) as LevelSpanTuple,
    levels: stages.split("|") as Art["levels"],
    styles: styles.split("|") as Art["styles"],
  };
}
export const CAMPUS_FARM_ART: Record<string, Art> = {
  preschool: art(
    "11 21 22 32 33",
    "Playroom|Discovery yard|Storybook wing|Adventure playground|Children’s village",
    "Toybox|Forest playhouse|Sunflower|Seaside",
  ),
  country_schoolhouse: art(
    "11 11 21 22 32",
    "One-room school|School bell|Teacher’s cottage|Reading garden|Harvest school fair",
    "Red clapboard|White chapel|Prairie timber|Fieldstone",
  ),
  elementary_school: art(
    "11 21 22 32 33",
    "Classroom porch|Shared playground|Library wing|School bus court|Neighborhood academy",
    "Garden brick|Coastal tiles|Maplewood|Sunburst",
  ),
  middle_school: art(
    "21 21 22 32 33",
    "Junior block|Science loft|Basketball courts|Gymnasium|Arts and athletics quad",
    "Fieldstone|Copper roof|Lakeside|Red brick",
  ),
  high_school: art(
    "22 22 32 33 43",
    "Senior hall|Gymnasium|Athletics track|Grandstand|Championship campus",
    "Cardinals|Owls|Mariners|Hornets",
  ),
  trade_school: art(
    "21 21 22 32 43",
    "Workshop|Machine shop|Apprentice bays|Fabrication crane|Technical works",
    "Boilermakers|Shipwrights|Machinists|Auto works",
  ),
  community_college: art(
    "21 22 32 33 43",
    "Learning center|Evening classrooms|Public library|Garden commons|Community quad",
    "Adobe|Green glazed|Harbor modern|City brick",
  ),
  university: art(
    "22 22 32 33 44",
    "Founders hall|Reading cloister|Clock tower|Residential courts|Collegiate quadrangle",
    "Limestone Gothic|Federal brick|Copper cloister|Pacific stone",
  ),
  research_university: art(
    "22 22 32 33 44",
    "Laboratory|Cleanroom|Research dome|Instrument tower|Discovery campus",
    "Ocean institute|Alpine sciences|Photon lab|Desert observatory",
  ),
  sports_field: art(
    "21 21 22 32 43",
    "Practice pitch|School league|Athletics oval|Floodlit stands|Championship ground",
    "Soccer green|Gridiron|Red clay|Blue track",
  ),
  research_institute: art(
    "21 21 22 32 33",
    "Instrument lab|Glass atrium|Observatory|Survey array|National laboratory",
    "Geosciences|Astronomy|Photonics|Atmospheric",
  ),
  vegetable_farm: art(
    "11 21 22 32 43",
    "Market garden|Tool shed|Wash house|Produce packing|Market cooperative",
    "Pumpkins|Tomatoes|Carrots|Cabbage",
  ),
  grain_farm: art(
    "11 21 22 32 43",
    "Grain croft|Threshing barn|Grain elevator|Harvester yard|Prairie granary",
    "Golden wheat|Amber barley|Silver oats|Rye",
  ),
  dairy_farm: art(
    "11 21 22 32 43",
    "Milking shed|Grazing yard|Milking parlor|Chilled tanks|Creamery",
    "Holstein|Jersey|Brown Swiss|Ayrshire",
  ),
  poultry_farm: art(
    "11 21 22 32 33",
    "Henhouse|Free-range yard|Laying house|Brooder sheds|Egg cooperative",
    "Buff hens|White layers|Red hens|Black hens",
  ),
  cattle_ranch: art(
    "21 21 22 32 43",
    "Stock yard|Watering corral|Ranch house|Sorting pens|Cattle station",
    "Hereford|Angus|Longhorn|Shorthorn",
  ),
  horse_ranch: art(
    "21 21 22 32 43",
    "Loose box|Grooming shed|Riding arena|Paddock stables|Equestrian center",
    "Chestnut|Palomino|Dapple grey|Bay",
  ),
  apiary: art(
    "11 11 21 22 32",
    "Hive garden|Honey store|Pollinator rows|Extraction hut|Bee research garden",
    "Sunflower|Heather|Clover|Lavender",
  ),
  vineyard: art(
    "11 21 22 32 43",
    "Vine garden|Trellis rows|Press house|Barrel cellar|Estate vineyard",
    "Burgundy|Chardonnay|Rosé|Concord",
  ),
  rice_farm: art(
    "11 21 22 32 43",
    "Starter paddy|Levee steps|Waterwheel|Threshing shed|Terraced paddies",
    "Jade rice|Golden rice|Black rice|Red rice",
  ),
  greenhouse_farm: art(
    "11 21 22 32 43",
    "Glass shed|Twin glasshouses|Climate house|Service boilers|Botanical range",
    "Victorian|Hydroponic|Sawtooth|Hoop house",
  ),
  vertical_farm: art(
    "11 11 21 22 32",
    "Grow room|Two-tier racks|Stacked garden|Nutrient tower|Sky harvest",
    "Leaf tower|Helical trays|LED stack|Solar terrace",
  ),
  vegetable_fields: art(
    "11 11 21 22 32",
    "Seed bed|Early rows|Irrigated beds|Harvest rows|Produce allotments",
    "Carrot rows|Pumpkin beds|Red peppers|White onions",
  ),
  grain_fields: art(
    "11 11 21 22 32",
    "Sown strip|Young grain|Golden stand|Sheaves|Harvest parcel",
    "Wheat|Barley|Oats|Rye",
  ),
  orchard_block: art(
    "11 11 21 22 32",
    "Saplings|Flowering orchard|Fruit trees|Picking lanes|Crated orchard",
    "Apple|Pear|Orange|Plum",
  ),
  grazing_pasture: art(
    "11 11 21 22 32",
    "Grass paddock|Water trough|Grazing shelter|Strip grazing|Rotational pasture",
    "Meadow|Alfalfa|Clover|Hill grass",
  ),
  livestock_pen: art(
    "11 11 21 22 32",
    "Stock pen|Feed rail|Handling gate|Holding pens|Sale yard",
    "Timber|Stone|Pipe rail|Split rail",
  ),
  chicken_coop: art(
    "11 11 21 22 22",
    "Nest box|Hen run|Roost house|Brooder court|Layer colony",
    "Red shingle|Sage roof|Straw coop|Blue tin",
  ),
  feed_silo: art(
    "11 11 21 22 32",
    "Feed bin|Raised hopper|Twin silos|Elevator leg|Bulk loading",
    "Galvanized|Red oxide|Cream enamel|Green steel",
  ),
  irrigation_pond: art(
    "11 11 21 22 32",
    "Catch pond|Gated outlet|Pump house|Settling beds|Irrigation reservoir",
    "Clay bank|Stone bank|Reed bed|Timber flume",
  ),
  greenhouse_bay: art(
    "11 11 21 22 32",
    "Cold frame|Propagation bench|Glass bay|Heated bays|Nursery range",
    "Clear glass|Sage frames|Blue glass|Copper ribs",
  ),
};
