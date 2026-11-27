import { SKYLINE_ELEMENTS } from "../skylineCatalog";
import { boroughAssembly, recordsArchive, planningBureau, publicWorks, nationalParliament } from "./civicInstitutions";
import { megaSkyscraper, supertreeGrove, guggenheimBilbao } from "./skylineLandmarks";
import type { Ctx } from "./kit";
import { defineDesigns } from "./registry";

const builders: Record<string,(c: Ctx) => void> = {
  borough_assembly:boroughAssembly, civic_records_archive:recordsArchive, city_planning_bureau:planningBureau,
  public_works_directorate:publicWorks, national_parliament:nationalParliament, mega_skyscraper:megaSkyscraper,
  supertree_grove:supertreeGrove, guggenheim_bilbao:guggenheimBilbao,
};
defineDesigns(Object.fromEntries(SKYLINE_ELEMENTS.map(def => [def.id,{
  footprints:def.footprints, levels:def.levelNames, growth:def.growth, build:builders[def.id],
}])));
