import React, { useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Eye,
  Flame,
  Hammer,
  Info,
  Link2,
  Move,
  RotateCw,
  Shuffle,
  Trash2,
  TrainFront,
  Wrench,
} from "lucide-react";
import { type CivElementDef, getElementLevelName, getMaxElementLevel, getStandardFootprintForLevel } from "../game/catalog";
import { SYNERGY_RULES } from "../game/cityDynamics";
import { buildingCharges, upgradeReadiness } from "../game/cityEconomy";
import { alertIssues, type IssueFix } from "../game/cityIssues";
import { type GameState, type HeatmapKind, MAINTENANCE_INTERVAL_SEC, maintenanceStatus, type PlacedElement, placedUpgradeCost } from "../game/simulation";
import { BottomSheet, Button, IconButton, InspectorCard, ListRow, type SheetHeight, Tabs, Tag } from "./ui";

export const RAIL_SITES = ["train_depots", "train_stops", "freight_rail_terminal"];
type InspectorTab = "needs" | "links" | "info" | "trains";

export function InspectorSheet({
  state,
  el,
  def,
  height,
  onHeight,
  onClose,
  onUpgrade,
  onLevelDown,
  onMove,
  onRotate,
  onVariant,
  onMaintain,
  onDemolish,
  onRailOps,
  onFieldGuide,
  onFix,
  onShowLayer,
  links,
  info,
}: {
  state: GameState;
  el: PlacedElement;
  def: CivElementDef;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
  onUpgrade: () => void;
  onLevelDown: () => void;
  onMove: () => void;
  onRotate: () => void;
  onVariant: () => void;
  onMaintain: () => void;
  onDemolish: () => void;
  onRailOps: () => void;
  onFieldGuide: () => void;
  onFix: (fix: IssueFix) => void;
  onShowLayer: (layer: HeatmapKind) => void;
  links: React.ReactNode;
  info: React.ReactNode;
}) {
  const [tab, setTab] = useState<InspectorTab>("needs");
  const god = state.mode === "god";
  const max = getMaxElementLevel(el.defId);
  const atMax = el.level >= max;
  const charges = buildingCharges(state);
  const cost = atMax ? 0 : placedUpgradeCost(state, el);
  const ready = upgradeReadiness(state, el);
  const short = charges && !atMax && state.money < cost;
  const blocked = !atMax && (short || !ready.ready);
  const levelName = getElementLevelName(def, el.level);
  const next = atMax ? undefined : getElementLevelName(def, el.level + 1);
  const nextSize = !atMax && !def.isNetwork ? " (" + getStandardFootprintForLevel(def, el.level + 1).join("×") + ")" : "";
  const isRail = RAIL_SITES.includes(def.id);
  const building = !def.isNetwork && !def.passiveNature;
  const lv = el.landValue ?? 0.5;
  const maintenance = maintenanceStatus(state, el);
  const cityNeeds = alertIssues(state).filter((i) => i.fix).slice(0, 3);

  const tabs: { id: InspectorTab; label: string; icon: React.ReactNode }[] = [
    { id: "needs", label: "Needs", icon: <AlertCircle size={13} /> },
    { id: "links", label: "Links", icon: <Link2 size={13} /> },
    { id: "info", label: "Info", icon: <Info size={13} /> },
    ...(isRail ? [{ id: "trains" as const, label: "Trains", icon: <TrainFront size={13} /> }] : []),
  ];

  return (
    <BottomSheet
      id="sheet-inspector"
      context
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close details"
      title={def.name}
      header={
        <InspectorCard
          def={def}
          title={def.name + " · Lv " + el.level}
          subtitle={levelName + (next ? " → Lv " + (el.level + 1) + nextSize : " · Max")}
        />
      }
      dock={
        <div className="ui-insp-dock">
          <div className="ui-tags" aria-label="Status">
            {building && !god && <Tag tone={el.connected ? "good" : "bad"}>{el.connected ? "Road ✓" : "No road"}</Tag>}
            {el.awaitingStreet && <Tag tone="warn">Street</Tag>}
            {el.onFire && (
              <Tag tone="bad" icon={<Flame size={11} />}>
                Fire
              </Tag>
            )}
            {el.disrepair && <Tag tone="bad">Disrepair</Tag>}
            {maintenance === "soon" && <Tag tone="warn">Maintenance in {Math.ceil(MAINTENANCE_INTERVAL_SEC - el.maintTimerSec)}s</Tag>}
            {maintenance === "due" && <Tag tone="warn">Maintenance due</Tag>}
            {building && el.landValue !== undefined && (
              <Tag tone={lv >= 1 ? "good" : lv < 0.45 ? "bad" : "info"} title="Land value">
                LV {lv.toFixed(2)}
              </Tag>
            )}
            {(el.pollution ?? 0) > 1 && <Tag tone="bad">Pol {(el.pollution ?? 0).toFixed(1)}</Tag>}
            {(el.synergies?.length ?? 0) > 0 && (
              <Tag
                tone="info"
                title={(el.synergies ?? []).map((id) => SYNERGY_RULES.find((r) => r.id === id)?.label ?? id).join(", ")}
              >
                +{Math.min(4, el.synergies!.length) * 12}%
              </Tag>
            )}
          </div>

          <div className="ui-insp-bar">
            {el.onFire ? (
              <Button small variant="primary" icon={<Flame size={14} />} label="Fire crew" onClick={onMaintain} />
            ) : (
              <Button
                small
                variant="primary"
                icon={<ArrowUp size={14} />}
                disabled={atMax || (blocked && !god)}
                onClick={onUpgrade}
                label={atMax ? "Max" : god || !charges ? "Lv " + (el.level + 1) : "$" + cost.toLocaleString()}
              />
            )}
            {maintenance !== "none" && maintenance !== "healthy" && <IconButton aria-label="Maintain building for free" title="Maintain for free" icon={<Wrench size={14} />} onClick={onMaintain} />}
            {god && <IconButton aria-label="Level down" title="Level down" icon={<ArrowDown size={14} />} disabled={el.level <= 1} onClick={onLevelDown} />}
            <IconButton aria-label="Move" title="Move" icon={<Move size={14} />} onClick={onMove} />
            {!def.isNetwork && <IconButton aria-label="Rotate 90°" title="Rotate 90°" icon={<RotateCw size={14} />} onClick={onRotate} />}
            <IconButton aria-label="Next visual style" title="Next visual style" icon={<Shuffle size={14} />} onClick={onVariant} />
            <IconButton aria-label="Atlas & 3D guide" title="Atlas & 3D guide" icon={<BookOpen size={14} />} onClick={onFieldGuide} />
            <IconButton aria-label="Demolish" title="Demolish" variant="danger" icon={<Trash2 size={14} />} onClick={onDemolish} />
          </div>

          {!atMax && blocked && (
            <p className="ui-upgrade-note">
              {short ? "Need $" + cost.toLocaleString() + ". " : ""}
              {ready.reasons.join(" ")}
            </p>
          )}
          <Tabs label="Building details" items={tabs} value={tab} onChange={setTab} />
        </div>
      }
    >
      {tab === "needs" && (
        <div className="ui-list">
          {!atMax && building && ready.goal > 0 && (
            <ListRow
              icon="⬆"
              tone={ready.value >= ready.goal ? undefined : "warn"}
              title={"Lv " + (el.level + 1) + ": " + ready.label}
              subtitle={
                Math.floor(ready.value).toLocaleString() +
                " / " +
                ready.goal.toLocaleString() +
                (ready.value >= ready.goal ? " · ready" : "")
              }
            />
          )}
          {building && !god && !el.connected && (
            <ListRow
              icon="🛣"
              tone="bad"
              title="Not connected"
              subtitle="Place any road next to this building to link automatically"
              trailing={
                <button
                  type="button"
                  className="ui-row-action-icon"
                  aria-label="Build roads"
                  title="Build roads"
                  onClick={() => onFix({ label: "Build roads", category: "roads_transit" })}
                >
                  <Hammer size={14} />
                </button>
              }
            />
          )}
          {building && !el.hasFireCover && (
            <ListRow
              icon="🚒"
              title="No fire cover"
              subtitle="Fires spread unchecked"
              trailing={
                <button
                  type="button"
                  className="ui-row-action-icon"
                  aria-label="Show Fire layer"
                  title="Show Fire layer"
                  onClick={() => onShowLayer("fire")}
                >
                  <Eye size={14} />
                </button>
              }
            />
          )}
          {building && state.metrics.crimeUnlocked && !el.hasPoliceCover && (
            <ListRow
              icon="🚓"
              title="No police cover"
              subtitle="Raises crime nearby"
              trailing={
                <button
                  type="button"
                  className="ui-row-action-icon"
                  aria-label="Show Police layer"
                  title="Show Police layer"
                  onClick={() => onShowLayer("police")}
                >
                  <Eye size={14} />
                </button>
              }
            />
          )}
          {el.nuisancePenalty > 0 && (
            <ListRow
              icon="🔊"
              tone="warn"
              title="Noisy neighbours"
              subtitle={"−" + Math.round(el.nuisancePenalty) + "% here"}
              trailing={
                <button
                  type="button"
                  className="ui-row-action-icon"
                  aria-label="Show Pollution layer"
                  title="Show Pollution layer"
                  onClick={() => onShowLayer("pollution")}
                >
                  <Eye size={14} />
                </button>
              }
            />
          )}
          {cityNeeds.map((i) => (
            <ListRow
              key={i.id}
              icon="⚠"
              tone={i.severity === "critical" ? "bad" : "warn"}
              title={i.title}
              subtitle={"City-wide" + (i.deltaHappiness ? " · " + i.deltaHappiness + "%" : "")}
              trailing={
                <button
                  type="button"
                  className="ui-row-action-icon"
                  aria-label={i.fix!.label}
                  title={i.fix!.label}
                  onClick={() => onFix(i.fix!)}
                >
                  <Hammer size={14} />
                </button>
              }
            />
          ))}
          {(el.synergies ?? []).map((id) => {
            const r = SYNERGY_RULES.find((x) => x.id === id);
            return r && <ListRow key={id} icon={r.emoji ?? "✨"} title={r.label} subtitle="Neighbour bonus" />;
          })}
          {building && el.connected && !cityNeeds.length && !el.nuisancePenalty && (
            <p className="ui-muted">All needs met. {atMax ? "" : "Upgrade when ready."}</p>
          )}
        </div>
      )}
      {tab === "links" && links}
      {tab === "info" && info}
      {tab === "trains" && (
        <div className="ui-list">
          <ListRow
            icon={<TrainFront size={16} />}
            title="Rail Operations"
            subtitle="Lines, trains & cargo"
            onClick={onRailOps}
            trailing={<ArrowUpRight size={15} />}
          />
        </div>
      )}
    </BottomSheet>
  );
}
