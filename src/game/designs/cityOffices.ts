/**
 * ORIGINAL city_offices: placeholder while the illustrated-catalog redesign (docs/redesign/CIVIC-FIVE-SPEC.md) is built.
 */
import { type Ctx, lot } from "./kit";

export const CITY_OFFICES = {
  levels: ["Town Clerk", "Town Hall", "City Hall", "Civic Center", "Grand City Hall"] as [string, string, string, string, string],
  variants: ["A", "B", "C", "D"] as [string, string, string, string],
  growth: "Placeholder.",
  description: "Placeholder.",
};

export function buildCityOffices(c: Ctx): void {
  lot(c, "grass");
  c.v.box(-c.hx + 2, 1, -c.hz + 2, c.hx - 2, 6, c.hz - 2, "cream");
}
