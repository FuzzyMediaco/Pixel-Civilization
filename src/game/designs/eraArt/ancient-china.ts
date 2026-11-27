/**
 * Deliberate ancient-china designs (illustrated-catalog redesign, docs/redesign/ART-BRIEF.md).
 * Each builder owns the element's whole parcel in this era. Names: src/game/eraNames/ancient-china.ts.
 */
import type { SignatureBuilder } from "../periodArtCatalog";

import { buildBambooArchive } from "./china/bambooArchive";
import { buildCourierYard } from "./china/relayYard";
import { buildJudgmentCourt } from "./china/judgmentCourt";

import { buildDrumOffices } from "./china/drumOffices";
import { buildCashHouse } from "./china/cashHouses";

export const signatures: Record<string, SignatureBuilder> = {
  public_library: buildBambooArchive,
  post_offices: buildCourierYard,
  courthouses: buildJudgmentCourt,
  city_offices: buildDrumOffices,
  banks: buildCashHouse,
};
