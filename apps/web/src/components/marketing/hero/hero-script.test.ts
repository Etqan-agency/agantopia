import { describe, expect, it } from "vitest";
import { buildFloorGeometry, HERO_CAST } from "../office/floor-geometry";
import { ALL_CONNECTORS, BEATS, SCENES, TOTAL_MS, sceneAt, sceneEndFrame, shortTitle, stateAt } from "./hero-script";

const castIds = new Set(HERO_CAST.map((c) => c.id));

describe("hero script", () => {
  it("has six ordered, contiguous scenes starting at 0 and ending at TOTAL_MS", () => {
    expect(SCENES).toHaveLength(6);
    expect(SCENES[0]!.start).toBe(0);
    SCENES.forEach((s, i) => {
      expect(s.index).toBe(i);
      expect(s.end).toBeGreaterThan(s.start);
      if (i > 0) expect(s.start).toBe(SCENES[i - 1]!.end);
    });
    expect(SCENES[5]!.end).toBe(TOTAL_MS);
    expect(TOTAL_MS).toBeGreaterThanOrEqual(22_000);
    expect(TOTAL_MS).toBeLessThanOrEqual(26_000);
  });

  it("sceneAt maps times to the right scene and clamps out-of-range input", () => {
    for (const s of SCENES) {
      expect(sceneAt(s.start).id).toBe(s.id);
      expect(sceneAt(s.end - 1).id).toBe(s.id);
    }
    expect(sceneAt(-500).index).toBe(0);
    expect(sceneAt(TOTAL_MS + 10_000).index).toBe(5);
    expect(sceneAt(Number.NaN).index).toBe(0);
  });

  it("only references employees that exist in the cast", () => {
    for (const ms of [0, ...BEATS, TOTAL_MS - 1]) {
      const f = stateAt(ms);
      for (const id of Object.keys(f.states)) expect(castIds.has(id)).toBe(true);
      for (const id of Object.keys(f.lamps)) expect(castIds.has(id)).toBe(true);
      for (const c of f.connectors) {
        expect(castIds.has(c.from)).toBe(true);
        expect(castIds.has(c.to)).toBe(true);
      }
      if (f.artifact) {
        expect(castIds.has(f.artifact.from)).toBe(true);
        expect(castIds.has(f.artifact.to)).toBe(true);
      }
    }
    for (const c of ALL_CONNECTORS) expect(castIds.has(c.from) && castIds.has(c.to)).toBe(true);
  });

  it("ends in the Delivery scene with the task completed and the deliverable shown", () => {
    const f = stateAt(TOTAL_MS - 1);
    expect(f.scene.id).toBe("delivery");
    expect(f.task.status).toBe("Completed");
    expect(f.task.delivered).toBe(true);
    expect(f.deliverable).not.toBeNull();
    expect(Object.values(f.task.subtasks).every((s) => s === "done")).toBe(true);
    expect(f.connectors).toHaveLength(0);
    expect(f.artifact).toBeNull();
    expect(f.lamps.manager).toBe("done");
  });

  it("starts with a new task, an empty feed and every lamp off", () => {
    const f = stateAt(0);
    expect(f.scene.id).toBe("arrives");
    expect(f.task.status).toBe("Backlog");
    expect(f.feed).toHaveLength(0);
    expect(Object.values(f.lamps).every((l) => l === "off")).toBe(true);
  });

  it("grows the feed monotonically, in time order, without rewriting earlier lines", () => {
    let prev = stateAt(0).feed;
    for (let ms = 0; ms < TOTAL_MS; ms += 100) {
      const feed = stateAt(ms).feed;
      expect(feed.length).toBeGreaterThanOrEqual(prev.length);
      expect(feed.slice(0, prev.length)).toEqual(prev);
      for (let i = 1; i < feed.length; i++) expect(feed[i]!.at).toBeGreaterThanOrEqual(feed[i - 1]!.at);
      for (const line of feed) expect(line.at).toBeLessThanOrEqual(ms);
      prev = feed;
    }
  });

  it("lights the researcher, designer and developer lamps during scene 3", () => {
    const f = sceneEndFrame(2);
    expect(f.states.researcher).toBe("WORKING");
    expect(f.states.designer).toBe("WORKING");
    expect(f.states.developer).toBe("WORKING");
    expect([f.lamps.researcher, f.lamps.designer, f.lamps.developer]).toEqual(["on", "on", "on"]);
    expect(f.lamps["developer-2"]).toBe("off");
  });

  it("keeps all three delegation connectors live through scene 2 and drops each as its specialist starts", () => {
    const end2 = sceneEndFrame(1);
    expect(end2.connectors.map((c) => c.to).sort()).toEqual(["designer", "developer", "researcher"]);
    expect(end2.connectors.every((c) => c.active)).toBe(true);
    expect(stateAt(4000).connectors.length).toBeGreaterThanOrEqual(2);
    const s3 = SCENES[2]!;
    expect(stateAt(s3.start + 400).connectors.map((c) => c.to).sort()).toEqual(["designer", "developer"]);
    expect(sceneEndFrame(2).connectors).toHaveLength(0);
  });

  it("sends the artifact from the developer to the manager during review", () => {
    const review = SCENES[4]!;
    const f = stateAt(review.start + 800);
    expect(f.artifact).toMatchObject({ from: "developer", to: "manager" });
    expect(f.artifact!.start + f.artifact!.duration).toBeLessThanOrEqual(review.end);
  });

  it("uses product phrasing for feed lines", () => {
    const lines = stateAt(TOTAL_MS - 1).feed.map((l) => l.text);
    expect(lines).toContain("Morgan Hale planned ‘Build a landing page…’");
    expect(lines.some((l) => l.startsWith("Nour Hany picked up ‘Research competitor"))).toBe(true);
    expect(lines.some((l) => / handed ‘.+’ to /.test(l))).toBe(true);
  });

  it("shortens long titles at a word boundary", () => {
    expect(shortTitle("Build a landing page for my new product")).toBe("Build a landing page…");
    expect(shortTitle("Review the build")).toBe("Review the build");
  });
});

