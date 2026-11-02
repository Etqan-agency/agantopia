import { describe, expect, it } from "vitest";
import { NARROW_LAYOUT, TABLET_LAYOUT, WIDE_LAYOUT, computeHeroScene } from "./hero-scene-geometry";

describe("hero scene geometry (Hero B)", () => {
  for (const layout of [WIDE_LAYOUT, TABLET_LAYOUT, NARROW_LAYOUT]) {
    const scene = computeHeroScene(layout);
    const label = `${layout.W}x${layout.H}`;

    it(`${label}: twelve employees, five lamps (three steady), one status pill`, () => {
      expect(scene.team.chars).toHaveLength(12);
      const lamps = scene.team.chars.filter((c) => c.member.lamp);
      expect(lamps).toHaveLength(5);
      expect(lamps.filter((c) => c.member.lamp === "steady")).toHaveLength(3);
      expect(scene.team.pills.map((p) => p.text)).toEqual(["Morgan · planning"]);
      expect(scene.team.tags.map((t) => t.text).sort()).toEqual(["Design", "Development", "QA", "Research"]);
    });

    it(`${label}: characters are drawn back to front and lamps light left to right`, () => {
      const ys = scene.team.chars.map((c) => c.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
      const lit = scene.team.chars.filter((c) => c.member.lamp).sort((a, b) => a.x - b.x);
      expect(lit.map((c) => c.lampDelay)).toEqual([0, 0.55, 1.1, 1.65, 2.2]);
    });

    it(`${label}: the team, owner and rail stay inside the drawing`, () => {
      for (const c of scene.team.chars) {
        expect(c.x).toBeGreaterThan(0);
        expect(c.x).toBeLessThan(layout.W);
        expect(c.y).toBeLessThan(layout.H);
      }
      expect(scene.rail.owner.x).toBeGreaterThan(0);
      expect(scene.rail.owner.x).toBeLessThan(layout.W / 2);
      expect(scene.frame.horizon).toBeLessThan(layout.stageY);
    });

    it(`${label}: connectors and the activity feed match the concept`, () => {
      expect(scene.connectors).toHaveLength(layout.narrow ? 2 : 3);
      expect(scene.feed).toHaveLength(layout.narrow ? 0 : 4);
      for (const c of scene.connectors) expect(c.len).toBeGreaterThan(14);
    });
  }
});
