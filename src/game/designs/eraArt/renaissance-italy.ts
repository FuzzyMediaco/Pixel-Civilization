/**
 * Deliberate renaissance-italy designs (illustrated-catalog redesign, docs/redesign/ART-BRIEF.md).
 * Each builder owns the element's whole parcel in this era. Names: src/game/eraNames/renaissance-italy.ts.
 */
import type { SignatureBuilder } from "../periodArtCatalog";

import { renCivic } from "./renCivic";

export const signatures: Record<string, SignatureBuilder> = { ...renCivic };
