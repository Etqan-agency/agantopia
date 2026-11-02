import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CreateCompanyInput, HireEmployeeInput, UpdateCompanyInput, UpdateProviderConnectionInput, UpsertLearningScheduleInput } from "./api";
import { patchSchema, TimeZone } from "./schema-utils";
import { LearningConfigSchema } from "./settings";

describe("patchSchema", () => {
  const S = z.object({ a: z.number().int().min(1).default(1), b: z.string().default("x"), c: z.boolean().optional() });

  it("parses {a:5} to {a:5} with no defaults injected", () => {
    expect(patchSchema(S).parse({ a: 5 })).toEqual({ a: 5 });
    expect(patchSchema(S).parse({})).toEqual({});
  });

  it("keeps field validations", () => {
    expect(patchSchema(S).safeParse({ a: 0 }).success).toBe(false);
    expect(patchSchema(S).safeParse({ b: 3 }).success).toBe(false);
  });

  it("zod .partial() would have injected defaults (regression guard)", () => {
    expect(S.partial().parse({ a: 5 })).toEqual({ a: 5, b: "x" });
  });

  it("company, provider and prompt patches carry only the sent fields", () => {
    expect(UpdateCompanyInput.parse({ settings: { maxConcurrentExecutions: 5 } })).toEqual({ settings: { maxConcurrentExecutions: 5 } });
    expect(UpdateProviderConnectionInput.parse({ settings: { maxTurns: 50 } })).toEqual({ settings: { maxTurns: 50 } });
    const hire = HireEmployeeInput.parse({ name: "Ada", specialty: "FRONTEND", prompt: { identity: "Me" } });
    expect(hire.prompt).toEqual({ identity: "Me" });
  });
});

describe("TimeZone", () => {
  it("accepts IANA names and rejects unknown ones", () => {
    expect(TimeZone.safeParse("Africa/Cairo").success).toBe(true);
    expect(TimeZone.safeParse("UTC").success).toBe(true);
    expect(TimeZone.safeParse("Mars/Olympus").success).toBe(false);
    expect(TimeZone.safeParse("'; DROP TABLE x; --").success).toBe(false);
  });

  it("is enforced on company, schedule and learning config inputs", () => {
    expect(CreateCompanyInput.safeParse({ name: "Co", timezone: "Nope/Zone" }).success).toBe(false);
    expect(CreateCompanyInput.parse({ name: "Co" }).timezone).toBe("Africa/Cairo");
    expect(UpdateCompanyInput.safeParse({ timezone: "Nope/Zone" }).success).toBe(false);
    expect(UpsertLearningScheduleInput.safeParse({ timezone: "Nope/Zone" }).success).toBe(false);
    expect(LearningConfigSchema.safeParse({ timezone: "Nope/Zone" }).success).toBe(false);
  });
});
