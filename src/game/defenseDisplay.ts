import type * as THREE from "three";
import type { DefenseArtMotion } from "./designs/militaryDisplayKit";

export function hasDefenseDisplay(id: string) {
  return id === "underground_missile_silo" || id === "drone_swarm_base";
}

export type DefensePose = "idle" | "training" | "alert";
export interface DisplayPart {
  pivot: THREE.Group;
  home: THREE.Vector3;
  motion: DefenseArtMotion;
  unit: number;
}
export interface DefenseDisplay {
  parts: DisplayPart[];
  roof: number;
  resting?: boolean;
}

const exerciseDuration = 20;
const returnDuration = 2.5;
const tau = Math.PI * 2;
function ease(t: number) {
  const s = Math.min(1, Math.max(0, t));
  return s * s * (3 - 2 * s);
}

/** Only active simulation time schedules exercises; each placed base has its own repeatable offset. */
export function exerciseSecond(activeSeconds: number, seed: number) {
  const period = 90 + (seed % 37);
  const second = (activeSeconds + ((seed >>> 8) % period)) % period;
  return second < exerciseDuration ? second : -1;
}

/** A drill already in the air continues its local formation when the island alert starts. */
export function alertFormationSecond(
  play: number,
  alert: number,
  seed: number,
) {
  const drill = exerciseSecond(play - alert, seed);
  // A drill that was already landing settles before starting its next formation.
  return drill >= 0 && drill <= exerciseDuration - 3.9 ? alert + drill : alert;
}

/** Let a returning display land. A drill already in progress can wait for its next window. */
export function nextExerciseSecond(
  play: number,
  sinceReturn: number,
  seed: number,
) {
  const drill = exerciseSecond(play, seed);
  return drill > sinceReturn - returnDuration ? -1 : drill;
}

/** Interpolate between simulation snapshots without advancing over a pause or accumulating hidden-tab time. */
export class DefenseDisplayClock {
  private play = 0;
  private sampledAt = 0;
  private alertId?: string;
  private alert?: number;
  private returnStart = -Infinity;
  private lastAlert = 0;

  sync(
    play: number,
    attack: { id: string; elapsedSec?: number } | null,
    elapsed: number,
  ) {
    const alert = attack ? (attack.elapsedSec ?? 0) : undefined;
    if (
      play === this.play &&
      alert === this.alert &&
      attack?.id === this.alertId
    )
      return;
    if (play < this.play || attack) this.returnStart = -Infinity;
    else if (this.alert !== undefined) {
      this.returnStart = play;
      this.lastAlert = this.alert;
    }
    this.play = play;
    this.alert = alert;
    this.alertId = attack?.id;
    this.sampledAt = elapsed;
  }

  sample(elapsed: number, speed: number) {
    const delta = Math.max(0, Math.min(0.25, elapsed - this.sampledAt)) * speed;
    const play = this.play + delta;
    const sinceReturn = play - this.returnStart;
    return {
      play,
      alert: this.alert === undefined ? undefined : this.alert + delta,
      lastAlert: Number.isFinite(sinceReturn)
        ? this.lastAlert + sinceReturn
        : 0,
      sinceReturn,
      returnAmount: 1 - ease(sinceReturn / returnDuration),
    };
  }
}

/** Both the inspection gallery and the world position the same independent parcel-local pivots. */
export function poseDefenseDisplay(
  display: DefenseDisplay,
  pose: DefensePose,
  seconds: number,
  reduced: boolean,
  fade = 1,
) {
  const resting = pose === "idle" || fade <= 0;
  if (resting && display.resting !== false) return;
  display.resting = resting;
  for (const { pivot, home, unit, motion } of display.parts) {
    pivot.position.copy(home);
    pivot.rotation.y = 0;
    if (resting) continue;
    if (motion.kind === "hatch") {
      if (pose !== "alert") continue;
      const open = fade * (reduced ? 1 : ease(seconds / 1.6));
      pivot.position.x += motion.travel[0] * unit * open;
      pivot.position.y += motion.travel[1] * unit * open;
      pivot.position.z += motion.travel[2] * unit * open;
      continue;
    }
    // Reduced motion leaves the rest of the flock visibly on its berths.
    const { index, count, hx, hz, variant } = motion;
    const flyingCount = reduced ? Math.min(2, count - 1) : count;
    if (index >= flyingCount) continue;
    const launch = ease(
      (seconds - index * (reduced ? 0.45 : 0.21)) / (reduced ? 4 : 2.2),
    );
    const land =
      pose === "training"
        ? ease(
            (exerciseDuration - seconds - (flyingCount - 1 - index) * 0.21) /
              2.8,
          )
        : 1;
    const flight = launch * land * fade;
    if (flight <= 0) continue;
    const sky =
      display.roof + unit * (3 + Math.min(hx, hz) * 0.22 + (index % 2) * 2);
    pivot.position.y += flight * (sky - home.y);
    // Stay directly over the berth until the full miniature has cleared the roof or landed back over it.
    const across = ease(
      (pivot.position.y - display.roof) / (sky - display.roof),
    );
    const turn = seconds * (reduced ? 0.075 : 0.34);
    const slot = flyingCount > 1 ? index / (flyingCount - 1) : 0.5;
    const angle = turn + (tau * index) / flyingCount;
    const rx = (hx - 4) * unit * 0.78,
      rz = (hz - 4) * unit * 0.78;
    let x: number, z: number, heading: number;
    if (variant === 0 || variant === 3) {
      // A ring or a figure eight fits over the local plaza at every lot size.
      x = rx * Math.cos(angle);
      const multiplier = variant === 3 ? 2 : 1;
      z = rz * Math.sin(angle * multiplier);
      heading = Math.atan2(
        -rx * Math.sin(angle),
        rz * multiplier * Math.cos(angle * multiplier),
      );
    } else {
      // A chevron and a pair of ribbons sweep side to side, keeping their formation.
      x = rx * ((slot * 2 - 1) * 0.66 + 0.32 * Math.sin(turn));
      const spacing =
        variant === 1
          ? Math.abs(slot * 2 - 1) - 0.45
          : index % 2
            ? 0.34
            : -0.34;
      z = rz * (spacing + 0.36 * Math.cos(turn));
      heading = Math.atan2(
        rx * 0.32 * Math.cos(turn),
        -rz * 0.36 * Math.sin(turn),
      );
    }
    pivot.position.x += (x - home.x) * across;
    pivot.position.z += (z - home.z) * across;
    pivot.rotation.y = heading * across;
  }
}
