import assert from "node:assert/strict";
import test from "node:test";
import "../src/game/designs/index";
import { elementSilhouette, silhouetteDistance, type Silhouette } from "../scripts/review/silhouette";

test("the five Original civic services can be distinguished without colors or signs", () => {
  const services = ["public_library", "post_offices", "courthouses", "banks", "city_offices"];
  for (let level = 1; level <= 5; level++) {
    for (let variant = 0; variant < 4; variant++) {
      const models = new Map<string, Silhouette>();
      for (const service of services) {
        const model = elementSilhouette(service, level, variant);
        for (const [neighbor, previous] of models) {
          const label = `${service} and ${neighbor}, level ${level}, variant ${variant + 1}`;
          assert.ok(silhouetteDistance(model, previous) >= 0.12, label);
          if (service === "city_offices") assert.ok(model.top > previous.top, label + ": city tower");
        }
        models.set(service, model);
      }
    }
  }
});

test("each Original government authority offers four distinct buildings and visible promotions", () => {
  const authorities = [
    "city_offices", "courthouses", "tax_collecting_office", "government_buildings", "borough_assembly",
    "civic_records_archive", "city_planning_bureau", "public_works_directorate", "national_parliament",
  ];
  for (const id of authorities) {
    let previous: Silhouette[] = [];
    for (let level = 1; level <= 5; level++) {
      const current: Silhouette[] = [];
      for (let variant = 0; variant < 4; variant++) {
        const shape = elementSilhouette(id, level, variant);
        const label = `${id}, level ${level}, variant ${variant + 1}`;
        for (const neighbor of current) assert.ok(silhouetteDistance(shape, neighbor) >= 0.12, label);
        if (level > 1) assert.ok(silhouetteDistance(shape, previous[variant]) >= 0.06, label);
        current.push(shape);
      }
      previous = current;
    }
  }
});
