/**
 * Deliberate world-war-ii designs (illustrated-catalog redesign, docs/redesign/ART-BRIEF.md).
 * Each builder owns the element's whole parcel in this era. Names: src/game/eraNames/world-war-ii.ts.
 */
import type { SignatureBuilder } from "../periodArtCatalog";

import { warCivic } from "./warCivic";

export const signatures: Record<string, SignatureBuilder> = { ...warCivic };
