import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { clinicPatientName, scopeArgs } = await import("./tenancy");

const A = "clinic_a";

describe("scopeArgs", () => {
  it("passes global models through untouched", () => {
    const args = { where: { clerkId: "x" } };
    expect(scopeArgs("User", "findUnique", args, A)).toBe(args);
    expect(scopeArgs("Specialty", "executeRaw", args, A)).toBe(args);
  });

  it.each([
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "count",
    "aggregate",
    "groupBy",
    "update",
    "updateMany",
    "delete",
    "deleteMany",
  ])("ANDs clinicId into where for %s", (op) => {
    expect(scopeArgs("Appointment", op, { where: { id: "1" } }, A).where).toEqual({
      id: "1",
      clinicId: A,
    });
  });

  it("adds a where when the caller gave none", () => {
    expect(scopeArgs("Doctor", "findMany", {}, A).where).toEqual({ clinicId: A });
  });

  it("keeps OR and AND filters intact beside clinicId", () => {
    const where = { OR: [{ name: "a" }, { name: "b" }] };
    expect(scopeArgs("Doctor", "findMany", { where }, A).where).toEqual({ ...where, clinicId: A });
  });

  it("sets clinicId on create, createMany, createManyAndReturn", () => {
    expect(scopeArgs("Branch", "create", { data: { name: "x" } }, A).data).toEqual({
      name: "x",
      clinicId: A,
    });
    for (const op of ["createMany", "createManyAndReturn"]) {
      expect(scopeArgs("Doctor", op, { data: [{ name: "x" }, { name: "y" }] }, A).data).toEqual([
        { name: "x", clinicId: A },
        { name: "y", clinicId: A },
      ]);
    }
  });

  it("scopes upsert where and create", () => {
    const out = scopeArgs(
      "ClinicPatient",
      "upsert",
      { where: { id: "p" }, create: { name: "n" }, update: {} },
      A,
    );
    expect(out.where).toEqual({ id: "p", clinicId: A });
    expect(out.create).toEqual({ name: "n", clinicId: A });
  });

  it("accepts an explicit matching clinicId", () => {
    expect(scopeArgs("Branch", "create", { data: { clinicId: A } }, A).data).toEqual({
      clinicId: A,
    });
  });

  it.each([
    ["create", { data: { clinicId: "clinic_b" } }],
    ["createMany", { data: [{ clinicId: A }, { clinicId: "clinic_b" }] }],
    ["findMany", { where: { clinicId: "clinic_b" } }],
    ["update", { where: { id: "1" }, data: { clinicId: "clinic_b" } }],
    ["upsert", { where: { id: "1" }, create: {}, update: { clinicId: "clinic_b" } }],
    ["create", { data: { clinic: { connect: { id: A } } } }],
  ])("throws on a foreign or relation clinic in %s", (op, args) => {
    expect(() => scopeArgs("Appointment", op, args, A)).toThrow(/Tenancy/);
  });

  it("fails closed on any other operation", () => {
    expect(() => scopeArgs("Appointment", "updateManyAndReturn", {}, A)).toThrow(/not allowed/);
  });

  it("does not mutate the caller's args", () => {
    const args = { where: { id: "1" } };
    scopeArgs("Doctor", "findFirst", args, A);
    expect(args).toEqual({ where: { id: "1" } });
  });
});

describe("clinicPatientName", () => {
  it.each([
    [{ firstName: "Vaibhav", lastName: null, email: "v@x.com" }, "Vaibhav"],
    [{ firstName: " A ", lastName: "B", email: "v@x.com" }, "A  B"],
    [{ firstName: null, lastName: null, email: "noname@x.com" }, "noname"],
    [{ firstName: null, lastName: null, email: "@x.com" }, "@x.com"],
  ])("%o -> %s", (user, name) => {
    expect(clinicPatientName(user)).toBe(name);
  });
});
