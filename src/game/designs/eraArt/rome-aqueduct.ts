import type { SignatureBuilder } from "../periodArtCatalog";
import { library } from "./rome/recordCourts";
import { postOffice } from "./rome/relayYards";
import { courthouse } from "./rome/tribunals";
import { cityOffices } from "./rome/magistrates";
import { bank } from "./rome/treasuries";

export const signatures: Record<string, SignatureBuilder> = {
  public_library: library,
  post_offices: postOffice,
  courthouses: courthouse,
  city_offices: cityOffices,
  banks: bank,
};
