/**
 * Deliberate art-deco designs (illustrated-catalog redesign, docs/redesign/ART-BRIEF.md).
 * Each builder owns the element's whole parcel in this era. Names: src/game/eraNames/art-deco.ts.
 */
import type { SignatureBuilder } from "../periodArtCatalog";
import { decoCivic } from "./decoCivic";

export const signatures: Record<string, SignatureBuilder> = { ...decoCivic };
