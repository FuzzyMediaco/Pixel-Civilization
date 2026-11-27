/**
 * ORIGINAL courthouses: placeholder while the illustrated-catalog redesign (docs/redesign/CIVIC-FIVE-SPEC.md) is built.
 */
import { type Ctx, lot } from "./kit";

export const COURTHOUSE = {
  levels: ["Magistrate’s Office", "County Court", "District Court", "Hall of Justice", "Supreme Court"] as [string, string, string, string, string],
  variants: ["A", "B", "C", "D"] as [string, string, string, string],
  growth: "Placeholder.",
  description: "Placeholder.",
};

export function buildCourthouse(c: Ctx): void {
  lot(c, "grass");
  c.v.box(-c.hx + 2, 1, -c.hz + 2, c.hx - 2, 6, c.hz - 2, "cream");
}
