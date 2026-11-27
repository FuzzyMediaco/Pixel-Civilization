import type { SignatureBuilder } from "../periodArtCatalog";
import { library } from "./egyptianLibrary";
import { post } from "./egyptianPost";
import { court } from "./egyptianCourts";
import { offices } from "./egyptianOffices";
import { treasury } from "./egyptianTreasuries";
import { egyptMarket } from "./egyptMarket";

export const signatures: Record<string, SignatureBuilder> = {
  public_library: library,
  post_offices: post,
  courthouses: court,
  city_offices: offices,
  banks: treasury,
  ...egyptMarket,
};
