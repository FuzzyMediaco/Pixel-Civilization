import * as THREE from "three";
import { activeBlessing, BLESSINGS } from "./faith";
import type { GameState } from "./simulation";

/** A ring of lights rises around the active sanctuary and dissolves above its spires. */
export class TempleLights {
  readonly group = new THREE.Group();
  private gem = new THREE.OctahedronGeometry(0.11);
  private light = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
  });
  private sparks = Array.from(
    { length: 16 },
    () => new THREE.Mesh(this.gem, this.light),
  );
  constructor() {
    this.group.add(...this.sparks);
    this.group.visible = false;
  }
  update(
    s: GameState,
    placed: Map<string, { group: THREE.Group }>,
    seconds: number,
  ) {
    const kind = activeBlessing(s);
    const model = kind && placed.get(s.faith!.active!.temple)?.group;
    this.group.visible = Boolean(model);
    if (!kind || !model) return;
    this.group.position.copy(model.position);
    const height = Math.max(2.5, Number(model.userData.topY) || 3);
    this.light.color.setHex(BLESSINGS[kind].color);
    this.light.opacity = 0.75 + 0.2 * Math.sin(seconds * 1.8);
    this.sparks.forEach((spark, i) => {
      const phase = (seconds * 0.19 + i / this.sparks.length) % 1;
      const angle = 0.4 * seconds + i * 2.4;
      const radius = (1.2 - 0.55 * phase) * Math.max(1.4, height * 0.34);
      spark.position.set(
        radius * Math.cos(angle),
        0.45 + phase * height * 1.2,
        radius * Math.sin(angle),
      );
      spark.scale.setScalar(0.45 + Math.sin(phase * Math.PI) * 0.9);
    });
  }
  dispose() {
    this.gem.dispose();
    this.light.dispose();
  }
}
