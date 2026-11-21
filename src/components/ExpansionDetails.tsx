import { ELEMENT_BY_ID } from "../game/catalog";
import { CAMPUS_FARM_ART } from "../game/campusFarmArt";
import { economyOf, pondCisternCapacity } from "../game/cityEconomy";
import { complexBoost, districtReport, isFarmPiece, SCHOOL_SPECIALTIES } from "../game/farmNetworks";
import { FARM_MODULE_IDS } from "../game/expansionCatalog";
import type { GameState, PlacedElement } from "../game/simulation";
export function ExpansionDetails({ s, el }: { s: GameState; el: PlacedElement }) {
  const farm = isFarmPiece(el.defId),
    specialty = SCHOOL_SPECIALTIES[el.defId],
    art = CAMPUS_FARM_ART[el.defId];
  if (!farm && !specialty && !art) return null;
  const report = districtReport(s),
    complex = report.farms.get(el.id);
  const school = !!specialty || el.defId === "research_institute" || el.defId === "sports_field";
  const owner = complex?.owner.get(el.id),
    parcelCount = complex?.count.get(el.id) ?? 0;
  const account = economyOf(s).sites[el.id],
    bonuses = report.bonuses;
  const neighbors = [
    ...new Set(bonuses.active.filter((d) => d.aId === el.id || d.bId === el.id).map((d) => d.title)),
  ];
  const changes = [
    [bonuses.foodMultiplier, "harvest"],
    [bonuses.educationMultiplier, "education"],
    [bonuses.recreationMultiplier, "recreation"],
    [bonuses.jobsMultiplier, "jobs"],
    [bonuses.incomeMultiplier, "income"],
  ] as const;
  const next = [5, 10, 25, 50].find((n) => n > (complex?.modules.length ?? 0));
  return (
    <details className="expansion-inspector" open>
      <summary>
        <strong>{farm ? "Farm complex" : "Campus details"}</strong>
      </summary>
      {art && (
        <p>
          {art.levels[Math.min(4, el.level - 1)]} · {art.styles[el.variant % 4]}
        </p>
      )}
      {school && (
        <p>
          {specialty ??
            (el.defId === "sports_field"
              ? "Athletics grounds provide recreation. Join a high school along a shared edge to form an Athletic Campus."
              : "Applied laboratories provide skilled jobs and trade. Share an edge with a university to form an Innovation District.")}
        </p>
      )}
      {school && account && (
        <p>
          {Math.round(account.attendees)} attending · {Math.round(account.workers)} staff
        </p>
      )}
      {farm && complex && (
        <>
          <p>
            {complex.live
              ? `${complex.anchors.length} anchor${complex.anchors.length === 1 ? "" : "s"} · ${complex.modules.length} connected modules`
              : "Give an anchor a local street entrance and join parcels along open edges."}
          </p>
          {complex.live && (
            <p>
              {FARM_MODULE_IDS.has(el.defId) && owner
                ? `Served by ${ELEMENT_BY_ID[owner.defId].name} at ${owner.gx}, ${owner.gz}.`
                : `${parcelCount} assigned modules · +${Math.round((complexBoost(parcelCount) - 1) * 100)}% anchor yield.`}{" "}
              Local harvest {Number(account?.yieldRate ?? 0).toFixed(2)} meals/s.
            </p>
          )}
          {el.defId === "irrigation_pond" && (
            <p>
              Stored irrigation water {Number(account?.cistern ?? 0).toFixed(1)} / {Math.round(pondCisternCapacity(el.level))} · supplying{" "}
              {Number(account?.irrigationOut ?? 0).toFixed(2)}/s
            </p>
          )}
          {el.defId === "feed_silo" && complex.live && (
            <p>Covered storage reduces spoilage across this farm by one third.</p>
          )}
          {complex.live && (
            <p>
              Activity tier {complex.tier}/4
              {next ? ` · Next activity at ${next} modules.` : " · Full harvest crew on duty."}
            </p>
          )}
        </>
      )}
      {neighbors.length > 0 && (
        <p>
          <strong>{neighbors.join(" · ")}</strong>
          <br />
          {changes
            .filter(([map]) => map.has(el.id))
            .map(([map, name]) => "+" + Math.round(((map.get(el.id) ?? 1) - 1) * 100) + "% " + name)
            .join(" · ")}
        </p>
      )}
    </details>
  );
}
