/**
 * ORIGINAL post_offices: placeholder while the illustrated-catalog redesign (docs/redesign/CIVIC-FIVE-SPEC.md) is built.
 */
import { type Ctx, lot } from "./kit";

export const POST_OFFICE = {
  levels: ["Mail Counter", "Village Post Office", "Parcel Office", "Mail Depot", "Regional Sorting Hub"] as [string, string, string, string, string],
  variants: ["A", "B", "C", "D"] as [string, string, string, string],
  growth: "Placeholder.",
  description: "Placeholder.",
};

export function buildPostOffice(c: Ctx): void {
  lot(c, "grass");
  c.v.box(-c.hx + 2, 1, -c.hz + 2, c.hx - 2, 6, c.hz - 2, "cream");
}
