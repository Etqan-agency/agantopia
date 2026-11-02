import { describe, expect, it } from "vitest";
import {
  bridgeEdges,
  connectorDelayClass,
  delayClass,
  floorReducer,
  keyToMove,
  layerByDependencies,
  parallelWith,
  slotCenter,
  stageDelay,
  STAGE_STEP_MS,
  wrapIndex,
} from "./sequence";

describe("stage sequencing", () => {
  it("spaces stages by the step", () => {
    expect([0, 1, 2, 3, 4].map((i) => stageDelay(i))).toEqual([0, 700, 1400, 2100, 2800]);
    expect(stageDelay(2, 100)).toBe(200);
    expect(stageDelay(-3)).toBe(0);
    expect(STAGE_STEP_MS).toBe(700);
  });

  it("maps stages to literal delay classes and clamps", () => {
    expect(delayClass(0)).toBe("delay-0");
    expect(delayClass(2)).toBe("delay-[1400ms]");
    expect(delayClass(99)).toBe("delay-[4900ms]");
    expect(delayClass(-1)).toBe("delay-0");
    expect(connectorDelayClass(1)).toBe("[&>path:last-child]:delay-[700ms]");
  });
});

describe("roving navigation", () => {
  it("wraps indices", () => {
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(wrapIndex(1, 1, 3)).toBe(2);
    expect(wrapIndex(5, 0, 0)).toBe(0);
  });

  it("maps keys by orientation", () => {
    expect(keyToMove("ArrowDown", "vertical")).toEqual({ type: "next" });
    expect(keyToMove("ArrowRight", "vertical")).toBeNull();
    expect(keyToMove("ArrowLeft", "horizontal")).toEqual({ type: "prev" });
    expect(keyToMove("ArrowUp", "both")).toEqual({ type: "prev" });
    expect(keyToMove("Home")).toEqual({ type: "first" });
    expect(keyToMove("End")).toEqual({ type: "last" });
    expect(keyToMove("a")).toBeNull();
  });
});

describe("floorReducer", () => {
  const s = { selected: 0, count: 3 };

  it("selects within range", () => {
    expect(floorReducer(s, { type: "select", index: 2 }).selected).toBe(2);
    expect(floorReducer(s, { type: "select", index: 9 }).selected).toBe(2);
    expect(floorReducer(s, { type: "select", index: -4 }).selected).toBe(0);
  });

  it("moves with wrap-around and Home/End", () => {
    expect(floorReducer(s, { type: "prev" }).selected).toBe(2);
    expect(floorReducer({ selected: 2, count: 3 }, { type: "next" }).selected).toBe(0);
    expect(floorReducer({ selected: 1, count: 3 }, { type: "first" }).selected).toBe(0);
    expect(floorReducer(s, { type: "last" }).selected).toBe(2);
  });

  it("returns the same object when nothing changes", () => {
    expect(floorReducer(s, { type: "select", index: 0 })).toBe(s);
    const empty = { selected: 0, count: 0 };
    expect(floorReducer(empty, { type: "next" })).toBe(empty);
  });
});

describe("dependency layering", () => {
  const plan = [
    { id: "research" },
    { id: "design", dependsOn: ["research"] },
    { id: "api", dependsOn: ["research"] },
    { id: "build", dependsOn: ["design", "api"] },
    { id: "review", dependsOn: ["build"] },
  ];

  it("puts parallel work in the same column", () => {
    const layers = layerByDependencies(plan).map((l) => l.map((n) => n.id));
    expect(layers).toEqual([["research"], ["design", "api"], ["build"], ["review"]]);
    expect(parallelWith(layerByDependencies(plan), "design")).toEqual(["api"]);
    expect(parallelWith(layerByDependencies(plan), "build")).toEqual([]);
  });

  it("uses the longest path", () => {
    const layers = layerByDependencies([{ id: "a" }, { id: "b", dependsOn: ["a"] }, { id: "c", dependsOn: ["a", "b"] }]);
    expect(layers.map((l) => l.map((n) => n.id))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("rejects cycles and unknown ids", () => {
    expect(() => layerByDependencies([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }])).toThrow(/Circular/);
    expect(() => layerByDependencies([{ id: "a", dependsOn: ["x"] }])).toThrow(/Unknown/);
  });

  it("computes bridge edges between adjacent columns", () => {
    const [l0, l1, l2] = layerByDependencies(plan);
    expect(bridgeEdges(l0!, l1!)).toEqual([
      { from: "research", to: "design", y1: 50, y2: 25 },
      { from: "research", to: "api", y1: 50, y2: 75 },
    ]);
    expect(bridgeEdges(l1!, l2!)).toEqual([
      { from: "design", to: "build", y1: 25, y2: 50 },
      { from: "api", to: "build", y1: 75, y2: 50 },
    ]);
    expect(slotCenter(0, 0)).toBe(50);
  });
});
