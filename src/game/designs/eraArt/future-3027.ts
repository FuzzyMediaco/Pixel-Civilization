/**
 * Deliberate future-3027 designs (illustrated-catalog redesign, docs/redesign/ART-BRIEF.md).
 * Each builder owns the element's whole parcel in this era. Names: src/game/eraNames/future-3027.ts.
 */
import type { SignatureBuilder } from "../periodArtCatalog";

import { memoryOrbit, pneumaticPost } from "./futureMemoryPost";
import { daylightCourt, signalSquare } from "./futureCourtSquare";
import { phaseReserve } from "./futureReserve";

export const signatures: Record<string, SignatureBuilder> = {
  public_library: (c, _ink, active) => memoryOrbit(c, active),
  post_offices: (c, _ink, active) => pneumaticPost(c, active),
  courthouses: (c, _ink, active) => daylightCourt(c, active),
  city_offices: (c, _ink, active) => signalSquare(c, active),
  banks: (c, _ink, active) => phaseReserve(c, active),
};
