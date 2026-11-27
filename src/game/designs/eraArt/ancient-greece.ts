import type { SignatureBuilder } from "../periodArtCatalog";
import { buildAgora } from "./greek/agora";
import { buildLyceum } from "./greek/lyceum";
import { buildMessengerStoa } from "./greek/messengers";
import { buildTreasury } from "./greek/treasury";
import { buildTribunal } from "./greek/tribunal";

export const signatures: Record<string, SignatureBuilder> = {
  public_library: buildLyceum,
  post_offices: buildMessengerStoa,
  courthouses: buildTribunal,
  city_offices: buildAgora,
  banks: buildTreasury,
};
