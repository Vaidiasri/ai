// Spec 0003 AC-3: only the allowlist may reach the unscoped client or raw SQL.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { CLINIC_OWNED_MODELS } = await import("./tenancy");

const ALLOWLIST = new Set([
  "src/lib/prisma.ts",
  "src/lib/tenancy.ts",
  "src/lib/services/patient-self.ts",
  "src/lib/services/doctors.ts",
  "src/lib/services/agent-session.ts",
  "src/lib/actions/platform.ts",
  "src/lib/actions/users.ts",
  "src/lib/actions/user.ts",
  "src/app/api/cron/purge-clinics/route.ts",
  "src/lib/tenancy.guard.test.ts",
  "src/lib/tenancy.db.test.ts",
]);

const FORBIDDEN = [
  /from\s+["'](?:@\/lib\/prisma|[./]*(?:src\/)?lib\/prisma)["']/,
  /import\(\s*["'](?:@\/lib\/prisma|[./]*(?:src\/)?lib\/prisma)["']\s*\)/,
  /require\(\s*["'](?:@\/lib\/prisma|[./]*(?:src\/)?lib\/prisma)["']\s*\)/,
  /\$(?:query|execute)Raw/,
  /new\s+PrismaClient\b/,
];

function violates(source: string) {
  return FORBIDDEN.some((re) => re.test(source));
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("tenancy guard", () => {
  it("catches each forbidden form", () => {
    expect(violates(`import { prisma } from "@/lib/prisma";`)).toBe(true);
    expect(violates(`import { prisma } from "../../lib/prisma";`)).toBe(true);
    expect(violates(`const { prisma } = await import("@/lib/prisma");`)).toBe(true);
    expect(violates("db.$queryRaw`SELECT 1`")).toBe(true);
    expect(violates("tx.$executeRawUnsafe('x')")).toBe(true);
    expect(violates("const c = new PrismaClient();")).toBe(true);
    expect(violates(`import { forClinic } from "@/lib/tenancy";`)).toBe(false);
  });

  it("finds no unscoped access outside the allowlist", () => {
    const root = process.cwd();
    const offenders = sources(join(root, "src"))
      .map((f) => relative(root, f).replaceAll("\\", "/"))
      .filter((f) => !ALLOWLIST.has(f))
      .filter((f) => violates(readFileSync(join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("scopes exactly the schema models that carry clinicId", () => {
    const withClinicId = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === "clinicId"))
      .map((m) => m.name)
      .sort();
    expect(withClinicId).toEqual([...CLINIC_OWNED_MODELS].sort());
  });
});