describe("hero floor geometry", () => {
  const g = buildFloorGeometry();

  it("matches the default 40x24 floor at a 16 unit tile", () => {
    expect(g.width).toBe(640);
    expect(g.height).toBe(384);
    expect(g.rooms.map((r) => r.name)).toEqual(["Manager's office", "Development", "Design", "Research", "Shared space", "QA lab", "Lounge"]);
  });

  it("seats every cast member at an existing desk inside the desk's room", () => {
    for (const m of HERO_CAST) {
      const desk = g.desks.find((d) => d.id === m.deskId);
      const seat = g.seats[m.deskId];
      expect(desk, m.id).toBeDefined();
      expect(seat, m.id).toBeDefined();
      const room = g.rooms[desk!.room]!;
      expect(seat!.feet.x).toBeGreaterThan(room.interior.x);
      expect(seat!.feet.x).toBeLessThan(room.interior.x + room.interior.w);
    }
    const desk = (id: string) => g.desks.find((d) => d.id === HERO_CAST.find((c) => c.id === id)!.deskId)!;
    expect(desk("manager").roomName).toBe("Manager's office");
    expect([desk("developer").roomName, desk("developer").slot]).toEqual(["Development", 1]);
    expect([desk("developer-2").roomName, desk("developer-2").slot]).toEqual(["Development", 4]);
    expect([desk("designer").roomName, desk("designer").slot]).toEqual(["Design", 0]);
    expect([desk("researcher").roomName, desk("researcher").slot]).toEqual(["Research", 0]);
    expect([desk("qa").roomName, desk("qa").slot]).toEqual(["QA lab", 0]);
  });

  it("finds door openings", () => {
    expect(g.doors.length).toBeGreaterThan(0);
    expect(g.doorMidpoints.length).toBeGreaterThan(0);
    expect(g.doorMidpoints.length).toBeLessThanOrEqual(g.doors.length);
  });
});
