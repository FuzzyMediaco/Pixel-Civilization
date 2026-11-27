export interface SignatureNames {
  /** Element name shown in this era (Build menu, Details, Atlas, Handbook). */
  name: string;
  /** One name per playable level. */
  levels: readonly string[];
  /** Variant A–D names; each should name an architectural idea, not a colour. */
  variants: readonly [string, string, string, string];
  /** One or two sentences on the governing idea and what grows. */
  description?: string;
  /** Extra search words. */
  aliases?: readonly string[];
}
export type EraNameTable = Readonly<Record<string, SignatureNames>>;
