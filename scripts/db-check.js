// Drift check (spec 0001, AC-3): does the live database match prisma/schema.prisma?
// Exit 0 = no drift, 1 = drift, 2 = could not compare.
//
// Prisma 6 cannot declare the partial slot index, so `migrate diff` may propose
// dropping it. That one statement is allowed here, and the pg_indexes query proves
// the index is present and correct instead. Real diff output against a freshly
// migrated database (Prisma 6.16, 2026-10-07):
//
//   -- This is an empty migration.
//
// So Prisma 6 ignores the partial index entirely today; the allow rule is a guard
// for a future Prisma that starts reporting it. Drop the rule after upgrading to
// Prisma 7.4+ and declaring the index in the schema.

const { execFileSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const SLOT_INDEX = "appointments_doctorId_date_time_active_key";
const ALLOWED = [
  /^DROP INDEX "(public"\.")?appointments_doctorId_date_time_active_key";$/,
];

function diff() {
  try {
    return execFileSync(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "diff",
        "--from-schema-datasource",
        "prisma/schema.prisma",
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    console.error("db:check could not run prisma migrate diff:");
    console.error(e.stderr || e.message);
    process.exit(2);
  }
}

async function main() {
  const drift = diff()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--"))
    .filter((l) => !ALLOWED.some((re) => re.test(l)));

  if (drift.length) {
    console.error("db:check: the database differs from schema.prisma:");
    for (const l of drift) console.error(`  ${l}`);
    return 1;
  }

  const prisma = new PrismaClient();
  try {
    const rows =
      await prisma.$queryRaw`select indexdef from pg_indexes where schemaname = 'public' and indexname = ${SLOT_INDEX}`;
    const def = rows[0]?.indexdef ?? "";
    if (
      !def.includes("UNIQUE") ||
      !def.includes("WHERE (status <> 'CANCELLED'")
    ) {
      console.error(
        `db:check: slot index ${SLOT_INDEX} is ${def ? `wrong: ${def}` : "missing"}`,
      );
      return 1;
    }
  } catch (e) {
    console.error("db:check could not query pg_indexes:");
    console.error(e.message);
    return 2;
  } finally {
    await prisma.$disconnect();
  }

  console.log("db:check: no drift");
  return 0;
}

// Any unexpected throw means we could not compare: exit 2, never 1 or 0.
main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("db:check failed:", e.message);
    process.exit(2);
  },
);
