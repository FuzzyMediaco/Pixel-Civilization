const eras = [
  ["china", "Ancient China", "ancient-china"],
  ["egypt", "Ancient Egypt", "ancient-egypt"],
  ["rome", "Ancient Rome", "rome-aqueduct"],
  ["greece", "Ancient Greece", "ancient-greece"],
  ["medieval", "Medieval Europe", "medieval-europe"],
  ["renaissance", "Renaissance Italy", "renaissance-italy"],
  ["wwii", "World War II", "world-war-ii"],
  ["deco", "Art Deco", "art-deco"],
  ["3027", "3027", "future-3027"],
  ["wasteland", "Post-apocalyptic", "post-apocalyptic"],
].map(([slug, label, era]) => ({ id: "era_" + slug, label, era, kind: "era", usdCents: 99, includes: [] }));
const modes = [
  {
    id: "mode_survival",
    mode: "survival",
    label: "Survival Mode",
    usdCents: 199,
    kind: "mode",
    includes: [],
  },
  { id: "mode_god", mode: "god", label: "God Mode", usdCents: 399, kind: "mode", includes: [] },
];
const starter = ["mode_survival"];
const builder = [...starter, "mode_god", "era_rome", "era_egypt"];
const studio = [...builder, "era_china", "era_greece", "era_medieval", "era_renaissance"];
const tiers = [
  ["pix_starter", "Pix Starter", 499, 100, 1490000, starter],
  ["pix_builder", "Pix Builder", 1499, 350, 4490000, builder],
  ["pix_studio", "Pix Studio", 3999, 1000, 11990000, studio],
  ["pix_complete", "Pix Complete", 9999, 2500, 29990000, [...modes, ...eras].map((item) => item.id)],
].map(([id, label, usdCents, messages, budgetMicros, includes]) => ({
  id,
  label,
  kind: "subscription",
  usdCents,
  messages,
  budgetMicros,
  includes,
}));

export const STORE_PRODUCTS = [...eras, ...modes, ...tiers];
export const productById = (id) => STORE_PRODUCTS.find((product) => product.id === id);
export const productForEra = (era) =>
  eras.find((p) => p.era === (era === "rome-forum" ? "rome-aqueduct" : era))?.id;
export const productForMode = (mode) => modes.find((p) => p.mode === mode)?.id;
export function canUseProduct(snapshot, id) {
  if (!id) return true;
  return Boolean(
    snapshot?.accountId &&
      snapshot.validUntil > Date.now() &&
      ((snapshot.complimentary === true && Boolean(productById(id))) ||
        snapshot.owned.includes(id) ||
        snapshot.plan === id ||
        productById(snapshot.plan)?.includes.includes(id)),
  );
}
