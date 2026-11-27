/**
 * Deliberate post-apocalyptic designs (illustrated-catalog redesign, docs/redesign/ART-BRIEF.md).
 * Each builder owns the element's whole parcel in this era. Names: src/game/eraNames/post-apocalyptic.ts.
 */
import type { SignatureBuilder } from "../periodArtCatalog";

import { salvageCivic } from "./salvageCivic";

export const signatures: Record<string, SignatureBuilder> = { ...salvageCivic };
