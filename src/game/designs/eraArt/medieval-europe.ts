import type { SignatureBuilder } from "../periodArtCatalog";
import { courierYard, guildBank } from "./medievalExchange";
import { assizes, guildOffices } from "./medievalGovernment";
import { scriptorium } from "./medievalLearning";

export const signatures: Record<string, SignatureBuilder> = {
  public_library: scriptorium,
  post_offices: courierYard,
  courthouses: assizes,
  city_offices: guildOffices,
  banks: guildBank,
};
